import { generateObject } from 'ai';
import { deepseek } from '@ai-sdk/deepseek';
import { google } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createXai } from '@ai-sdk/xai';
import { z } from 'zod';
import { logger } from '../utils/logger';
import config from '../config/config';
import notificationService from './NotificationService';
import { LLMMessage, LLMCallOptions, LLMResponse } from '../types/index';

/**
 * AI 服务类
 * 负责通用的AI模型调用功能
 */
export class AiService {
  private model: any;
  private fallbackModel: any;
  private currentProvider: string = '';
  private fallbackProvider: string = '';
  private initialized: boolean = false;

  async initialize(): Promise<void> {
    if (this.initialized) {
      return; // 已经初始化过了
    }

    try {
      logger.info('🤖 正在初始化AI服务...');

      // 检查配置是否存在
      if (!config?.ai?.provider) {
        throw new Error('AI配置不存在或provider未设置');
      }

      // 初始化主provider
      this.currentProvider = config.ai.provider;
      this.model = await this.createModel(this.currentProvider);
      logger.info(`✅ 主Provider初始化完成: ${this.currentProvider}`);

      // 初始化备用provider（如果配置了且与主provider不同）
      if (config.ai.fallbackProvider && config.ai.fallbackProvider !== this.currentProvider) {
        try {
          this.fallbackProvider = config.ai.fallbackProvider;
          this.fallbackModel = await this.createModel(this.fallbackProvider);
          logger.info(`✅ 备用Provider初始化完成: ${this.fallbackProvider}`);
        } catch (fallbackError: any) {
          logger.warn(`⚠️ 备用Provider初始化失败: ${this.fallbackProvider}`, fallbackError.message);
          this.fallbackModel = null;
          this.fallbackProvider = '';
        }
      }

      this.initialized = true;
      logger.info('✅ AI服务初始化完成');
    } catch (error: any) {
      logger.error('❌ AI服务初始化失败:', error);

      // 发送AI服务初始化失败通知
      try {
        await notificationService.sendAiServiceFailureNotification(
          config?.ai?.provider || 'unknown',
          (config?.ai?.[config.ai.provider as keyof typeof config.ai] as any)?.model || 'unknown',
          error.message || 'AI服务初始化失败'
        );
      } catch (notifyError) {
        logger.error('发送AI服务失败通知失败:', notifyError);
      }

      this.initialized = false;
      throw error;
    }
  }

  /**
   * 创建指定provider的模型
   */
  private async createModel(providerName: string): Promise<any> {
    switch (providerName) {
      case 'deepseek':
        if (!config.ai.deepseek?.model) {
          throw new Error('DeepSeek模型配置不存在');
        }
        logger.info(`创建 DeepSeek 模型: ${config.ai.deepseek.model}`);
        return deepseek(config.ai.deepseek.model);

      case 'google':
        if (!config.ai.google?.model) {
          throw new Error('Google模型配置不存在');
        }
        logger.info(`创建 Google 模型: ${config.ai.google.model}`);
        return google(config.ai.google.model);

      case 'qwen':
        if (!config.ai.qwen?.model || !config.ai.qwen?.apiKey) {
          throw new Error('千问模型配置不存在');
        }
        // 创建千问OpenAI兼容客户端
        const qwenOpenAI = createOpenAI({
          apiKey: config.ai.qwen.apiKey,
          baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        });
        logger.info(`创建 千问 模型: ${config.ai.qwen.model}`);
        return qwenOpenAI(config.ai.qwen.model);

      case 'xai':
        if (!config.ai.xai?.model || !config.ai.xai?.apiKey) {
          throw new Error('xAI模型配置不存在');
        }
        // 使用专门的 xAI SDK
        const xai = createXai({
          apiKey: config.ai.xai.apiKey,
        });
        logger.info(`创建 xAI 模型: ${config.ai.xai.model}`);
        return xai(config.ai.xai.model);

      default:
        throw new Error(`不支持的AI提供商: ${providerName}`);
    }
  }

  /**
   * 调用LLM并返回JSON响应 - 支持备用provider
   */
  async callLLMWithJsonResponse<T = any>(
    messages: LLMMessage[],
    options: LLMCallOptions = {}
  ): Promise<LLMResponse<T>> {
    // 确保AI服务已初始化
    if (!this.initialized) {
      logger.info('AI服务未初始化，正在自动初始化...');
      await this.initialize();
    }

    // 尝试使用主provider
    try {
      return await this.callWithProvider(this.model, this.currentProvider, messages, options);
    } catch (primaryError: any) {
      logger.warn(`🔄 主Provider(${this.currentProvider})调用失败: ${primaryError.message}`);

      // 如果有备用provider，尝试使用
      if (this.fallbackModel && this.fallbackProvider) {
        logger.info(`🔄 切换到备用Provider: ${this.fallbackProvider}`);
        try {
          const result = await this.callWithProvider(this.fallbackModel, this.fallbackProvider, messages, options);
          logger.info(`✅ 备用Provider(${this.fallbackProvider})调用成功`);
          return result;
                 } catch (fallbackError: any) {
           logger.error(`❌ 备用Provider(${this.fallbackProvider})也失败: ${fallbackError.message}`);
           
           // 不在这里发送通知，由上层EntityExtractionService在最终失败时统一发送
           // 返回主provider的错误（通常更有意义）
           return {
             success: false,
             error: `主Provider失败: ${primaryError.message}; 备用Provider失败: ${fallbackError.message}`,
           };
         }
             } else {
         logger.warn('⚠️ 没有可用的备用Provider');
         
         // 不在这里发送通知，由上层EntityExtractionService在最终失败时统一发送
         return {
           success: false,
           error: primaryError.message || 'LLM JSON调用失败',
         };
       }
    }
  }

  /**
   * 使用指定provider调用LLM
   */
  private async callWithProvider<T = any>(
    model: any,
    providerName: string,
    messages: LLMMessage[],
    options: LLMCallOptions = {}
  ): Promise<LLMResponse<T>> {
    if (!model) {
      throw new Error(`${providerName} 模型未正确初始化`);
    }

    const {
      temperature = 0.7,
      timeout = 10 * 60 * 1000, // 默认10分钟超时
      schema,
    } = options;

    logger.debug(`调用LLM (${providerName}):`, {
      messageCount: messages.length,
      firstMessage: messages[0]?.content?.substring(0, 100) + '...',
      options: { ...options, schema: schema ? 'provided' : 'default' },
      provider: providerName,
    });

    // 将messages转换为prompt格式
    const prompt = messages
      .filter(msg => msg.role === 'user')
      .map(msg => msg.content)
      .join('\n\n');

    const systemMessage =
      messages.find(msg => msg.role === 'system')?.content || '你是一个专业的AI助手。';

    // 使用传入的schema，如果没有传入则使用默认宽松schema
    const schemaToUse = schema || z.object({}).passthrough();

    // 创建LLM调用Promise
    const llmPromise = async () => {
      try {
        return await generateObject({
          model,
          prompt,
          temperature,
          system: systemMessage,
          schema: schemaToUse,
        });
      } catch (error: any) {
        // 如果generateObject失败，尝试从错误信息中解析JSON
        if (error.text) {
          try {
            return {
              object: JSON.parse(error.text),
              usage: undefined,
            };
          } catch (parseError) {
            throw error;
          }
        }
        throw error;
      }
    };

    // 使用Promise.race来实现超时控制
    const result = await Promise.race([llmPromise(), this.createTimeoutPromise(timeout)]);

    // 解析结果
    let parsedData: T;
    try {
      // 如果result.object是字符串，尝试解析为JSON
      if (typeof result.object === 'string') {
        parsedData = JSON.parse(result.object) as T;
      } else {
        parsedData = result.object as T;
      }
    } catch (parseError) {
      // 如果解析失败，返回原始对象
      parsedData = result.object as T;
    }

    logger.debug(`LLM JSON响应成功 (${providerName}):`, {
      hasObject: !!result.object,
      usage: result.usage,
    });

    return {
      success: true,
      data: parsedData,
      usage: result.usage
        ? {
            promptTokens: result.usage.promptTokens,
            completionTokens: result.usage.completionTokens,
            totalTokens: result.usage.totalTokens,
          }
        : undefined,
    };
  }

  /**
   * 创建超时Promise
   */
  private createTimeoutPromise(timeoutMs: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`LLM调用超时 (${timeoutMs}ms)`));
      }, timeoutMs);
    });
  }

  /**
   * 获取初始化状态
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * 重置AI服务（用于错误恢复）
   */
  reset(): void {
    this.initialized = false;
    this.model = null;
    this.fallbackModel = null;
    this.currentProvider = '';
    this.fallbackProvider = '';
    logger.info('AI服务已重置');
  }

  /**
   * 获取当前使用的provider信息
   */
  getProviderInfo(): { current: string; fallback: string; hasFallback: boolean } {
    return {
      current: this.currentProvider,
      fallback: this.fallbackProvider,
      hasFallback: !!(this.fallbackModel && this.fallbackProvider),
    };
  }
}

export default new AiService();

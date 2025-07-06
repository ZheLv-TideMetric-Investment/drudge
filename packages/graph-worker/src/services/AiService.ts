import { generateObject } from 'ai';
import { deepseek } from '@ai-sdk/deepseek';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { logger } from '../utils/logger';
import config from '../config/config';
import { LLMMessage, LLMCallOptions, LLMResponse } from '../types/index';

/**
 * AI 服务类
 * 负责通用的AI模型调用功能
 */
export class AiService {
  private model: any;
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

      // 根据配置选择模型
      if (config.ai.provider === 'deepseek') {
        if (!config.ai.deepseek?.model) {
          throw new Error('DeepSeek模型配置不存在');
        }
        this.model = deepseek(config.ai.deepseek.model);
        logger.info(`使用 DeepSeek 模型: ${config.ai.deepseek.model}`);
      } else if (config.ai.provider === 'google') {
        if (!config.ai.google?.model) {
          throw new Error('Google模型配置不存在');
        }
        this.model = google(config.ai.google.model);
        logger.info(`使用 Google 模型: ${config.ai.google.model}`);
      } else {
        throw new Error(`不支持的AI提供商: ${config.ai.provider}`);
      }

      this.initialized = true;
      logger.info('✅ AI服务初始化完成');
    } catch (error) {
      logger.error('❌ AI服务初始化失败:', error);
      this.initialized = false;
      throw error;
    }
  }

  /**
   * 调用LLM并返回JSON响应
   */
  async callLLMWithJsonResponse<T = any>(
    messages: LLMMessage[],
    options: LLMCallOptions = {}
  ): Promise<LLMResponse<T>> {
    try {
      // 确保AI服务已初始化
      if (!this.initialized) {
        logger.info('AI服务未初始化，正在自动初始化...');
        await this.initialize();
      }

      // 双重检查模型是否存在
      if (!this.model) {
        throw new Error('AI模型未正确初始化');
      }

      const {
        temperature = 0.7,
        timeout = 10 * 60 * 1000, // 默认10分钟超时
        schema
      } = options;

      logger.debug('调用LLM (JSON):', {
        messageCount: messages.length,
        firstMessage: messages[0]?.content?.substring(0, 100) + '...',
        options: { ...options, schema: schema ? 'provided' : 'default' },
        modelProvider: config?.ai?.provider
      });

      // 将messages转换为prompt格式
      const prompt = messages
        .filter(msg => msg.role === 'user')
        .map(msg => msg.content)
        .join('\n\n');

      const systemMessage = messages.find(msg => msg.role === 'system')?.content || '你是一个专业的AI助手。';

      // 使用传入的schema，如果没有传入则使用默认宽松schema
      const schemaToUse = schema || z.object({}).passthrough();

      // 创建LLM调用Promise
      const llmPromise = generateObject({
        model: this.model,
        prompt,
        temperature,
        system: systemMessage,
        schema: schemaToUse,
      });

      // 使用Promise.race来实现超时控制
      const result = await Promise.race([
        llmPromise,
        this.createTimeoutPromise(timeout)
      ]);

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

      logger.debug('LLM JSON响应成功:', {
        hasObject: !!result.object,
        usage: result.usage
      });

      return {
        success: true,
        data: parsedData,
        usage: result.usage ? {
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
          totalTokens: result.usage.totalTokens
        } : undefined
      };

    } catch (error: any) {
      logger.error('LLM JSON调用失败:', error);
      
      // 如果是初始化相关错误，重置状态
      if (error.message?.includes('provider') || error.message?.includes('模型') || error.message?.includes('配置')) {
        this.initialized = false;
        this.model = null;
      }
      
      return {
        success: false,
        error: error.message || 'LLM JSON调用失败'
      };
    }
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
    logger.info('AI服务已重置');
  }
}

export default new AiService(); 
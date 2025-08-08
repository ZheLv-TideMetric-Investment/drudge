// AI SDK imports
import { generateObject, generateText } from 'ai';
import { deepseek } from '@ai-sdk/deepseek';
import { google } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { xai } from '@ai-sdk/xai';
import { z } from 'zod';
import { config } from '../config';
import { notificationService } from '../services/notification';
import { LLMMessage, LLMCallOptions, LLMResponse } from '../../types/llm';

/**
 * 创建消息格式
 */
export function createMessages(systemPrompt: string, userPrompt: string): LLMMessage[] {
  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];
}

/**
 * AI 服务类
 * 负责通用的AI模型调用功能
 */
class AiService {
  private model: any;
  private simpleModel: any;
  private initialized: boolean = false;
  private mockMode: boolean = false;

  async initialize(): Promise<void> {
    if (this.initialized) {
      return; // 已经初始化过了
    }

    try {
      console.log('🤖 正在初始化AI服务...');

      // 初始化主AI提供商
      const provider = config.ai.provider;
      this.model = await this.createModel(provider);
      console.log(`✅ 主AI服务初始化完成: ${provider} - ${this.getModelName()}`);

      // 初始化简单AI提供商
      const simpleProvider = config.ai.simpleProvider;
      try {
        this.simpleModel = await this.createModel(simpleProvider);
        console.log(`✅ 简单AI服务初始化完成: ${simpleProvider} - ${this.getSimpleModelName()}`);
      } catch (simpleError: any) {
        console.warn(`⚠️ 简单AI服务初始化失败，将使用主模型: ${simpleError.message}`);
        this.simpleModel = this.model;
      }

      this.initialized = true;
      this.mockMode = false;
      console.log('✅ AI服务完全初始化完成');
    } catch (error: any) {
      console.error('❌ AI服务初始化失败，切换到模拟模式:', error);

      // 切换到模拟模式
      this.model = { provider: 'mock' };
      this.simpleModel = { provider: 'mock' }; // 同时设置简单模型
      this.initialized = true;
      this.mockMode = true;

      // 发送AI服务初始化失败通知
      try {
        await notificationService.sendSystemAlert(
          `AI服务初始化失败，已切换到模拟模式: ${config?.ai?.provider || 'unknown'}`,
          `模型: ${this.getModelName()}\n错误: ${error.message || 'AI服务初始化失败'}`
        );
      } catch (notifyError) {
        console.error('发送AI服务失败通知失败:', notifyError);
      }
    }
  }

  /**
   * 创建指定provider的模型
   */
  async createModel(providerName: string): Promise<any> {
    switch (providerName) {
      case 'deepseek':
        if (!config.ai.deepseek.apiKey) {
          throw new Error('DeepSeek API Key 未配置');
        }
        // 设置环境变量给DeepSeek SDK使用
        process.env.DEEPSEEK_API_KEY = config.ai.deepseek.apiKey;
        return deepseek(config.ai.deepseek.model);

      case 'google':
        if (!config.ai.google.apiKey) {
          throw new Error('Google API Key 未配置');
        }
        // 设置环境变量给Google SDK使用
        process.env.GOOGLE_GENERATIVE_AI_API_KEY = config.ai.google.apiKey;
        return google(config.ai.google.model);

      case 'qwen':
        if (!config.ai.qwen.apiKey) {
          throw new Error('Qwen API Key 未配置');
        }
        // 千问使用OpenAI兼容接口
        const qwen = createOpenAI({
          apiKey: config.ai.qwen.apiKey,
          baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        });
        return qwen(config.ai.qwen.model);

      case 'xai':
        if (!config.ai.xai.apiKey) {
          throw new Error('xAI API Key 未配置');
        }
        // 设置环境变量给xAI SDK使用
        process.env.XAI_API_KEY = config.ai.xai.apiKey;
        return xai(config.ai.xai.model);

      default:
        throw new Error(`不支持的AI提供商: ${providerName}`);
    }
  }

  /**
   * 获取当前模型名称
   */
  private getModelName(): string {
    if (this.mockMode) return 'mock';

    const provider = config.ai.provider;
    switch (provider) {
      case 'deepseek':
        return config.ai.deepseek.model;
      case 'google':
        return config.ai.google.model;
      case 'qwen':
        return config.ai.qwen.model;
      case 'xai':
        return config.ai.xai.model;
      default:
        return 'unknown';
    }
  }

  /**
   * 获取简单模型名称
   */
  private getSimpleModelName(): string {
    if (this.mockMode) return 'mock';

    const provider = config.ai.simpleProvider;
    switch (provider) {
      case 'deepseek':
        return config.ai.deepseek.model;
      case 'google':
        return config.ai.google.model;
      case 'qwen':
        return config.ai.qwen.model;
      case 'xai':
        return config.ai.xai.model;
      default:
        return 'unknown';
    }
  }

  async callLLM(
    messages: LLMMessage[],
    options: LLMCallOptions = {}
  ): Promise<LLMResponse<string>> {
    try {
      // 确保AI服务已初始化
      if (!this.initialized) {
        console.log('AI服务未初始化，正在自动初始化...');
        await this.initialize();
      }

      // 如果是模拟模式，返回模拟响应
      if (this.mockMode) {
        return this.getMockResponse<string>(messages, options);
      }

      // 真实AI调用
      console.log(`🤖 调用AI: ${config.ai.provider} - ${this.getModelName()}`);
      console.log('消息数量:', messages.length);

      // 构建消息格式
      const formattedMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      // 调用AI生成对象
      const result = await generateText({
        model: this.model,
        messages: formattedMessages,
        temperature: options.temperature || 0.7,
        // timeout: options.timeout || 30000, // 30秒超时
      });

      console.log('✅ AI调用成功');

      return {
        success: true,
        data: result.text,
        usage: result.usage
          ? {
              promptTokens: result.usage.promptTokens,
              completionTokens: result.usage.completionTokens,
              totalTokens: result.usage.totalTokens,
            }
          : undefined,
      };
    } catch (error: any) {
      console.error('❌ LLM调用失败:', error);

      // 发送AI服务调用失败通知
      try {
        await notificationService.sendSystemAlert(
          `AI服务调用失败: ${config?.ai?.provider || 'unknown'}`,
          `模型: ${this.getModelName()}\n错误: ${error.message || 'LLM调用失败'}`
        );
      } catch (notifyError) {
        console.error('发送AI服务调用失败通知失败:', notifyError);
      }

      // 如果真实调用失败，尝试返回模拟响应
      if (!this.mockMode) {
        console.warn('真实AI调用失败，返回模拟响应');
        return this.getMockResponse<string>(messages, options);
      }

      return {
        success: false,
        error: error.message || 'LLM调用失败',
      };
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
        console.log('AI服务未初始化，正在自动初始化...');
        await this.initialize();
      }

      // 如果是模拟模式，返回模拟响应
      if (this.mockMode) {
        return this.getMockResponse<T>(messages, options);
      }

      // 真实AI调用
      console.log(`🤖 调用AI: ${config.ai.provider} - ${this.getModelName()}`);
      console.log('消息数量:', messages.length);

      // 构建消息格式
      const formattedMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      // 设置默认schema
      const schema = options.schema || z.object({});

      // 调用AI生成对象
      const result = await generateObject({
        model: this.model,
        messages: formattedMessages,
        schema: schema,
        temperature: options.temperature || 0.7,
        // timeout: options.timeout || 30000, // 30秒超时
      });

      console.log('✅ AI调用成功');

      return {
        success: true,
        data: result.object as T,
        usage: result.usage
          ? {
              promptTokens: result.usage.promptTokens,
              completionTokens: result.usage.completionTokens,
              totalTokens: result.usage.totalTokens,
            }
          : undefined,
      };
    } catch (error: any) {
      console.error('❌ LLM调用失败:', error);

      // 发送AI服务调用失败通知
      try {
        await notificationService.sendSystemAlert(
          `AI服务调用失败: ${config?.ai?.provider || 'unknown'}`,
          `模型: ${this.getModelName()}\n错误: ${error.message || 'LLM调用失败'}`
        );
      } catch (notifyError) {
        console.error('发送AI服务调用失败通知失败:', notifyError);
      }

      // 如果真实调用失败，尝试返回模拟响应
      if (!this.mockMode) {
        console.warn('真实AI调用失败，返回模拟响应');
        return this.getMockResponse<T>(messages, options);
      }

      return {
        success: false,
        error: error.message || 'LLM调用失败',
      };
    }
  }

  /**
   * 调用简单AI处理简单任务
   */
  async callSimpleAI<T = any>(
    messages: LLMMessage[],
    options: LLMCallOptions = {}
  ): Promise<LLMResponse<T>> {
    try {
      // 确保AI服务已初始化
      if (!this.initialized) {
        console.log('AI服务未初始化，正在自动初始化...');
        await this.initialize();
      }

      // 如果是模拟模式，返回模拟响应
      if (this.mockMode) {
        return this.getMockResponse<T>(messages, options);
      }

      // 使用简单AI模型调用
      console.log(`🚀 调用简单AI: ${config.ai.simpleProvider} - ${this.getSimpleModelName()}`);
      console.log('消息数量:', messages.length);

      // 构建消息格式
      const formattedMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      let result;

      // 根据是否需要JSON响应来选择生成方法
      if (options.schema) {
        // 使用 generateObject 生成结构化响应
        result = await generateObject({
          model: this.simpleModel,
          messages: formattedMessages,
          schema: options.schema,
          temperature: options.temperature || 0.3, // 简单任务使用较低温度
        });

        return {
          success: true,
          data: result.object as T,
          usage: result.usage
            ? {
                promptTokens: result.usage.promptTokens,
                completionTokens: result.usage.completionTokens,
                totalTokens: result.usage.totalTokens,
              }
            : undefined,
        };
      } else {
        // 使用 generateText 生成文本响应
        result = await generateText({
          model: this.simpleModel,
          messages: formattedMessages,
          temperature: options.temperature || 0.3, // 简单任务使用较低温度
        });

        return {
          success: true,
          data: result.text as T,
          usage: result.usage
            ? {
                promptTokens: result.usage.promptTokens,
                completionTokens: result.usage.completionTokens,
                totalTokens: result.usage.totalTokens,
              }
            : undefined,
        };
      }
    } catch (error: any) {
      console.error('❌ 简单AI调用失败:', error);

      // 发送AI服务调用失败通知
      try {
        await notificationService.sendSystemAlert(
          `简单AI服务调用失败: ${config?.ai?.simpleProvider || 'unknown'}`,
          `模型: ${this.getSimpleModelName()}\n错误: ${error.message || '简单AI调用失败'}`
        );
      } catch (notifyError) {
        console.error('发送简单AI服务调用失败通知失败:', notifyError);
      }

      // 如果简单AI调用失败，尝试使用主AI
      if (!this.mockMode) {
        console.warn('简单AI调用失败，尝试使用主AI');
        if (options.schema) {
          return this.callLLMWithJsonResponse<T>(messages, options);
        } else {
          return this.callLLM(messages, options) as Promise<LLMResponse<T>>;
        }
      }

      return {
        success: false,
        error: error.message || '简单AI调用失败',
      };
    }
  }

  /**
   * 获取模拟响应
   */
  private getMockResponse<T>(messages: LLMMessage[], options: LLMCallOptions): LLMResponse<T> {
    console.warn('⚠️  使用AI模拟响应');
    console.log('模拟AI调用:', {
      messageCount: messages.length,
      firstMessage: messages[0]?.content?.substring(0, 100) + '...',
      options: { ...options, schema: options.schema ? 'provided' : 'default' },
      modelProvider: 'mock',
    });

    // 模拟响应结构
    const mockResponse = {
      overall_summary: '本时段新闻情况正常（模拟响应）',
      key_highlights: ['重要事件1（模拟）', '重要事件2（模拟）'],
      market_impact: '市场影响较小（模拟）',
      focus_areas: ['关注点1（模拟）', '关注点2（模拟）'],
      severity_assessment: 'low' as const,
      confidence: 0.8,
    };

    return {
      success: true,
      data: mockResponse as T,
      usage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      },
    };
  }

  /**
   * 获取初始化状态
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * 检查是否为模拟模式
   */
  isMockMode(): boolean {
    return this.mockMode;
  }

  /**
   * 获取当前提供商信息
   */
  getProviderInfo(): {
    provider: string;
    model: string;
    simpleProvider: string;
    simpleModel: string;
    mockMode: boolean;
  } {
    return {
      provider: config.ai.provider,
      model: this.getModelName(),
      simpleProvider: config.ai.simpleProvider,
      simpleModel: this.getSimpleModelName(),
      mockMode: this.mockMode,
    };
  }

  /**
   * 重置AI服务（用于错误恢复）
   */
  reset(): void {
    this.initialized = false;
    this.mockMode = false;
    this.model = null;
    this.simpleModel = null;
    console.log('AI服务已重置');
  }
}

// 创建单例实例
const aiService = new AiService();

/**
 * 验证 JSON 响应
 */
export function validateJsonResponse(
  data: unknown,
  schema: z.ZodSchema<unknown>
): { success: boolean; data?: unknown; error?: string } {
  try {
    const validated = schema.parse(data);
    return {
      success: true,
      data: validated,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('JSON 响应验证失败:', error);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

// 导出AI服务实例
export { aiService };

/**
 * 便捷的简单AI调用函数
 */
export const callSimpleAI = <T = any>(
  messages: LLMMessage[],
  options: LLMCallOptions = {}
): Promise<LLMResponse<T>> => {
  return aiService.callSimpleAI<T>(messages, options);
};

/**
 * 便捷的简单AI文本调用函数
 */
export const callSimpleAIText = async (
  systemPrompt: string,
  userPrompt: string,
  options: Omit<LLMCallOptions, 'schema'> = {}
): Promise<LLMResponse<string>> => {
  const messages = createMessages(systemPrompt, userPrompt);
  return aiService.callSimpleAI<string>(messages, options);
};

/**
 * 便捷的简单AI JSON调用函数
 */
export const callSimpleAIWithJson = async <T = any>(
  systemPrompt: string,
  userPrompt: string,
  schema: LLMCallOptions['schema'],
  options: Omit<LLMCallOptions, 'schema'> = {}
): Promise<LLMResponse<T>> => {
  const messages = createMessages(systemPrompt, userPrompt);
  return aiService.callSimpleAI<T>(messages, { ...options, schema });
};

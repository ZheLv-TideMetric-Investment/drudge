// AI SDK imports
import { generateObject, generateText } from 'ai';
import { deepseek } from '@ai-sdk/deepseek';
import { google } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
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
  private initialized: boolean = false;
  private mockMode: boolean = false;

  async initialize(): Promise<void> {
    if (this.initialized) {
      return; // 已经初始化过了
    }

    try {
      console.log('🤖 正在初始化AI服务...');

      // 根据配置选择AI提供商
      const provider = config.ai.provider;

      switch (provider) {
        case 'deepseek':
          if (!config.ai.deepseek.apiKey) {
            throw new Error('DeepSeek API Key 未配置');
          }
          // 设置环境变量给DeepSeek SDK使用
          process.env.DEEPSEEK_API_KEY = config.ai.deepseek.apiKey;
          this.model = deepseek(config.ai.deepseek.model);
          break;

        case 'google':
          if (!config.ai.google.apiKey) {
            throw new Error('Google API Key 未配置');
          }
          // 设置环境变量给Google SDK使用
          process.env.GOOGLE_GENERATIVE_AI_API_KEY = config.ai.google.apiKey;
          this.model = google(config.ai.google.model);
          break;

        case 'qwen':
          if (!config.ai.qwen.apiKey) {
            throw new Error('Qwen API Key 未配置');
          }
          // 千问使用OpenAI兼容接口
          const qwen = createOpenAI({
            apiKey: config.ai.qwen.apiKey,
            baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
          });
          this.model = qwen(config.ai.qwen.model);
          break;

        default:
          throw new Error(`不支持的AI提供商: ${provider}`);
      }

      this.initialized = true;
      this.mockMode = false;
      console.log(`✅ AI服务初始化完成: ${provider} - ${this.getModelName()}`);
    } catch (error: any) {
      console.error('❌ AI服务初始化失败，切换到模拟模式:', error);

      // 切换到模拟模式
      this.model = { provider: 'mock' };
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
      const schema =
        options.schema ||
        z.object({
          overall_summary: z.string().describe('整体总结'),
          key_highlights: z.array(z.string()).describe('关键亮点'),
          market_impact: z.string().describe('市场影响'),
          focus_areas: z.array(z.string()).describe('关注领域'),
          severity_assessment: z.enum(['low', 'medium', 'high']).describe('严重程度评估'),
          confidence: z.number().min(0).max(1).describe('置信度'),
        });

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
  getProviderInfo(): { provider: string; model: string; mockMode: boolean } {
    return {
      provider: config.ai.provider,
      model: this.getModelName(),
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

// AI SDK imports
import { generateObject, generateText } from 'ai';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import {
  buildLLMLogMeta,
  createJsonBodyFetch,
  createMessages,
  getLLMErrorMessage,
  normalizeLLMUsage,
  parseJsonContent,
} from '@drudge/common';
import { z } from 'zod';
import { config } from '../config';
import { notificationService } from '../services/notification';
import { LLMMessage, LLMCallOptions, LLMResponse } from '../../types/llm';

export { createMessages };

/**
 * 模型包装器类 - 提供统一的call接口
 */
export class ModelWrapper {
  private rawModel: any;
  private providerName: string;
  private mockMode: boolean;
  private modelName?: string;

  constructor(rawModel: any, providerName: string, mockMode: boolean = false, modelName?: string) {
    this.rawModel = rawModel;
    this.providerName = providerName;
    this.mockMode = mockMode;
    this.modelName = modelName;
  }

  /**
   * 统一的call接口 - 返回文本响应
   */
  async call(messages: LLMMessage[], options: LLMCallOptions = {}): Promise<LLMResponse<string>> {
    if (this.mockMode) {
      return this.getMockTextResponse(messages, options);
    }

    // 如果是xAI且使用代理，直接调用代理API
    if (this.providerName === 'xai' && config.ai.xai?.proxyUrl) {
      return await this.callXAIProxyText(messages, options);
    }

    try {
      // 构建消息格式
      const formattedMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      // 调用AI生成文本
      const result = await generateText({
        model: this.rawModel,
        messages: formattedMessages,
        temperature: options.temperature || 0.7,
      });

      const usage = normalizeLLMUsage(result.usage);

      console.log(
        `✅ ${this.providerName} 模型调用成功`,
        buildLLMLogMeta({
          provider: this.providerName,
          model: this.modelName,
          mode: 'text',
          messages,
          options,
          usage,
        })
      );

      return {
        success: true,
        data: result.text,
        usage,
      };
    } catch (error: any) {
      console.error(
        `❌ ${this.providerName} 模型调用失败:`,
        buildLLMLogMeta({
          provider: this.providerName,
          model: this.modelName,
          mode: 'text',
          messages,
          options,
        }),
        error
      );
      return {
        success: false,
        error: getLLMErrorMessage(error, `${this.providerName} 模型调用失败`),
      };
    }
  }

  /**
   * JSON响应调用接口
   */
  async callWithJson<T = any>(
    messages: LLMMessage[],
    options: LLMCallOptions = {}
  ): Promise<LLMResponse<T>> {
    if (this.mockMode) {
      return this.getMockJsonResponse<T>(messages, options);
    }

    // 如果是xAI且使用代理，直接调用代理API
    if (this.providerName === 'xai' && config.ai.xai?.proxyUrl) {
      return await this.callXAIProxyJson<T>(messages, options);
    }

    try {
      // 构建消息格式
      const formattedMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      }));

      // 设置默认schema
      const schema = options.schema || z.object({});

      // 调用AI生成对象
      const result = await generateObject({
        model: this.rawModel,
        messages: formattedMessages,
        schema: schema,
        temperature: options.temperature || 0.7,
      });

      const usage = normalizeLLMUsage(result.usage);

      const parsedResult = parseJsonContent(result.object);
      const parsedData = parsedResult.value as T;

      console.log(
        `✅ ${this.providerName} 模型JSON调用成功`,
        buildLLMLogMeta({
          provider: this.providerName,
          model: this.modelName,
          mode: 'json',
          messages,
          options,
          usage,
        })
      );

      return {
        success: true,
        data: parsedData,
        usage,
      };
    } catch (error: any) {
      console.error(
        `❌ ${this.providerName} 模型JSON调用失败:`,
        buildLLMLogMeta({
          provider: this.providerName,
          model: this.modelName,
          mode: 'json',
          messages,
          options,
        }),
        error
      );
      return {
        success: false,
        error: getLLMErrorMessage(error, `${this.providerName} 模型JSON调用失败`),
      };
    }
  }

  /**
   * 获取模拟文本响应
   */
  private getMockTextResponse(
    _messages: LLMMessage[],
    _options: LLMCallOptions
  ): LLMResponse<string> {
    console.warn(`⚠️ 使用${this.providerName}模拟文本响应`);
    return {
      success: true,
      data: `这是${this.providerName}的模拟响应：基于您的问题，我提供了一个模拟回答。`,
      usage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      },
    };
  }

  /**
   * 获取模拟JSON响应
   */
  private getMockJsonResponse<T>(
    _messages: LLMMessage[],
    _options: LLMCallOptions
  ): LLMResponse<T> {
    console.warn(`⚠️ 使用${this.providerName}模拟JSON响应`);
    const mockResponse = {
      message: `这是${this.providerName}的模拟JSON响应`,
      provider: this.providerName,
      timestamp: new Date().toISOString(),
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
   * 获取提供商信息
   */
  getProviderName(): string {
    return this.providerName;
  }

  /**
   * 检查是否为模拟模式
   */
  isMockMode(): boolean {
    return this.mockMode;
  }

  /**
   * 直接调用xAI代理服务 - 文本响应
   */
  private async callXAIProxyText(
    messages: LLMMessage[],
    options: LLMCallOptions = {}
  ): Promise<LLMResponse<string>> {
    const { temperature = 0.7, timeout = 10 * 60 * 1000 } = options;

    const proxyUrl = `${config.ai.xai!.proxyUrl}/v1/chat/completions`;

    console.log('调用xAI代理 (文本):', {
      url: proxyUrl,
      messageCount: messages.length,
      model: config.ai.xai!.model,
    });

    const requestBody = {
      model: config.ai.xai!.model,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
      // 基础性能参数 - 最强配置
      // max_completion_tokens: 32768, // 最大输出token数
      temperature,
      ...(config.ai.xai!.model === 'grok-4.3' ? { reasoning_effort: 'none' } : {}),
      // top_p: 0.95, // 核采样，保持创造性和准确性的平衡

      // // 日志概率 - 获取模型置信度信息
      // logprobs: true,
      // top_logprobs: 8, // 最大值，获得最详细的概率信息

      // 工具调用支持
      // parallel_tool_calls: true, // 支持并行工具调用
      // tool_choice: 'auto', // 自动选择是否使用工具

      // 搜索参数 - 最强搜索配置
      search_parameters: {
        max_search_results: 30, // 最大搜索结果数
        mode: 'on', // 始终搜索，获得最强搜索能力
        return_citations: true, // 返回引用信息
        sources: [
          {
            type: 'web',
            safe_search: false, // 不限制内容以获得更全面的结果
            country: null, // 不限制国家，获得全球信息
          },
          {
            type: 'news',
            safe_search: false, // 不限制内容
            country: null, // 不限制国家
          },
          {
            type: 'x',
            post_favorite_count: null, // 不限制收藏数，获得更多内容
            post_view_count: null, // 不限制查看数
          },
        ],
      },
    };

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, timeout);

    try {
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-xai-api-key': config.ai.xai!.apiKey,
        },
        body: JSON.stringify(requestBody),
        signal: abortController.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('xAI代理请求失败:', {
          status: response.status,
          statusText: response.statusText,
          errorText,
        });
        return {
          success: false,
          error: `xAI代理返回错误: ${response.status} ${response.statusText} - ${errorText}`,
        };
      }

      const responseData = (await response.json()) as {
        choices?: Array<{
          message?: {
            content?: string;
          };
        }>;
        model?: string;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
        };
      };

      console.log('xAI代理响应成功 (文本):', {
        model: responseData.model,
        usage: responseData.usage,
      });

      // 提取消息内容
      const content = responseData.choices?.[0]?.message?.content;
      if (!content) {
        return {
          success: false,
          error: 'xAI代理响应格式错误: 没有找到消息内容',
        };
      }

      return {
        success: true,
        data: content,
        usage: normalizeLLMUsage(responseData.usage),
      };
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        return {
          success: false,
          error: `xAI代理请求超时 (${timeout}ms)`,
        };
      }

      return {
        success: false,
        error: getLLMErrorMessage(error, 'xAI代理调用失败'),
      };
    }
  }

  /**
   * 直接调用xAI代理服务 - JSON响应
   */
  private async callXAIProxyJson<T = any>(
    messages: LLMMessage[],
    options: LLMCallOptions = {}
  ): Promise<LLMResponse<T>> {
    const { temperature = 0.7, timeout = 10 * 60 * 1000 } = options;

    const proxyUrl = `${config.ai.xai!.proxyUrl}/v1/chat/completions`;

    console.log('调用xAI代理 (JSON):', {
      url: proxyUrl,
      messageCount: messages.length,
      model: config.ai.xai!.model,
    });

    const requestBody = {
      model: config.ai.xai!.model,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
      // 基础性能参数 - 最强配置
      // max_completion_tokens: 32768, // 最大输出token数
      temperature,
      ...(config.ai.xai!.model === 'grok-4.3' ? { reasoning_effort: 'none' } : {}),
      // top_p: 0.95, // 核采样，保持创造性和准确性的平衡

      // 日志概率 - 获取模型置信度信息
      // logprobs: true,
      // top_logprobs: 8, // 最大值，获得最详细的概率信息

      // 工具调用支持
      // parallel_tool_calls: true, // 支持并行工具调用
      // tool_choice: 'auto', // 自动选择是否使用工具

      // JSON响应格式 - 强制JSON输出
      response_format: {
        type: 'json_object', // 确保返回有效的JSON格式
      },

      // 搜索参数 - 最强搜索配置
      search_parameters: {
        max_search_results: 30, // 最大搜索结果数
        mode: 'on', // 始终搜索，获得最强搜索能力
        return_citations: true, // 返回引用信息
        sources: [
          {
            type: 'web',
            safe_search: false, // 不限制内容以获得更全面的结果
            country: null, // 不限制国家，获得全球信息
          },
          {
            type: 'news',
            safe_search: false, // 不限制内容
            country: null, // 不限制国家
          },
          {
            type: 'x',
            post_favorite_count: null, // 不限制收藏数，获得更多内容
            post_view_count: null, // 不限制查看数
          },
        ],
      },
    };

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, timeout);

    try {
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-xai-api-key': config.ai.xai!.apiKey,
        },
        body: JSON.stringify(requestBody),
        signal: abortController.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('xAI代理请求失败:', {
          status: response.status,
          statusText: response.statusText,
          errorText,
        });
        return {
          success: false,
          error: `xAI代理返回错误: ${response.status} ${response.statusText} - ${errorText}`,
        };
      }

      const responseData = (await response.json()) as {
        choices?: Array<{
          message?: {
            content?: string;
          };
        }>;
        model?: string;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
        };
      };

      console.log('xAI代理响应成功 (JSON):', {
        model: responseData.model,
        usage: responseData.usage,
      });

      // 提取消息内容
      const content = responseData.choices?.[0]?.message?.content;
      if (!content) {
        return {
          success: false,
          error: 'xAI代理响应格式错误: 没有找到消息内容',
        };
      }

      // 解析结果 - 与AiService.ts保持一致的逻辑
      const parsedResult = parseJsonContent(content);
      let parsedData: T;
      if (parsedResult.parsed) {
        parsedData = parsedResult.value as T;
      } else {
        parsedData = { message: parsedResult.value as string } as T;
      }

      return {
        success: true,
        data: parsedData,
        usage: normalizeLLMUsage(responseData.usage),
      };
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        return {
          success: false,
          error: `xAI代理请求超时 (${timeout}ms)`,
        };
      }

      return {
        success: false,
        error: getLLMErrorMessage(error, 'xAI代理调用失败'),
      };
    }
  }

  /**
   * 获取原始模型（用于高级用法）
   */
  getRawModel(): any {
    return this.rawModel;
  }
}

/**
 * AI 服务类
 * 负责通用的AI模型调用功能
 */
class AiService {
  private model: ModelWrapper | null = null;
  private simpleModel: ModelWrapper | null = null;
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
      this.mockMode = this.model.isMockMode();
      console.log('✅ AI服务完全初始化完成');
    } catch (error: any) {
      console.error('❌ AI服务初始化失败，切换到模拟模式:', error);

      // 切换到模拟模式
      const providerName = config.ai.provider;
      const simpleProviderName = config.ai.simpleProvider;
      const providerModelName = this.resolveModelName(providerName);
      const simpleModelName = this.resolveModelName(simpleProviderName);

      this.model = new ModelWrapper({ provider: 'mock' }, providerName, true, providerModelName);
      this.simpleModel = new ModelWrapper(
        { provider: 'mock' },
        simpleProviderName,
        true,
        simpleModelName
      );
      this.initialized = true;
      this.mockMode = true;

      // 发送AI服务初始化失败通知
      try {
        await notificationService.sendSystemAlert(
          `AI服务初始化失败，已切换到模拟模式: ${providerName}`,
          `模型: ${this.getModelName()}\n错误: ${error.message || 'AI服务初始化失败'}`
        );
      } catch (notifyError) {
        console.error('发送AI服务失败通知失败:', notifyError);
      }
    }
  }

  /**
   * 创建指定provider的模型包装器
   */
  async createModel(providerName: string): Promise<ModelWrapper> {
    try {
      const rawModel = await this.createRawModel(providerName);
      const modelName = this.resolveModelName(providerName);
      return new ModelWrapper(rawModel, providerName, this.mockMode, modelName);
    } catch (error: any) {
      console.warn(`⚠️ 创建${providerName}模型失败，返回模拟模型:`, error.message);
      // 如果创建失败，返回模拟模式的ModelWrapper
      const modelName = this.resolveModelName(providerName);
      return new ModelWrapper({ provider: 'mock' }, providerName, true, modelName);
    }
  }

  /**
   * 创建原始AI SDK模型（内部方法）
   */
  private async createRawModel(providerName: string): Promise<any> {
    switch (providerName) {
      case 'deepseek':
        if (!config.ai.deepseek.apiKey) {
          throw new Error('DeepSeek API Key 未配置');
        }
        return createDeepSeek({
          apiKey: config.ai.deepseek.apiKey,
          fetch: createJsonBodyFetch({ thinking: { type: 'disabled' } }),
        }).chat(config.ai.deepseek.model);

      case 'google':
        if (!config.ai.google.apiKey) {
          throw new Error('Google API Key 未配置');
        }
        return createGoogleGenerativeAI({ apiKey: config.ai.google.apiKey }).chat(
          config.ai.google.model
        );

      case 'qwen':
        if (!config.ai.qwen.apiKey) {
          throw new Error('Qwen API Key 未配置');
        }
        // 千问使用OpenAI兼容接口
        const qwen = createOpenAI({
          apiKey: config.ai.qwen.apiKey,
          baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
          ...(config.ai.qwen.model.startsWith('qwen3')
            ? { fetch: createJsonBodyFetch({ enable_thinking: false }) }
            : {}),
        });
        return qwen(config.ai.qwen.model);

      case 'xai':
        if (!config.ai.xai.apiKey) {
          throw new Error('xAI API Key 未配置');
        }
        // 使用代理服务访问 xAI
        const xai = createOpenAI({
          apiKey: config.ai.xai.apiKey,
          baseURL: config.ai.xai.proxyUrl,
          headers: {
            'x-xai-api-key': config.ai.xai.apiKey,
          },
        });
        return xai(config.ai.xai.model);

      default:
        throw new Error(`不支持的AI提供商: ${providerName}`);
    }
  }

  /**
   * 获取当前模型名称
   */
  private resolveModelName(providerName: string): string {
    switch (providerName) {
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
   * 获取当前模型名称
   */
  private getModelName(): string {
    if (this.model?.isMockMode()) return 'mock';

    return this.resolveModelName(config.ai.provider);
  }

  /**
   * 获取简单模型名称
   */
  private getSimpleModelName(): string {
    if (this.simpleModel?.isMockMode()) return 'mock';

    return this.resolveModelName(config.ai.simpleProvider);
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

      if (!this.model) {
        throw new Error('主模型未初始化');
      }

      // 使用ModelWrapper的call方法
      return await this.model.call(messages, options);
    } catch (error: any) {
      console.error('❌ LLM调用失败:', error);

      // 发送AI服务调用失败通知
      try {
        await notificationService.sendSystemAlert(
          `AI服务调用失败: ${config.ai.provider}`,
          `模型: ${this.getModelName()}\n错误: ${error.message || 'LLM调用失败'}`
        );
      } catch (notifyError) {
        console.error('发送AI服务调用失败通知失败:', notifyError);
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

      if (!this.model) {
        throw new Error('主模型未初始化');
      }

      // 使用ModelWrapper的callWithJson方法
      return await this.model.callWithJson<T>(messages, options);
    } catch (error: any) {
      console.error('❌ LLM JSON调用失败:', error);

      // 发送AI服务调用失败通知
      try {
        await notificationService.sendSystemAlert(
          `AI服务调用失败: ${config.ai.provider}`,
          `模型: ${this.getModelName()}\n错误: ${error.message || 'LLM JSON调用失败'}`
        );
      } catch (notifyError) {
        console.error('发送AI服务调用失败通知失败:', notifyError);
      }

      return {
        success: false,
        error: error.message || 'LLM JSON调用失败',
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

      if (!this.simpleModel) {
        throw new Error('简单模型未初始化');
      }

      // 使用较低的温度进行简单任务
      const simpleOptions = { ...options, temperature: options.temperature || 0.3 };

      // 根据是否需要JSON响应来选择调用方法
      if (options.schema) {
        return await this.simpleModel.callWithJson<T>(messages, simpleOptions);
      } else {
        const result = await this.simpleModel.call(messages, simpleOptions);
        return result as LLMResponse<T>;
      }
    } catch (error: any) {
      console.error('❌ 简单AI调用失败:', error);

      // 发送AI服务调用失败通知
      try {
        await notificationService.sendSystemAlert(
          `简单AI服务调用失败: ${config.ai.simpleProvider}`,
          `模型: ${this.getSimpleModelName()}\n错误: ${error.message || '简单AI调用失败'}`
        );
      } catch (notifyError) {
        console.error('发送简单AI服务调用失败通知失败:', notifyError);
      }

      // 如果简单AI调用失败，尝试使用主AI
      if (this.model) {
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

// @ts-nocheck
import { generateText, generateObject } from 'ai';
import { deepseek } from '@ai-sdk/deepseek';
import { z } from 'zod';
import config from '../config/config';
import logger from './logger';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMCallOptions {
  temperature?: number;
  timeout?: number; // 超时时长（毫秒）
  schema?: z.ZodSchema<any>; // 可选的 zod schema
}

export interface LLMResponse {
  success: boolean;
  data?: string;
  error?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LLMJsonResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * 创建超时Promise
 */
function createTimeoutPromise(timeoutMs: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`LLM调用超时 (${timeoutMs}ms)`));
    }, timeoutMs);
  });
}

/**
 * 调用LLM并返回文本响应
 */
export async function callLLM(
  messages: LLMMessage[], 
  options: LLMCallOptions = {}
): Promise<LLMResponse> {
  try {
    // 验证messages参数
    if (!Array.isArray(messages) || messages.length === 0) {
      const errorMsg = 'messages参数必须是非空数组';
      logger.error(errorMsg, { messages });
      return {
        success: false,
        error: errorMsg
      };
    }

    // 验证每个message的格式
    for (const message of messages) {
      if (!message.role || !message.content || typeof message.content !== 'string') {
        const errorMsg = 'messages数组中的每个元素都必须包含role和content字段';
        logger.error(errorMsg, { message });
        return {
          success: false,
          error: errorMsg
        };
      }
    }

    const {
      temperature = 0.7,
      timeout = 10 * 60 * 1000 // 默认10分钟超时
    } = options;

    logger.debug('调用LLM:', { 
      messageCount: messages.length,
      firstMessage: messages[0]?.content?.substring(0, 100) + '...',
      options 
    });

    // 将messages转换为prompt格式
    const prompt = messages
      .filter(msg => msg.role === 'user')
      .map(msg => msg.content)
      .join('\n\n');

    const systemMessage = messages.find(msg => msg.role === 'system')?.content || '你是一个专业的AI助手。';

    // 创建LLM调用Promise
    const llmPromise = generateText({
      model: deepseek(config.ai.model),
      prompt,
      temperature,
      system: systemMessage,
    });

    // 使用Promise.race来实现超时控制
    const result = await Promise.race([
      llmPromise,
      createTimeoutPromise(timeout)
    ]);

    logger.debug('LLM响应成功:', { 
      textLength: result.text.length,
      usage: result.usage 
    });

    return {
      success: true,
      data: result.text,
      usage: result.usage ? {
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens
      } : undefined
    };

  } catch (error: any) {
    logger.error('LLM调用失败:', error);
    return {
      success: false,
      error: error.message || 'LLM调用失败'
    };
  }
}

/**
 * 调用LLM并返回JSON响应，使用generateObject
 */
export async function callLLMWithJsonResponse<T = any>(
  messages: LLMMessage[], 
  options: LLMCallOptions = {}
): Promise<LLMJsonResponse<T>> {
  try {
    // 验证messages参数
    if (!Array.isArray(messages) || messages.length === 0) {
      const errorMsg = 'messages参数必须是非空数组';
      logger.error(errorMsg, { messages });
      return {
        success: false,
        error: errorMsg
      };
    }

    // 验证每个message的格式
    for (const message of messages) {
      if (!message.role || !message.content || typeof message.content !== 'string') {
        const errorMsg = 'messages数组中的每个元素都必须包含role和content字段';
        logger.error(errorMsg, { message });
        return {
          success: false,
          error: errorMsg
        };
      }
    }

    const {
      temperature = 0.7,
      timeout = 10 * 60 * 1000, // 默认10分钟超时
      schema
    } = options;

    logger.debug('调用LLM (JSON):', { 
      messageCount: messages.length,
      firstMessage: messages[0]?.content?.substring(0, 100) + '...',
      options: { ...options, schema: schema ? 'provided' : 'default' }
    });

    // 将messages转换为prompt格式
    const prompt = messages
      .filter(msg => msg.role === 'user')
      .map(msg => msg.content)
      .join('\n\n');

    const systemMessage = messages.find(msg => msg.role === 'system')?.content || '你是一个专业的AI助手。';

    // 如果没有提供schema，使用默认的宽松schema
    const defaultSchema = z.object({}).passthrough();
    const actualSchema = schema || defaultSchema;

    // 创建LLM调用Promise
    const llmPromise = generateObject({
      model: deepseek(config.ai.model),
      prompt,
      temperature,
      system: systemMessage,
      schema: actualSchema,
    });

    // 使用Promise.race来实现超时控制
    const result = await Promise.race([
      llmPromise,
      createTimeoutPromise(timeout)
    ]);

    logger.debug('LLM JSON响应成功:', { 
      hasObject: !!result.object,
      usage: result.usage 
    });

    return {
      success: true,
      data: result.object as T,
      usage: result.usage ? {
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens
      } : undefined
    };

  } catch (error: any) {
    logger.error('LLM JSON调用失败:', error);
    return {
      success: false,
      error: error.message || 'LLM JSON调用失败'
    };
  }
}

/**
 * 调用LLM进行批量处理
 */
export async function callLLMBatch(
  messagesList: LLMMessage[][], 
  options: LLMCallOptions = {}
): Promise<LLMResponse[]> {
  const results: LLMResponse[] = [];
  
  for (const messages of messagesList) {
    const result = await callLLM(messages, options);
    results.push(result);
    
    // 添加延迟避免API限流
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return results;
}

/**
 * 工具函数：快速创建messages数组
 */
export function createMessages(systemPrompt?: string, userPrompt?: string): LLMMessage[] {
  const messages: LLMMessage[] = [];
  
  if (systemPrompt) {
    messages.push({
      role: 'system',
      content: systemPrompt
    });
  }
  
  if (userPrompt) {
    messages.push({
      role: 'user',
      content: userPrompt
    });
  }
  
  return messages;
}

/**
 * 工具函数：向messages数组添加消息
 */
export function addMessage(messages: LLMMessage[], role: 'system' | 'user' | 'assistant', content: string): LLMMessage[] {
  return [...messages, { role, content }];
}

/**
 * 工具函数：创建用于新闻级别评估的schema
 */
export function createNewsLevelSchema() {
  return z.object({
    level: z.number().min(1).max(5),
    reasoning: z.string(),
    confidence: z.number().min(0).max(1),
    urgency: z.enum(['low', 'medium', 'high', 'critical']),
  });
}

/**
 * 工具函数：创建用于摘要生成的schema
 */
export function createSummarySchema() {
  return z.object({
    summary: z.string(),
    key_points: z.array(z.string()),
    confidence: z.number().min(0).max(1),
  });
}

/**
 * 工具函数：创建用于特定数据结构的schema
 */
export function createEntityExtractionSchema() {
  return z.object({
    events: z.array(z.object({
      event_name: z.string(),
      event_description: z.string(),
      event_type: z.string(),
      significance: z.number(),
      sentiment: z.string(),
      magnitude: z.number(),
      event_level: z.string(),
    })).optional().default([]),
    companies: z.array(z.object({
      company_name: z.string(),
      ticker: z.string().optional(),
      industry: z.string().optional(),
      market: z.string().optional(),
      country: z.string().optional(),
    })).optional().default([]),
    persons: z.array(z.object({
      person_name: z.string(),
      title: z.string().optional(),
      company: z.string().optional(),
      nationality: z.string().optional(),
    })).optional().default([]),
    organizations: z.array(z.object({
      organization_name: z.string(),
      type: z.string().optional(),
      country: z.string().optional(),
    })).optional().default([]),
    locations: z.array(z.object({
      location_name: z.string(),
      type: z.string().optional(),
      country: z.string().optional(),
      region: z.string().optional(),
      coordinates: z.object({
        latitude: z.number(),
        longitude: z.number(),
      }).optional(),
    })).optional().default([]),
    times: z.array(z.object({
      time_value: z.string(),
      type: z.string().optional(),
      precision: z.string().optional(),
      timezone: z.string().optional(),
    })).optional().default([]),
    relationships: z.array(z.object({
      type: z.string(),
      from: z.string(),
      to: z.string(),
      description: z.string(),
    })).optional().default([]),
  });
}

/**
 * 工具函数：创建用于批量实体提取的schema
 */
export function createBatchEntityExtractionSchema() {
  return z.object({
    results: z.array(z.object({
      news_id: z.string(),
      events: z.array(z.object({
        event_name: z.string(),
        event_description: z.string(),
        event_type: z.string(),
        significance: z.number(),
        sentiment: z.string(),
        magnitude: z.number(),
        event_level: z.string(),
      })).optional().default([]),
      companies: z.array(z.object({
        company_name: z.string(),
        ticker: z.string().optional(),
        industry: z.string().optional(),
        market: z.string().optional(),
        country: z.string().optional(),
      })).optional().default([]),
      persons: z.array(z.object({
        person_name: z.string(),
        title: z.string().optional(),
        company: z.string().optional(),
        nationality: z.string().optional(),
      })).optional().default([]),
      organizations: z.array(z.object({
        organization_name: z.string(),
        type: z.string().optional(),
        country: z.string().optional(),
      })).optional().default([]),
      locations: z.array(z.object({
        location_name: z.string(),
        type: z.string().optional(),
        country: z.string().optional(),
        region: z.string().optional(),
        coordinates: z.object({
          latitude: z.number(),
          longitude: z.number(),
        }).optional(),
      })).optional().default([]),
      times: z.array(z.object({
        time_value: z.string(),
        type: z.string().optional(),
        precision: z.string().optional(),
        timezone: z.string().optional(),
      })).optional().default([]),
      relationships: z.array(z.object({
        type: z.string(),
        from: z.string(),
        to: z.string(),
        description: z.string(),
      })).optional().default([]),
    }))
  });
} 
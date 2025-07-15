import { z } from 'zod';

/**
 * LLM消息接口
 */
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * LLM调用选项
 */
export interface LLMCallOptions {
  temperature?: number;
  timeout?: number;
  schema?: z.ZodSchema<unknown>;
}

/**
 * LLM响应接口
 */
export interface LLMResponse<T = unknown> {
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
 * AI提供商类型
 */
export type AiProvider = 'deepseek' | 'google' | 'qwen'; 
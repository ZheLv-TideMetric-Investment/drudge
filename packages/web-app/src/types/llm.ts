import { z } from 'zod';
import type {
  LLMMessage as CommonLLMMessage,
  LLMCallOptions as CommonLLMCallOptions,
  LLMResponse as CommonLLMResponse
} from '@drudge/common';

export type LLMMessage = CommonLLMMessage;

export type LLMCallOptions = Omit<CommonLLMCallOptions, 'schema'> & {
  schema?: z.ZodSchema<unknown>;
};

export type LLMResponse<T = unknown> = CommonLLMResponse<T>;

/**
 * AI提供商类型
 */
export type AiProvider = 'deepseek' | 'google' | 'qwen'; 

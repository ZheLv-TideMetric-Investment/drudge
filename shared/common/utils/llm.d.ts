export type PromptMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type LLMMessage = PromptMessage;

export type LLMUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export interface LLMCallOptions {
  temperature?: number;
  timeout?: number;
  schema?: any;
}

export interface LLMResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  usage?: LLMUsage;
}

export function createMessages(systemPrompt: string, userPrompt: string): PromptMessage[];

export function formatPromptFields(
  fields: Array<[string, string | number | boolean | null | undefined]>,
  options?: {
    separator?: string;
    joiner?: string;
  }
): string;

export function buildLLMLogMeta(params?: {
  provider?: string;
  model?: string;
  mode?: 'text' | 'json' | string;
  messages?: LLMMessage[];
  options?: LLMCallOptions;
  usage?: LLMUsage;
}): {
  provider?: string;
  model?: string;
  mode?: 'text' | 'json' | string;
  messageCount: number;
  firstMessage?: string;
  temperature?: number;
  timeout?: number;
  schema?: 'provided' | 'default';
  usage?: LLMUsage;
};

export function getLLMErrorMessage(error: unknown, fallbackMessage?: string): string;

export function normalizeLLMUsage(usage?: any): LLMUsage | undefined;

export function parseJsonContent<T = unknown>(content: T): { value: unknown; parsed: boolean };

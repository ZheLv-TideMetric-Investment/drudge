import type { LLMMessage, LLMUsage } from './llm';

export type LocalAiConfig = {
  baseUrl: string;
  model: string;
  contextLength: number;
  timeoutMs: number;
};

export type LocalAiResult<T> =
  | { success: true; data: T; usage: LLMUsage }
  | { success: false; reason: string; usage?: LLMUsage };

export class LocalAiClient {
  constructor(config: LocalAiConfig);
  call<T = string>(
    messages: LLMMessage[],
    options?: {
      temperature?: number;
      schema?: object;
      validate?: (data: unknown) => boolean;
    }
  ): Promise<LocalAiResult<T>>;
}

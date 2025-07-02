export interface LLMCallOptions {
    temperature?: number;
    maxTokens?: number;
    system?: string;
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
 * 调用LLM并返回文本响应
 */
export declare function callLLM(prompt: string, options?: LLMCallOptions): Promise<LLMResponse>;
/**
 * 调用LLM并返回JSON响应
 */
export declare function callLLMWithJsonResponse<T = any>(prompt: string, options?: LLMCallOptions): Promise<LLMJsonResponse<T>>;
/**
 * 调用LLM进行批量处理
 */
export declare function callLLMBatch(prompts: string[], options?: LLMCallOptions): Promise<LLMResponse[]>;

import { LLMJsonResponse } from '../../shared/utils/llm';
export interface NewsLevelResult {
    level: number;
    reasoning: string;
    confidence: number;
    urgency: 'low' | 'medium' | 'high' | 'critical';
}
export interface EntityExtractionRequest {
    title: string;
    content: string;
    timestamp: string;
}
export interface EntityExtractionResponse {
    entities: {
        events: any[];
        companies: any[];
        persons: any[];
        organizations: any[];
        locations: any[];
        times: any[];
    };
    relationships: any[];
    confidence: number;
}
export interface SummaryRequest {
    content: string;
    maxLength?: number;
    style?: 'brief' | 'detailed' | 'bullet_points';
}
export interface SummaryResponse {
    summary: string;
    key_points: string[];
    confidence: number;
}
/**
 * AI服务 - 提供各种AI功能的统一接口
 */
declare class AiService {
    private initialized;
    /**
     * 初始化AI服务
     */
    initialize(): Promise<void>;
    /**
     * 新闻级别评估
     */
    evaluateNewsLevel(title: string, content: string): Promise<LLMJsonResponse<NewsLevelResult>>;
    /**
     * 实体提取
     */
    extractEntities(request: EntityExtractionRequest): Promise<LLMJsonResponse<EntityExtractionResponse>>;
    /**
     * 生成摘要
     */
    generateSummary(request: SummaryRequest): Promise<LLMJsonResponse<SummaryResponse>>;
    /**
     * 批量处理新闻级别评估
     */
    batchEvaluateNewsLevel(newsItems: Array<{
        title: string;
        content: string;
    }>): Promise<LLMJsonResponse<NewsLevelResult>[]>;
    /**
     * 健康检查
     */
    healthCheck(): Promise<{
        status: string;
        timestamp: string;
        error?: string;
    }>;
}
declare const aiService: AiService;
export default aiService;

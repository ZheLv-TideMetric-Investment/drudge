import { NewsExtractionResult } from '../entities/index';
/**
 * 新闻六要素提取服务
 * 基于5W1H原则从新闻中提取事件、公司、人物、机构、地点、时间信息
 */
declare class EntityExtractionService {
    constructor();
    /**
     * 从新闻中提取六要素信息
     * @param {Object} newsItem - 新闻对象
     * @returns {NewsExtractionResult} - 提取结果
     */
    extractFromNews(newsItem: any): Promise<NewsExtractionResult>;
    /**
     * 调用AI进行六要素提取
     * @param {Object} newsItem - 新闻对象
     * @returns {Object} - AI返回的提取数据
     */
    callAIExtraction(newsItem: any): Promise<import("../../shared/utils/llm").LLMJsonResponse<any>>;
    /**
     * 解析提取结果
     * @param {Object} extractionData - AI提取的原始数据
     * @param {Object} newsItem - 原始新闻
     * @returns {NewsExtractionResult} - 格式化的提取结果
     */
    parseExtractionResult(extractionData: any, newsItem: any): NewsExtractionResult;
    /**
     * 判断新闻级别（完全基于AI判断结果）
     * @param {Object} newsItem - 新闻对象
     * @param {NewsExtractionResult} result - 提取结果
     * @returns {string} - 新闻级别
     */
    determineNewsLevel(newsItem: any, result: any): any;
    /**
     * 获取级别数值（用于比较，数值越小级别越高）
     */
    getLevelValue(level: any): any;
    /**
     * 解析日期
     */
    parseDate(timestamp: any): string;
    /**
     * 验证事件类型
     */
    validateEventType(type: any): any;
    /**
     * 验证重要性级别
     */
    validateSignificance(significance: any): number;
    /**
     * 验证情感倾向
     */
    validateSentiment(sentiment: any): any;
    /**
     * 验证影响程度
     */
    validateMagnitude(magnitude: any): number;
    /**
     * 验证关系类型
     */
    validateRelationshipType(type: any): any;
    /**
     * 验证新闻级别
     */
    validateNewsLevel(level: any): any;
    /**
     * 延迟函数
     */
    delay(ms: any): Promise<unknown>;
    /**
     * 批量提取新闻六要素（简化版，用于NewsProcessingService）
     * @param {Array} newsItems - 新闻数组（一批，比如5条）
     * @returns {Array} - 提取结果数组
     */
    batchExtractEntities(newsItems: any): Promise<any[]>;
    /**
     * 批量AI调用 - 一次性处理多条新闻（简化版）
     * @param {Array} newsItems - 新闻对象数组
     * @returns {Array} - 提取结果数组
     */
    callBatchAIExtraction(newsItems: any): Promise<any[]>;
}
declare const _default: EntityExtractionService;
export default _default;

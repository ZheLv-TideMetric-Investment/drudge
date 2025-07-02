import { NewsItem, BatchResult, BatchSummary, BatchCallbackData } from '../../shared/types/common';
/**
 * 新闻处理应用服务
 * 协调各种服务来处理新闻并构建知识图谱
 */
declare class NewsProcessingService {
    private knowledgeGraph;
    private entityExtraction;
    private initialized;
    constructor();
    /**
     * 初始化服务
     */
    initialize(): Promise<void>;
    /**
     * 检查新闻是否已经处理过
     */
    isNewsProcessed(newsId: string): Promise<boolean>;
    /**
     * 批量检查新闻是否已处理过
     */
    getUnprocessedNewsIds(newsIds: string[]): Promise<string[]>;
    /**
     * 处理单条新闻并构建知识图谱
     */
    processNews(newsItem: NewsItem): Promise<BatchResult>;
    /**
     * 批量处理新闻 - 流式处理，每批完成后立即处理结果
     */
    batchProcessNews(newsItems: NewsItem[], batchSize: number, onBatchComplete: (data: BatchCallbackData) => Promise<void>): Promise<{
        summary: BatchSummary;
    }>;
    /**
     * 使用回调函数的流式批量处理
     */
    private _processBatchesWithCallback;
    /**
     * 处理单个批次
     */
    private _processSingleBatch;
    /**
     * 计算批次统计信息
     */
    private _calculateBatchSummary;
    /**
     * 更新汇总统计
     */
    private _updateSummary;
    /**
     * 获取统计信息
     */
    getStats(): Promise<any>;
    /**
     * 健康检查
     */
    healthCheck(): Promise<any>;
}
declare const newsProcessingService: NewsProcessingService;
export default newsProcessingService;

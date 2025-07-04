// @ts-nocheck
import logger from '../../shared/utils/logger';
import knowledgeGraphServiceV2 from './KnowledgeGraphServiceV2';
import { NewsItem, BatchResult, BatchSummary, BatchCallbackData } from '../../shared/types/common';

/**
 * 新闻处理服务 V2
 * 重构版本：使用新的知识图谱服务架构
 */
class NewsProcessingServiceV2 {
  private knowledgeGraph: any;
  private initialized: boolean = false;

  constructor() {
    this.knowledgeGraph = knowledgeGraphServiceV2;
  }

  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    try {
      await this.knowledgeGraph.initialize();
      this.initialized = true;
      logger.info('新闻处理服务 V2 初始化完成');
    } catch (error) {
      logger.error('新闻处理服务 V2 初始化失败:', error);
      throw error;
    }
  }

  /**
   * 处理单条新闻
   */
  async processNews(newsItem: NewsItem): Promise<BatchResult> {
    try {
      logger.info(`开始处理新闻: ${newsItem.id}`);
      const result = await this.knowledgeGraph.processNews(newsItem);
      logger.info(`新闻处理完成: ${newsItem.id}`);
      return result;
    } catch (error: any) {
      logger.error(`处理新闻失败: ${newsItem.id}`, error);
      return { 
        success: false, 
        error: error.message,
        newsId: newsItem.id,
        processed_at: new Date().toISOString()
      };
    }
  }

  /**
   * 批量处理新闻 - 流式处理
   */
  async batchProcessNews(
    newsItems: NewsItem[], 
    batchSize: number = 5, 
    onBatchComplete: (data: BatchCallbackData) => Promise<void>
  ): Promise<{ summary: BatchSummary }> {
    if (newsItems.length === 0) {
      return { summary: { total: 0, success: 0, failed: 0, message: '没有新闻需要处理' } };
    }

    if (typeof onBatchComplete !== 'function') {
      throw new Error('必须提供 onBatchComplete 回调函数用于流式处理');
    }

    logger.info(`开始流式批量处理 ${newsItems.length} 条新闻，批量大小: ${batchSize}`);

    const totalBatches = Math.ceil(newsItems.length / batchSize);
    const summary: BatchSummary = {
      total: 0,
      success: 0,
      failed: 0,
      processed_batches: 0,
      total_batches: totalBatches,
      start_time: new Date().toISOString()
    };

    return await this._processBatchesWithCallback(newsItems, batchSize, onBatchComplete, summary);
  }

  /**
   * 使用回调函数的流式批量处理
   */
  private async _processBatchesWithCallback(
    newsItems: NewsItem[], 
    batchSize: number, 
    onBatchComplete: (data: BatchCallbackData) => Promise<void>, 
    summary: BatchSummary
  ): Promise<{ summary: BatchSummary }> {
    for (let i = 0; i < newsItems.length; i += batchSize) {
      const currentBatch = i / batchSize + 1;
      const batch = newsItems.slice(i, i + batchSize);
      
      logger.info(`开始处理第 ${currentBatch}/${summary.total_batches} 批，共 ${batch.length} 条新闻`);

      try {
        // 使用新的知识图谱服务批量处理
        const batchResults = await this.knowledgeGraph.batchProcessNews(batch);
        
        // 如果所有新闻都已处理过，创建跳过的结果
        const actualResults = batchResults.length > 0 ? batchResults : batch.map(newsItem => ({
          success: true,
          skipped: true,
          reason: 'already_processed',
          stats: { events: 0, companies: 0, persons: 0 },
          newsId: newsItem.id,
          processed_at: new Date().toISOString()
        }));

        // 立即调用回调处理这批结果
        await onBatchComplete({
          batchNumber: currentBatch,
          totalBatches: summary.total_batches!,
          batchResults: actualResults,
          batchSummary: this._calculateBatchSummary(actualResults),
          overallProgress: {
            processed: currentBatch,
            total: summary.total_batches!,
            percentage: Math.round((currentBatch / summary.total_batches!) * 100)
          }
        });

        // 更新汇总统计
        this._updateSummary(summary, actualResults);
        
        logger.info(`第 ${currentBatch} 批处理完成并已处理结果`);
        
        // 批次间的短暂延迟，避免过载
        if (currentBatch < summary.total_batches!) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

      } catch (error: any) {
        logger.error(`处理第 ${currentBatch} 批时发生错误:`, error);
        
        // 即使出错也要调用回调
        const errorResults: BatchResult[] = batch.map(newsItem => ({
          success: false,
          error: error.message,
          newsId: newsItem.id,
          processed_at: new Date().toISOString()
        }));

        await onBatchComplete({
          batchNumber: currentBatch,
          totalBatches: summary.total_batches!,
          batchResults: errorResults,
          batchSummary: this._calculateBatchSummary(errorResults),
          error: error.message,
          overallProgress: {
            processed: currentBatch,
            total: summary.total_batches!,
            percentage: Math.round((currentBatch / summary.total_batches!) * 100)
          }
        });

        this._updateSummary(summary, errorResults);
      }
    }

    summary.end_time = new Date().toISOString();
    summary.duration_ms = new Date(summary.end_time).getTime() - new Date(summary.start_time!).getTime();
    
    logger.info(`批量处理完成，汇总统计:`, summary);
    return { summary };
  }

  /**
   * 计算批次摘要
   */
  private _calculateBatchSummary(batchResults: BatchResult[]): BatchSummary {
    const success = batchResults.filter(r => r.success).length;
    const failed = batchResults.filter(r => !r.success).length;
    
    return {
      total: batchResults.length,
      success,
      failed,
      message: `批次完成: ${success} 成功, ${failed} 失败`
    };
  }

  /**
   * 更新汇总统计
   */
  private _updateSummary(summary: BatchSummary, batchResults: BatchResult[]): void {
    summary.total += batchResults.length;
    summary.success += batchResults.filter(r => r.success).length;
    summary.failed += batchResults.filter(r => !r.success).length;
    summary.processed_batches = (summary.processed_batches || 0) + 1;
  }

  /**
   * 获取统计信息
   */
  async getStats(): Promise<any> {
    return await this.knowledgeGraph.getStats();
  }

  /**
   * 处理未处理的新闻
   */
  async processUnprocessedNews(storage: any, limit: number = 100): Promise<any> {
    try {
      logger.info(`开始处理未处理的新闻，限制: ${limit}`);
      
      const allNews = await storage.getAll();
      const unprocessedNews = allNews.slice(0, limit);
      
      if (unprocessedNews.length === 0) {
        return {
          success: true,
          message: '没有未处理的新闻',
          processed: 0,
          total: 0
        };
      }

      let processedCount = 0;
      const results: any[] = [];

      // 定义批处理回调
      const onBatchComplete = async (batchInfo: any) => {
        processedCount += batchInfo.batchResults.length;
        results.push(...batchInfo.batchResults);
        
        logger.info(`批处理进度: ${batchInfo.batchNumber}/${batchInfo.totalBatches} (${batchInfo.overallProgress.percentage}%)`);
        
        // 发送进度通知
        await this.knowledgeGraph.sendProcessingProgress({
          processed: processedCount,
          total: unprocessedNews.length,
          percentage: Math.round((processedCount / unprocessedNews.length) * 100),
          currentTask: `处理新闻批次 ${batchInfo.batchNumber}/${batchInfo.totalBatches}`
        });
      };

      // 执行批处理
      const batchResult = await this.batchProcessNews(unprocessedNews, 5, onBatchComplete);
      
      return {
        success: true,
        message: `未处理新闻处理完成: ${batchResult.summary.success} 成功, ${batchResult.summary.failed} 失败`,
        processed: batchResult.summary.success,
        failed: batchResult.summary.failed,
        total: unprocessedNews.length,
        summary: batchResult.summary
      };
    } catch (error: any) {
      logger.error('处理未处理新闻失败:', error);
      return {
        success: false,
        error: error.message,
        processed: 0,
        total: 0
      };
    }
  }

  /**
   * 处理最近的新闻
   */
  async processRecentNews(storage: any, hours: number = 24): Promise<any> {
    try {
      logger.info(`开始处理最近 ${hours} 小时的新闻`);
      
      const allNews = await storage.getAll();
      const cutoffTime = Math.floor(Date.now() / 1000) - (hours * 3600);
      const recentNews = allNews.filter(item => item.time >= cutoffTime);
      
      if (recentNews.length === 0) {
        return {
          success: true,
          message: `最近 ${hours} 小时没有新闻`,
          processed: 0,
          total: 0
        };
      }

      let processedCount = 0;
      const results: any[] = [];

      // 定义批处理回调
      const onBatchComplete = async (batchInfo: any) => {
        processedCount += batchInfo.batchResults.length;
        results.push(...batchInfo.batchResults);
        
        logger.info(`批处理进度: ${batchInfo.batchNumber}/${batchInfo.totalBatches} (${batchInfo.overallProgress.percentage}%)`);
      };

      // 执行批处理
      const batchResult = await this.batchProcessNews(recentNews, 10, onBatchComplete);
      
      return {
        success: true,
        message: `最近 ${hours} 小时新闻处理完成: ${batchResult.summary.success} 成功, ${batchResult.summary.failed} 失败`,
        processed: batchResult.summary.success,
        failed: batchResult.summary.failed,
        total: recentNews.length,
        summary: batchResult.summary
      };
    } catch (error: any) {
      logger.error('处理最近新闻失败:', error);
      return {
        success: false,
        error: error.message,
        processed: 0,
        total: 0
      };
    }
  }

  /**
   * 重新处理单条新闻
   */
  async reprocessNews(storage: any, newsId: string): Promise<any> {
    try {
      logger.info(`开始重新处理新闻: ${newsId}`);
      
      const allNews = await storage.getAll();
      const newsItem = allNews.find(item => item.id === newsId);
      
      if (!newsItem) {
        return {
          success: false,
          error: `未找到新闻: ${newsId}`,
          newsId
        };
      }

      const result = await this.processNews(newsItem);
      
      return {
        success: result.success,
        message: result.success ? '重新处理成功' : '重新处理失败',
        result,
        newsId
      };
    } catch (error: any) {
      logger.error(`重新处理新闻失败: ${newsId}`, error);
      return {
        success: false,
        error: error.message,
        newsId
      };
    }
  }

  /**
   * 检查新闻是否已处理
   */
  async isNewsProcessed(newsId: string): Promise<boolean> {
    return await this.knowledgeGraph.isNewsProcessed(newsId);
  }

  /**
   * 批量检查新闻处理状态
   */
  async getUnprocessedNewsIds(newsIds: string[]): Promise<string[]> {
    return await this.knowledgeGraph.getUnprocessedNewsIds(newsIds);
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<any> {
    try {
      const kgHealth = await this.knowledgeGraph.healthCheck();
      
      return {
        status: kgHealth.status,
        service: 'NewsProcessingServiceV2',
        timestamp: new Date().toISOString(),
        knowledge_graph: kgHealth,
        version: '2.0',
        initialized: this.initialized
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        service: 'NewsProcessingServiceV2',
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  /**
   * 获取服务信息
   */
  getServiceInfo(): any {
    const kgInfo = this.knowledgeGraph.getServiceInfo();
    
    return {
      version: '2.0',
      description: '重构版本的新闻处理服务，使用新的知识图谱服务架构',
      initialized: this.initialized,
      knowledge_graph: kgInfo,
      features: [
        '流式批处理',
        '实时进度回调',
        '错误自动警报',
        '幂等性保证',
        '服务解耦设计'
      ]
    };
  }
}

export default new NewsProcessingServiceV2(); 
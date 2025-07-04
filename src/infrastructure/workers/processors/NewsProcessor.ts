// @ts-nocheck
import logger from '../../../shared/utils/logger';
import storageService from '../../storage/FileStorage';
import notificationService from '../../../application/services/business/NotificationService';
import newsProcessingServiceV2 from '../../../application/services/NewsProcessingServiceV2';
import config from '../../../shared/config/config';

/**
 * 新闻处理器
 * 负责核心的新闻处理逻辑
 */
export class NewsProcessor {
  private stats: any;

  constructor() {
    this.stats = {
      totalProcessed: 0,
      totalSkipped: 0,
      totalErrors: 0,
      lastProcessTime: null,
      processingTime: 0
    };
  }

  /**
   * 处理未处理的新闻
   */
  async processUnhandledNews(): Promise<any> {
    const startTime = Date.now();

    try {
      logger.info('开始检查和处理未处理的新闻...');

      // 1. 获取所有本地存储的新闻
      const allNews = await storageService.getAll(1000); // 限制最多1000条避免内存过载
      
      if (allNews.length === 0) {
        logger.debug('没有找到本地存储的新闻');
        return { success: true, message: '没有找到新闻' };
      }

      // 2. 过滤出未处理的新闻
      const newsIds = allNews.map(item => item.id);
      const unprocessedIds = await newsProcessingServiceV2.getUnprocessedNewsIds(newsIds);
      const unprocessedNews = allNews.filter(item => unprocessedIds.includes(item.id));

      if (unprocessedNews.length === 0) {
        logger.info(`所有${allNews.length}条新闻都已处理过`);
        return { success: true, message: `所有新闻都已处理` };
      }

      logger.info(`发现${unprocessedNews.length}条未处理的新闻（总计${allNews.length}条）`);

      // 3. 处理新闻
      const results = await this.batchProcessNews(unprocessedNews);

      // 4. 统计结果
      const processedCount = results.filter(r => r.success && !r.skipped).length;
      const skippedCount = results.filter(r => r.skipped).length;
      const errorCount = results.filter(r => !r.success).length;
      const highLevelCount = results.filter(r => r.newsLevel === 'Level 1' || r.newsLevel === 'Level 2').length;

      // 5. 更新统计信息
      this.stats.totalProcessed += processedCount;
      this.stats.totalSkipped += skippedCount;
      this.stats.totalErrors += errorCount;
      this.stats.lastProcessTime = Date.now();
      this.stats.processingTime = Date.now() - startTime;

      const message = `新闻处理完成：处理${processedCount}条，跳过${skippedCount}条，错误${errorCount}条，发现${highLevelCount}条高级别新闻，耗时${this.stats.processingTime}ms`;
      
      logger.info(message);

      return {
        success: true,
        message,
        totalNews: allNews.length,
        unprocessedCount: unprocessedNews.length,
        processedCount,
        skippedCount,
        errorCount,
        highLevelCount,
        processingTime: this.stats.processingTime,
        timestamp: Date.now()
      };

    } catch (error) {
      logger.error('处理未处理新闻时发生错误:', error);
      return {
        success: false,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  /**
   * 批量处理新闻（增强版：支持流式处理）
   */
  async batchProcessNews(newsItems: any[]): Promise<any[]> {
    const allResults = [];
    
    if (newsItems.length >= config.batch?.minBatchSize || 3) {
      // 使用批量流式处理
      logger.info(`🚀 开始批量流式处理${newsItems.length}条新闻`);
      
      // 使用流式处理
      const batchSize = config.batch?.maxBatchSize || 5;
      const result = await newsProcessingServiceV2.batchProcessNews(newsItems, batchSize, null);
      
      logger.info(`✅ 批量流式处理完成，汇总统计:`, result.summary);
      
      return result.results || [];
      
    } else {
      // 单条处理
      logger.info(`🔄 开始单条处理${newsItems.length}条新闻`);
      for (const newsItem of newsItems) {
        try {
          const result = await this.processSingleNews(newsItem);
          allResults.push(result);
        } catch (error) {
          logger.error(`单条处理失败: ${newsItem.id}`, error);
          allResults.push({
            success: false,
            newsId: newsItem.id,
            error: error.message,
            processed_at: new Date().toISOString()
          });
        }
      }
    }

    return allResults;
  }

  /**
   * 处理单条新闻
   */
  async processSingleNews(newsItem: any): Promise<any> {
    try {
      // 1. 构建知识图谱
      const graphResult = await newsProcessingServiceV2.processNews(newsItem);
      
      if (!graphResult.success) {
        return {
          success: false,
          newsId: newsItem.id,
          error: graphResult.error
        };
      }

      // 2. 处理新闻级别
      let levelResult = null;
      if (graphResult.extractionResult) {
        levelResult = await notificationService.checkAndHandleNewsLevel?.(
          newsItem, 
          graphResult.extractionResult
        );
      }

      return {
        success: true,
        newsId: newsItem.id,
        skipped: graphResult.skipped || false,
        stats: graphResult.stats,
        newsLevel: graphResult.extractionResult?.news_level,
        shouldPush: levelResult?.shouldPush || false
      };
      
    } catch (error) {
      logger.error(`处理新闻失败: ${newsItem.id}`, error);
      return {
        success: false,
        newsId: newsItem.id,
        error: error.message
      };
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): any {
    return this.stats;
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = {
      totalProcessed: 0,
      totalSkipped: 0,
      totalErrors: 0,
      lastProcessTime: null,
      processingTime: 0
    };
  }
} 
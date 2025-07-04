// @ts-nocheck
import { NewsExtractionResult } from '../../domain/entities/NewsExtractionResult';
import entityExtractionService from '../services/processing/entityExtractionService';
import knowledgeGraphServiceV2 from '../services/KnowledgeGraphServiceV2';
import notificationService from '../services/business/NotificationService';
import logger from '../../shared/utils/logger';

/**
 * 处理新闻用例
 * 编排新闻处理的完整业务流程
 */
export class ProcessNewsUseCase {
  /**
   * 执行单个新闻处理
   * @param newsItem 新闻项
   * @returns 处理结果
   */
  async execute(newsItem: any): Promise<any> {
    const startTime = Date.now();
    
    try {
      logger.info(`开始处理新闻: ${newsItem.id}`);

      // 1. 提取实体
      const extractionResult = await entityExtractionService.extractFromNews(newsItem);
      
      // 2. 构建知识图谱
      const graphResult = await knowledgeGraphServiceV2.processExtractionResult(extractionResult);
      
      // 3. 评估新闻级别和通知
      let notificationResult = null;
      if (extractionResult.news_level && ['Level 1', 'Level 2'].includes(extractionResult.news_level)) {
        notificationResult = await notificationService.handleHighLevelNews(newsItem, extractionResult);
      }

      const processingTime = Date.now() - startTime;
      
      logger.info(`新闻处理完成: ${newsItem.id}, 级别: ${extractionResult.news_level}, 耗时: ${processingTime}ms`);

      return {
        success: true,
        newsId: newsItem.id,
        extractionResult,
        graphResult,
        notificationResult,
        processingTime,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error(`新闻处理失败: ${newsItem.id}`, error);
      return {
        success: false,
        newsId: newsItem.id,
        error: error.message,
        processingTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 批量执行新闻处理
   * @param newsItems 新闻数组
   * @returns 批量处理结果
   */
  async batchExecute(newsItems: any[]): Promise<any> {
    const startTime = Date.now();
    const results = [];

    try {
      logger.info(`开始批量处理${newsItems.length}条新闻`);

      for (const newsItem of newsItems) {
        const result = await this.execute(newsItem);
        results.push(result);
      }

      const processingTime = Date.now() - startTime;
      const successCount = results.filter(r => r.success).length;
      const errorCount = results.filter(r => !r.success).length;

      logger.info(`批量处理完成: 成功${successCount}条, 失败${errorCount}条, 耗时${processingTime}ms`);

      return {
        success: true,
        totalCount: newsItems.length,
        successCount,
        errorCount,
        results,
        processingTime,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('批量处理失败:', error);
      return {
        success: false,
        error: error.message,
        results,
        processingTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    }
  }
} 
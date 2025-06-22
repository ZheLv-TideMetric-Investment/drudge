import logger from '../../shared/utils/logger.js';
import knowledgeGraphService from './knowledgeGraphService.js';
import entityExtractionService from '../../domain/services/entityExtractionService.js';
import { NewsExtractionResult } from '../../domain/entities/index.js';

/**
 * 新闻处理应用服务
 * 协调各种服务来处理新闻并构建知识图谱
 */
class NewsProcessingService {
  constructor() {
    this.knowledgeGraph = knowledgeGraphService;
    this.entityExtraction = entityExtractionService;
    this.initialized = false;
  }

  /**
   * 初始化服务
   */
  async initialize() {
    try {
      this.initialized = true;
      logger.info('新闻处理应用服务初始化完成');
    } catch (error) {
      logger.error('新闻处理应用服务初始化失败:', error);
      throw error;
    }
  }

  /**
   * 检查新闻是否已经处理过
   */
  async isNewsProcessed(newsId) {
    return await this.knowledgeGraph.isNewsProcessed(newsId);
  }

  /**
   * 批量检查新闻是否已处理过
   */
  async getUnprocessedNewsIds(newsIds) {
    return await this.knowledgeGraph.getUnprocessedNewsIds(newsIds);
  }

  /**
   * 处理单条新闻并构建知识图谱
   */
  async processNews(newsItem) {
    try {
      // 幂等性检查
      const alreadyProcessed = await this.isNewsProcessed(newsItem.id);
      if (alreadyProcessed) {
        logger.debug(`新闻 ${newsItem.id} 已经处理过，跳过`);
        return { 
          success: true, 
          skipped: true, 
          reason: 'already_processed',
          stats: { events: 0, companies: 0, persons: 0 }
        };
      }

      logger.info(`开始处理新闻构建图谱: ${newsItem.id}`);

      // 直接使用 knowledgeGraphService 处理单条新闻
      const result = await this.knowledgeGraph.processNews(newsItem);
      
      return result;
    } catch (error) {
      logger.error(`处理新闻 ${newsItem.id} 失败:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 批量处理新闻 - 流式处理，每批完成后立即处理结果
   * @param {Array} newsItems - 待处理的新闻列表
   * @param {number} batchSize - 批量大小
   * @param {Function} onBatchComplete - 每批完成后的回调函数
   * @returns {Object} - 处理统计信息
   */
  async batchProcessNews(newsItems, batchSize = 5, onBatchComplete) {
    if (newsItems.length === 0) {
      return { summary: { total: 0, success: 0, failed: 0, message: '没有新闻需要处理' } };
    }

    if (typeof onBatchComplete !== 'function') {
      throw new Error('必须提供 onBatchComplete 回调函数用于流式处理');
    }

    logger.info(`开始流式批量处理${newsItems.length}条新闻，批量大小: ${batchSize}`);

    const totalBatches = Math.ceil(newsItems.length / batchSize);
    const summary = {
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
  async _processBatchesWithCallback(newsItems, batchSize, onBatchComplete, summary) {
    for (let i = 0; i < newsItems.length; i += batchSize) {
      const currentBatch = i / batchSize + 1;
      const batch = newsItems.slice(i, i + batchSize);
      
      logger.info(`开始处理第${currentBatch}/${summary.total_batches}批，共${batch.length}条新闻`);

      try {
        const batchResults = await this._processSingleBatch(batch, currentBatch, summary.total_batches);
        
        // 立即调用回调处理这批结果
        await onBatchComplete({
          batchNumber: currentBatch,
          totalBatches: summary.total_batches,
          batchResults,
          batchSummary: this._calculateBatchSummary(batchResults),
          overallProgress: {
            processed: currentBatch,
            total: summary.total_batches,
            percentage: Math.round((currentBatch / summary.total_batches) * 100)
          }
        });

        // 更新汇总统计
        this._updateSummary(summary, batchResults);
        
        logger.info(`第${currentBatch}批处理完成并已处理结果`);
        
        // 批次间的短暂延迟，避免过载
        if (currentBatch < summary.total_batches) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

      } catch (error) {
        logger.error(`处理第${currentBatch}批时发生错误:`, error);
        
        // 即使出错也要调用回调
        const errorResults = batch.map(newsItem => ({
          success: false,
          error: error.message,
          newsId: newsItem.id
        }));

        await onBatchComplete({
          batchNumber: currentBatch,
          totalBatches: summary.total_batches,
          batchResults: errorResults,
          batchSummary: this._calculateBatchSummary(errorResults),
          error: error.message,
          overallProgress: {
            processed: currentBatch,
            total: summary.total_batches,
            percentage: Math.round((currentBatch / summary.total_batches) * 100)
          }
        });

        this._updateSummary(summary, errorResults);
      }
    }

    summary.end_time = new Date().toISOString();
    summary.duration_ms = new Date(summary.end_time) - new Date(summary.start_time);
    
    logger.info(`批量处理完成，汇总统计:`, summary);
    return { summary, totalResults: [] }; // 使用回调时不返回具体结果，节省内存
  }



  /**
   * 处理单个批次
   */
  async _processSingleBatch(batch, currentBatch, totalBatches) {
    logger.info(`开始处理第${currentBatch}批：${batch.length}条新闻`);

    // 1. 批量提取实体（真正的批量AI调用）
    const extractionResults = await this.entityExtraction.batchExtractEntities(batch);

    // 2. 批量创建图数据
    const graphResults = await this.knowledgeGraph.batchCreateGraphData(extractionResults);

    // 3. 构建统一的批次结果格式
    const batchResults = [];
    for (let j = 0; j < batch.length; j++) {
      const newsItem = batch[j];
      const extractionResult = extractionResults[j];
      const graphResult = graphResults[j];
      
      if (graphResult && graphResult.success && extractionResult) {
        batchResults.push({
          success: true,
          newsId: newsItem.id,
          stats: {
            events: extractionResult.events?.length || 0,
            companies: extractionResult.companies?.length || 0,
            persons: extractionResult.persons?.length || 0,
            organizations: extractionResult.organizations?.length || 0,
            locations: extractionResult.locations?.length || 0,
            times: extractionResult.times?.length || 0
          },
          extractionResult: extractionResult,
          processed_at: new Date().toISOString()
        });
      } else {
        batchResults.push({
          success: false,
          error: (graphResult && graphResult.error) || '处理失败',
          newsId: newsItem.id,
          processed_at: new Date().toISOString()
        });
      }
    }

    logger.info(`第${currentBatch}批处理完成：成功${batchResults.filter(r => r.success).length}/${batch.length}条`);
    return batchResults;
  }

  /**
   * 计算批次统计信息
   */
  _calculateBatchSummary(batchResults) {
    return {
      total: batchResults.length,
      success: batchResults.filter(r => r.success).length,
      failed: batchResults.filter(r => !r.success).length,
      success_rate: Math.round((batchResults.filter(r => r.success).length / batchResults.length) * 100)
    };
  }

  /**
   * 更新汇总统计
   */
  _updateSummary(summary, batchResults) {
    summary.total += batchResults.length;
    summary.success += batchResults.filter(r => r.success).length;
    summary.failed += batchResults.filter(r => !r.success).length;
    summary.processed_batches += 1;
    summary.success_rate = Math.round((summary.success / summary.total) * 100);
  }

  /**
   * 获取统计信息
   */
  async getStats() {
    return await this.knowledgeGraph.getGraphStats();
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    return await this.knowledgeGraph.healthCheck();
  }
}

// 创建单例实例
const newsProcessingService = new NewsProcessingService();

export default newsProcessingService; 
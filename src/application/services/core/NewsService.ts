// @ts-nocheck
import logger from '../../../shared/utils/logger';
import { NewsExtractionResult } from '../../../domain/entities/index';
import { NewsItem, BatchResult } from '../../../shared/types/common';
import entityExtractionService from '../processing/entityExtractionService';

/**
 * 核心新闻服务
 * 负责新闻的基本处理逻辑，不涉及具体的存储或通知
 */
class NewsService {
  private entityExtraction: any;
  private initialized: boolean = false;

  constructor() {
    this.entityExtraction = entityExtractionService;
  }

  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    try {
      this.initialized = true;
      logger.info('核心新闻服务初始化完成');
    } catch (error) {
      logger.error('核心新闻服务初始化失败:', error);
      throw error;
    }
  }

  /**
   * 提取新闻实体
   */
  async extractEntities(newsItem: NewsItem): Promise<NewsExtractionResult> {
    try {
      logger.debug(`开始提取新闻实体: ${newsItem.id}`);
      const extractionResult = await this.entityExtraction.extractFromNews(newsItem);
      logger.debug(`新闻实体提取完成: ${newsItem.id}`);
      return extractionResult;
    } catch (error) {
      logger.error(`新闻实体提取失败: ${newsItem.id}`, error);
      throw error;
    }
  }

  /**
   * 批量提取新闻实体
   */
  async batchExtractEntities(newsItems: NewsItem[]): Promise<NewsExtractionResult[]> {
    try {
      logger.info(`开始批量提取新闻实体: ${newsItems.length} 条`);
      const results = await this.entityExtraction.batchExtractEntities(newsItems);
      logger.info(`批量提取完成: ${results.length} 条`);
      return results;
    } catch (error) {
      logger.error('批量提取新闻实体失败:', error);
      throw error;
    }
  }

  /**
   * 验证新闻数据
   */
  validateNews(newsItem: NewsItem): boolean {
    if (!newsItem.id || !newsItem.title || !newsItem.content) {
      logger.warn(`新闻数据不完整: ${newsItem.id}`);
      return false;
    }
    return true;
  }

  /**
   * 标准化新闻数据
   */
  normalizeNews(newsItem: NewsItem): NewsItem {
    return {
      ...newsItem,
      id: newsItem.id.toString(),
      title: newsItem.title.trim(),
      content: newsItem.content.trim(),
      source: newsItem.source || '未知来源',
      time: newsItem.time || Math.floor(Date.now() / 1000),
      url: newsItem.url || '',
      level: newsItem.level || 0
    };
  }

  /**
   * 过滤有效新闻
   */
  filterValidNews(newsItems: NewsItem[]): NewsItem[] {
    return newsItems
      .map(item => this.normalizeNews(item))
      .filter(item => this.validateNews(item));
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<any> {
    try {
      // 测试实体提取服务
      const testNews = {
        id: 'test-' + Date.now(),
        title: '测试新闻',
        content: '这是一个测试新闻内容',
        time: Math.floor(Date.now() / 1000),
        source: '测试源'
      };

      const result = await this.extractEntities(testNews);
      
      return {
        status: 'healthy',
        service: 'NewsService',
        timestamp: new Date().toISOString(),
        test_extraction: result ? 'success' : 'failed'
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        service: 'NewsService',
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }
}

export default new NewsService(); 
// @ts-nocheck
import { SingleProcessor } from './processors/SingleProcessor';
import { BatchProcessor } from './processors/BatchProcessor';
import { NewsExtractionResult } from '../../../domain/entities/index';

/**
 * 新闻六要素提取服务
 * 基于5W1H原则从新闻中提取事件、公司、人物、机构、地点、时间信息
 * 重构版：采用组合模式，委托给专门的处理器
 */
class EntityExtractionService {
  private singleProcessor: SingleProcessor;
  private batchProcessor: BatchProcessor;

  constructor() {
    this.singleProcessor = new SingleProcessor();
    this.batchProcessor = new BatchProcessor();
  }

  /**
   * 从新闻中提取六要素信息
   * @param {Object} newsItem - 新闻对象
   * @returns {NewsExtractionResult} - 提取结果
   */
  async extractFromNews(newsItem: any): Promise<NewsExtractionResult> {
    return await this.singleProcessor.extractFromNews(newsItem);
  }

  /**
   * 批量提取新闻六要素（简化版，用于NewsProcessingService）
   * @param {Array} newsItems - 新闻数组（一批，比如5条）
   * @returns {Array} - 提取结果数组
   */
  async batchExtractEntities(newsItems: any[]): Promise<NewsExtractionResult[]> {
    return await this.batchProcessor.batchExtractEntities(newsItems);
  }
}

export default new EntityExtractionService(); 
// @ts-nocheck
import logger from '../../shared/utils/logger';
import { NewsExtractionResult } from '../../domain/entities/index';
import { NewsItem, BatchResult } from '../../shared/types/common';

// 导入核心服务
import newsService from './core/NewsService';
import entityService from './core/EntityService';
import relationshipService from './core/RelationshipService';

// 导入业务服务
import notificationService from './business/NotificationService';
import queryService from './business/QueryService';

/**
 * 知识图谱服务 V2
 * 重构版本：整合所有核心服务，实现高内聚低耦合的设计
 */
class KnowledgeGraphServiceV2 {
  private initialized: boolean = false;
  private services: any = {};

  constructor() {
    this.services = {
      news: newsService,
      entity: entityService,
      relationship: relationshipService,
      notification: notificationService,
      query: queryService
    };
  }

  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    try {
      // 按顺序初始化所有服务
      await this.services.news.initialize();
      await this.services.entity.initialize();
      await this.services.relationship.initialize();
      await this.services.notification.initialize();
      await this.services.query.initialize();
      
      this.initialized = true;
      logger.info('知识图谱服务 V2 初始化完成');
    } catch (error) {
      logger.error('知识图谱服务 V2 初始化失败:', error);
      throw error;
    }
  }

  /**
   * 处理单条新闻并构建知识图谱
   */
  async processNews(newsItem: NewsItem): Promise<BatchResult> {
    try {
      // 幂等性检查
      const alreadyProcessed = await this.services.query.isNewsProcessed(newsItem.id);
      if (alreadyProcessed) {
        logger.debug(`新闻 ${newsItem.id} 已经处理过，跳过`);
        return { 
          success: true, 
          skipped: true, 
          reason: 'already_processed',
          stats: { events: 0, companies: 0, persons: 0 },
          newsId: newsItem.id,
          processed_at: new Date().toISOString()
        };
      }

      logger.info(`开始处理新闻构建图谱: ${newsItem.id}`);

      // 1. 提取新闻实体
      const extractionResult = await this.services.news.extractEntities(newsItem);

      if (extractionResult.events.length === 0) {
        logger.info(`新闻 ${newsItem.id} 未提取到有效事件`);
        // 即使没有事件也要创建新闻节点
        await this.services.entity.createNews(newsItem, extractionResult.news_level || 'Level 5');
        return { 
          success: true, 
          stats: extractionResult.getStats(), 
          extractionResult,
          newsId: newsItem.id,
          processed_at: new Date().toISOString()
        };
      }

      // 2. 创建新闻节点
      await this.services.entity.createNews(newsItem, extractionResult.news_level);

      // 3. 创建所有实体节点
      await this.createAllEntities(extractionResult);

      // 4. 创建所有关系
      await this.createAllRelationships(extractionResult, newsItem.id);

      // 5. 发送通知（如果需要）
      await this.services.notification.sendNewsLevelNotification(newsItem, extractionResult);

      const stats = {
        ...extractionResult.getStats(),
        news_level: extractionResult.news_level
      };

      logger.info(`新闻 ${newsItem.id} 图谱构建完成:`, stats);
      return { 
        success: true, 
        stats, 
        extractionResult,
        newsId: newsItem.id,
        processed_at: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`处理新闻 ${newsItem.id} 失败:`, error);
      
      // 发送错误警报
      await this.services.notification.sendErrorAlert(error, `处理新闻 ${newsItem.id}`);
      
      return { 
        success: false, 
        error: error.message,
        newsId: newsItem.id,
        processed_at: new Date().toISOString()
      };
    }
  }

  /**
   * 批量处理新闻
   */
  async batchProcessNews(newsItems: NewsItem[]): Promise<BatchResult[]> {
    if (newsItems.length === 0) return [];

    logger.info(`开始批量处理 ${newsItems.length} 条新闻`);

    try {
      // 1. 过滤有效新闻
      const validNews = this.services.news.filterValidNews(newsItems);
      
      // 2. 检查未处理的新闻
      const newsIds = validNews.map(item => item.id);
      const unprocessedIds = await this.services.query.getUnprocessedNewsIds(newsIds);
      const unprocessedNews = validNews.filter(item => unprocessedIds.includes(item.id));

      if (unprocessedNews.length === 0) {
        logger.info('所有新闻都已处理过');
        return [];
      }

      // 3. 批量提取实体
      const extractionResults = await this.services.news.batchExtractEntities(unprocessedNews);

      // 4. 批量创建节点和关系
      await this.batchCreateGraphData(extractionResults);

      // 5. 生成结果
      const results = extractionResults.map((result, index) => ({
        success: true,
        stats: result.getStats(),
        extractionResult: result,
        newsId: unprocessedNews[index].id,
        processed_at: new Date().toISOString()
      }));

      logger.info(`批量处理完成: ${results.length} 条新闻`);
      return results;
    } catch (error) {
      logger.error('批量处理失败:', error);
      await this.services.notification.sendErrorAlert(error, '批量处理新闻');
      throw error;
    }
  }

  /**
   * 创建所有实体节点
   */
  private async createAllEntities(extractionResult: NewsExtractionResult): Promise<void> {
    // 创建事件节点
    for (const event of extractionResult.events) {
      await this.services.entity.createEvent(event);
    }

    // 创建公司节点
    for (const company of extractionResult.companies) {
      await this.services.entity.createCompany(company);
    }

    // 创建人物节点
    for (const person of extractionResult.persons) {
      await this.services.entity.createPerson(person);
    }

    // 创建位置节点
    for (const location of extractionResult.locations) {
      await this.services.entity.createLocation(location);
    }

    // 创建时间节点
    for (const time of extractionResult.times) {
      await this.services.entity.createTime(time);
    }
  }

  /**
   * 创建所有关系
   */
  private async createAllRelationships(extractionResult: NewsExtractionResult, newsId: string): Promise<void> {
    // 为每个事件创建关系
    for (const event of extractionResult.events) {
      // 事件-新闻关系
      await this.services.relationship.createEventNewsRelation(event.event_id, newsId);

      // 事件-公司关系
      for (const company of extractionResult.companies) {
        await this.services.relationship.createEventCompanyRelation(event.event_id, company.company_name);
      }

      // 事件-人物关系
      for (const person of extractionResult.persons) {
        await this.services.relationship.createEventPersonRelation(event.event_id, person.person_name);
      }

      // 事件-位置关系
      for (const location of extractionResult.locations) {
        await this.services.relationship.createEventLocationRelation(event.event_id, location.location_name);
      }

      // 事件-时间关系
      for (const time of extractionResult.times) {
        await this.services.relationship.createEventTimeRelation(event.event_id, time.time_value);
      }
    }

    // 创建自定义关系
    if (extractionResult.relationships) {
      for (const relationship of extractionResult.relationships) {
        await this.services.relationship.createCustomRelationship(relationship);
      }
    }
  }

  /**
   * 批量创建图数据
   */
  private async batchCreateGraphData(extractionResults: NewsExtractionResult[]): Promise<void> {
    // 批量创建新闻节点
    await this.batchCreateNewsNodes(extractionResults);

    // 批量创建实体节点
    await this.services.entity.batchCreateEntities(extractionResults);

    // 批量创建关系
    await this.services.relationship.batchCreateRelationships(extractionResults);

    // 创建推断关系
    await this.services.relationship.createInferredRelationships(extractionResults);
  }

  /**
   * 批量创建新闻节点
   */
  private async batchCreateNewsNodes(extractionResults: NewsExtractionResult[]): Promise<void> {
    const queries: string[] = [];
    const parameters: any = {};

    extractionResults.forEach((result, index) => {
      const paramKey = `news_${index}`;
      queries.push(`
        MERGE (n:News {id: $${paramKey}.id})
        SET n.title = $${paramKey}.title,
            n.content = $${paramKey}.content,
            n.timestamp = $${paramKey}.timestamp,
            n.source = $${paramKey}.source,
            n.url = $${paramKey}.url,
            n.level = $${paramKey}.level,
            n.news_level = $${paramKey}.newsLevel,
            n.processed = true,
            n.created_at = $${paramKey}.createdAt,
            n.updated_at = $${paramKey}.updatedAt
      `);

      parameters[paramKey] = {
        id: result.newsId,
        title: result.title,
        content: result.content,
        timestamp: result.timestamp,
        source: result.source || '',
        url: result.url || '',
        level: result.level || 0,
        newsLevel: result.news_level || 'Level 5',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    });

    if (queries.length > 0) {
      const batchCypher = queries.join('\n');
      await this.services.entity.neo4j.executeQuery(batchCypher, parameters);
      logger.info(`批量创建新闻节点完成: ${queries.length} 个节点`);
    }
  }

  // ======= 查询相关方法 =======

  /**
   * 根据级别获取新闻
   */
  async getNewsByLevel(newsLevel: string, limit: number = 20): Promise<any[]> {
    return await this.services.query.getNewsByLevel(newsLevel, limit);
  }

  /**
   * 获取公司相关事件
   */
  async getCompanyEvents(companyName: string, limit: number = 50): Promise<any[]> {
    return await this.services.query.getCompanyEvents(companyName, limit);
  }

  /**
   * 获取多个公司的共同事件
   */
  async getMultiCompanyEvents(companyNames: string[], limit: number = 30): Promise<any[]> {
    return await this.services.query.getMultiCompanyEvents(companyNames, limit);
  }

  /**
   * 获取指定日期的事件
   */
  async getDayEvents(date: string): Promise<any[]> {
    return await this.services.query.getDayEvents(date);
  }

  /**
   * 获取小时摘要
   */
  async getHourlySummary(hourStart: string, hourEnd: string): Promise<any> {
    return await this.services.query.getHourlySummary(hourStart, hourEnd);
  }

  /**
   * 搜索实体
   */
  async searchEntities(searchTerm: string, nodeType: string = null, limit: number = 20): Promise<any[]> {
    return await this.services.query.searchEntities(searchTerm, nodeType, limit);
  }

  /**
   * 搜索相关新闻
   */
  async searchRelatedNews(query: string, limit: number = 10): Promise<any[]> {
    return await this.services.query.searchRelatedNews(query, limit);
  }

  /**
   * 获取突发新闻
   */
  async getBreakingNews(hours: number = 24): Promise<any[]> {
    return await this.services.query.getBreakingNews(hours);
  }

  /**
   * 获取高级别新闻
   */
  async getHighLevelNews(hours: number = 12): Promise<any[]> {
    return await this.services.query.getHighLevelNews(hours);
  }

  /**
   * 获取新闻级别统计
   */
  async getNewsLevelStats(startTime: string, endTime: string): Promise<any[]> {
    return await this.services.query.getNewsLevelStats(startTime, endTime);
  }

  /**
   * 获取新闻提取结果
   */
  async getNewsExtractionResult(newsId: string): Promise<any> {
    return await this.services.query.getNewsExtractionResult(newsId);
  }

  // ======= 统计相关方法 =======

  /**
   * 获取统计信息
   */
  async getStats(): Promise<any> {
    const entityStats = await this.services.query.getEntityStats();
    const relationshipStats = await this.services.query.getRelationshipStats();
    
    return {
      nodes: Object.values(entityStats).reduce((sum: number, count: any) => sum + count, 0),
      relationships: relationshipStats.reduce((sum, stat) => sum + stat.count, 0),
      news: entityStats.News || 0,
      companies: entityStats.Company || 0,
      persons: entityStats.Person || 0,
      events: entityStats.Event || 0,
      locations: entityStats.Location || 0,
      times: entityStats.Time || 0,
      entity_breakdown: entityStats,
      relationship_breakdown: relationshipStats
    };
  }

  // ======= 通知相关方法 =======

  /**
   * 发送突发新闻通知
   */
  async sendBreakingNewsNotification(hours: number = 24): Promise<boolean> {
    const breakingNews = await this.services.query.getBreakingNews(hours);
    return await this.services.notification.sendBreakingNewsNotification(
      breakingNews, 
      `${hours}小时内`
    );
  }

  /**
   * 发送处理进度通知
   */
  async sendProcessingProgress(progress: any): Promise<boolean> {
    return await this.services.notification.sendProcessingProgress(progress);
  }

  // ======= 工具方法 =======

  /**
   * 检查新闻是否已处理
   */
  async isNewsProcessed(newsId: string): Promise<boolean> {
    return await this.services.query.isNewsProcessed(newsId);
  }

  /**
   * 批量检查新闻处理状态
   */
  async getUnprocessedNewsIds(newsIds: string[]): Promise<string[]> {
    return await this.services.query.getUnprocessedNewsIds(newsIds);
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<any> {
    const serviceHealths = [];
    
    // 检查所有服务的健康状态
    for (const [name, service] of Object.entries(this.services)) {
      try {
        const health = await service.healthCheck();
        serviceHealths.push({
          name,
          status: health.status,
          details: health
        });
      } catch (error) {
        serviceHealths.push({
          name,
          status: 'unhealthy',
          error: error.message
        });
      }
    }

    const allHealthy = serviceHealths.every(s => s.status === 'healthy');
    
    return {
      status: allHealthy ? 'healthy' : 'unhealthy',
      service: 'KnowledgeGraphServiceV2',
      timestamp: new Date().toISOString(),
      services: serviceHealths
    };
  }

  /**
   * 获取服务信息
   */
  getServiceInfo(): any {
    return {
      version: '2.0',
      services: Object.keys(this.services),
      initialized: this.initialized,
      description: '重构版本的知识图谱服务，采用高内聚低耦合设计'
    };
  }
}

export default new KnowledgeGraphServiceV2(); 
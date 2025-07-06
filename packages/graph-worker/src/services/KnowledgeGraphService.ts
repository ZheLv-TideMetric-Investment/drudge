import { logger } from '../utils/logger';
import { EntityExtractionService } from './EntityExtractionService';
import { EntityService } from './EntityService';
import relationshipService from './RelationshipService';
import { 
  NewsItem, 
  NewsExtractionResult, 
  ProcessResult, 
  BatchSummary 
} from '../types/index';

/**
 * 知识图谱服务
 * 整合实体提取、实体管理和关系管理功能
 */
export class KnowledgeGraphService {
  private entityExtractionService: EntityExtractionService;
  private entityService: EntityService;
  private initialized: boolean = false;

  constructor() {
    this.entityExtractionService = new EntityExtractionService();
    this.entityService = new EntityService();
  }

  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    try {
      logger.info('🕸️ 正在初始化知识图谱服务...');
      
      // 初始化子服务（它们现在共享同一个 Neo4j 实例）
      await this.entityService.initialize();
      await relationshipService.initialize();
      
      // 创建数据库索引
      await this.entityService['neo4j'].createIndexes();
      
      this.initialized = true;
      logger.info('✅ 知识图谱服务初始化完成');
    } catch (error) {
      logger.error('❌ 知识图谱服务初始化失败:', error);
      throw error;
    }
  }

  /**
   * 处理单条新闻
   */
  async processNews(newsItem: NewsItem): Promise<ProcessResult> {
    try {
      logger.info(`📊 开始处理新闻: ${newsItem.id}`);

      // 检查是否已处理
      const isProcessed = await this.entityService.isNewsProcessed(newsItem.id);
      if (isProcessed) {
        logger.info(`新闻 ${newsItem.id} 已处理过，跳过`);
        return {
          success: true,
          newsId: newsItem.id,
          processed_at: new Date().toISOString()
        };
      }

      // 1. 提取六要素
      const extractionResult = await this.entityExtractionService.extractFromNews(newsItem);
      
      // 2. 存储实体到图数据库
      await this.entityService.batchCreateEntities(extractionResult);
      
      // 3. 创建关系
      await relationshipService.createRelationship(
        { from: '', to: '', type: 'OTHER', description: '', confidence: 0.8 }, 
        extractionResult.newsId || ''
      );
      
      // 4. 批量创建所有关系
      for (const relationship of extractionResult.relationships) {
        await relationshipService.createRelationship(relationship, extractionResult.newsId || '');
      }
      
      // 5. 创建推断关系
      await relationshipService.createInferredRelationships([extractionResult]);
      
      const stats = {
        events: extractionResult.events.length,
        companies: extractionResult.companies.length,
        persons: extractionResult.persons?.length || 0,
        organizations: extractionResult.organizations.length,
        locations: extractionResult.locations.length,
        times: extractionResult.times.length,
        relationships: extractionResult.relationships.length
      };

      logger.info(`✅ 新闻处理完成: ${newsItem.id}`, stats);

      return {
        success: true,
        newsId: newsItem.id,
        processed_at: new Date().toISOString(),
        stats
      };

    } catch (error: any) {
      logger.error(`❌ 处理新闻失败: ${newsItem.id}`, error);
      
      return {
        success: false,
        newsId: newsItem.id,
        processed_at: new Date().toISOString(),
        error: error.message
      };
    }
  }

  /**
   * 批量处理新闻
   */
  async batchProcessNews(newsItems: NewsItem[]): Promise<ProcessResult[]> {
    logger.info(`🔄 开始批量处理新闻: ${newsItems.length} 条`);
    
    const results: ProcessResult[] = [];
    
    // 先过滤出未处理的新闻
    const newsIds = newsItems.map(item => item.id);
    const unprocessedIds = await this.entityService.getUnprocessedNewsIds(newsIds);
    const unprocessedNews = newsItems.filter(item => unprocessedIds.includes(item.id));
    
    if (unprocessedNews.length === 0) {
      logger.info('所有新闻都已处理过');
      return newsItems.map(item => ({
        success: true,
        newsId: item.id,
        processed_at: new Date().toISOString()
      }));
    }

    logger.info(`需要处理 ${unprocessedNews.length} 条未处理新闻`);

    // 批量提取实体
    const extractionResults = await this.entityExtractionService.batchExtractEntities(unprocessedNews);
    
    // 批量存储实体到图数据库
    for (const extractionResult of extractionResults) {
      try {
        await this.entityService.batchCreateEntities(extractionResult);
        
        const stats = {
          events: extractionResult.events.length,
          companies: extractionResult.companies.length,
          persons: extractionResult.persons?.length || 0,
          organizations: extractionResult.organizations.length,
          locations: extractionResult.locations.length,
          times: extractionResult.times.length,
          relationships: extractionResult.relationships.length
        };

        results.push({
          success: true,
          newsId: extractionResult.newsId || '',
          processed_at: new Date().toISOString(),
          stats
        });

      } catch (error: any) {
        logger.error(`批量处理失败: ${extractionResult.newsId}`, error);
        results.push({
          success: false,
          newsId: extractionResult.newsId || '',
          processed_at: new Date().toISOString(),
          error: error.message
        });
      }
    }

    // 批量创建关系
    try {
      await relationshipService.batchCreateRelationships(extractionResults);
      
      // 创建推断关系
      await relationshipService.createInferredRelationships(extractionResults);
      
      logger.info(`✅ 批量关系创建完成`);
    } catch (error: any) {
      logger.error(`❌ 批量关系创建失败:`, error);
    }

    logger.info(`✅ 批量处理完成: ${results.length} 条新闻`);
    return results;
  }

  /**
   * 检查新闻是否已处理
   */
  async isNewsProcessed(newsId: string): Promise<boolean> {
    return await this.entityService.isNewsProcessed(newsId);
  }

  /**
   * 获取图谱统计信息
   */
  async getGraphStats(): Promise<any> {
    try {
      const dbStats = await this.entityService['neo4j'].getDbStats();
      const healthStatus = await this.entityService['neo4j'].healthCheck();
      
      return {
        success: true,
        timestamp: new Date().toISOString(),
        version: '2.0.0', // 图谱服务版本
        initialized: this.initialized,
        services: {
          '知识图谱服务': this.initialized ? '✅ 运行中' : '❌ 未初始化',
          '实体提取服务': '✅ 运行中',
          '关系服务': '✅ 运行中',
          'Neo4j数据库': healthStatus ? '✅ 连接正常' : '❌ 连接异常'
        },
        database: {
          status: healthStatus ? '正常' : '异常',
          service: 'Neo4j',
          neo4j_connection: healthStatus ? '已连接' : '连接失败',
          nodes: dbStats.nodes || { total: 0, byLabel: [] },
          relationships: dbStats.relationships || { total: 0, byType: [] }
        },
        stats: dbStats
      };
    } catch (error: any) {
      logger.error('获取图谱统计信息失败:', error);
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        initialized: false,
        services: {
          '知识图谱服务': '❌ 错误',
          '实体提取服务': '❌ 错误',
          '关系服务': '❌ 错误',
          'Neo4j数据库': '❌ 错误'
        },
        database: {
          status: '异常',
          service: 'Neo4j',
          neo4j_connection: '连接失败'
        }
      };
    }
  }

  /**
   * 搜索实体
   */
  async searchEntities(query: string, limit: number = 10): Promise<any[]> {
    try {
      // 确保 limit 是正整数
      const safeLimit = Math.max(1, Math.floor(Number(limit)) || 10);
      
      // 使用 Neo4j Integer 类型确保整数传递
      const neo4j = require('neo4j-driver');
      
      let cypher: string;
      let params: any;
      
      // 如果查询为空或为通配符，返回所有节点
      if (!query || query.trim() === '' || query === '*') {
        cypher = `
          MATCH (n)
          RETURN labels(n) as labels, n
          LIMIT $limit
        `;
        params = { limit: neo4j.int(safeLimit) };
      } else {
        // 使用更灵活的查询，检查节点的所有字符串属性
        cypher = `
          MATCH (n)
          WHERE ANY(prop IN keys(n) WHERE toString(n[prop]) CONTAINS $query)
          RETURN labels(n) as labels, n
          LIMIT $limit
        `;
        params = { query, limit: neo4j.int(safeLimit) };
      }
      
      const result = await this.entityService['neo4j'].executeQuery(cypher, params);
      
      return result.records.map((record: any) => ({
        labels: record.get('labels'),
        properties: record.get('n').properties
      }));

    } catch (error: any) {
      logger.error('搜索实体失败:', error);
      return [];
    }
  }

  /**
   * 获取实体关系图
   */
  async getEntityRelations(entityName: string, depth: number = 2): Promise<any> {
    try {
      return await relationshipService.getEntityRelationships(entityName, depth * 25);
    } catch (error: any) {
      logger.error('获取实体关系图失败:', error);
      return { nodes: [], relationships: [], center: entityName };
    }
  }

  /**
   * 关闭服务
   */
  async close(): Promise<void> {
    if (this.entityService) {
      await this.entityService.close();
    }
    if (relationshipService) {
      await relationshipService.close();
    }
    this.initialized = false;
  }
}

// 导出单例
export default new KnowledgeGraphService(); 
import { logger } from '../utils/logger';
import { EntityExtractionService } from './EntityExtractionService';
import { EntityService } from './EntityService';
import relationshipService from './RelationshipService';
import config from '../config/config';
import { getCurrentTime } from '../utils/timeUtils';
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
          processed_at: getCurrentTime()
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
        relationships: extractionResult.relationships.length
      };

      logger.info(`✅ 新闻处理完成: ${newsItem.id}`, stats);

      return {
        success: true,
        newsId: newsItem.id,
        processed_at: getCurrentTime(),
        stats
      };

    } catch (error: any) {
      logger.error(`❌ 处理新闻失败: ${newsItem.id}`, error);
      
      return {
        success: false,
        newsId: newsItem.id,
        processed_at: getCurrentTime(),
        error: error.message
      };
    }
  }

  /**
   * 批量处理新闻 - 优化版本，分块处理避免内存溢出
   */
  async batchProcessNews(newsItems: NewsItem[]): Promise<ProcessResult[]> {
    logger.info(`🔄 开始批量处理新闻: ${newsItems.length} 条`);
    
    const allResults: ProcessResult[] = [];
    
    // 先过滤出未处理的新闻
    const newsIds = newsItems.map(item => item.id);
    const unprocessedIds = await this.entityService.getUnprocessedNewsIds(newsIds);
    const unprocessedNews = newsItems.filter(item => unprocessedIds.includes(item.id));
    
    if (unprocessedNews.length === 0) {
      logger.info('所有新闻都已处理过');
      return newsItems.map(item => ({
        success: true,
        newsId: item.id,
        processed_at: getCurrentTime()
      }));
    }

    logger.info(`需要处理 ${unprocessedNews.length} 条未处理新闻`);

    // 从配置文件读取分块处理配置
    const PROCESSING_CHUNK_SIZE = config.processing.memory.processingChunkSize;
    const CHUNK_DELAY = config.processing.memory.chunkDelayMs * 2; // 处理分块间隔稍长一些
    const MEMORY_THRESHOLD = config.processing.memory.dangerThreshold * config.processing.memory.maxHeapSizeMB * 1024 * 1024;
    
    logger.info(`📊 处理配置: 分块大小=${PROCESSING_CHUNK_SIZE}, 延迟=${CHUNK_DELAY}ms`);
    
    // 分块处理未处理的新闻
    for (let chunkStart = 0; chunkStart < unprocessedNews.length; chunkStart += PROCESSING_CHUNK_SIZE) {
      const newsChunk = unprocessedNews.slice(chunkStart, chunkStart + PROCESSING_CHUNK_SIZE);
      const chunkIndex = Math.floor(chunkStart / PROCESSING_CHUNK_SIZE) + 1;
      const totalChunks = Math.ceil(unprocessedNews.length / PROCESSING_CHUNK_SIZE);
      
      logger.info(`🔄 处理新闻分块 ${chunkIndex}/${totalChunks}: ${newsChunk.length} 条新闻`);
      
      // 记录内存使用情况
      const memoryBefore = process.memoryUsage();
      logger.debug(`内存使用 (分块${chunkIndex}开始): ${Math.round(memoryBefore.heapUsed / 1024 / 1024)}MB`);
      
      try {
        // 批量提取当前分块的实体
        const extractionResults = await this.entityExtractionService.batchExtractEntities(newsChunk);
        
        // 立即处理提取结果，避免累积在内存中
        const chunkResults = await this.processExtractionResults(extractionResults);
        allResults.push(...chunkResults);
        
        // 记录分块处理后的内存使用情况
        const memoryAfter = process.memoryUsage();
        logger.debug(`内存使用 (分块${chunkIndex}结束): ${Math.round(memoryAfter.heapUsed / 1024 / 1024)}MB`);
        
        // 如果内存使用过高，触发垃圾回收
        if (memoryAfter.heapUsed > MEMORY_THRESHOLD) {
          logger.warn(`⚠️ 内存使用达到${Math.round(memoryAfter.heapUsed / 1024 / 1024)}MB，触发垃圾回收`);
          if (global.gc && config.processing.memory.enableAutoGC) {
            global.gc();
            const memoryAfterGC = process.memoryUsage();
            logger.info(`🗑️ 垃圾回收完成，内存释放到${Math.round(memoryAfterGC.heapUsed / 1024 / 1024)}MB`);
          }
        }
        
        logger.info(`✅ 分块${chunkIndex}处理完成: ${chunkResults.filter(r => r.success).length} 条成功`);
        
      } catch (error: any) {
        logger.error(`❌ 分块${chunkIndex}处理失败:`, error);
        
        // 为失败的分块创建失败结果
        const failedResults = newsChunk.map(newsItem => ({
          success: false,
          newsId: newsItem.id,
          processed_at: getCurrentTime(),
          error: `分块处理失败: ${error.message}`
        }));
        allResults.push(...failedResults);
      }
      
      // 分块间添加延迟，给系统休息时间
      if (chunkStart + PROCESSING_CHUNK_SIZE < unprocessedNews.length) {
        await new Promise(resolve => setTimeout(resolve, CHUNK_DELAY));
      }
    }

    // 批量创建关系（使用已处理的结果）
    try {
      // 分批创建关系，避免一次性处理所有关系
      const successfulResults = allResults.filter(r => r.success);
      if (successfulResults.length > 0) {
        logger.info(`🔗 开始创建关系: ${successfulResults.length} 条成功处理的新闻`);
        // 这里可以根据需要进一步优化关系创建过程
      }
      
    } catch (error: any) {
      logger.error(`❌ 批量关系创建失败:`, error);
    }

    const successful = allResults.filter(r => r.success).length;
    const failed = allResults.filter(r => !r.success).length;
    
    logger.info(`✅ 批量处理完成: 成功 ${successful} 条，失败 ${failed} 条，总计 ${allResults.length} 条新闻`);
    return allResults;
  }

  /**
   * 处理提取结果，立即写入数据库
   */
  private async processExtractionResults(extractionResults: NewsExtractionResult[]): Promise<ProcessResult[]> {
    const results: ProcessResult[] = [];
    
    // 逐个处理提取结果，避免批量累积
    for (const extractionResult of extractionResults) {
      try {
        await this.entityService.batchCreateEntities(extractionResult);
        
        const stats = {
          events: extractionResult.events.length,
          companies: extractionResult.companies.length,
          persons: extractionResult.persons?.length || 0,
          organizations: extractionResult.organizations.length,
          locations: extractionResult.locations.length,
          relationships: extractionResult.relationships.length
        };

        results.push({
          success: true,
          newsId: extractionResult.newsId || '',
          processed_at: getCurrentTime(),
          stats
        });

      } catch (error: any) {
        logger.error(`批量处理失败: ${extractionResult.newsId}`, error);
        results.push({
          success: false,
          newsId: extractionResult.newsId || '',
          processed_at: getCurrentTime(),
          error: error.message
        });
      }
    }
    
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
        timestamp: getCurrentTime(),
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
        timestamp: getCurrentTime(),
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
        // 使用安全的查询方式，只对已知的字符串属性进行搜索，避免数组属性
        cypher = `
          MATCH (n)
          WHERE 
            (n.company_name IS NOT NULL AND toString(n.company_name) CONTAINS $query) OR
            (n.person_name IS NOT NULL AND toString(n.person_name) CONTAINS $query) OR
            (n.organization_name IS NOT NULL AND toString(n.organization_name) CONTAINS $query) OR
            (n.location_name IS NOT NULL AND toString(n.location_name) CONTAINS $query) OR
            (n.event_name IS NOT NULL AND toString(n.event_name) CONTAINS $query) OR
            (n.title IS NOT NULL AND toString(n.title) CONTAINS $query) OR
            (n.time_value IS NOT NULL AND toString(n.time_value) CONTAINS $query) OR
            (n.ticker IS NOT NULL AND toString(n.ticker) CONTAINS $query) OR
            (n.industry IS NOT NULL AND toString(n.industry) CONTAINS $query) OR
            (n.event_description IS NOT NULL AND toString(n.event_description) CONTAINS $query)
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
import logger from '../../shared/utils/logger.js';

/**
 * 新闻处理应用服务
 * 协调各种服务来处理新闻并构建知识图谱
 */
class NewsProcessingService {
  constructor({
    neo4jRepository,
    entityExtractionService,
    entityCreationService,
    relationshipService
  }) {
    this.neo4jRepo = neo4jRepository;
    this.entityExtraction = entityExtractionService;
    this.entityCreation = entityCreationService;
    this.relationships = relationshipService;
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
    const cypher = `
      MATCH (n:News {id: $newsId, processed: true})
      RETURN n
      LIMIT 1
    `;
    
    const result = await this.neo4jRepo.executeQuery(cypher, { newsId });
    return result.records.length > 0;
  }

  /**
   * 批量检查新闻是否已处理过
   */
  async getUnprocessedNewsIds(newsIds) {
    if (newsIds.length === 0) return [];
    
    const cypher = `
      WITH $newsIds as ids
      UNWIND ids as newsId
      OPTIONAL MATCH (n:News {id: newsId, processed: true})
      WITH newsId, n
      WHERE n IS NULL
      RETURN newsId
    `;
    
    const result = await this.neo4jRepo.executeQuery(cypher, { newsIds });
    return result.records.map(record => record.get('newsId'));
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

      // 1. 提取新闻实体
      const extractionResult = await this.entityExtraction.extractFromNews(newsItem);

      if (extractionResult.events.length === 0) {
        logger.info(`新闻 ${newsItem.id} 未提取到有效事件`);
        await this.entityCreation.createNewsNode(newsItem, extractionResult.news_level || 'Level 5');
        return { success: true, stats: extractionResult.getStats(), extractionResult };
      }

      // 2. 创建新闻节点
      await this.entityCreation.createNewsNode(newsItem, extractionResult.news_level);

      // 3. 创建实体节点
      const createdNodes = await this.entityCreation.createAllEntities(extractionResult, newsItem.id);

      // 4. 建立关系
      await this.relationships.createAllRelationships(extractionResult, newsItem.id);

      const stats = {
        ...extractionResult.getStats(),
        created_nodes: createdNodes,
        news_level: extractionResult.news_level
      };

      logger.info(`新闻 ${newsItem.id} 图谱构建完成:`, stats);
      return { success: true, stats, extractionResult };
    } catch (error) {
      logger.error(`处理新闻 ${newsItem.id} 失败:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 批量处理新闻
   */
  async batchProcessNews(newsItems, batchSize = 5) {
    if (newsItems.length === 0) {
      return [];
    }

    logger.info(`开始批量处理${newsItems.length}条新闻，批量大小: ${batchSize}`);

    const results = [];
    const totalBatches = Math.ceil(newsItems.length / batchSize);

    for (let i = 0; i < newsItems.length; i += batchSize) {
      const currentBatch = i / batchSize + 1;
      const batch = newsItems.slice(i, i + batchSize);
      
      logger.info(`开始批量提取第${currentBatch}批，共${batch.length}条新闻`);

      try {
        // 1. 批量提取实体
        const extractionResults = await this.entityExtraction.batchExtractFromNews(batch);

        // 2. 批量创建新闻节点
        await this.entityCreation.batchCreateNewsNodes(batch, extractionResults);

        // 3. 批量创建实体和关系
        await this.entityCreation.batchCreateEntitiesAndRelationships(extractionResults);

        // 4. 处理结果
        for (let j = 0; j < batch.length; j++) {
          const newsItem = batch[j];
          const extractionResult = extractionResults[j];
          
          if (extractionResult && extractionResult.success) {
            results.push({
              success: true,
              stats: extractionResult.getStats(),
              extractionResult: extractionResult
            });
          } else {
            results.push({
              success: false,
              error: '提取失败',
              newsId: newsItem.id
            });
          }
        }

        logger.info(`批量处理第${currentBatch}/${totalBatches}批完成`);
      } catch (error) {
        logger.error(`批量处理第${currentBatch}批失败:`, error);
        
        // 为这一批的所有新闻添加失败结果
        for (const newsItem of batch) {
          results.push({
            success: false,
            error: error.message,
            newsId: newsItem.id
          });
        }
      }
    }

    logger.info(`批量处理完成，总计处理${newsItems.length}条新闻`);
    return results;
  }

  /**
   * 获取统计信息
   */
  async getStats() {
    return await this.neo4jRepo.getGraphStats();
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    return await this.neo4jRepo.healthCheck();
  }
}

export default NewsProcessingService; 
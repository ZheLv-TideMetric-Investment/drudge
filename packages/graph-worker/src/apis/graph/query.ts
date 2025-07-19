import { logger } from '../../utils/logger';
import knowledgeGraphService from '../../services/KnowledgeGraphService';
import neo4jService from '../../services/Neo4jService';
import { getCurrentTime } from '../../utils/timeUtils';

/**
 * 获取图谱统计信息
 */
export async function getGraphStats(): Promise<any> {
  try {
    logger.info('📊 获取图谱统计信息...');
    
    const stats = await knowledgeGraphService.getGraphStats();
    
    return {
      success: true,
      stats,
      timestamp: getCurrentTime()
    };

  } catch (error: any) {
    logger.error('❌ 获取图谱统计信息失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 搜索实体
 */
export async function searchEntities(query: string, limit: number = 10): Promise<any> {
  try {
    logger.info(`🔍 搜索实体: ${query}`);
    
    const entities = await knowledgeGraphService.searchEntities(query, limit);
    
    return {
      success: true,
      query,
      entities,
      count: entities.length
    };

  } catch (error: any) {
    logger.error('❌ 搜索实体失败:', error);
    return {
      success: false,
      error: error.message,
      query
    };
  }
}

/**
 * 获取实体关系图
 */
export async function getEntityRelations(entityName: string, depth: number = 2): Promise<any> {
  try {
    logger.info(`🕸️ 获取实体关系图: ${entityName} (深度: ${depth})`);
    
    const relations = await knowledgeGraphService.getEntityRelations(entityName, depth);
    
    return {
      success: true,
      entityName,
      depth,
      relations
    };

  } catch (error: any) {
    logger.error('❌ 获取实体关系图失败:', error);
    return {
      success: false,
      error: error.message,
      entityName
    };
  }
}

/**
 * 查询新闻列表
 */
export async function getNewsList(limit: number = 10, level?: string): Promise<any> {
  try {
    logger.info(`📰 查询新闻列表: ${limit} 条${level ? `, 级别: ${level}` : ''}`);

    let query = `
      MATCH (n:News)
      ${level ? 'WHERE n.level = $level' : ''}
      RETURN n.id as id, n.title as title, n.level as level, 
             n.timestamp as timestamp, n.processedAt as processedAt
      ORDER BY n.processedAt DESC
      LIMIT $limit
    `;

    const params: any = { limit };
    if (level) {
      params.level = level;
    }

    const result = await neo4jService.executeQuery(query, params);

    const news = result.records.map((record: any) => ({
      id: record.get('id'),
      title: record.get('title'),
      level: record.get('level'),
      timestamp: record.get('timestamp'),
      processedAt: record.get('processedAt')
    }));

    return {
      success: true,
      news,
      count: news.length,
      filters: { level, limit }
    };

  } catch (error: any) {
    logger.error('❌ 查询新闻列表失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 获取新闻详情
 */
export async function getNewsDetail(newsId: string): Promise<any> {
  try {
    logger.info(`📋 获取新闻详情: ${newsId}`);

    // 获取新闻基本信息
    const newsResult = await neo4jService.executeQuery(`
      MATCH (n:News {id: $newsId})
      RETURN n
    `, { newsId });

    if (newsResult.records.length === 0) {
      return {
        success: false,
        error: '新闻不存在',
        newsId
      };
    }

    const newsNode = newsResult.records[0].get('n');

    // 获取相关实体
    const entitiesResult = await neo4jService.executeQuery(`
      MATCH (n:News {id: $newsId})-[r]->(entity)
      RETURN type(r) as relationType, labels(entity) as entityLabels, entity
    `, { newsId });

    const entities = entitiesResult.records.map((record: any) => ({
      relationType: record.get('relationType'),
      entityLabels: record.get('entityLabels'),
      entity: record.get('entity').properties
    }));

    return {
      success: true,
      newsId,
      news: newsNode.properties,
      entities,
      entityCount: entities.length
    };

  } catch (error: any) {
    logger.error('❌ 获取新闻详情失败:', error);
    return {
      success: false,
      error: error.message,
      newsId
    };
  }
}

/**
 * 获取热门实体
 */
export async function getPopularEntities(limit: number = 10): Promise<any> {
  try {
    logger.info(`🔥 获取热门实体: ${limit} 个`);

    const result = await neo4jService.executeQuery(`
      MATCH (entity)<-[:INVOLVES|:LOCATED_AT]-(n:News)
      WHERE entity.name IS NOT NULL
      RETURN labels(entity) as labels, entity.name as name, count(n) as newsCount
      ORDER BY newsCount DESC
      LIMIT $limit
    `, { limit });

    const entities = result.records.map((record: any) => ({
      labels: record.get('labels'),
      name: record.get('name'),
      newsCount: record.get('newsCount').toNumber()
    }));

    return {
      success: true,
      entities,
      count: entities.length
    };

  } catch (error: any) {
    logger.error('❌ 获取热门实体失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 查询实体相关新闻
 */
export async function getEntityNews(entityName: string, limit: number = 10): Promise<any> {
  try {
    logger.info(`📰 查询实体相关新闻: ${entityName} (${limit} 条)`);

    const result = await neo4jService.executeQuery(`
      MATCH (entity {name: $entityName})<-[r]-(n:News)
      RETURN n.id as id, n.title as title, n.level as level, 
             n.timestamp as timestamp, type(r) as relationType
      ORDER BY n.timestamp DESC
      LIMIT $limit
    `, { entityName, limit });

    const news = result.records.map((record: any) => ({
      id: record.get('id'),
      title: record.get('title'),
      level: record.get('level'),
      timestamp: record.get('timestamp'),
      relationType: record.get('relationType')
    }));

    return {
      success: true,
      entityName,
      news,
      count: news.length
    };

  } catch (error: any) {
    logger.error('❌ 查询实体相关新闻失败:', error);
    return {
      success: false,
      error: error.message,
      entityName
    };
  }
}

/**
 * 获取新闻级别分布
 */
export async function getNewsLevelDistribution(): Promise<any> {
  try {
    logger.info('📊 获取新闻级别分布...');

    const result = await neo4jService.executeQuery(`
      MATCH (n:News)
      WHERE n.level IS NOT NULL
      RETURN n.level as level, count(n) as count
      ORDER BY n.level
    `);

    const distribution = result.records.map((record: any) => ({
      level: record.get('level'),
      count: record.get('count').toNumber()
    }));

    const total = distribution.reduce((sum: number, item: any) => sum + item.count, 0);

    return {
      success: true,
      distribution,
      total
    };

  } catch (error: any) {
    logger.error('❌ 获取新闻级别分布失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
} 
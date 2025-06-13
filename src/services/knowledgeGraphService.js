import neo4jService from './neo4jService.js';
import entityExtractionService from './entityExtractionService.js';
import logger from '../utils/logger.js';
import {
  EntityNode,
  EventNode,
  NewsNode,
  Relationship,
  GraphQueryResult,
  RelationshipTypes,
  EntityTypes,
} from '../models/GraphModels.js';

/**
 * 知识图谱服务
 * 负责构建、维护和查询新闻事件网络图
 */
class KnowledgeGraphService {
  constructor() {
    this.initialized = false;
  }

  /**
   * 初始化服务
   */
  async initialize() {
    try {
      if (!neo4jService.isConnected()) {
        await neo4jService.connect();
      }
      this.initialized = true;
      logger.info('知识图谱服务初始化完成');
    } catch (error) {
      logger.error('知识图谱服务初始化失败:', error);
      throw error;
    }
  }

  /**
   * 处理新闻并构建知识图谱
   * @param {Object} newsItem - 新闻对象
   * @returns {Object} - 处理结果
   */
  async processNews(newsItem) {
    try {
      logger.info(`开始处理新闻: ${newsItem.id}`);

      // 提取实体和事件
      const extractionResult = await entityExtractionService.extractFromNews(newsItem);

      if (extractionResult.entities.length === 0 && extractionResult.events.length === 0) {
        logger.info(`新闻 ${newsItem.id} 未提取到有效实体或事件`);
        return { success: true, stats: extractionResult.getStats() };
      }

      // 创建新闻节点
      await this.createNewsNode(newsItem);

      // 处理实体
      const entityNodes = await this.processEntities(extractionResult.entities, newsItem.id);

      // 处理事件
      const eventNodes = await this.processEvents(extractionResult.events, newsItem.id);

      // 处理关系
      await this.processRelationships(extractionResult.relationships, newsItem.id);

      // 建立实体与新闻的关系
      await this.linkEntitiesToNews(entityNodes, newsItem.id);

      // 建立事件与新闻的关系
      await this.linkEventsToNews(eventNodes, newsItem.id);

      const stats = {
        ...extractionResult.getStats(),
        createdEntityNodes: entityNodes.length,
        createdEventNodes: eventNodes.length,
      };

      logger.info(`新闻 ${newsItem.id} 处理完成:`, stats);
      return { success: true, stats };
    } catch (error) {
      logger.error(`处理新闻 ${newsItem.id} 失败:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 批量处理新闻
   * @param {Array} newsItems - 新闻数组
   */
  async batchProcessNews(newsItems) {
    const results = [];
    for (const newsItem of newsItems) {
      const result = await this.processNews(newsItem);
      results.push({ newsId: newsItem.id, ...result });
    }
    return results;
  }

  /**
   * 创建新闻节点
   */
  async createNewsNode(newsItem) {
    const cypher = `
      MERGE (n:News {id: $id})
      SET n.title = $title,
          n.content = $content,
          n.timestamp = $timestamp,
          n.source = $source,
          n.url = $url,
          n.level = $level,
          n.processed = true,
          n.createdAt = $createdAt,
          n.updatedAt = $updatedAt
      RETURN n
    `;

    const parameters = {
      id: newsItem.id,
      title: newsItem.title,
      content: newsItem.content,
      timestamp: new Date(newsItem.time * 1000).toISOString(),
      source: newsItem.source || '',
      url: newsItem.url || '',
      level: newsItem.level || 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await neo4jService.executeQuery(cypher, parameters);
  }

  /**
   * 处理实体
   */
  async processEntities(entities, newsId) {
    const createdEntities = [];

    for (const entity of entities) {
      try {
        // 查找是否存在相同或相似的实体
        const existingEntity = await this.findSimilarEntity(entity);

        if (existingEntity) {
          // 更新现有实体
          await this.updateEntity(existingEntity.name, entity);
          createdEntities.push(existingEntity);
          logger.debug(`实体 "${entity.name}" 合并到现有实体 "${existingEntity.name}"`);
        } else {
          // 创建新实体
          const newEntity = await this.createEntity(entity);
          createdEntities.push(newEntity);
          logger.debug(`创建新实体: "${entity.name}"`);
        }
      } catch (error) {
        logger.error(`处理实体 "${entity.name}" 失败:`, error);
      }
    }

    return createdEntities;
  }

  /**
   * 查找相似实体
   */
  async findSimilarEntity(entity) {
    // 首先精确匹配
    let cypher = `
      MATCH (e:Entity)
      WHERE e.name = $name OR $name IN e.aliases
      RETURN e LIMIT 1
    `;

    let result = await neo4jService.executeQuery(cypher, { name: entity.name });

    if (result.records.length > 0) {
      return result.records[0].get('e').properties;
    }

    // 模糊匹配（针对同类型实体）
    cypher = `
      MATCH (e:Entity {type: $type})
      WHERE e.name CONTAINS $namePart OR ANY(alias IN e.aliases WHERE alias CONTAINS $namePart)
      RETURN e, 
             CASE 
               WHEN e.name = $name THEN 1.0
               WHEN $name IN e.aliases THEN 0.9
               WHEN e.name CONTAINS $name OR $name CONTAINS e.name THEN 0.8
               ELSE 0.7
             END as similarity
      ORDER BY similarity DESC
      LIMIT 1
    `;

    const namePart = entity.name.length > 2 ? entity.name.substring(0, Math.min(entity.name.length, 3)) : entity.name;

    result = await neo4jService.executeQuery(cypher, {
      type: entity.type,
      name: entity.name,
      namePart,
    });

    if (result.records.length > 0 && result.records[0].get('similarity') > 0.7) {
      return result.records[0].get('e').properties;
    }

    return null;
  }

  /**
   * 创建实体
   */
  async createEntity(entity) {
    const cypher = `
      CREATE (e:Entity {
        name: $name,
        type: $type,
        aliases: $aliases,
        description: $description,
        confidence: $confidence,
        createdAt: $createdAt,
        updatedAt: $updatedAt
      })
      RETURN e
    `;

    const parameters = {
      name: entity.name,
      type: entity.type,
      aliases: entity.aliases,
      description: entity.description,
      confidence: entity.confidence,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };

    const result = await neo4jService.executeQuery(cypher, parameters);
    return result.records[0].get('e').properties;
  }

  /**
   * 更新实体
   */
  async updateEntity(existingName, newEntity) {
    const cypher = `
      MATCH (e:Entity {name: $existingName})
      SET e.aliases = e.aliases + [alias IN $newAliases WHERE NOT alias IN e.aliases],
          e.description = CASE WHEN $newDescription <> '' THEN $newDescription ELSE e.description END,
          e.confidence = ($confidence + e.confidence) / 2,
          e.updatedAt = $updatedAt
      RETURN e
    `;

    const newAliases = [newEntity.name, ...newEntity.aliases].filter(alias => alias !== existingName);

    await neo4jService.executeQuery(cypher, {
      existingName,
      newAliases,
      newDescription: newEntity.description,
      confidence: newEntity.confidence,
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * 处理事件
   */
  async processEvents(events, newsId) {
    const createdEvents = [];

    for (const event of events) {
      try {
        const eventNode = await this.createEvent(event, newsId);
        createdEvents.push(eventNode);
        logger.debug(`创建事件: "${event.description}"`);
      } catch (error) {
        logger.error(`处理事件失败:`, error);
      }
    }

    return createdEvents;
  }

  /**
   * 创建事件
   */
  async createEvent(event, newsId) {
    const eventId = `${event.type}_${newsId}_${Date.now()}`;

    const cypher = `
      CREATE (e:Event {
        id: $id,
        type: $type,
        description: $description,
        sentiment: $sentiment,
        magnitude: $magnitude,
        timestamp: $timestamp,
        location: $location,
        source: $source,
        createdAt: $createdAt
      })
      RETURN e
    `;

    const parameters = {
      id: eventId,
      type: event.type,
      description: event.description,
      sentiment: event.sentiment,
      magnitude: event.magnitude,
      timestamp: event.timestamp,
      location: event.location,
      source: newsId,
      createdAt: event.createdAt,
    };

    const result = await neo4jService.executeQuery(cypher, parameters);
    return result.records[0].get('e').properties;
  }

  /**
   * 处理关系
   */
  async processRelationships(relationships, newsId) {
    for (const rel of relationships) {
      try {
        await this.createRelationship(rel);
        logger.debug(`创建关系: ${rel.from} ${rel.type} ${rel.to}`);
      } catch (error) {
        logger.error(`创建关系失败:`, error);
      }
    }
  }

  /**
   * 创建关系
   */
  async createRelationship(relationship) {
    const cypher = `
      MATCH (from:Entity {name: $fromName})
      MATCH (to:Entity {name: $toName})
      MERGE (from)-[r:${relationship.type}]->(to)
      SET r.confidence = $confidence,
          r.description = $description,
          r.source = $source,
          r.createdAt = $createdAt
      RETURN r
    `;

    await neo4jService.executeQuery(cypher, {
      fromName: relationship.from,
      toName: relationship.to,
      confidence: relationship.confidence,
      description: relationship.description,
      source: relationship.source,
      createdAt: new Date().toISOString(),
    });
  }

  /**
   * 建立实体与新闻的关系
   */
  async linkEntitiesToNews(entities, newsId) {
    for (const entity of entities) {
      const cypher = `
        MATCH (e:Entity {name: $entityName})
        MATCH (n:News {id: $newsId})
        MERGE (e)-[r:MENTIONED_IN]->(n)
        SET r.createdAt = $createdAt
      `;

      await neo4jService.executeQuery(cypher, {
        entityName: entity.name,
        newsId,
        createdAt: new Date().toISOString(),
      });
    }
  }

  /**
   * 建立事件与新闻的关系
   */
  async linkEventsToNews(events, newsId) {
    for (const event of events) {
      const cypher = `
        MATCH (e:Event {id: $eventId})
        MATCH (n:News {id: $newsId})
        MERGE (e)-[r:REPORTED_IN]->(n)
        SET r.createdAt = $createdAt
      `;

      await neo4jService.executeQuery(cypher, {
        eventId: event.id,
        newsId,
        createdAt: new Date().toISOString(),
      });
    }
  }

  /**
   * 查询实体相关的所有信息
   */
  async getEntityGraph(entityName, depth = 2) {
    const cypher = `
      MATCH path = (e:Entity {name: $entityName})-[*1..${depth}]-(connected)
      RETURN path
      LIMIT 100
    `;

    const result = await neo4jService.executeQuery(cypher, { entityName });
    return this.buildGraphResult(result);
  }

  /**
   * 查询事件相关的实体
   */
  async getEventEntities(eventType, limit = 50) {
    const cypher = `
      MATCH (e:Event {type: $eventType})-[:REPORTED_IN]->(n:News)<-[:MENTIONED_IN]-(entity:Entity)
      RETURN DISTINCT entity, e, n
      ORDER BY e.timestamp DESC
      LIMIT $limit
    `;

    const result = await neo4jService.executeQuery(cypher, { eventType, limit });
    return this.buildGraphResult(result);
  }

  /**
   * 查询实体的事件时间线
   */
  async getEntityTimeline(entityName, startDate, endDate) {
    const cypher = `
      MATCH (entity:Entity {name: $entityName})-[:MENTIONED_IN]->(n:News)<-[:REPORTED_IN]-(e:Event)
      WHERE e.timestamp >= $startDate AND e.timestamp <= $endDate
      RETURN e, n
      ORDER BY e.timestamp DESC
    `;

    const result = await neo4jService.executeQuery(cypher, {
      entityName,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    });

    return this.buildGraphResult(result);
  }

  /**
   * 查询热门实体
   */
  async getPopularEntities(limit = 20) {
    const cypher = `
      MATCH (e:Entity)-[:MENTIONED_IN]->(n:News)
      WITH e, count(n) as mentions
      ORDER BY mentions DESC
      LIMIT $limit
      RETURN e, mentions
    `;

    const result = await neo4jService.executeQuery(cypher, { limit });
    return result.records.map(record => ({
      entity: record.get('e').properties,
      mentions: record.get('mentions').toNumber(),
    }));
  }

  /**
   * 搜索实体
   */
  async searchEntities(searchTerm, entityType = null, limit = 20) {
    let cypher = `
      MATCH (e:Entity)
      WHERE e.name CONTAINS $searchTerm 
         OR ANY(alias IN e.aliases WHERE alias CONTAINS $searchTerm)
    `;

    const parameters = { searchTerm, limit };

    if (entityType) {
      cypher += ` AND e.type = $entityType`;
      parameters.entityType = entityType;
    }

    cypher += `
      RETURN e
      ORDER BY 
        CASE 
          WHEN e.name = $searchTerm THEN 1
          WHEN e.name STARTS WITH $searchTerm THEN 2
          ELSE 3
        END,
        e.name
      LIMIT $limit
    `;

    const result = await neo4jService.executeQuery(cypher, parameters);
    return result.records.map(record => record.get('e').properties);
  }

  /**
   * 构建图查询结果
   */
  buildGraphResult(result) {
    const graphResult = new GraphQueryResult({});
    const nodeIds = new Set();

    for (const record of result.records) {
      // 处理路径或直接的节点/关系
      if (record.has('path')) {
        const path = record.get('path');
        // 处理路径中的节点和关系
        for (const segment of path.segments) {
          // 添加起始节点
          if (!nodeIds.has(segment.start.identity.toString())) {
            graphResult.addNode({
              id: segment.start.identity.toString(),
              labels: segment.start.labels,
              properties: segment.start.properties,
            });
            nodeIds.add(segment.start.identity.toString());
          }

          // 添加结束节点
          if (!nodeIds.has(segment.end.identity.toString())) {
            graphResult.addNode({
              id: segment.end.identity.toString(),
              labels: segment.end.labels,
              properties: segment.end.properties,
            });
            nodeIds.add(segment.end.identity.toString());
          }

          // 添加关系
          graphResult.addRelationship({
            id: segment.relationship.identity.toString(),
            type: segment.relationship.type,
            startNode: segment.start.identity.toString(),
            endNode: segment.end.identity.toString(),
            properties: segment.relationship.properties,
          });
        }
      } else {
        // 处理直接返回的节点
        for (const key of record.keys) {
          const value = record.get(key);
          if (value && value.labels) {
            // 这是一个节点
            if (!nodeIds.has(value.identity.toString())) {
              graphResult.addNode({
                id: value.identity.toString(),
                labels: value.labels,
                properties: value.properties,
              });
              nodeIds.add(value.identity.toString());
            }
          }
        }
      }
    }

    return graphResult;
  }

  /**
   * 获取图谱统计信息
   */
  async getGraphStats() {
    const stats = await neo4jService.getStats();

    // 获取各类型节点数量
    const nodeTypeStats = await neo4jService.executeQuery(`
      MATCH (n)
      RETURN labels(n) as labels, count(n) as count
    `);

    // 获取关系类型统计
    const relTypeStats = await neo4jService.executeQuery(`
      MATCH ()-[r]->()
      RETURN type(r) as type, count(r) as count
    `);

    return {
      ...stats,
      nodeTypes: nodeTypeStats.records.map(r => ({
        labels: r.get('labels'),
        count: r.get('count').toNumber(),
      })),
      relationshipTypes: relTypeStats.records.map(r => ({
        type: r.get('type'),
        count: r.get('count').toNumber(),
      })),
    };
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    try {
      const dbHealth = await neo4jService.healthCheck();
      return {
        status: dbHealth.status === 'healthy' && this.initialized ? 'healthy' : 'unhealthy',
        database: dbHealth,
        initialized: this.initialized,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        initialized: this.initialized,
        timestamp: new Date().toISOString(),
      };
    }
  }
}

export default new KnowledgeGraphService(); 
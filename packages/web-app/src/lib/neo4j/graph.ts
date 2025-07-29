import { neo4jConnection } from './connection';
import { GraphData, Entity, Relationship } from '@/types';
import { NodeType, SystemRelationshipType } from '../../../constants/enums';
import { TimeZoneUtils } from '../utils/timezone';

/**
 * 图谱查询服务
 * 专门处理图数据查询、实体关系分析和可视化数据准备
 */
class Neo4jGraphService {
  /**
   * 获取图谱概览数据
   */
  async getGraphOverview(limit: number = 50): Promise<GraphData> {
    try {
      const cypher = `
        MATCH (n)-[r]-(m)
        WHERE n <> m
        WITH n, r, m, rand() as random
        ORDER BY random
        LIMIT $limit
        RETURN n, r, m
      `;

      const result = await neo4jConnection.executeQuery(cypher, { limit });
      return this.processGraphResult(result);
    } catch (error: any) {
      console.error('获取图谱概览失败:', error);
      throw error;
    }
  }

  /**
   * 搜索图谱数据
   */
  async searchGraph(query: string, limit: number = 100): Promise<GraphData> {
    try {
      const cypher = `
        CALL {
          // 按节点属性搜索
          MATCH (n)
          WHERE ANY(prop IN keys(n) WHERE toString(n[prop]) CONTAINS $query)
          RETURN n as node
          UNION
          // 按关系属性搜索
          MATCH (n)-[r]-(m)
          WHERE ANY(prop IN keys(r) WHERE toString(r[prop]) CONTAINS $query)
          RETURN n as node
          UNION
          MATCH (n)-[r]-(m)
          WHERE ANY(prop IN keys(r) WHERE toString(r[prop]) CONTAINS $query)
          RETURN m as node
        }
        WITH DISTINCT node
        MATCH (node)-[r]-(connected)
        RETURN node, r, connected
        LIMIT $limit
      `;

      const result = await neo4jConnection.executeQuery(cypher, { query, limit });
      return this.processGraphResult(result);
    } catch (error: any) {
      console.error('搜索图谱数据失败:', error);
      throw error;
    }
  }

  /**
   * 获取实体的邻居关系
   */
  async getEntityNeighborhood(entityId: string, depth: number = 1, limit: number = 50): Promise<GraphData> {
    try {
      // 验证entityId
      if (!entityId || entityId === 'undefined') {
        throw new Error('无效的实体ID');
      }

      // 限制深度并构建动态查询（Neo4j不允许在变长路径中使用参数）
      const actualDepth = Math.min(depth, 3);
      const cypher = `
        MATCH (start)
        WHERE id(start) = $entityId
        MATCH path = (start)-[*1..${actualDepth}]-(connected)
        WITH nodes(path) as pathNodes, relationships(path) as pathRels
        UNWIND pathNodes as n
        UNWIND pathRels as r
        WITH DISTINCT n, r
        MATCH (source)-[r]-(target)
        WHERE n = source OR n = target
        RETURN source, r, target
        LIMIT $limit
      `;

      const result = await neo4jConnection.executeQuery(cypher, { 
        entityId: parseInt(entityId), 
        limit 
      });
      
      return this.processGraphResult(result);
    } catch (error: any) {
      console.error('获取实体邻居关系失败:', error);
      throw error;
    }
  }

  /**
   * 按节点类型获取图谱数据
   */
  async getGraphByNodeType(nodeType: string, limit: number = 100): Promise<GraphData> {
    try {
      const cypher = `
        MATCH (n:${nodeType})-[r]-(m)
        RETURN n, r, m
        ORDER BY rand()
        LIMIT $limit
      `;

      const result = await neo4jConnection.executeQuery(cypher, { limit });
      return this.processGraphResult(result);
    } catch (error: any) {
      console.error(`获取${nodeType}类型图谱数据失败:`, error);
      throw error;
    }
  }

  /**
   * 获取热门排行数据
   * @param days 天数（基于北京时间计算）
   * @param limit 限制数量
   */
  async getHotRankData(days: number = 7, limit: number = 20): Promise<any> {
    try {
      // 使用TimeZoneUtils获取基于北京时间的最近N天范围
      const timeRange = TimeZoneUtils.getRecentDaysRange(days);

      // 查询热点新闻排行（按关联实体数量排序）
      const hotNewsQuery = `
        MATCH (n:News)-[:DESCRIBES]->(e:Event)
        WHERE n.timestamp >= $startTime AND n.timestamp <= $endTime
        OPTIONAL MATCH (e)-[]-(entity)
        WITH n, e, count(DISTINCT entity) as entityCount, 
             CASE WHEN n.news_level = '1' THEN 3 
                  WHEN n.news_level = '2' THEN 2 
                  ELSE 1 END as levelWeight
        WITH n, e, entityCount, levelWeight, 
             (entityCount * levelWeight) as hotScore
        RETURN 
          n.id as newsId,
          n.title as title,
          n.content as content,
          n.news_level as level,
          n.timestamp as timestamp,
          n.source as source,
          entityCount,
          hotScore
        ORDER BY hotScore DESC, n.timestamp DESC
        LIMIT $limit
      `;

      // 查询热点事件排行
      const hotEventsQuery = `
        MATCH (e:Event)<-[:DESCRIBES]-(n:News)
        WHERE n.timestamp >= $startTime AND n.timestamp <= $endTime
        WITH e, count(n) as newsCount, collect(DISTINCT n.news_level) as levels
        RETURN 
          e.event_id as eventId,
          e.event_name as eventName,
          e.event_description as eventDescription,
          e.event_type as eventType,
          newsCount,
          levels
        ORDER BY newsCount DESC
        LIMIT $limit
      `;

      // 查询时间趋势统计（不使用 APOC）
      const timeStatsQuery = `
        MATCH (n:News)
        WHERE n.timestamp >= $startTime AND n.timestamp <= $endTime
        WITH n, 
             datetime(n.timestamp).year as year,
             datetime(n.timestamp).month as month,
             datetime(n.timestamp).day as day
        WITH date({year: year, month: month, day: day}) as newsDate
        RETURN newsDate, count(*) as newsCount
        ORDER BY newsDate
      `;

      const [hotNewsResult, hotEventsResult, timeStatsResult] = await Promise.all([
        neo4jConnection.executeQuery(hotNewsQuery, {
          startTime: timeRange.startTime,
          endTime: timeRange.endTime,
          limit
        }),
        neo4jConnection.executeQuery(hotEventsQuery, {
          startTime: timeRange.startTime,
          endTime: timeRange.endTime,
          limit
        }),
        neo4jConnection.executeQuery(timeStatsQuery, {
          startTime: timeRange.startTime,
          endTime: timeRange.endTime
        })
      ]);

      return {
        hotNews: hotNewsResult.records.map((record: any) => ({
          newsId: record.get('newsId'),
          title: record.get('title'),
          content: record.get('content'),
          level: record.get('level'),
          timestamp: record.get('timestamp'),
          source: record.get('source'),
          entityCount: record.get('entityCount').toNumber(),
          hotScore: record.get('hotScore').toNumber()
        })),
        hotEvents: hotEventsResult.records.map((record: any) => ({
          eventId: record.get('eventId'),
          eventName: record.get('eventName'),
          eventDescription: record.get('eventDescription'),
          eventType: record.get('eventType'),
          newsCount: record.get('newsCount').toNumber(),
          levels: record.get('levels')
        })),
        timeStats: timeStatsResult.records.map((record: any) => ({
          date: record.get('newsDate'),
          newsCount: record.get('newsCount').toNumber()
        }))
      };
    } catch (error: any) {
      console.error('获取热点排行数据失败:', error);
      throw error;
    }
  }

  /**
   * 获取特定新闻的知识图谱
   */
  async getNewsKnowledgeGraph(newsId: string): Promise<GraphData> {
    try {
      const cypher = `
        MATCH (n:${NodeType.NEWS} {id: $newsId})-[:${SystemRelationshipType.DESCRIBES}]->(e:${NodeType.EVENT})
        OPTIONAL MATCH (e)-[r1]-(entity1)
        OPTIONAL MATCH (entity1)-[r2]-(entity2)
        WHERE entity2 <> e AND entity2 <> n
        RETURN n, e, entity1, entity2, r1, r2
        UNION
        MATCH (n:${NodeType.NEWS} {id: $newsId})-[:${SystemRelationshipType.DESCRIBES}]->(e:${NodeType.EVENT})
        RETURN n, e, null as entity1, null as entity2, null as r1, null as r2
      `;

      const result = await neo4jConnection.executeQuery(cypher, { newsId });
      
      const nodes = new Map<string, Entity>();
      const edges: Relationship[] = [];

      result.records.forEach((record: any) => {
        const newsNode = record.get('n');
        const eventNode = record.get('e');
        const entity1 = record.get('entity1');
        const entity2 = record.get('entity2');
        const rel1 = record.get('r1');
        const rel2 = record.get('r2');

        // 添加新闻节点
        if (!nodes.has(newsNode.identity.toString())) {
          nodes.set(newsNode.identity.toString(), {
            id: newsNode.identity.toString(),
            name: newsNode.properties.title || 'News',
            type: NodeType.NEWS,
            properties: newsNode.properties
          });
        }

        // 添加事件节点
        if (!nodes.has(eventNode.identity.toString())) {
          nodes.set(eventNode.identity.toString(), {
            id: eventNode.identity.toString(),
            name: this.getNodeName(eventNode),
            type: eventNode.labels[0] as any,
            properties: eventNode.properties
          });
        }

        // 添加其他实体节点
        if (entity1 && !nodes.has(entity1.identity.toString())) {
          nodes.set(entity1.identity.toString(), {
            id: entity1.identity.toString(),
            name: this.getNodeName(entity1),
            type: entity1.labels[0] as any,
            properties: entity1.properties
          });
        }

        if (entity2 && !nodes.has(entity2.identity.toString())) {
          nodes.set(entity2.identity.toString(), {
            id: entity2.identity.toString(),
            name: this.getNodeName(entity2),
            type: entity2.labels[0] as any,
            properties: entity2.properties
          });
        }

        // 添加关系
        if (rel1) {
          edges.push({
            id: rel1.identity.toString(),
            source: rel1.start.toString(),
            target: rel1.end.toString(),
            type: rel1.type as any,
            properties: rel1.properties,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        }

        if (rel2) {
          edges.push({
            id: rel2.identity.toString(),
            source: rel2.start.toString(),
            target: rel2.end.toString(),
            type: rel2.type as any,
            properties: rel2.properties,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
        }
      });

      return {
        nodes: Array.from(nodes.values()),
        edges
      };
    } catch (error: any) {
      console.error('获取新闻知识图谱失败:', error);
      throw error;
    }
  }

  /**
   * 获取公司关系网络
   */
  async getCompanyNetwork(companyName?: string, limit: number = 50): Promise<GraphData> {
    try {
      let cypher: string;
      let parameters: any = { limit };

      if (companyName) {
        cypher = `
          MATCH (c:Company {company_name: $companyName})-[r]-(connected)
          OPTIONAL MATCH (connected)-[r2]-(secondLevel:Company)
          WHERE secondLevel <> c
          RETURN c, connected, secondLevel, r, r2
          LIMIT $limit
        `;
        parameters.companyName = companyName;
      } else {
        cypher = `
          MATCH (c1:Company)-[r]-(c2:Company)
          WHERE c1 <> c2
          RETURN c1, c2, r
          ORDER BY rand()
          LIMIT $limit
        `;
      }

      const result = await neo4jConnection.executeQuery(cypher, parameters);
      return this.processGraphResult(result);
    } catch (error: any) {
      console.error('获取公司关系网络失败:', error);
      throw error;
    }
  }

  /**
   * 获取通用图谱数据
   */
  async getGraphData(query?: string, limit: number = 100): Promise<any> {
    try {
      let cypher: string;
      let parameters: any = { limit };

      if (query) {
        // 有查询条件时，搜索相关节点和关系
        cypher = `
          CALL {
            MATCH (n)
            WHERE ANY(prop IN keys(n) WHERE toString(n[prop]) CONTAINS $query)
            RETURN n
            UNION
            MATCH (n)-[r]->(m)
            WHERE ANY(prop IN keys(r) WHERE toString(r[prop]) CONTAINS $query)
            RETURN n
            UNION
            MATCH (n)<-[r]-(m)
            WHERE ANY(prop IN keys(r) WHERE toString(r[prop]) CONTAINS $query)
            RETURN n
          }
          WITH DISTINCT n
          MATCH (n)-[r]-(m)
          RETURN n, r, m
          LIMIT $limit
        `;
        parameters.query = query;
      } else {
        // 无查询条件时，返回基本的图谱概览
        cypher = `
          MATCH (n)-[r]-(m)
          RETURN n, r, m
          ORDER BY rand()
          LIMIT $limit
        `;
      }

      const result = await neo4jConnection.executeQuery(cypher, parameters);

      const nodes = new Map();
      const edges: any[] = [];

      result.records.forEach((record: any) => {
        // 处理节点
        const possibleNodeFields = ['n', 'm', 'source', 'target', 'node', 'c', 'c1', 'c2', 'connected', 'entity1', 'entity2', 'start', 'end', 'secondLevel'];
        
        possibleNodeFields.forEach(field => {
          try {
            const node = record.get(field);
            if (node && node.identity) {
              const nodeId = node.identity.toString();
              if (!nodes.has(nodeId)) {
                nodes.set(nodeId, {
                  id: nodeId,
                  label: this.getNodeName(node),
                  type: node.labels[0],
                  properties: node.properties
                });
              }
            }
          } catch {
            // 字段不存在，跳过
          }
        });

        // 处理关系
        const possibleRelFields = ['r', 'r1', 'r2', 'rel'];
        
        possibleRelFields.forEach(field => {
          try {
            const rel = record.get(field);
            if (rel && rel.identity) {
              edges.push({
                id: rel.identity.toString(),
                source: rel.start.toString(),
                target: rel.end.toString(),
                type: rel.type,
                properties: rel.properties || {}
              });
            }
          } catch {
            // 字段不存在，跳过
          }
        });
      });

      return {
        nodes: Array.from(nodes.values()),
        edges
      };
    } catch (error: any) {
      console.error('获取图谱数据失败:', error);
      throw error;
    }
  }

  /**
   * 处理图查询结果的通用方法
   */
  private processGraphResult(result: any): GraphData {
    const nodes = new Map<string, Entity>();
    const edges: Relationship[] = [];

    result.records.forEach((record: any) => {
      // 处理节点（可能是n, source, target等字段）
      const possibleNodeFields = ['n', 'm', 'source', 'target', 'node', 'c', 'c1', 'c2', 'connected', 'entity1', 'entity2', 'start', 'end', 'secondLevel'];
      
      possibleNodeFields.forEach(field => {
        try {
          const node = record.get(field);
          if (node && node.identity) {
            const nodeId = node.identity.toString();
            if (!nodes.has(nodeId)) {
              nodes.set(nodeId, {
                id: nodeId,
                name: this.getNodeName(node),
                type: node.labels[0] as any,
                properties: node.properties
              });
            }
          }
        } catch {
          // 字段不存在，跳过
        }
      });

      // 处理关系
      const possibleRelFields = ['r', 'r1', 'r2', 'rel'];
      
      possibleRelFields.forEach(field => {
        try {
          const rel = record.get(field);
          if (rel && rel.identity) {
            edges.push({
              id: rel.identity.toString(),
              source: rel.start.toString(),
              target: rel.end.toString(),
              type: rel.type as any,
              properties: rel.properties || {},
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          }
        } catch {
          // 字段不存在，跳过
        }
      });
    });

    return {
      nodes: Array.from(nodes.values()),
      edges
    };
  }

  /**
   * 获取节点名称的辅助方法
   */
  private getNodeName(node: any): string {
    const properties = node.properties;
    const labels = node.labels;
    
    // 根据节点类型返回对应的名称属性
    if (labels.includes('Company')) {
      return properties.company_name || 'Unknown Company';
    } else if (labels.includes('Person')) {
      return properties.person_name || 'Unknown Person';
    } else if (labels.includes('Organization')) {
      return properties.organization_name || 'Unknown Organization';
    } else if (labels.includes('Location')) {
      return properties.location_name || 'Unknown Location';
    } else if (labels.includes('Event')) {
      return properties.event_name || 'Unknown Event';
    } else if (labels.includes('News')) {
      return properties.title || 'Unknown News';
    }
    
    return properties.name || `${labels[0]} Node`;
  }
}

export const neo4jGraphService = new Neo4jGraphService();
export { Neo4jGraphService }; 
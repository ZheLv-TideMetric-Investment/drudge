import { neo4jService } from './neo4j';
import { GraphData, Entity, Relationship, GraphQueryResult, EntitySearchResult } from '@/types';
import moment from 'moment-timezone';
import { NodeType } from '../../../constants/enums';

/**
 * 图谱查询服务
 * 专门处理图数据查询、实体关系分析和可视化数据准备
 */
class GraphService {
  private neo4j = neo4jService;

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

      const result = await this.neo4j.executeQuery(cypher, { limit });
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

      const result = await this.neo4j.executeQuery(cypher, { query, limit });
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
      const cypher = `
        MATCH (start)
        WHERE elementId(start) = $entityId
        MATCH path = (start)-[*1..$depth]-(connected)
        WITH nodes(path) as pathNodes, relationships(path) as pathRels
        UNWIND pathNodes as n
        UNWIND pathRels as r
        WITH DISTINCT n, r
        MATCH (source)-[r]-(target)
        WHERE n = source OR n = target
        RETURN source, r, target
        LIMIT $limit
      `;

      const result = await this.neo4j.executeQuery(cypher, { 
        entityId, 
        depth: Math.min(depth, 3), // 限制最大深度
        limit 
      });
      
      return this.processGraphResult(result);
    } catch (error: any) {
      console.error('获取实体邻居关系失败:', error);
      throw error;
    }
  }

  /**
   * 获取两个实体之间的路径
   */
  async getEntityPath(startEntityId: string, endEntityId: string, maxLength: number = 4): Promise<GraphData> {
    try {
      const cypher = `
        MATCH (start), (end)
        WHERE elementId(start) = $startEntityId AND elementId(end) = $endEntityId
        MATCH path = shortestPath((start)-[*1..$maxLength]-(end))
        WITH nodes(path) as pathNodes, relationships(path) as pathRels
        UNWIND range(0, size(pathRels)-1) as i
        RETURN pathNodes[i] as source, pathRels[i] as r, pathNodes[i+1] as target
      `;

      const result = await this.neo4j.executeQuery(cypher, { 
        startEntityId, 
        endEntityId, 
        maxLength: Math.min(maxLength, 6) 
      });
      
      return this.processGraphResult(result);
    } catch (error: any) {
      console.error('获取实体路径失败:', error);
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

      const result = await this.neo4j.executeQuery(cypher, { limit });
      return this.processGraphResult(result);
    } catch (error: any) {
      console.error(`获取${nodeType}类型图谱数据失败:`, error);
      throw error;
    }
  }

  /**
   * 获取最活跃的实体
   */
  async getMostConnectedEntities(limit: number = 20): Promise<EntitySearchResult[]> {
    try {
      const cypher = `
        MATCH (n)-[r]-()
        WITH n, count(r) as connections
        WHERE connections > 1
        RETURN n as entity, connections
        ORDER BY connections DESC
        LIMIT $limit
      `;

      const result = await this.neo4j.executeQuery(cypher, { limit });
      
      return result.records.map((record: any) => {
        const entity = record.get('entity');
        return {
          entity: {
            id: entity.identity.toString(),
            name: this.getNodeName(entity),
            type: entity.labels[0] as any,
            properties: entity.properties
          },
          score: 1.0,
          connections: record.get('connections').toNumber()
        };
      });
    } catch (error: any) {
      console.error('获取最活跃实体失败:', error);
      throw error;
    }
  }

  /**
   * 分析关系类型分布
   */
  async getRelationshipDistribution(): Promise<Record<string, number>> {
    try {
      return await this.neo4j.getRelationshipStats();
    } catch (error: any) {
      console.error('获取关系分布失败:', error);
      throw error;
    }
  }

  /**
   * 获取特定新闻的知识图谱
   */
  async getNewsKnowledgeGraph(newsId: string): Promise<GraphData> {
    try {
      const cypher = `
        MATCH (n:News {id: $newsId})-[:DESCRIBES]->(e:Event)
        OPTIONAL MATCH (e)-[r1]-(entity1)
        OPTIONAL MATCH (entity1)-[r2]-(entity2)
        WHERE entity2 <> e AND entity2 <> n
        RETURN n, e, entity1, entity2, r1, r2
        UNION
        MATCH (n:News {id: $newsId})-[:DESCRIBES]->(e:Event)
        RETURN n, e, null as entity1, null as entity2, null as r1, null as r2
      `;

      const result = await this.neo4j.executeQuery(cypher, { newsId });
      
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

      const result = await this.neo4j.executeQuery(cypher, parameters);
      return this.processGraphResult(result);
    } catch (error: any) {
      console.error('获取公司关系网络失败:', error);
      throw error;
    }
  }

  /**
   * 处理图查询结果
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
   * 获取节点名称
   */
  private getNodeName(node: any): string {
    const props = node.properties;
    if (props.company_name) return props.company_name;
    if (props.person_name) return props.person_name;
    if (props.organization_name) return props.organization_name;
    if (props.location_name) return props.location_name;
    if (props.event_name) return props.event_name;
    if (props.title) return props.title;
    if (props.name) return props.name;
    return node.labels?.[0] || 'Unknown';
  }

  /**
   * 获取图谱统计信息
   */
  async getGraphStats(): Promise<any> {
    try {
      return await this.neo4j.getDatabaseInfo();
    } catch (error: any) {
      console.error('获取图谱统计信息失败:', error);
      throw error;
    }
  }

  /**
   * 获取时间统计数据
   * 昨天之前按天统计，今天按小时统计
   */
  async getTimeStats(): Promise<any> {
    try {
      // 获取北京时间的今天开始时间
      const today = moment.tz('Asia/Shanghai').startOf('day');
      const yesterday = today.clone().subtract(1, 'day');
      const sevenDaysAgo = today.clone().subtract(7, 'days');

      // 查询今天的每小时统计
      const todayHourlyStats = await this.getTodayHourlyStats(today);
      
      // 查询昨天之前的每日统计（最近7天）
      const dailyStats = await this.getDailyStats(sevenDaysAgo, yesterday);

      return {
        todayHourly: todayHourlyStats,
        daily: dailyStats,
        metadata: {
          todayStart: today.toISOString(),
          yesterdayStart: yesterday.toISOString(),
          sevenDaysAgo: sevenDaysAgo.toISOString()
        }
      };
    } catch (error: any) {
      console.error('获取时间统计失败:', error);
      throw error;
    }
  }

  /**
   * 获取今天的每小时统计
   */
  private async getTodayHourlyStats(today: moment.Moment): Promise<any[]> {
    const todayStart = today.utc().toISOString();
    const todayEnd = today.clone().endOf('day').utc().toISOString();

    const cypher = `
      MATCH (n:News)
      WHERE n.timestamp >= $todayStart AND n.timestamp <= $todayEnd
      RETURN n.timestamp as timestamp,
             n.news_level as newsLevel,
             count(n) as newsCount
    `;

    const result = await this.neo4j.executeQuery(cypher, {
      todayStart,
      todayEnd
    });

    // 创建0-23小时的完整数组，没有数据的小时显示为0
    const hourlyData = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      newsCount: 0,
      highLevelCount: 0,
      time: today.clone().hour(hour).format('HH:mm')
    }));

    // 处理返回的数据，按小时分组
    result.records.forEach((record: any) => {
      const timestamp = record.get('timestamp');
      const newsLevel = record.get('newsLevel');
      
      // 将UTC时间转换为北京时间并获取小时
      const beijingTime = moment.utc(timestamp).tz('Asia/Shanghai');
      const hour = beijingTime.hour();
      
      if (hour >= 0 && hour <= 23) {
        hourlyData[hour].newsCount += 1;
        if (newsLevel === 'Level 1' || newsLevel === 'Level 2') {
          hourlyData[hour].highLevelCount += 1;
        }
      }
    });

    return hourlyData;
  }

  /**
   * 获取每日统计（昨天之前）
   */
  private async getDailyStats(startDate: moment.Moment, endDate: moment.Moment): Promise<any[]> {
    const start = startDate.utc().toISOString();
    const end = endDate.endOf('day').utc().toISOString();

    const cypher = `
      MATCH (n:News)
      WHERE n.timestamp >= $start AND n.timestamp <= $end
      RETURN n.timestamp as timestamp,
             n.news_level as newsLevel
    `;

    const result = await this.neo4j.executeQuery(cypher, {
      start,
      end
    });

    // 创建日期分组映射
    const dailyStats = new Map<string, { newsCount: number; highLevelCount: number }>();
    
    // 处理返回的数据，按日期分组
    result.records.forEach((record: any) => {
      const timestamp = record.get('timestamp');
      const newsLevel = record.get('newsLevel');
      
      // 将UTC时间转换为北京时间并获取日期
      const beijingTime = moment.utc(timestamp).tz('Asia/Shanghai');
      const dateKey = beijingTime.format('YYYY-MM-DD');
      
      if (!dailyStats.has(dateKey)) {
        dailyStats.set(dateKey, { newsCount: 0, highLevelCount: 0 });
      }
      
      const dayStats = dailyStats.get(dateKey)!;
      dayStats.newsCount += 1;
      
      if (newsLevel === 'Level 1' || newsLevel === 'Level 2') {
        dayStats.highLevelCount += 1;
      }
    });

    // 转换为数组并排序
    const result_array = Array.from(dailyStats.entries())
      .map(([dateKey, stats]) => {
        const date = moment.tz(dateKey, 'Asia/Shanghai');
        return {
          date: dateKey,
          dateDisplay: date.format('MM-DD'),
          newsCount: stats.newsCount,
          highLevelCount: stats.highLevelCount
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date)); // 按日期倒序排列

    return result_array;
  }

  /**
   * 实体相似度分析
   */
  async findSimilarEntities(entityId: string, entityType: string, limit: number = 10): Promise<EntitySearchResult[]> {
    try {
      // 基于共同连接的实体进行相似度分析
      const cypher = `
        MATCH (source:${entityType})-[r1]-(common)-[r2]-(similar:${entityType})
        WHERE elementId(source) = $entityId AND source <> similar
        WITH similar, count(common) as commonConnections
        OPTIONAL MATCH (similar)-[r]-()
        WITH similar, commonConnections, count(r) as totalConnections
        RETURN similar as entity, 
               commonConnections,
               totalConnections,
               toFloat(commonConnections) / toFloat(totalConnections) as similarity
        ORDER BY similarity DESC, commonConnections DESC
        LIMIT $limit
      `;

      const result = await this.neo4j.executeQuery(cypher, { entityId, limit });
      
      return result.records.map((record: any) => {
        const entity = record.get('entity');
        return {
          entity: {
            id: entity.identity.toString(),
            name: this.getNodeName(entity),
            type: entity.labels[0] as any,
            properties: entity.properties
          },
          score: record.get('similarity').toNumber() || 0,
          connections: record.get('totalConnections').toNumber()
        };
      });
    } catch (error: any) {
      console.error('查找相似实体失败:', error);
      return [];
    }
  }
}

export const graphService = new GraphService(); 
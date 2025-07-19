import { neo4jService } from './neo4j';
import moment from 'moment-timezone';
import { 
  EventLevel, 
  NodeType, 
  SystemRelationshipType, 
  RelationshipType,
  UrgencyLevel 
} from '../../../constants/enums';

/**
 * 将北京时间转换为UTC时间用于数据库查询
 * @param beijingTime 北京时间字符串（ISO格式或moment对象）
 * @returns UTC时间字符串
 */
function convertBeijingToUTC(beijingTime: string | moment.Moment): string {
  let time: moment.Moment;
  
  if (typeof beijingTime === 'string') {
    // 如果输入是字符串，先解析为moment对象
    // 如果包含时区信息就直接解析，否则假定为北京时间
    if (beijingTime.includes('+') || beijingTime.includes('Z')) {
      time = moment(beijingTime);
    } else {
      time = moment.tz(beijingTime, 'Asia/Shanghai');
    }
  } else {
    time = beijingTime;
  }
  
  // 转换为UTC时间
  return time.utc().toISOString();
}

/**
 * 查询服务
 * 提供从 Neo4j 数据库查询数据的方法
 */
class QueryService {
  neo4j = neo4jService;

  /**
   * 获取时间范围内的新闻数据（通用方法）
   */
  private async getNewsInTimeRange(startTime: string, endTime: string): Promise<any> {
    try {
      // 转换北京时间为UTC时间查询数据库
      const utcStartTime = convertBeijingToUTC(startTime);
      const utcEndTime = convertBeijingToUTC(endTime);
      
      console.log(`[QueryService] 时间查询: 输入时间 ${startTime} - ${endTime} -> 数据库查询 ${utcStartTime} - ${utcEndTime}`);
      
      const cypher = `
        MATCH (n:${NodeType.NEWS})
        WHERE n.timestamp >= $startTime AND n.timestamp <= $endTime
        OPTIONAL MATCH (n)-[:${SystemRelationshipType.DESCRIBES}]->(e:${NodeType.EVENT})
        OPTIONAL MATCH (e)-[:${RelationshipType.PARTICIPATES_IN}]-(c:${NodeType.COMPANY})
        OPTIONAL MATCH (e)-[:${RelationshipType.PARTICIPATES_IN}]-(p:${NodeType.PERSON})
        OPTIONAL MATCH (e)-[:${RelationshipType.PARTICIPATES_IN}]-(o:${NodeType.ORGANIZATION})
        OPTIONAL MATCH (e)-[:${SystemRelationshipType.LOCATED_AT}]->(l:${NodeType.LOCATION})
        
        RETURN 
          count(DISTINCT n) as news_count,
          count(DISTINCT e) as event_count,
          sum(CASE WHEN n.news_level = '${EventLevel.LEVEL_1}' THEN 1 ELSE 0 END) as high_level_count,
          sum(CASE WHEN n.news_level = '${EventLevel.LEVEL_1}' THEN 1 ELSE 0 END) as critical_count,
          collect(DISTINCT c.company_name) as companies,
          collect(DISTINCT p.person_name) as persons,
          collect(DISTINCT o.organization_name) as organizations,
          collect(DISTINCT l.location_name) as locations,
          collect({
            newsId: n.id,
            title: n.title,
            content: n.content,
            level: n.news_level,
            timestamp: n.timestamp
          }) as news_items
      `;

      const result = await this.neo4j.executeQuery(cypher, {
        startTime: utcStartTime,
        endTime: utcEndTime
      });

      if (result.records.length === 0) {
        return {
          news_count: 0,
          event_count: 0,
          high_level_count: 0,
          critical_count: 0,
          companies: [],
          persons: [],
          organizations: [],
          locations: [],
          news_items: []
        };
      }

      const record = result.records[0];
      return {
        news_count: record.get('news_count').toNumber(),
        event_count: record.get('event_count').toNumber(),
        high_level_count: record.get('high_level_count').toNumber(),
        critical_count: record.get('critical_count').toNumber(),
        companies: record.get('companies').filter(Boolean),
        persons: record.get('persons').filter(Boolean),
        organizations: record.get('organizations').filter(Boolean),
        locations: record.get('locations').filter(Boolean),
        news_items: record.get('news_items').filter((item: any) => item.title)
      };
    } catch (error: any) {
      console.error('获取新闻数据失败:', error);
      throw error;
    }
  }

  /**
   * 获取小时总结数据
   */
  async getHourlySummary(startTime: string, endTime: string): Promise<any> {
    return this.getNewsInTimeRange(startTime, endTime);
  }

  /**
   * 获取 Level 1 新闻
   */
  async getHighLevelNews(startTime: string, endTime: string): Promise<any[]> {
    try {
      // 转换北京时间为UTC时间查询数据库
      const utcStartTime = convertBeijingToUTC(startTime);
      const utcEndTime = convertBeijingToUTC(endTime);
      
      console.log(`[QueryService] Level 1 新闻查询: 输入时间 ${startTime} - ${endTime} -> 数据库查询 ${utcStartTime} - ${utcEndTime}`);
      
      const cypher = `
        MATCH (n:${NodeType.NEWS})
        WHERE n.timestamp >= $startTime 
          AND n.timestamp <= $endTime
          AND n.news_level = '${EventLevel.LEVEL_1}'
        OPTIONAL MATCH (n)-[:${SystemRelationshipType.DESCRIBES}]->(e:${NodeType.EVENT})
        OPTIONAL MATCH (e)-[:${RelationshipType.PARTICIPATES_IN}]-(c:${NodeType.COMPANY})
        OPTIONAL MATCH (e)-[:${RelationshipType.PARTICIPATES_IN}]-(p:${NodeType.PERSON})
        OPTIONAL MATCH (e)-[:${RelationshipType.PARTICIPATES_IN}]-(o:${NodeType.ORGANIZATION})
        RETURN 
          n.id as newsId,
          n.title as title,
          n.content as content,
          n.news_level as level,
          n.timestamp as timestamp,
          n.source as source,
          n.url as url,
          collect(DISTINCT c.company_name) as companies,
          collect(DISTINCT p.person_name) as persons,
          collect(DISTINCT o.organization_name) as organizations,
          collect(DISTINCT e.event_name) as events,
          collect(DISTINCT e.event_level) as event_levels
        ORDER BY n.timestamp DESC
      `;

      const result = await this.neo4j.executeQuery(cypher, {
        startTime: utcStartTime,
        endTime: utcEndTime
      });

      return result.records.map((record: any) => {
        const eventLevels = record.get('event_levels').filter(Boolean);
        const hasUrgentEvent = eventLevels.includes(EventLevel.LEVEL_1);
        
        return {
          newsId: record.get('newsId'),
          title: record.get('title'),
          content: record.get('content'),
          level: record.get('level'),
          timestamp: record.get('timestamp'),
          source: record.get('source'),
          url: record.get('url'),
          companies: record.get('companies').filter(Boolean),
          persons: record.get('persons').filter(Boolean),
          organizations: record.get('organizations').filter(Boolean),
          events: record.get('events').filter(Boolean),
          event_levels: eventLevels,
          urgency: hasUrgentEvent ? UrgencyLevel.CRITICAL : record.get('level') === EventLevel.LEVEL_1 ? UrgencyLevel.HIGH : UrgencyLevel.MEDIUM
        };
      });
    } catch (error: any) {
      console.error('获取 Level 1 新闻失败:', error);
      throw error;
    }
  }

  /**
   * 获取每日新闻数据
   */
  async getDailyNewsData(startTime: string, endTime: string): Promise<any> {
    return this.getNewsInTimeRange(startTime, endTime);
  }

  /**
   * 搜索实体
   */
  async searchEntities(searchTerm: string, nodeType?: string, limit: number = 20): Promise<any[]> {
    try {
      let cypher: string;
      
      if (nodeType) {
        // 搜索特定类型的节点
        switch (nodeType.toLowerCase()) {
          case 'company':
            cypher = `
              MATCH (c:Company)
              WHERE c.company_name CONTAINS $searchTerm
              OPTIONAL MATCH (c)-[r]-()
              RETURN c as entity, 
                     $companyType as type,
                     c.company_name as name,
                     count(r) as connections
              ORDER BY connections DESC, c.company_name
              LIMIT $limit
            `;
            break;
          case 'person':
            cypher = `
              MATCH (p:Person)
              WHERE p.person_name CONTAINS $searchTerm
              OPTIONAL MATCH (p)-[r]-()
              RETURN p as entity,
                     $personType as type,
                     p.person_name as name,
                     count(r) as connections
              ORDER BY connections DESC, p.person_name
              LIMIT $limit
            `;
            break;
          case 'organization':
            cypher = `
              MATCH (o:Organization)
              WHERE o.organization_name CONTAINS $searchTerm
              OPTIONAL MATCH (o)-[r]-()
              RETURN o as entity,
                     $organizationType as type,
                     o.organization_name as name,
                     count(r) as connections
              ORDER BY connections DESC, o.organization_name
              LIMIT $limit
            `;
            break;
          case 'location':
            cypher = `
              MATCH (l:Location)
              WHERE l.location_name CONTAINS $searchTerm
              OPTIONAL MATCH (l)-[r]-()
              RETURN l as entity,
                     $locationType as type,
                     l.location_name as name,
                     count(r) as connections
              ORDER BY connections DESC, l.location_name
              LIMIT $limit
            `;
            break;
          case 'event':
            cypher = `
              MATCH (e:Event)
              WHERE e.event_name CONTAINS $searchTerm OR e.event_description CONTAINS $searchTerm
              OPTIONAL MATCH (e)-[r]-()
              RETURN e as entity,
                     $eventType as type,
                     e.event_name as name,
                     count(r) as connections
              ORDER BY connections DESC, e.event_name
              LIMIT $limit
            `;
            break;
          default:
            throw new Error(`不支持的节点类型: ${nodeType}`);
        }
      } else {
        // 搜索所有类型的节点
        cypher = `
          CALL {
            MATCH (c:Company)
            WHERE c.company_name CONTAINS $searchTerm
            OPTIONAL MATCH (c)-[r]-()
            RETURN c as entity, $companyType as type, c.company_name as name, count(r) as connections
            UNION
            MATCH (p:Person)
            WHERE p.person_name CONTAINS $searchTerm
            OPTIONAL MATCH (p)-[r]-()
            RETURN p as entity, $personType as type, p.person_name as name, count(r) as connections
            UNION
            MATCH (o:Organization)
            WHERE o.organization_name CONTAINS $searchTerm
            OPTIONAL MATCH (o)-[r]-()
            RETURN o as entity, $organizationType as type, o.organization_name as name, count(r) as connections
            UNION
            MATCH (l:Location)
            WHERE l.location_name CONTAINS $searchTerm
            OPTIONAL MATCH (l)-[r]-()
            RETURN l as entity, $locationType as type, l.location_name as name, count(r) as connections
            UNION
            MATCH (e:Event)
            WHERE e.event_name CONTAINS $searchTerm OR e.event_description CONTAINS $searchTerm
            OPTIONAL MATCH (e)-[r]-()
            RETURN e as entity, $eventType as type, e.event_name as name, count(r) as connections
          }
          RETURN entity, type, name, connections
          ORDER BY connections DESC, name
          LIMIT $limit
        `;
      }

      const queryParams: any = {
        searchTerm,
        limit,
        // 添加所有节点类型参数
        companyType: NodeType.COMPANY,
        personType: NodeType.PERSON,
        organizationType: NodeType.ORGANIZATION,
        locationType: NodeType.LOCATION,
        eventType: NodeType.EVENT
      };

      const result = await this.neo4j.executeQuery(cypher, queryParams);

      return result.records.map((record: any) => ({
        entity: record.get('entity').properties,
        type: record.get('type'),
        name: record.get('name'),
        connections: record.get('connections').toNumber()
      }));
    } catch (error: any) {
      console.error('搜索实体失败:', error);
      throw error;
    }
  }

  /**
   * 获取图谱数据
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

      const result = await this.neo4j.executeQuery(cypher, parameters);

      const nodes = new Map();
      const edges: any[] = [];

      result.records.forEach((record: any) => {
        const n = record.get('n');
        const r = record.get('r');
        const m = record.get('m');

        // 添加节点
        if (!nodes.has(n.identity.toString())) {
          nodes.set(n.identity.toString(), {
            id: n.identity.toString(),
            name: this.getNodeName(n),
            type: n.labels[0],
            properties: n.properties
          });
        }

        if (!nodes.has(m.identity.toString())) {
          nodes.set(m.identity.toString(), {
            id: m.identity.toString(),
            name: this.getNodeName(m),
            type: m.labels[0],
            properties: m.properties
          });
        }

        // 添加边
        edges.push({
          id: r.identity.toString(),
          source: r.start.toString(),
          target: r.end.toString(),
          type: r.type,
          properties: r.properties
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
    return node.labels[0] || 'Unknown';
  }


}

// 导出查询服务实例
export const queryService = new QueryService();

/**
 * 时区转换测试函数（开发调试用）
 */
export function testTimezoneConversion() {
  console.log('=== 时区转换测试 ===');
  
  // 测试1: 北京时间字符串（包含时区）
  const beijingTimeWithTz = '2025-01-16T14:00:00.000+08:00';
  const utc1 = convertBeijingToUTC(beijingTimeWithTz);
  console.log(`北京时间 ${beijingTimeWithTz} -> UTC ${utc1}`);
  
  // 测试2: UTC时间字符串
  const utcTime = '2025-01-16T06:00:00.000Z';
  const utc2 = convertBeijingToUTC(utcTime);
  console.log(`UTC时间 ${utcTime} -> UTC ${utc2}`);
  
  // 测试3: 无时区信息的字符串（假定北京时间）
  const noTzTime = '2025-01-16T14:00:00.000';
  const utc3 = convertBeijingToUTC(noTzTime);
  console.log(`无时区时间 ${noTzTime} -> UTC ${utc3}`);
  
  // 测试4: moment对象
  const momentObj = moment.tz('2025-01-16T14:00:00', 'Asia/Shanghai');
  const utc4 = convertBeijingToUTC(momentObj);
  console.log(`Moment对象 ${momentObj.toISOString()} -> UTC ${utc4}`);
  
  console.log('=== 测试完成 ===');
} 
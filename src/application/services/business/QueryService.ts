// @ts-nocheck
import logger from '../../../shared/utils/logger';
import neo4jService from '../../../infrastructure/database/Neo4jRepository';
import { NewsLevel } from '../../../shared/types/enums';
import moment from 'moment-timezone';

/**
 * 查询服务
 * 负责所有数据查询和搜索功能
 */
class QueryService {
  private neo4j: any;
  private initialized: boolean = false;

  constructor() {
    this.neo4j = neo4jService;
  }

  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    try {
      if (!this.neo4j.isConnected()) {
        await this.neo4j.connect();
      }
      this.initialized = true;
      logger.info('查询服务初始化完成');
    } catch (error) {
      logger.error('查询服务初始化失败:', error);
      throw error;
    }
  }

  /**
   * 根据级别获取新闻
   */
  async getNewsByLevel(newsLevel: string = NewsLevel.LEVEL_1, limit: number = 20): Promise<any[]> {
    const cypher = `
      MATCH (n:News {news_level: $newsLevel})
      RETURN n
      ORDER BY n.timestamp DESC
      LIMIT $limit
    `;

    const result = await this.neo4j.executeQuery(cypher, { newsLevel, limit });
    return result.records.map(record => record.get('n').properties);
  }

  /**
   * 获取公司相关事件
   */
  async getCompanyEvents(companyName: string, limit: number = 50): Promise<any[]> {
    const cypher = `
      MATCH (c:Company {company_name: $companyName})<-[:INVOLVES]-(e:Event)
      OPTIONAL MATCH (e)-[:REPORTED_IN]->(n:News)
      RETURN e, n
      ORDER BY e.event_date DESC
      LIMIT $limit
    `;

    const result = await this.neo4j.executeQuery(cypher, { companyName, limit });
    return result.records.map(record => ({
      event: record.get('e').properties,
      news: record.get('n')?.properties
    }));
  }

  /**
   * 获取多个公司的共同事件
   */
  async getMultiCompanyEvents(companyNames: string[], limit: number = 30): Promise<any[]> {
    const cypher = `
      MATCH (c:Company)<-[:INVOLVES]-(e:Event)
      WHERE c.company_name IN $companyNames
      WITH e, collect(DISTINCT c.company_name) as companies
      WHERE size(companies) > 1
      OPTIONAL MATCH (e)-[:REPORTED_IN]->(n:News)
      RETURN e, companies, n
      ORDER BY e.event_date DESC
      LIMIT $limit
    `;

    const result = await this.neo4j.executeQuery(cypher, { companyNames, limit });
    return result.records.map(record => ({
      event: record.get('e').properties,
      companies: record.get('companies'),
      news: record.get('n')?.properties
    }));
  }

  /**
   * 获取指定日期的事件
   */
  async getDayEvents(date: string): Promise<any[]> {
    const startDate = moment(date).startOf('day').toISOString();
    const endDate = moment(date).endOf('day').toISOString();

    const cypher = `
      MATCH (e:Event)
      WHERE e.event_date >= $startDate AND e.event_date <= $endDate
      OPTIONAL MATCH (e)-[:INVOLVES]->(c:Company)
      OPTIONAL MATCH (e)-[:INVOLVES]->(p:Person)
      OPTIONAL MATCH (e)-[:OCCURRED_AT]->(l:Location)
      OPTIONAL MATCH (e)-[:REPORTED_IN]->(n:News)
      RETURN e, 
             collect(DISTINCT c.company_name) as companies,
             collect(DISTINCT p.person_name) as persons,
             collect(DISTINCT l.location_name) as locations,
             collect(DISTINCT n.title) as news_titles
      ORDER BY e.event_date DESC
    `;

    const result = await this.neo4j.executeQuery(cypher, { startDate, endDate });
    return result.records.map(record => ({
      event: record.get('e').properties,
      companies: record.get('companies').filter(Boolean),
      persons: record.get('persons').filter(Boolean),
      locations: record.get('locations').filter(Boolean),
      news_titles: record.get('news_titles').filter(Boolean)
    }));
  }

  /**
   * 获取小时摘要
   */
  async getHourlySummary(hourStart: string, hourEnd: string): Promise<any> {
    const cypher = `
      MATCH (n:News)
      WHERE n.timestamp >= $hourStart AND n.timestamp <= $hourEnd
      OPTIONAL MATCH (n)<-[:REPORTED_IN]-(e:Event)
      OPTIONAL MATCH (e)-[:INVOLVES]->(c:Company)
      OPTIONAL MATCH (e)-[:INVOLVES]->(p:Person)
      OPTIONAL MATCH (e)-[:OCCURRED_AT]->(l:Location)
      
      RETURN 
        count(DISTINCT n) as news_count,
        count(DISTINCT e) as event_count,
        collect(DISTINCT c.company_name) as companies,
        collect(DISTINCT p.person_name) as persons,
        collect(DISTINCT l.location_name) as locations,
        collect(DISTINCT n.news_level) as news_levels,
        collect({
          title: n.title,
          level: n.news_level,
          timestamp: n.timestamp
        }) as news_items
    `;

    const result = await this.neo4j.executeQuery(cypher, { hourStart, hourEnd });
    
    if (result.records.length === 0) {
      return {
        period: `${hourStart} - ${hourEnd}`,
        news_count: 0,
        event_count: 0,
        companies: [],
        persons: [],
        locations: [],
        news_levels: [],
        news_items: []
      };
    }

    const record = result.records[0];
    return {
      period: `${hourStart} - ${hourEnd}`,
      news_count: record.get('news_count').toNumber(),
      event_count: record.get('event_count').toNumber(),
      companies: record.get('companies').filter(Boolean),
      persons: record.get('persons').filter(Boolean),
      locations: record.get('locations').filter(Boolean),
      news_levels: record.get('news_levels').filter(Boolean),
      news_items: record.get('news_items').filter(item => item.title)
    };
  }

  /**
   * 搜索实体
   */
  async searchEntities(searchTerm: string, nodeType: string = null, limit: number = 20): Promise<any[]> {
    let cypher: string;
    let parameters: any = { searchTerm, limit };

    if (nodeType) {
      const mainProperty = this.getMainProperty(nodeType);
      cypher = `
        MATCH (n:${nodeType})
        WHERE n.${mainProperty} CONTAINS $searchTerm
        RETURN n, labels(n) as node_type
        ORDER BY n.${mainProperty}
        LIMIT $limit
      `;
    } else {
      cypher = `
        MATCH (n)
        WHERE (n.company_name CONTAINS $searchTerm OR 
               n.person_name CONTAINS $searchTerm OR 
               n.location_name CONTAINS $searchTerm OR 
               n.event_name CONTAINS $searchTerm OR
               n.title CONTAINS $searchTerm)
        RETURN n, labels(n) as node_type
        ORDER BY 
          CASE 
            WHEN n.company_name CONTAINS $searchTerm THEN n.company_name
            WHEN n.person_name CONTAINS $searchTerm THEN n.person_name
            WHEN n.location_name CONTAINS $searchTerm THEN n.location_name
            WHEN n.event_name CONTAINS $searchTerm THEN n.event_name
            WHEN n.title CONTAINS $searchTerm THEN n.title
            ELSE ''
          END
        LIMIT $limit
      `;
    }

    const result = await this.neo4j.executeQuery(cypher, parameters);
    return result.records.map(record => ({
      entity: record.get('n').properties,
      type: record.get('node_type')[0]
    }));
  }

  /**
   * 搜索相关新闻
   */
  async searchRelatedNews(query: string, limit: number = 10): Promise<any[]> {
    const cypher = `
      MATCH (n:News)
      WHERE n.title CONTAINS $query OR n.content CONTAINS $query
      RETURN n
      ORDER BY n.timestamp DESC
      LIMIT $limit
    `;

    const result = await this.neo4j.executeQuery(cypher, { query, limit });
    return result.records.map(record => record.get('n').properties);
  }

  /**
   * 获取突发新闻
   */
  async getBreakingNews(hours: number = 24): Promise<any[]> {
    const startTime = moment().subtract(hours, 'hours').toISOString();
    
    const cypher = `
      MATCH (n:News)
      WHERE n.news_level IN ['Level 1', 'Level 2'] 
        AND n.timestamp >= $startTime
      RETURN n
      ORDER BY n.timestamp DESC
    `;

    const result = await this.neo4j.executeQuery(cypher, { startTime });
    return result.records.map(record => record.get('n').properties);
  }

  /**
   * 获取高级别新闻
   */
  async getHighLevelNews(hours: number = 12): Promise<any[]> {
    const startTime = moment().subtract(hours, 'hours').toISOString();
    
    const cypher = `
      MATCH (n:News)
      WHERE n.news_level IN ['Level 1', 'Level 2', 'Level 3']
        AND n.timestamp >= $startTime
      RETURN n
      ORDER BY n.news_level ASC, n.timestamp DESC
    `;

    const result = await this.neo4j.executeQuery(cypher, { startTime });
    return result.records.map(record => record.get('n').properties);
  }

  /**
   * 获取新闻级别统计
   */
  async getNewsLevelStats(startTime: string, endTime: string): Promise<any[]> {
    const cypher = `
      MATCH (n:News)
      WHERE n.timestamp >= $startTime AND n.timestamp <= $endTime
      RETURN n.news_level as level, count(n) as count
      ORDER BY count DESC
    `;

    const result = await this.neo4j.executeQuery(cypher, { startTime, endTime });
    return result.records.map(record => ({
      level: record.get('level'),
      count: record.get('count').toNumber()
    }));
  }

  /**
   * 获取实体统计
   */
  async getEntityStats(): Promise<any> {
    const cypher = `
      MATCH (n)
      RETURN labels(n)[0] as node_type, count(n) as count
      ORDER BY count DESC
    `;

    const result = await this.neo4j.executeQuery(cypher);
    const stats = {};
    
    result.records.forEach(record => {
      const nodeType = record.get('node_type');
      const count = record.get('count').toNumber();
      stats[nodeType] = count;
    });

    return stats;
  }

  /**
   * 获取关系统计
   */
  async getRelationshipStats(): Promise<any[]> {
    const cypher = `
      MATCH ()-[r]->()
      RETURN type(r) as relationship_type, count(r) as count
      ORDER BY count DESC
    `;

    const result = await this.neo4j.executeQuery(cypher);
    return result.records.map(record => ({
      type: record.get('relationship_type'),
      count: record.get('count').toNumber()
    }));
  }

  /**
   * 获取新闻提取结果
   */
  async getNewsExtractionResult(newsId: string): Promise<any> {
    const cypher = `
      MATCH (n:News {id: $newsId})
      OPTIONAL MATCH (n)<-[:REPORTED_IN]-(e:Event)
      OPTIONAL MATCH (e)-[:INVOLVES]->(c:Company)
      OPTIONAL MATCH (e)-[:INVOLVES]->(p:Person)
      OPTIONAL MATCH (e)-[:OCCURRED_AT]->(l:Location)
      OPTIONAL MATCH (e)-[:OCCURRED_AT]->(t:Time)
      
      RETURN n,
             collect(DISTINCT e) as events,
             collect(DISTINCT c) as companies,
             collect(DISTINCT p) as persons,
             collect(DISTINCT l) as locations,
             collect(DISTINCT t) as times
    `;

    const result = await this.neo4j.executeQuery(cypher, { newsId });
    
    if (result.records.length === 0) {
      return null;
    }

    const record = result.records[0];
    return {
      news: record.get('n').properties,
      events: record.get('events').map(node => node.properties),
      companies: record.get('companies').map(node => node.properties),
      persons: record.get('persons').map(node => node.properties),
      locations: record.get('locations').map(node => node.properties),
      times: record.get('times').map(node => node.properties)
    };
  }

  /**
   * 获取节点的主要属性
   */
  private getMainProperty(nodeType: string): string {
    const propertyMap = {
      'Company': 'company_name',
      'Person': 'person_name',
      'Location': 'location_name',
      'Event': 'event_name',
      'Time': 'time_value',
      'News': 'title'
    };
    return propertyMap[nodeType] || 'name';
  }

  /**
   * 检查新闻是否已处理
   */
  async isNewsProcessed(newsId: string): Promise<boolean> {
    const cypher = `
      MATCH (n:News {id: $newsId, processed: true})
      RETURN n
      LIMIT 1
    `;
    
    const result = await this.neo4j.executeQuery(cypher, { newsId });
    return result.records.length > 0;
  }

  /**
   * 批量检查新闻处理状态
   */
  async getUnprocessedNewsIds(newsIds: string[]): Promise<string[]> {
    if (newsIds.length === 0) return [];
    
    const cypher = `
      WITH $newsIds as ids
      UNWIND ids as newsId
      OPTIONAL MATCH (n:News {id: newsId, processed: true})
      WITH newsId, n
      WHERE n IS NULL
      RETURN newsId
    `;
    
    const result = await this.neo4j.executeQuery(cypher, { newsIds });
    return result.records.map(record => record.get('newsId'));
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<any> {
    try {
      // 检查数据库连接
      const connectionTest = await this.neo4j.executeQuery('RETURN 1 as test');
      
      // 获取基本统计
      const stats = await this.getEntityStats();
      
      return {
        status: 'healthy',
        service: 'QueryService',
        timestamp: new Date().toISOString(),
        neo4j_connection: connectionTest ? 'connected' : 'disconnected',
        entity_stats: stats
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        service: 'QueryService',
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }
}

export default new QueryService(); 
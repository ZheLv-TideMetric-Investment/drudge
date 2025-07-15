import { logger } from '../utils/logger';
import neo4jService from './Neo4jService';
import { parseTimeToBeijing } from '../utils/timeUtils';
import { 
  NewsExtractionResult, 
  Event, 
  Company, 
  Person, 
  Organization, 
  Location, 
  Time, 
  Relationship,
  NewsItem 
} from '../types/index';

/**
 * 实体服务
 * 负责知识图谱中实体节点的创建和管理
 */
export class EntityService {
  private neo4j = neo4jService;
  private initialized: boolean = false;

  constructor() {
    // 使用共享的 Neo4j 单例实例
  }

  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    try {
      await this.neo4j.initialize();
      this.initialized = true;
      logger.info('✅ 实体服务初始化完成');
    } catch (error) {
      logger.error('❌ 实体服务初始化失败:', error);
      throw error;
    }
  }

  /**
   * 创建新闻节点
   */
  async createNews(newsItem: NewsItem, newsLevel: string = 'Level 5'): Promise<void> {
    const cypher = `
      MERGE (n:News {id: $id})
      SET n.title = $title,
          n.content = $content,
          n.timestamp = $timestamp,
          n.source = $source,
          n.url = $url,
          n.level = $level,
          n.news_level = $newsLevel,
          n.processed = true,
          n.created_at = $createdAt,
          n.updated_at = $updatedAt
      RETURN n
    `;

    const parameters = {
      id: newsItem.id,
      title: newsItem.title,
      content: newsItem.content,
      timestamp: parseTimeToBeijing(newsItem.time),
      source: newsItem.source || '',
      url: newsItem.url || '',
      level: newsItem.level || 0,
      newsLevel,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await this.neo4j.executeQuery(cypher, parameters);
    logger.debug(`新闻节点创建成功: ${newsItem.id}`);
  }

  /**
   * 创建事件节点 - 适配新的枚举类型
   */
  async createEvent(event: Event, newsId: string): Promise<void> {
    const cypher = `
      MERGE (e:Event {event_id: $eventId})
      SET e.event_name = $eventName,
          e.event_description = $eventDescription,
          e.event_type = $eventType,
          e.event_date = $eventDate,
          e.sentiment = $sentiment,
          e.magnitude = $magnitude,
          e.event_level = $eventLevel,
          e.significance = $significance,
          e.raw_event_date = $rawEventDate,
          e.parsed_event_date = $parsedEventDate,
          e.created_at = $createdAt,
          e.updated_at = $updatedAt
      WITH e
      MATCH (n:News {id: $newsId})
      MERGE (n)-[:DESCRIBES]->(e)
      RETURN e
    `;

    const parameters = {
      eventId: event.event_id,
      eventName: event.event_name,
      eventDescription: event.event_description || '',
      eventType: event.event_type || 'other',
      eventDate: event.event_date || new Date().toISOString(),
      sentiment: event.sentiment || 'neutral',
      magnitude: event.magnitude || 0,
      eventLevel: event.event_level || 'Level 5',
      significance: event.significance || 1,
      rawEventDate: event.raw_event_date || '',
      parsedEventDate: event.parsed_event_date || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      newsId
    };

    await this.neo4j.executeQuery(cypher, parameters);
    logger.debug(`事件节点创建成功: ${event.event_id}`);
  }

  /**
   * 创建公司节点 - 优化字段处理
   */
  async createCompany(company: Company, newsId: string): Promise<void> {
    const cypher = `
      MERGE (c:Company {company_name: $companyName})
      SET c.ticker = $ticker,
          c.industry = $industry,
          c.market = $market,
          c.country = $country,
          c.aliases = $aliases,
          c.created_at = $createdAt,
          c.updated_at = $updatedAt
      WITH c
      MATCH (n:News {id: $newsId})
      MERGE (n)-[:INVOLVES]->(c)
      RETURN c
    `;

    const parameters = {
      companyName: company.company_name,
      ticker: company.ticker || '',
      industry: company.industry || '',
      market: company.market || '',
      country: company.country || '',
      aliases: company.aliases && company.aliases.length > 0 ? company.aliases : [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      newsId
    };

    await this.neo4j.executeQuery(cypher, parameters);
    logger.debug(`公司节点创建成功: ${company.company_name}`);
  }

  /**
   * 创建人物节点
   */
  async createPerson(person: Person, newsId: string): Promise<void> {
    const cypher = `
      MERGE (p:Person {person_name: $personName})
      SET p.title = $title,
          p.company = $company,
          p.nationality = $nationality,
          p.created_at = $createdAt,
          p.updated_at = $updatedAt
      WITH p
      MATCH (n:News {id: $newsId})
      MERGE (n)-[:MENTIONS]->(p)
      RETURN p
    `;

    const parameters = {
      personName: person.person_name,
      title: person.title || '',
      company: person.company || '',
      nationality: person.nationality || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      newsId
    };

    await this.neo4j.executeQuery(cypher, parameters);
    logger.debug(`人物节点创建成功: ${person.person_name}`);
  }

  /**
   * 创建机构节点 - 使用标准枚举
   */
  async createOrganization(organization: Organization, newsId: string): Promise<void> {
    const cypher = `
      MERGE (o:Organization {organization_name: $organizationName})
      SET o.type = $type,
          o.country = $country,
          o.created_at = $createdAt,
          o.updated_at = $updatedAt
      WITH o
      MATCH (n:News {id: $newsId})
      MERGE (n)-[:INVOLVES]->(o)
      RETURN o
    `;

    const parameters = {
      organizationName: organization.organization_name,
      type: organization.type || 'other',
      country: organization.country || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      newsId
    };

    await this.neo4j.executeQuery(cypher, parameters);
    logger.debug(`机构节点创建成功: ${organization.organization_name}`);
  }

  /**
   * 创建位置节点 - 处理可选坐标和枚举类型
   */
  async createLocation(location: Location, newsId: string): Promise<void> {
    const cypher = `
      MERGE (l:Location {location_name: $locationName})
      SET l.type = $type,
          l.country = $country,
          l.region = $region,
          l.coordinates = $coordinates,
          l.latitude = $latitude,
          l.longitude = $longitude,
          l.created_at = $createdAt,
          l.updated_at = $updatedAt
      WITH l
      MATCH (n:News {id: $newsId})
      MERGE (n)-[:LOCATED_AT]->(l)
      RETURN l
    `;

    const parameters = {
      locationName: location.location_name,
      type: location.type || 'other',
      country: location.country || '',
      region: location.region || '',
      coordinates: location.coordinates ? JSON.stringify(location.coordinates) : null,
      latitude: location.coordinates?.latitude || null,
      longitude: location.coordinates?.longitude || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      newsId
    };

    await this.neo4j.executeQuery(cypher, parameters);
    logger.debug(`位置节点创建成功: ${location.location_name}`);
  }

  /**
   * 创建时间节点 - 使用标准枚举和时间标准化字段
   */
  async createTime(time: Time, newsId: string): Promise<void> {
    const cypher = `
      MERGE (t:Time {time_value: $timeValue})
      SET t.type = $type,
          t.precision = $precision,
          t.timezone = $timezone,
          t.raw_value = $rawValue,
          t.parsed_iso = $parsedIso,
          t.created_at = $createdAt,
          t.updated_at = $updatedAt
      WITH t
      MATCH (n:News {id: $newsId})
      MERGE (n)-[:OCCURRED_AT]->(t)
      RETURN t
    `;

    const parameters = {
      timeValue: time.time_value,
      type: time.type || 'OTHER',
      precision: time.precision || 'DAY',
      timezone: time.timezone || '',
      rawValue: time.raw_value || '',
      parsedIso: time.parsed_iso || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      newsId
    };

    await this.neo4j.executeQuery(cypher, parameters);
    logger.debug(`时间节点创建成功: ${time.time_value}`);
  }

  /**
   * 批量创建实体（使用新的 MERGE 模板）
   */
  async batchCreateEntities(extractionResult: NewsExtractionResult): Promise<void> {
    try {
      logger.info(`开始批量创建实体: ${extractionResult.newsId}`);

      // 1. 创建新闻节点
      const newsItem: NewsItem = {
        id: extractionResult.newsId || '',
        title: extractionResult.title || '',
        content: extractionResult.content || '',
        time: new Date(extractionResult.timestamp).getTime() / 1000,
        source: extractionResult.source || '',
        url: extractionResult.url || '',
        level: 0, // 兼容旧字段
        timestamp: new Date(extractionResult.timestamp)
      };
      
      await this.createNews(newsItem, extractionResult.news_level);

      // 2. 批量创建实体（使用新的 MERGE 模板）
      if (extractionResult.events.length > 0) {
        await this.neo4j.batchMergeEntities('Event', extractionResult.events);
      }

      if (extractionResult.companies.length > 0) {
        await this.neo4j.batchMergeEntities('Company', extractionResult.companies);
      }

      if (extractionResult.persons && extractionResult.persons.length > 0) {
        await this.neo4j.batchMergeEntities('Person', extractionResult.persons);
      }

      if (extractionResult.organizations.length > 0) {
        await this.neo4j.batchMergeEntities('Organization', extractionResult.organizations);
      }

      if (extractionResult.locations.length > 0) {
        await this.neo4j.batchMergeEntities('Location', extractionResult.locations);
      }

      if (extractionResult.times.length > 0) {
        await this.neo4j.batchMergeEntities('Time', extractionResult.times);
      }

      // 3. 批量创建关系
      await this.batchCreateRelationships(extractionResult);

      logger.info(`批量创建实体完成: ${extractionResult.newsId}`);
    } catch (error) {
      logger.error(`批量创建实体失败: ${extractionResult.newsId}`, error);
      throw error;
    }
  }

  /**
   * 批量创建关系（使用新的 MERGE 模板）
   */
  private async batchCreateRelationships(extractionResult: NewsExtractionResult): Promise<void> {
    const relationships: Array<{
      fromType: string;
      fromKey: string;
      fromValue: string;
      toType: string;
      toKey: string;
      toValue: string;
      relType: string;
      properties?: any;
    }> = [];

    const newsId = extractionResult.newsId || '';

    // 新闻 -> 事件
    for (const event of extractionResult.events) {
      relationships.push({
        fromType: 'News',
        fromKey: 'id',
        fromValue: newsId,
        toType: 'Event',
        toKey: 'event_id',
        toValue: event.event_id,
        relType: 'DESCRIBES',
        properties: { confidence: 0.9 }
      });
    }

    // 新闻 -> 公司
    for (const company of extractionResult.companies) {
      relationships.push({
        fromType: 'News',
        fromKey: 'id',
        fromValue: newsId,
        toType: 'Company',
        toKey: 'company_name',
        toValue: company.company_name,
        relType: 'INVOLVES',
        properties: { confidence: 0.8 }
      });
    }

    // 新闻 -> 人物
    for (const person of extractionResult.persons || []) {
      relationships.push({
        fromType: 'News',
        fromKey: 'id',
        fromValue: newsId,
        toType: 'Person',
        toKey: 'person_name',
        toValue: person.person_name,
        relType: 'MENTIONS',
        properties: { confidence: 0.8 }
      });
    }

    // 新闻 -> 机构
    for (const organization of extractionResult.organizations) {
      relationships.push({
        fromType: 'News',
        fromKey: 'id',
        fromValue: newsId,
        toType: 'Organization',
        toKey: 'organization_name',
        toValue: organization.organization_name,
        relType: 'INVOLVES',
        properties: { confidence: 0.8 }
      });
    }

    // 新闻 -> 地点
    for (const location of extractionResult.locations) {
      relationships.push({
        fromType: 'News',
        fromKey: 'id',
        fromValue: newsId,
        toType: 'Location',
        toKey: 'location_name',
        toValue: location.location_name,
        relType: 'LOCATED_AT',
        properties: { confidence: 0.7 }
      });
    }

    // 新闻 -> 时间
    for (const time of extractionResult.times) {
      relationships.push({
        fromType: 'News',
        fromKey: 'id',
        fromValue: newsId,
        toType: 'Time',
        toKey: 'time_value',
        toValue: time.time_value,
        relType: 'OCCURRED_AT',
        properties: { confidence: 0.7 }
      });
    }

    // 执行批量关系创建
    if (relationships.length > 0) {
      await this.neo4j.batchMergeRelationships(relationships);
    }
  }

  /**
   * 检查新闻是否已处理
   */
  async isNewsProcessed(newsId: string): Promise<boolean> {
    try {
      const result = await this.neo4j.executeQuery(
        'MATCH (n:News {id: $newsId}) RETURN n.processed as processed',
        { newsId }
      );

      return result.records.length > 0 && result.records[0].get('processed') === true;
    } catch (error) {
      logger.error(`检查新闻处理状态失败: ${newsId}`, error);
      return false;
    }
  }

  /**
   * 批量检查新闻处理状态
   */
  async getUnprocessedNewsIds(newsIds: string[]): Promise<string[]> {
    try {
      if (newsIds.length === 0) {
        return [];
      }

      const result = await this.neo4j.executeQuery(
        'MATCH (n:News) WHERE n.id IN $newsIds AND n.processed = true RETURN n.id as id',
        { newsIds }
      );

      const processedIds = result.records.map((record: any) => record.get('id'));
      const unprocessedIds = newsIds.filter(id => !processedIds.includes(id));

      logger.info(`总计 ${newsIds.length} 条新闻，已处理 ${processedIds.length} 条，未处理 ${unprocessedIds.length} 条`);

      return unprocessedIds;
    } catch (error) {
      logger.error('获取未处理新闻ID列表失败:', error);
      return newsIds; // 如果查询失败，认为都未处理
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<any> {
    try {
      // 检查数据库连接
      const result = await this.neo4j.executeQuery('RETURN 1 as test');
      
      return {
        status: 'healthy',
        service: 'EntityService',
        timestamp: new Date().toISOString(),
        neo4j_connection: result ? 'connected' : 'disconnected'
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        service: 'EntityService',
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }

  /**
   * 关闭服务
   */
  async close(): Promise<void> {
    await this.neo4j.close();
  }
}

export default new EntityService(); 
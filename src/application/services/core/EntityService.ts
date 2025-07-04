// @ts-nocheck
import logger from '../../../shared/utils/logger';
import neo4jService from '../../../infrastructure/database/Neo4jRepository';
import { Event, Company, Person, Location, Time, NewsExtractionResult } from '../../../domain/entities/index';

/**
 * 实体服务
 * 负责知识图谱中实体节点的创建和管理
 */
class EntityService {
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
      logger.info('实体服务初始化完成');
    } catch (error) {
      logger.error('实体服务初始化失败:', error);
      throw error;
    }
  }

  /**
   * 创建事件节点
   */
  async createEvent(event: Event): Promise<void> {
    const cypher = `
      MERGE (e:Event {event_id: $eventId})
      SET e.event_name = $eventName,
          e.event_description = $eventDescription,
          e.event_type = $eventType,
          e.event_date = $eventDate,
          e.sentiment = $sentiment,
          e.magnitude = $magnitude,
          e.event_level = $eventLevel,
          e.created_at = $createdAt,
          e.updated_at = $updatedAt
      RETURN e
    `;

    const parameters = {
      eventId: event.event_id,
      eventName: event.event_name,
      eventDescription: event.event_description || '',
      eventType: event.event_type || 'general',
      eventDate: event.event_date || new Date().toISOString(),
      sentiment: event.sentiment || 'neutral',
      magnitude: event.magnitude || 0,
      eventLevel: event.event_level || 5,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await this.neo4j.executeQuery(cypher, parameters);
    logger.debug(`事件节点创建成功: ${event.event_id}`);
  }

  /**
   * 创建公司节点
   */
  async createCompany(company: Company): Promise<void> {
    const cypher = `
      MERGE (c:Company {company_name: $companyName})
      SET c.market = $market,
          c.country = $country,
          c.created_at = $createdAt,
          c.updated_at = $updatedAt
      RETURN c
    `;

    const parameters = {
      companyName: company.company_name,
      market: company.market || '',
      country: company.country || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await this.neo4j.executeQuery(cypher, parameters);
    logger.debug(`公司节点创建成功: ${company.company_name}`);
  }

  /**
   * 创建人物节点
   */
  async createPerson(person: Person): Promise<void> {
    const cypher = `
      MERGE (p:Person {person_name: $personName})
      SET p.title = $title,
          p.nationality = $nationality,
          p.created_at = $createdAt,
          p.updated_at = $updatedAt
      RETURN p
    `;

    const parameters = {
      personName: person.person_name,
      title: person.title || '',
      nationality: person.nationality || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await this.neo4j.executeQuery(cypher, parameters);
    logger.debug(`人物节点创建成功: ${person.person_name}`);
  }

  /**
   * 创建位置节点
   */
  async createLocation(location: Location): Promise<void> {
    const cypher = `
      MERGE (l:Location {location_name: $locationName})
      SET l.type = $type,
          l.coordinates = $coordinates,
          l.created_at = $createdAt,
          l.updated_at = $updatedAt
      RETURN l
    `;

    const parameters = {
      locationName: location.location_name,
      type: location.type || '',
      coordinates: location.coordinates || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await this.neo4j.executeQuery(cypher, parameters);
    logger.debug(`位置节点创建成功: ${location.location_name}`);
  }

  /**
   * 创建时间节点
   */
  async createTime(time: Time): Promise<void> {
    const cypher = `
      MERGE (t:Time {time_value: $timeValue})
      SET t.created_at = $createdAt,
          t.updated_at = $updatedAt
      RETURN t
    `;

    const parameters = {
      timeValue: time.time_value,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await this.neo4j.executeQuery(cypher, parameters);
    logger.debug(`时间节点创建成功: ${time.time_value}`);
  }

  /**
   * 创建新闻节点
   */
  async createNews(newsItem: any, newsLevel: string = 'Level 5'): Promise<void> {
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
      timestamp: new Date(newsItem.time * 1000).toISOString(),
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
   * 批量创建实体
   */
  async batchCreateEntities(extractionResults: NewsExtractionResult[]): Promise<void> {
    const queries: string[] = [];
    const parameters: any = {};

    let paramIndex = 0;
    
    for (const result of extractionResults) {
      // 收集事件创建查询
      for (const event of result.events) {
        const eventParams = `event_${paramIndex}`;
        queries.push(`
          MERGE (e:Event {event_id: $${eventParams}.eventId})
          SET e.event_name = $${eventParams}.eventName,
              e.event_description = $${eventParams}.eventDescription,
              e.event_type = $${eventParams}.eventType,
              e.event_date = $${eventParams}.eventDate,
              e.sentiment = $${eventParams}.sentiment,
              e.magnitude = $${eventParams}.magnitude,
              e.event_level = $${eventParams}.eventLevel,
              e.created_at = $${eventParams}.createdAt,
              e.updated_at = $${eventParams}.updatedAt
        `);
        
        parameters[eventParams] = {
          eventId: event.event_id,
          eventName: event.event_name,
          eventDescription: event.event_description || '',
          eventType: event.event_type || 'general',
          eventDate: event.event_date || new Date().toISOString(),
          sentiment: event.sentiment || 'neutral',
          magnitude: event.magnitude || 0,
          eventLevel: event.event_level || 5,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        paramIndex++;
      }

      // 收集公司创建查询
      for (const company of result.companies) {
        const companyParams = `company_${paramIndex}`;
        queries.push(`
          MERGE (c:Company {company_name: $${companyParams}.companyName})
          SET c.market = $${companyParams}.market,
              c.country = $${companyParams}.country,
              c.created_at = $${companyParams}.createdAt,
              c.updated_at = $${companyParams}.updatedAt
        `);
        
        parameters[companyParams] = {
          companyName: company.company_name,
          market: company.market || '',
          country: company.country || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        paramIndex++;
      }

      // 收集人物创建查询
      for (const person of result.persons) {
        const personParams = `person_${paramIndex}`;
        queries.push(`
          MERGE (p:Person {person_name: $${personParams}.personName})
          SET p.title = $${personParams}.title,
              p.nationality = $${personParams}.nationality,
              p.created_at = $${personParams}.createdAt,
              p.updated_at = $${personParams}.updatedAt
        `);
        
        parameters[personParams] = {
          personName: person.person_name,
          title: person.title || '',
          nationality: person.nationality || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        paramIndex++;
      }

      // 收集位置创建查询
      for (const location of result.locations) {
        const locationParams = `location_${paramIndex}`;
        queries.push(`
          MERGE (l:Location {location_name: $${locationParams}.locationName})
          SET l.type = $${locationParams}.type,
              l.coordinates = $${locationParams}.coordinates,
              l.created_at = $${locationParams}.createdAt,
              l.updated_at = $${locationParams}.updatedAt
        `);
        
        parameters[locationParams] = {
          locationName: location.location_name,
          type: location.type || '',
          coordinates: location.coordinates || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        paramIndex++;
      }

      // 收集时间创建查询
      for (const time of result.times) {
        const timeParams = `time_${paramIndex}`;
        queries.push(`
          MERGE (t:Time {time_value: $${timeParams}.timeValue})
          SET t.created_at = $${timeParams}.createdAt,
              t.updated_at = $${timeParams}.updatedAt
        `);
        
        parameters[timeParams] = {
          timeValue: time.time_value,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        paramIndex++;
      }
    }

    // 执行批量查询
    if (queries.length > 0) {
      const batchCypher = queries.join('\n');
      await this.neo4j.executeQuery(batchCypher, parameters);
      logger.info(`批量创建实体完成: ${queries.length} 个实体`);
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
    } catch (error) {
      return {
        status: 'unhealthy',
        service: 'EntityService',
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }
}

export default new EntityService(); 
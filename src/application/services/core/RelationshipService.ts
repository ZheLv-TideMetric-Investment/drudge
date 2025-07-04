// @ts-nocheck
import logger from '../../../shared/utils/logger';
import neo4jService from '../../../infrastructure/database/Neo4jRepository';
import { NewsExtractionResult } from '../../../domain/entities/index';

/**
 * 关系服务
 * 负责知识图谱中实体关系的创建和管理
 */
class RelationshipService {
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
      logger.info('关系服务初始化完成');
    } catch (error) {
      logger.error('关系服务初始化失败:', error);
      throw error;
    }
  }

  /**
   * 创建事件-新闻关系
   */
  async createEventNewsRelation(eventId: string, newsId: string): Promise<void> {
    const cypher = `
      MATCH (e:Event {event_id: $eventId})
      MATCH (n:News {id: $newsId})
      MERGE (e)-[:REPORTED_IN]->(n)
    `;

    await this.neo4j.executeQuery(cypher, { eventId, newsId });
    logger.debug(`事件-新闻关系创建成功: ${eventId} -> ${newsId}`);
  }

  /**
   * 创建事件-公司关系
   */
  async createEventCompanyRelation(eventId: string, companyName: string): Promise<void> {
    const cypher = `
      MATCH (e:Event {event_id: $eventId})
      MATCH (c:Company {company_name: $companyName})
      MERGE (e)-[:INVOLVES]->(c)
    `;

    await this.neo4j.executeQuery(cypher, { eventId, companyName });
    logger.debug(`事件-公司关系创建成功: ${eventId} -> ${companyName}`);
  }

  /**
   * 创建事件-人物关系
   */
  async createEventPersonRelation(eventId: string, personName: string): Promise<void> {
    const cypher = `
      MATCH (e:Event {event_id: $eventId})
      MATCH (p:Person {person_name: $personName})
      MERGE (e)-[:INVOLVES]->(p)
    `;

    await this.neo4j.executeQuery(cypher, { eventId, personName });
    logger.debug(`事件-人物关系创建成功: ${eventId} -> ${personName}`);
  }

  /**
   * 创建事件-位置关系
   */
  async createEventLocationRelation(eventId: string, locationName: string): Promise<void> {
    const cypher = `
      MATCH (e:Event {event_id: $eventId})
      MATCH (l:Location {location_name: $locationName})
      MERGE (e)-[:OCCURRED_AT]->(l)
    `;

    await this.neo4j.executeQuery(cypher, { eventId, locationName });
    logger.debug(`事件-位置关系创建成功: ${eventId} -> ${locationName}`);
  }

  /**
   * 创建事件-时间关系
   */
  async createEventTimeRelation(eventId: string, timeValue: string): Promise<void> {
    const cypher = `
      MATCH (e:Event {event_id: $eventId})
      MATCH (t:Time {time_value: $timeValue})
      MERGE (e)-[:OCCURRED_AT]->(t)
    `;

    await this.neo4j.executeQuery(cypher, { eventId, timeValue });
    logger.debug(`事件-时间关系创建成功: ${eventId} -> ${timeValue}`);
  }

  /**
   * 创建自定义关系
   */
  async createCustomRelationship(relationship: any): Promise<void> {
    const cypher = `
      MATCH (from:${relationship.from_type} {${relationship.from_property}: $fromValue})
      MATCH (to:${relationship.to_type} {${relationship.to_property}: $toValue})
      MERGE (from)-[:${relationship.type}]->(to)
    `;

    const parameters = {
      fromValue: relationship.from_value,
      toValue: relationship.to_value
    };

    await this.neo4j.executeQuery(cypher, parameters);
    logger.debug(`自定义关系创建成功: ${relationship.from_value} -[${relationship.type}]-> ${relationship.to_value}`);
  }

  /**
   * 批量创建关系
   */
  async batchCreateRelationships(extractionResults: NewsExtractionResult[]): Promise<void> {
    const queries: string[] = [];
    const parameters: any = {};

    let paramIndex = 0;

    for (const result of extractionResults) {
      const newsId = result.newsId;

      // 为每个事件创建关系
      for (const event of result.events) {
        const eventId = event.event_id;

        // 事件-新闻关系
        const eventNewsParam = `eventNews_${paramIndex}`;
        queries.push(`
          MATCH (e:Event {event_id: $${eventNewsParam}.eventId})
          MATCH (n:News {id: $${eventNewsParam}.newsId})
          MERGE (e)-[:REPORTED_IN]->(n)
        `);
        parameters[eventNewsParam] = { eventId, newsId };
        paramIndex++;

        // 事件-公司关系
        for (const company of result.companies) {
          const eventCompanyParam = `eventCompany_${paramIndex}`;
          queries.push(`
            MATCH (e:Event {event_id: $${eventCompanyParam}.eventId})
            MATCH (c:Company {company_name: $${eventCompanyParam}.companyName})
            MERGE (e)-[:INVOLVES]->(c)
          `);
          parameters[eventCompanyParam] = { eventId, companyName: company.company_name };
          paramIndex++;
        }

        // 事件-人物关系
        for (const person of result.persons) {
          const eventPersonParam = `eventPerson_${paramIndex}`;
          queries.push(`
            MATCH (e:Event {event_id: $${eventPersonParam}.eventId})
            MATCH (p:Person {person_name: $${eventPersonParam}.personName})
            MERGE (e)-[:INVOLVES]->(p)
          `);
          parameters[eventPersonParam] = { eventId, personName: person.person_name };
          paramIndex++;
        }

        // 事件-位置关系
        for (const location of result.locations) {
          const eventLocationParam = `eventLocation_${paramIndex}`;
          queries.push(`
            MATCH (e:Event {event_id: $${eventLocationParam}.eventId})
            MATCH (l:Location {location_name: $${eventLocationParam}.locationName})
            MERGE (e)-[:OCCURRED_AT]->(l)
          `);
          parameters[eventLocationParam] = { eventId, locationName: location.location_name };
          paramIndex++;
        }

        // 事件-时间关系
        for (const time of result.times) {
          const eventTimeParam = `eventTime_${paramIndex}`;
          queries.push(`
            MATCH (e:Event {event_id: $${eventTimeParam}.eventId})
            MATCH (t:Time {time_value: $${eventTimeParam}.timeValue})
            MERGE (e)-[:OCCURRED_AT]->(t)
          `);
          parameters[eventTimeParam] = { eventId, timeValue: time.time_value };
          paramIndex++;
        }
      }

      // 创建自定义关系
      if (result.relationships) {
        for (const relationship of result.relationships) {
          const customRelParam = `customRel_${paramIndex}`;
          queries.push(`
            MATCH (from:${relationship.from_type} {${relationship.from_property}: $${customRelParam}.fromValue})
            MATCH (to:${relationship.to_type} {${relationship.to_property}: $${customRelParam}.toValue})
            MERGE (from)-[:${relationship.type}]->(to)
          `);
          parameters[customRelParam] = {
            fromValue: relationship.from_value,
            toValue: relationship.to_value
          };
          paramIndex++;
        }
      }
    }

    // 执行批量查询
    if (queries.length > 0) {
      const batchCypher = queries.join('\n');
      await this.neo4j.executeQuery(batchCypher, parameters);
      logger.info(`批量创建关系完成: ${queries.length} 个关系`);
    }
  }

  /**
   * 创建推断关系
   */
  async createInferredRelationships(extractionResults: NewsExtractionResult[]): Promise<void> {
    const queries: string[] = [];

    for (const result of extractionResults) {
      // 基于共同出现在同一新闻中的实体，创建推断关系
      const companies = result.companies;
      const persons = result.persons;
      const locations = result.locations;

      // 公司-人物关系推断
      for (const company of companies) {
        for (const person of persons) {
          queries.push(`
            MATCH (c:Company {company_name: "${company.company_name}"})
            MATCH (p:Person {person_name: "${person.person_name}"})
            MERGE (c)-[:RELATED_TO]->(p)
          `);
        }
      }

      // 公司-位置关系推断
      for (const company of companies) {
        for (const location of locations) {
          queries.push(`
            MATCH (c:Company {company_name: "${company.company_name}"})
            MATCH (l:Location {location_name: "${location.location_name}"})
            MERGE (c)-[:LOCATED_IN]->(l)
          `);
        }
      }

      // 人物-位置关系推断
      for (const person of persons) {
        for (const location of locations) {
          queries.push(`
            MATCH (p:Person {person_name: "${person.person_name}"})
            MATCH (l:Location {location_name: "${location.location_name}"})
            MERGE (p)-[:ASSOCIATED_WITH]->(l)
          `);
        }
      }
    }

    // 执行推断关系创建
    if (queries.length > 0) {
      const batchCypher = queries.join('\n');
      await this.neo4j.executeQuery(batchCypher);
      logger.info(`推断关系创建完成: ${queries.length} 个关系`);
    }
  }

  /**
   * 获取关系统计
   */
  async getRelationshipStats(): Promise<any> {
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
   * 健康检查
   */
  async healthCheck(): Promise<any> {
    try {
      // 检查关系总数
      const cypher = 'MATCH ()-[r]->() RETURN count(r) as relationship_count';
      const result = await this.neo4j.executeQuery(cypher);
      const relationshipCount = result.records[0]?.get('relationship_count').toNumber() || 0;
      
      return {
        status: 'healthy',
        service: 'RelationshipService',
        timestamp: new Date().toISOString(),
        relationship_count: relationshipCount
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        service: 'RelationshipService',
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }
}

export default new RelationshipService(); 
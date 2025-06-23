import neo4jService from '../../infrastructure/database/Neo4jRepository.js';
import entityExtractionService from '../../domain/services/entityExtractionService.js';
import logger from '../../shared/utils/logger.js';
import config from '../../shared/config/config.js';
import {
  Event,
  Company,
  Person,
  Organization,
  Location,
  Time,
  News,
  Relationship,
  GraphQueryResult,
  SnakeTrackingQuery,
  HourlySummary,
} from '../../domain/entities/index.js';
import { 
  RelationshipTypes,
  NodeTypes,
  SignificanceLevel 
} from '../../shared/types/enums.js';

/**
 * 新闻处理与图数据库存储系统 - 知识图谱服务
 * 基于新闻六要素（5W1H）构建和查询知识图谱
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
   * 检查新闻是否已经处理过
   * @param {string} newsId - 新闻ID
   * @returns {boolean} - 是否已处理
   */
  async isNewsProcessed(newsId) {
    const cypher = `
      MATCH (n:News {id: $newsId, processed: true})
      RETURN n
      LIMIT 1
    `;
    
    const result = await neo4jService.executeQuery(cypher, { newsId });
    return result.records.length > 0;
  }

  /**
   * 批量检查新闻是否已处理过
   * @param {Array} newsIds - 新闻ID列表
   * @returns {Array} - 未处理的新闻ID列表
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
    
    const result = await neo4jService.executeQuery(cypher, { newsIds });
    return result.records.map(record => record.get('newsId'));
  }

  /**
   * 处理新闻并构建知识图谱（幂等性保证）
   * @param {Object} newsItem - 新闻对象
   * @returns {Object} - 处理结果
   */
  async processNews(newsItem) {
    try {
      // 幂等性检查：如果新闻已经处理过，直接返回
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

      // 提取新闻六要素
      const extractionResult = await entityExtractionService.extractFromNews(newsItem);

      if (extractionResult.events.length === 0) {
        logger.info(`新闻 ${newsItem.id} 未提取到有效事件`);
        // 即使没有事件也要标记为已处理
        await this.createNewsNode(newsItem, extractionResult.news_level || 'Level 5');
        return { success: true, stats: extractionResult.getStats(), extractionResult };
      }

      // 创建新闻节点
      await this.createNewsNode(newsItem, extractionResult.news_level);

      // 处理各类节点
      const createdNodes = await this.processAllNodes(extractionResult, newsItem.id);

      // 建立关系
      await this.createRelationships(extractionResult, newsItem.id);

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
   * 创建新闻节点
   */
  async createNewsNode(newsItem, newsLevel = 'Level 3') {
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
      updatedAt: new Date().toISOString(),
    };

    await neo4jService.executeQuery(cypher, parameters);
  }

  /**
   * 处理所有节点创建
   */
  async processAllNodes(extractionResult, newsId) {
    const createdNodes = {
      events: 0,
      companies: 0,
      persons: 0,
      organizations: 0,
      locations: 0,
      times: 0,
    };

    // 处理事件节点
    for (const event of extractionResult.events) {
      await this.createEventNode(event);
      createdNodes.events++;
    }

    // 处理公司节点
    for (const company of extractionResult.companies) {
      await this.createCompanyNode(company);
      createdNodes.companies++;
    }

    // 处理人物节点
    for (const person of extractionResult.persons) {
      await this.createPersonNode(person);
      createdNodes.persons++;
    }

    // 处理机构节点
    for (const organization of extractionResult.organizations) {
      await this.createOrganizationNode(organization);
      createdNodes.organizations++;
  }

    // 处理地点节点
    for (const location of extractionResult.locations) {
      await this.createLocationNode(location);
      createdNodes.locations++;
    }

    // 处理时间节点
    for (const time of extractionResult.times) {
      await this.createTimeNode(time);
      createdNodes.times++;
    }

    return createdNodes;
  }

  /**
   * 创建事件节点
   */
  async createEventNode(event) {
    const cypher = `
      MERGE (e:Event {id: $id})
      SET e.event_name = $eventName,
          e.event_description = $eventDescription,
          e.event_date = $eventDate,
          e.event_type = $eventType,
          e.significance = $significance,
          e.sentiment = $sentiment,
          e.magnitude = $magnitude,
          e.event_level = $eventLevel,
          e.created_at = $createdAt,
          e.updated_at = $updatedAt
      RETURN e
    `;

    await neo4jService.executeQuery(cypher, {
      id: event.id,
      eventName: event.event_name,
      eventDescription: event.event_description,
      eventDate: event.event_date,
      eventType: event.event_type,
      significance: event.significance,
      sentiment: event.sentiment,
      magnitude: event.magnitude,
      eventLevel: event.event_level,
      createdAt: event.created_at,
      updatedAt: event.updated_at,
    });
  }

  /**
   * 创建公司节点
   */
  async createCompanyNode(company) {
    const cypher = `
      MERGE (c:Company {company_name: $companyName})
      SET c.ticker = $ticker,
          c.industry = $industry,
          c.created_at = $createdAt,
          c.updated_at = $updatedAt
      RETURN c
    `;

    await neo4jService.executeQuery(cypher, {
      companyName: company.company_name,
      ticker: company.ticker,
      industry: company.industry,
      createdAt: company.created_at,
      updatedAt: company.updated_at,
    });
  }

  /**
   * 创建人物节点
   */
  async createPersonNode(person) {
    const cypher = `
      MERGE (p:Person {person_name: $personName})
      SET p.role = $role,
          p.company = $company,
          p.created_at = $createdAt,
          p.updated_at = $updatedAt
      RETURN p
    `;

    await neo4jService.executeQuery(cypher, {
      personName: person.person_name,
      role: person.role,
      company: person.company,
      createdAt: person.created_at,
      updatedAt: person.updated_at,
    });
  }

  /**
   * 创建机构节点
   */
  async createOrganizationNode(organization) {
    const cypher = `
      MERGE (o:Organization {organization_name: $organizationName})
      SET o.type = $type,
          o.country = $country,
          o.created_at = $createdAt,
          o.updated_at = $updatedAt
      RETURN o
    `;

    await neo4jService.executeQuery(cypher, {
      organizationName: organization.organization_name,
      type: organization.type,
      country: organization.country,
      createdAt: organization.created_at,
      updatedAt: organization.updated_at,
    });
  }

  /**
   * 创建地点节点
   */
  async createLocationNode(location) {
    const cypher = `
      MERGE (l:Location {location_name: $locationName})
      SET l.country = $country,
          l.region = $region,
          l.created_at = $createdAt,
          l.updated_at = $updatedAt
      RETURN l
    `;

    await neo4jService.executeQuery(cypher, {
      locationName: location.location_name,
      country: location.country,
      region: location.region,
      createdAt: location.created_at,
      updatedAt: location.updated_at,
    });
  }

  /**
   * 创建时间节点
   */
  async createTimeNode(time) {
    const cypher = `
      MERGE (t:Time {timestamp: $timestamp})
      SET t.date = $date,
          t.hour = $hour,
          t.time_of_day = $timeOfDay,
          t.created_at = $createdAt
      RETURN t
    `;

    await neo4jService.executeQuery(cypher, {
      timestamp: time.timestamp,
      date: time.date,
      hour: time.hour,
      timeOfDay: time.time_of_day,
      createdAt: time.created_at,
    });
  }

  /**
   * 创建关系
   */
  async createRelationships(extractionResult, newsId) {
    // 事件与新闻的关系
    for (const event of extractionResult.events) {
      await this.createEventNewsRelation(event.id, newsId);
    }

    // 处理提取的关系
    for (const rel of extractionResult.relationships) {
      await this.createCustomRelationship(rel);
    }

    // 基于数据推断的自然关系
    await this.createInferredRelationships(extractionResult);
  }

  /**
   * 创建事件与新闻的关系
   */
  async createEventNewsRelation(eventId, newsId) {
    const cypher = `
      MATCH (e:Event {id: $eventId})
      MATCH (n:News {id: $newsId})
      MERGE (e)-[r:REPORTED_IN]->(n)
      SET r.created_at = $createdAt
    `;

    await neo4jService.executeQuery(cypher, {
      eventId,
      newsId,
      createdAt: new Date().toISOString(),
    });
  }

  /**
   * 创建自定义关系
   */
  async createCustomRelationship(relationship) {
    // 根据关系类型动态创建查询
    const cypher = `
      MATCH (from) WHERE from.event_name = $fromName OR from.company_name = $fromName OR from.person_name = $fromName
      MATCH (to) WHERE to.event_name = $toName OR to.company_name = $toName OR to.person_name = $toName
      MERGE (from)-[r:${relationship.type}]->(to)
      SET r.description = $description,
          r.confidence = $confidence,
          r.source = $source,
          r.created_at = $createdAt
    `;

    await neo4jService.executeQuery(cypher, {
      fromName: relationship.from,
      toName: relationship.to,
      description: relationship.description,
      confidence: relationship.confidence,
      source: relationship.source,
      createdAt: new Date().toISOString(),
    });
  }

  /**
   * 创建推断的自然关系
   */
  async createInferredRelationships(extractionResult) {
    // 事件与公司的关系
    for (const event of extractionResult.events) {
      for (const company of extractionResult.companies) {
        await this.createEventCompanyRelation(event.id, company.company_name);
      }
    }

    // 事件与人物的关系
    for (const event of extractionResult.events) {
      for (const person of extractionResult.persons) {
        await this.createEventPersonRelation(event.id, person.person_name, person.role);
      }
    }

    // 事件与地点的关系
    for (const event of extractionResult.events) {
      for (const location of extractionResult.locations) {
        await this.createEventLocationRelation(event.id, location.location_name);
      }
    }

    // 事件与时间的关系
    for (const event of extractionResult.events) {
      for (const time of extractionResult.times) {
        await this.createEventTimeRelation(event.id, time.timestamp);
      }
    }
  }

  /**
   * 创建事件与公司的关系
   */
  async createEventCompanyRelation(eventId, companyName) {
      const cypher = `
        MATCH (e:Event {id: $eventId})
      MATCH (c:Company {company_name: $companyName})
      MERGE (e)-[r:OCCURRED_IN]->(c)
      SET r.date = e.event_date,
          r.significance = e.significance,
          r.created_at = $createdAt
      `;

      await neo4jService.executeQuery(cypher, {
      eventId,
      companyName,
        createdAt: new Date().toISOString(),
      });
  }

  /**
   * 创建事件与人物的关系
   */
  async createEventPersonRelation(eventId, personName, role) {
      const cypher = `
        MATCH (e:Event {id: $eventId})
      MATCH (p:Person {person_name: $personName})
      MERGE (e)-[r:INVOLVES]->(p)
      SET r.role = $role,
          r.created_at = $createdAt
      `;

      await neo4jService.executeQuery(cypher, {
      eventId,
      personName,
      role,
        createdAt: new Date().toISOString(),
      });
  }

  /**
   * 创建事件与地点的关系
   */
  async createEventLocationRelation(eventId, locationName) {
    const cypher = `
      MATCH (e:Event {id: $eventId})
      MATCH (l:Location {location_name: $locationName})
      MERGE (e)-[r:OCCURRED_AT]->(l)
      SET r.location_type = '发生地',
          r.created_at = $createdAt
    `;

    await neo4jService.executeQuery(cypher, {
      eventId,
      locationName,
      createdAt: new Date().toISOString(),
    });
  }

  /**
   * 创建事件与时间的关系
   */
  async createEventTimeRelation(eventId, timestamp) {
    const cypher = `
      MATCH (e:Event {id: $eventId})
      MATCH (t:Time {timestamp: $timestamp})
      MERGE (e)-[r:HAPPENED_AT]->(t)
      SET r.created_at = $createdAt
    `;

    await neo4jService.executeQuery(cypher, {
      eventId,
      timestamp,
      createdAt: new Date().toISOString(),
    });
  }

  /**
   * 获取特定级别的新闻事件
   * @param {string} newsLevel - 新闻级别 (Level 1/Level 2/Level 3/Level 4)
   * @param {number} limit - 限制数量
   * @returns {Array} - 指定级别的事件列表
   */
  async getNewsByLevel(newsLevel = 'Level 1', limit = 20) {
    // 确保limit是整数
    const limitInt = parseInt(limit) || 20;
    
    const cypher = `
      MATCH (n:News {news_level: $newsLevel})-[:REPORTED_IN]-(e:Event)
      RETURN e, n
      ORDER BY n.timestamp DESC
      LIMIT $limit
    `;

    const result = await neo4jService.executeQuery(cypher, { newsLevel, limit: limitInt });
    return result.records.map(record => ({
      event: record.get('e').properties,
      news: record.get('n').properties,
    }));
  }

  /**
   * 草蛇灰线功能 - 查询公司相关事件
   * @param {string} companyName - 公司名称
   * @param {number} limit - 限制数量
   * @returns {Array} - 相关事件列表
   */
  async getCompanyEvents(companyName, limit = 50) {
    // 确保limit是整数
    const limitInt = parseInt(limit) || 50;
    
    const cypher = `
      MATCH (c:Company {company_name: $companyName})<-[:OCCURRED_IN]-(e:Event)
      RETURN e
      ORDER BY e.event_date DESC
      LIMIT $limit
    `;

    const result = await neo4jService.executeQuery(cypher, { companyName, limit: limitInt });
    return result.records.map(record => record.get('e').properties);
  }

  /**
   * 草蛇灰线功能 - 查询多公司关联事件
   * @param {Array} companyNames - 公司名称列表
   * @param {number} limit - 限制数量
   * @returns {Array} - 关联事件列表
   */
  async getMultiCompanyEvents(companyNames, limit = 30) {
    // 确保limit是整数
    const limitInt = parseInt(limit) || 30;
    
    const cypher = `
      MATCH (c1:Company)<-[:OCCURRED_IN]-(e:Event)-[:OCCURRED_IN]->(c2:Company)
      WHERE c1.company_name IN $companyNames AND c2.company_name IN $companyNames
      AND c1 <> c2
      RETURN DISTINCT e, collect(DISTINCT c1.company_name) + collect(DISTINCT c2.company_name) as companies
      ORDER BY e.event_date DESC
      LIMIT $limit
    `;

    const result = await neo4jService.executeQuery(cypher, { companyNames, limit: limitInt });
    return result.records.map(record => ({
      event: record.get('e').properties,
      companies: record.get('companies'),
    }));
  }

  /**
   * 草蛇灰线功能 - 查询某日所有事件
   * @param {string} date - 日期 (YYYY-MM-DD)
   * @returns {Array} - 当日事件列表
   */
  async getDayEvents(date) {
    const cypher = `
      MATCH (t:Time {date: $date})<-[:HAPPENED_AT]-(e:Event)
      OPTIONAL MATCH (e)-[:OCCURRED_IN]->(c:Company)
      OPTIONAL MATCH (e)-[:INVOLVES]->(p:Person)
      OPTIONAL MATCH (e)-[:OCCURRED_AT]->(l:Location)
      RETURN e, collect(DISTINCT c.company_name) as companies,
             collect(DISTINCT p.person_name) as persons,
             collect(DISTINCT l.location_name) as locations
      ORDER BY t.timestamp
    `;

    const result = await neo4jService.executeQuery(cypher, { date });
    return result.records.map(record => ({
      event: record.get('e').properties,
      companies: record.get('companies'),
      persons: record.get('persons'),
      locations: record.get('locations'),
    }));
  }

  /**
   * 按小时总结功能 - 获取某小时的新闻统计
   * @param {string} hourStart - 开始时间
   * @param {string} hourEnd - 结束时间
   * @returns {HourlySummary} - 小时总结
   */
  async getHourlySummary(hourStart, hourEnd) {
    const cypher = `
      MATCH (n:News)
      WHERE n.timestamp >= $hourStart AND n.timestamp < $hourEnd
      
      OPTIONAL MATCH (n)<-[:REPORTED_IN]-(e:Event)
      OPTIONAL MATCH (e)-[:OCCURRED_IN]->(c:Company)
      
      WITH n, e, c
      RETURN 
        count(DISTINCT n) as total_news_count,
        count(DISTINCT CASE WHEN n.news_level = 'Level 1' THEN n END) as critical_news_count,
        collect(DISTINCT {event: e.event_name, significance: e.significance}) as events,
        collect(DISTINCT c.company_name) as companies
    `;

    const result = await neo4jService.executeQuery(cypher, {
      hourStart,
      hourEnd,
    });

    if (result.records.length === 0) {
      return new HourlySummary({
        hour_start: hourStart,
        hour_end: hourEnd,
      });
    }

    const record = result.records[0];
    const events = record.get('events').filter(e => e.event !== null);
    const companies = record.get('companies').filter(c => c !== null);

    // 获取重要事件（按重要性排序）
    const topEvents = events
      .sort((a, b) => b.significance - a.significance)
      .slice(0, 10);

    // 获取最活跃的公司
    const companyCount = {};
    companies.forEach(company => {
      companyCount[company] = (companyCount[company] || 0) + 1;
    });
    const topCompanies = Object.entries(companyCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([company, count]) => ({ company, count }));

    return new HourlySummary({
      hour_start: hourStart,
      hour_end: hourEnd,
      total_news_count: record.get('total_news_count').toNumber(),
      critical_news_count: record.get('critical_news_count').toNumber(),
      top_events: topEvents,
      top_companies: topCompanies,
    });
          }

  /**
   * 搜索实体
   * @param {string} searchTerm - 搜索词
   * @param {string} nodeType - 节点类型
   * @param {number} limit - 限制数量
   * @returns {Array} - 搜索结果
   */
  async searchEntities(searchTerm, nodeType = null, limit = 20) {
    // 确保limit是整数
    const limitInt = parseInt(limit) || 20;
    
    let cypher = '';
    const parameters = { searchTerm: searchTerm.toLowerCase(), limit: limitInt };

    if (nodeType) {
      cypher = `
        MATCH (n:${nodeType})
        WHERE toLower(n.${this.getMainProperty(nodeType)}) CONTAINS $searchTerm
        RETURN n
        ORDER BY n.${this.getMainProperty(nodeType)}
        LIMIT $limit
      `;
      } else {
      cypher = `
        MATCH (n)
        WHERE (
          (n:Company AND toLower(n.${this.getMainProperty('Company')}) CONTAINS $searchTerm) OR
          (n:Person AND toLower(n.${this.getMainProperty('Person')}) CONTAINS $searchTerm) OR
          (n:Event AND toLower(n.${this.getMainProperty('Event')}) CONTAINS $searchTerm) OR
          (n:Location AND toLower(n.${this.getMainProperty('Location')}) CONTAINS $searchTerm) OR
          (n:Organization AND toLower(n.${this.getMainProperty('Organization')}) CONTAINS $searchTerm)
        )
        RETURN n, labels(n)[0] as nodeType
        LIMIT $limit
      `;
    }

    const result = await neo4jService.executeQuery(cypher, parameters);
    return result.records.map(record => ({
      node: record.get('n').properties,
      nodeType: nodeType || record.get('nodeType'),
    }));
  }

  /**
   * 获取节点的主要属性名
   */
  getMainProperty(nodeType) {
    const mapping = {
      Company: 'company_name',
      Person: 'person_name',
      Event: 'event_name',
      Location: 'location_name',
      Organization: 'organization_name',
      Time: 'date',
    };
    return mapping[nodeType] || 'name';
  }

  /**
   * 获取图谱统计信息
   */
  async getGraphStats() {
    const cypher = `
      MATCH (n)
      RETURN labels(n)[0] as nodeType, count(n) as count
      ORDER BY count DESC
    `;

    const result = await neo4jService.executeQuery(cypher);
    return result.records.map(record => ({
      nodeType: record.get('nodeType'),
      count: record.get('count').toNumber(),
    }));
  }

  /**
   * 获取新闻的提取结果（用于等级检查等）
   * @param {string} newsId - 新闻ID
   * @returns {Object|null} - 新闻提取结果
   */
  async getNewsExtractionResult(newsId) {
    try {
      // 查询新闻基本信息
      const newsCypher = `
        MATCH (n:News {id: $newsId, processed: true})
        RETURN n
      `;
      
      const newsResult = await neo4jService.executeQuery(newsCypher, { newsId });
      
      if (newsResult.records.length === 0) {
        return null; // 新闻不存在或未处理
      }
      
      const newsNode = newsResult.records[0].get('n').properties;
      
      // 查询相关实体
      const entitiesCypher = `
        MATCH (n:News {id: $newsId})
        OPTIONAL MATCH (n)<-[:REPORTED_IN]-(e:Event)
        OPTIONAL MATCH (e)-[:OCCURRED_IN]->(c:Company)
        OPTIONAL MATCH (e)-[:INVOLVES]->(p:Person)
        OPTIONAL MATCH (e)-[:OCCURRED_AT]->(l:Location)
        OPTIONAL MATCH (e)-[:HAPPENED_AT]->(t:Time)
        OPTIONAL MATCH (e)-[:RELATED_TO]->(o:Organization)
        
        RETURN 
          collect(DISTINCT e.event_name) as events,
          collect(DISTINCT c.company_name) as companies,
          collect(DISTINCT p.person_name) as persons,
          collect(DISTINCT o.organization_name) as organizations,
          collect(DISTINCT l.location_name) as locations,
          collect(DISTINCT t.date) as times
      `;
      
      const entitiesResult = await neo4jService.executeQuery(entitiesCypher, { newsId });
      
      if (entitiesResult.records.length === 0) {
        // 如果没有关联实体，返回基本信息
        return {
          news_id: newsId,
          news_level: newsNode.news_level || 'Level 5',
          confidence: newsNode.confidence || 0,
          entities: [],
          events: [],
          companies: [],
          persons: [],
          organizations: [],
          locations: [],
          times: [],
          processed_at: newsNode.updated_at
        };
      }
      
      const entitiesRecord = entitiesResult.records[0];
      
      // 过滤空值
      const events = entitiesRecord.get('events').filter(e => e !== null);
      const companies = entitiesRecord.get('companies').filter(c => c !== null);
      const persons = entitiesRecord.get('persons').filter(p => p !== null);
      const organizations = entitiesRecord.get('organizations').filter(o => o !== null);
      const locations = entitiesRecord.get('locations').filter(l => l !== null);
      const times = entitiesRecord.get('times').filter(t => t !== null);
      
      // 构建实体列表（用于兼容性）
      const entities = [...events, ...companies, ...persons, ...organizations, ...locations];
      
      return {
        news_id: newsId,
        news_level: newsNode.news_level || 'Level 5',
        confidence: newsNode.confidence || 0,
        entities,
        events,
        companies,
        persons,
        organizations,
        locations,
        times,
        processed_at: newsNode.updated_at
      };
      
    } catch (error) {
      logger.error(`获取新闻提取结果失败: ${newsId}`, error);
      return null;
    }
  }

  /**
   * 获取统计信息（用于脚本调用）
   * @returns {Object} - 图谱统计信息
   */
  async getStats() {
    try {
      const graphStats = await this.getGraphStats();
      
      // 计算总节点数和关系数
      const totalNodes = graphStats.reduce((sum, stat) => sum + stat.count, 0);
      
      // 获取关系数量
      const relationshipCypher = `
        MATCH ()-[r]->()
        RETURN count(r) as relationshipCount
      `;
      const relationshipResult = await neo4jService.executeQuery(relationshipCypher);
      const totalRelationships = relationshipResult.records[0].get('relationshipCount').toNumber();
      
      // 构建实体类型分布
      const entityTypes = {};
      for (const stat of graphStats) {
        if (stat.nodeType !== 'News') {
          entityTypes[stat.nodeType] = stat.count;
        }
      }
      
      // 获取新闻和实体数量
      const newsCount = graphStats.find(stat => stat.nodeType === 'News')?.count || 0;
      const entitiesCount = Object.values(entityTypes).reduce((sum, count) => sum + count, 0);
      
      return {
        nodes: totalNodes,
        relationships: totalRelationships,
        news: newsCount,
        entities: entitiesCount,
        entity_types: entityTypes,
        node_distribution: graphStats.reduce((acc, stat) => {
          acc[stat.nodeType] = stat.count;
          return acc;
        }, {}),
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('获取图谱统计信息失败:', error);
      return {
        nodes: 0,
        relationships: 0,
        news: 0,
        entities: 0,
        entity_types: {},
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * 导出图谱数据
   * @param {string} format - 导出格式 ('json', 'cypher', 'csv')
   * @returns {string|Object} - 导出的数据
   */
  async exportGraph(format = 'json') {
    try {
      logger.info(`开始导出图谱数据，格式: ${format}`);
      
      const timestamp = new Date().toISOString();
      
      switch (format.toLowerCase()) {
        case 'json':
          return await this.exportAsJson();
          
        case 'cypher':
          return await this.exportAsCypher();
          
        case 'csv':
          return await this.exportAsCsv();
          
        default:
          throw new Error(`不支持的导出格式: ${format}`);
      }
      
    } catch (error) {
      logger.error('导出图谱数据失败:', error);
      throw error;
    }
  }

  /**
   * 导出为JSON格式
   * @returns {Object} - JSON格式的图谱数据
   */
  async exportAsJson() {
    const nodesCypher = `
      MATCH (n)
      RETURN labels(n)[0] as nodeType, properties(n) as properties, id(n) as nodeId
      ORDER BY nodeType, nodeId
    `;
    
    const relationshipsCypher = `
      MATCH (a)-[r]->(b)
      RETURN 
        labels(a)[0] as sourceType, 
        properties(a) as sourceProps,
        type(r) as relationshipType,
        properties(r) as relationshipProps,
        labels(b)[0] as targetType,
        properties(b) as targetProps
      ORDER BY sourceType, relationshipType, targetType
    `;
    
    const [nodesResult, relationshipsResult] = await Promise.all([
      neo4jService.executeQuery(nodesCypher),
      neo4jService.executeQuery(relationshipsCypher)
    ]);
    
    const nodes = nodesResult.records.map(record => ({
      type: record.get('nodeType'),
      properties: record.get('properties'),
      id: record.get('nodeId').toNumber()
    }));
    
    const relationships = relationshipsResult.records.map(record => ({
      source: {
        type: record.get('sourceType'),
        properties: record.get('sourceProps')
      },
      relationship: {
        type: record.get('relationshipType'),
        properties: record.get('relationshipProps')
      },
      target: {
        type: record.get('targetType'),
        properties: record.get('targetProps')
      }
    }));
    
    return {
      metadata: {
        exportTime: new Date().toISOString(),
        nodeCount: nodes.length,
        relationshipCount: relationships.length,
        version: '1.0'
      },
      nodes,
      relationships
    };
  }

  /**
   * 导出为Cypher语句格式
   * @returns {string} - Cypher语句
   */
  async exportAsCypher() {
    const nodesCypher = `
      MATCH (n)
      RETURN labels(n)[0] as nodeType, properties(n) as properties
      ORDER BY nodeType
    `;
    
    const relationshipsCypher = `
      MATCH (a)-[r]->(b)
      RETURN 
        labels(a)[0] as sourceType, 
        properties(a) as sourceProps,
        type(r) as relationshipType,
        properties(r) as relationshipProps,
        labels(b)[0] as targetType,
        properties(b) as targetProps
      ORDER BY sourceType, relationshipType, targetType
    `;
    
    const [nodesResult, relationshipsResult] = await Promise.all([
      neo4jService.executeQuery(nodesCypher),
      neo4jService.executeQuery(relationshipsCypher)
    ]);
    
    let cypherStatements = [];
    
    // 添加注释头
    cypherStatements.push(`// 知识图谱数据导出`);
    cypherStatements.push(`// 导出时间: ${new Date().toISOString()}`);
    cypherStatements.push(`// 节点数量: ${nodesResult.records.length}`);
    cypherStatements.push(`// 关系数量: ${relationshipsResult.records.length}`);
    cypherStatements.push('');
    
    // 清理数据库（可选）
    cypherStatements.push('// 清理现有数据（可选）');
    cypherStatements.push('// MATCH (n) DETACH DELETE n;');
    cypherStatements.push('');
    
    // 生成节点创建语句
    cypherStatements.push('// 创建节点');
    const nodesByType = {};
    nodesResult.records.forEach(record => {
      const nodeType = record.get('nodeType');
      const props = record.get('properties');
      
      if (!nodesByType[nodeType]) {
        nodesByType[nodeType] = [];
      }
      nodesByType[nodeType].push(props);
    });
    
    Object.entries(nodesByType).forEach(([nodeType, nodes]) => {
      nodes.forEach(props => {
        const propsStr = Object.entries(props)
          .map(([key, value]) => `${key}: ${JSON.stringify(value)}`)
          .join(', ');
        cypherStatements.push(`CREATE (:${nodeType} {${propsStr}});`);
      });
    });
    
    cypherStatements.push('');
    cypherStatements.push('// 创建关系');
    
    // 生成关系创建语句
    relationshipsResult.records.forEach(record => {
      const sourceProps = record.get('sourceProps');
      const targetProps = record.get('targetProps');
      const relationshipType = record.get('relationshipType');
      const relationshipProps = record.get('relationshipProps');
      
      const sourceKey = this.getMainProperty(record.get('sourceType'));
      const targetKey = this.getMainProperty(record.get('targetType'));
      
      const sourceMatch = `${record.get('sourceType')} {${sourceKey}: ${JSON.stringify(sourceProps[sourceKey])}}`;
      const targetMatch = `${record.get('targetType')} {${targetKey}: ${JSON.stringify(targetProps[targetKey])}}`;
      
      const relPropsStr = Object.keys(relationshipProps).length > 0 
        ? ` {${Object.entries(relationshipProps).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join(', ')}}` 
        : '';
      
      cypherStatements.push(`MATCH (a:${sourceMatch}), (b:${targetMatch}) CREATE (a)-[:${relationshipType}${relPropsStr}]->(b);`);
    });
    
    return cypherStatements.join('\n');
  }

  /**
   * 导出为CSV格式
   * @returns {string} - CSV格式数据
   */
  async exportAsCsv() {
    const nodesCypher = `
      MATCH (n)
      RETURN labels(n)[0] as nodeType, properties(n) as properties
      ORDER BY nodeType
    `;
    
    const result = await neo4jService.executeQuery(nodesCypher);
    
    const csvLines = ['NodeType,Properties'];
    
    result.records.forEach(record => {
      const nodeType = record.get('nodeType');
      const props = JSON.stringify(record.get('properties')).replace(/"/g, '""');
      csvLines.push(`"${nodeType}","${props}"`);
    });
    
    return csvLines.join('\n');
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    try {
      const stats = await this.getGraphStats();
      const totalNodes = stats.reduce((sum, stat) => sum + stat.count, 0);
      
      return {
        status: 'healthy',
        totalNodes,
        nodeTypes: stats,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 批量创建知识图谱（供NewsProcessingService调用）
   * @param {Array} extractionResults - 实体提取结果数组
   * @returns {Array} - 处理结果数组
   */
  async batchCreateGraphData(extractionResults) {
    const results = [];
    
    try {
      // 1. 批量创建新闻节点（从extractionResults推断新闻信息）
      await this.batchCreateNewsNodesFromExtractions(extractionResults);
      
      // 2. 批量创建实体节点和关系
      await this.batchCreateEntitiesAndRelationships(extractionResults);
      
      // 3. 构建返回结果
      for (const extractionResult of extractionResults) {
        if (extractionResult && extractionResult.news_id) {
        const stats = {
            events: extractionResult.events?.length || 0,
            companies: extractionResult.companies?.length || 0,
            persons: extractionResult.persons?.length || 0,
            organizations: extractionResult.organizations?.length || 0,
            locations: extractionResult.locations?.length || 0,
            times: extractionResult.times?.length || 0,
          news_level: extractionResult.news_level,
          confidence: extractionResult.confidence
        };
        
        results.push({
            newsId: extractionResult.news_id,
          success: true,
          stats,
            extractionResult,
            processed_at: new Date().toISOString()
          });
        } else {
          results.push({ 
            newsId: extractionResult?.news_id || 'unknown',
            success: false, 
            error: '实体提取失败或缺少news_id',
            processed_at: new Date().toISOString()
          });
      }
    }
    
    return results;
    } catch (error) {
      logger.error('批量创建图数据失败:', error);
      // 返回错误结果
      return extractionResults.map(extractionResult => ({
        newsId: extractionResult?.news_id || 'unknown',
        success: false,
        error: error.message,
        processed_at: new Date().toISOString()
      }));
    }
  }

  /**
   * 从提取结果批量创建新闻节点
   * @param {Array} extractionResults - 提取结果数组
   */
  async batchCreateNewsNodesFromExtractions(extractionResults) {
    const queries = [];
    
    for (const extractionResult of extractionResults) {
      if (!extractionResult.news_id) continue;
      
      const query = {
        cypher: `
          MERGE (n:News {id: $id})
          SET n.news_level = $newsLevel,
              n.confidence = $confidence,
              n.processed = true,
              n.processing_time = $processingTime,
              n.entity_count = $entityCount,
              n.created_at = $createdAt,
              n.updated_at = $updatedAt
          RETURN n.id as newsId
        `,
        parameters: {
          id: extractionResult.news_id,
          newsLevel: extractionResult.news_level || 'Level 5',
          confidence: extractionResult.confidence || 0,
          processingTime: extractionResult.processing_time || 0,
          entityCount: (extractionResult.events?.length || 0) + 
                      (extractionResult.companies?.length || 0) + 
                      (extractionResult.persons?.length || 0) + 
                      (extractionResult.organizations?.length || 0) + 
                      (extractionResult.locations?.length || 0) + 
                      (extractionResult.times?.length || 0),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
      };
      
      queries.push(query);
    }
    
    // 批量执行
    if (queries.length > 0) {
    await this.executeBatchQueries(queries, '新闻节点');
    }
  }

  /**
   * 批量创建实体节点和关系
   * @param {Array} extractionResults - 提取结果数组
   */
  async batchCreateEntitiesAndRelationships(extractionResults) {
    const allQueries = [];
    
    // 收集所有实体创建查询
    for (const result of extractionResults) {
      const queries = await this.collectEntityQueries(result);
      allQueries.push(...queries);
    }
    
    // 批量执行实体创建
    if (allQueries.length > 0) {
      await this.executeBatchQueries(allQueries, '实体节点');
    }
    
    // 收集所有关系创建查询  
    const relationshipQueries = [];
    for (const result of extractionResults) {
      const queries = await this.collectRelationshipQueries(result);
      relationshipQueries.push(...queries);
    }
    
    // 批量执行关系创建
    if (relationshipQueries.length > 0) {
      await this.executeBatchQueries(relationshipQueries, '关系');
    }
  }

  /**
   * 收集实体创建查询
   * @param {NewsExtractionResult} extractionResult - 提取结果
   * @returns {Array} - 查询数组
   */
  async collectEntityQueries(extractionResult) {
    const queries = [];
    
    // 事件节点
    for (const event of extractionResult.events || []) {
      queries.push({
        cypher: `
          MERGE (e:Event {id: $id})
                   SET e.event_name = $eventName,
             e.event_description = $eventDescription,
             e.event_date = $eventDate,
             e.event_type = $eventType,
             e.significance = $significance,
             e.sentiment = $sentiment,
             e.magnitude = $magnitude,
             e.event_level = $eventLevel,
             e.created_at = $createdAt,
             e.updated_at = $updatedAt
          RETURN e.id
        `,
                 parameters: {
           id: event.id,
           eventName: event.event_name,
           eventDescription: event.event_description,
           eventDate: event.event_date,
           eventType: event.event_type,
           significance: event.significance,
           sentiment: event.sentiment,
           magnitude: event.magnitude,
           eventLevel: event.event_level,
           createdAt: event.created_at,
           updatedAt: event.updated_at,
         }
      });
    }
    
    // 公司节点
    for (const company of extractionResult.companies || []) {
      queries.push({
        cypher: `
          MERGE (c:Company {company_name: $companyName})
          SET c.ticker = $ticker,
              c.industry = $industry,
              c.created_at = $createdAt,
              c.updated_at = $updatedAt
          RETURN c.company_name
        `,
        parameters: {
          companyName: company.company_name,
          ticker: company.ticker,
          industry: company.industry,
          createdAt: company.created_at,
          updatedAt: company.updated_at,
        }
      });
    }
    
    // 人物节点
    for (const person of extractionResult.persons || []) {
      queries.push({
        cypher: `
          MERGE (p:Person {person_name: $personName})
          SET p.role = $role,
              p.company = $company,
              p.created_at = $createdAt,
              p.updated_at = $updatedAt
          RETURN p.person_name
        `,
        parameters: {
          personName: person.person_name,
          role: person.role,
          company: person.company,
          createdAt: person.created_at,
          updatedAt: person.updated_at,
        }
      });
    }
    
    // 机构节点
    for (const organization of extractionResult.organizations || []) {
      queries.push({
        cypher: `
          MERGE (o:Organization {organization_name: $organizationName})
          SET o.type = $type,
              o.country = $country,
              o.created_at = $createdAt,
              o.updated_at = $updatedAt
          RETURN o.organization_name
        `,
        parameters: {
          organizationName: organization.organization_name,
          type: organization.type,
          country: organization.country,
          createdAt: organization.created_at,
          updatedAt: organization.updated_at,
        }
      });
    }
    
    // 地点节点
    for (const location of extractionResult.locations || []) {
      queries.push({
        cypher: `
          MERGE (l:Location {location_name: $locationName})
          SET l.country = $country,
              l.region = $region,
              l.created_at = $createdAt,
              l.updated_at = $updatedAt
          RETURN l.location_name
        `,
        parameters: {
          locationName: location.location_name,
          country: location.country,
          region: location.region,
          createdAt: location.created_at,
          updatedAt: location.updated_at,
        }
      });
    }
    
    // 时间节点
    for (const time of extractionResult.times || []) {
      queries.push({
        cypher: `
          MERGE (t:Time {timestamp: $timestamp})
          SET t.date = $date,
              t.hour = $hour,
              t.time_of_day = $timeOfDay,
              t.created_at = $createdAt
          RETURN t.timestamp
        `,
        parameters: {
          timestamp: time.timestamp,
          date: time.date,
          hour: time.hour,
          timeOfDay: time.time_of_day,
          createdAt: time.created_at,
        }
      });
    }
    
    return queries;
  }

  /**
   * 收集关系创建查询
   * @param {NewsExtractionResult} extractionResult - 提取结果
   * @returns {Array} - 查询数组
   */
  async collectRelationshipQueries(extractionResult) {
    const queries = [];
    const createdAt = new Date().toISOString();
    
    // 事件与新闻的关系
    for (const event of extractionResult.events || []) {
      queries.push({
        cypher: `
          MATCH (e:Event {id: $eventId})
          MATCH (n:News {id: $newsId})
          MERGE (e)-[r:REPORTED_IN]->(n)
          SET r.created_at = $createdAt
        `,
        parameters: {
          eventId: event.id,
          newsId: extractionResult.news_id,
          createdAt
        }
      });
    }
    
    // 推断的关系
    for (const event of extractionResult.events || []) {
      // 事件与公司的关系
      for (const company of extractionResult.companies || []) {
        queries.push({
          cypher: `
            MATCH (e:Event {id: $eventId})
            MATCH (c:Company {company_name: $companyName})
            MERGE (e)-[r:OCCURRED_IN]->(c)
            SET r.date = e.event_date,
                r.significance = e.significance,
                r.created_at = $createdAt
          `,
          parameters: {
            eventId: event.id,
            companyName: company.company_name,
            createdAt
          }
        });
      }
      
      // 事件与人物的关系
      for (const person of extractionResult.persons || []) {
        queries.push({
          cypher: `
            MATCH (e:Event {id: $eventId})
            MATCH (p:Person {person_name: $personName})
            MERGE (e)-[r:INVOLVES]->(p)
            SET r.role = $role,
                r.created_at = $createdAt
          `,
          parameters: {
            eventId: event.id,
            personName: person.person_name,
            role: person.role,
            createdAt
          }
        });
      }
      
      // 事件与地点的关系
      for (const location of extractionResult.locations || []) {
        queries.push({
          cypher: `
            MATCH (e:Event {id: $eventId})
            MATCH (l:Location {location_name: $locationName})
            MERGE (e)-[r:OCCURRED_AT]->(l)
            SET r.location_type = '发生地',
                r.created_at = $createdAt
          `,
          parameters: {
            eventId: event.id,
            locationName: location.location_name,
            createdAt
          }
        });
      }
      
      // 事件与时间的关系
      for (const time of extractionResult.times || []) {
        queries.push({
          cypher: `
            MATCH (e:Event {id: $eventId})
            MATCH (t:Time {timestamp: $timestamp})
            MERGE (e)-[r:HAPPENED_AT]->(t)
            SET r.created_at = $createdAt
          `,
          parameters: {
            eventId: event.id,
            timestamp: time.timestamp,
            createdAt
          }
        });
      }
    }
    
    // 自定义关系
    for (const rel of extractionResult.relationships || []) {
      queries.push({
        cypher: `
          MATCH (from) WHERE from.event_name = $fromName OR from.company_name = $fromName OR from.person_name = $fromName
          MATCH (to) WHERE to.event_name = $toName OR to.company_name = $toName OR to.person_name = $toName
          MERGE (from)-[r:${rel.type}]->(to)
          SET r.description = $description,
              r.confidence = $confidence,
              r.source = $source,
              r.created_at = $createdAt
        `,
        parameters: {
          fromName: rel.from,
          toName: rel.to,
          description: rel.description,
          confidence: rel.confidence,
          source: rel.source,
          createdAt
        }
      });
    }
    
    return queries;
  }

  /**
   * 批量执行查询
   * @param {Array} queries - 查询数组
   * @param {string} queryType - 查询类型（用于日志）
   */
  async executeBatchQueries(queries, queryType) {
    const batchSize = config.batch?.dbBatchSize || 20; // 每批处理的查询数量
    
    for (let i = 0; i < queries.length; i += batchSize) {
      const batch = queries.slice(i, i + batchSize);
      let session = null;
      
      try {
        // 使用Neo4jRepository的executeBatch方法
        await neo4jService.executeBatch(batch);
        logger.debug(`批量执行${queryType}查询成功: ${batch.length}条`);
        
      } catch (error) {
        logger.error(`批量执行${queryType}查询失败:`, error);
        // 回退到单条执行
        for (const query of batch) {
          try {
            await neo4jService.executeQuery(query.cypher, query.parameters);
          } catch (singleError) {
            logger.warn(`单条${queryType}查询失败:`, singleError.message);
          }
        }
      }
    }
  }
}

export default new KnowledgeGraphService(); 
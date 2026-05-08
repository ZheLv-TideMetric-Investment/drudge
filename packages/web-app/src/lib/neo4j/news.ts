import { neo4jConnection } from './connection';
import { NodeType, EventLevel, SystemRelationshipType, RelationshipType } from '../../../constants/enums';
import { TimeZoneUtils } from '../utils/timezone';

/**
 * 新闻相关的数据库查询服务
 * 包含所有与新闻节点相关的查询操作
 */
class Neo4jNewsService {
  private normalizeNewsLevel(level?: string): string | undefined {
    if (!level) return undefined;
    const trimmed = level.trim();
    if (/^Level\s+\d+$/i.test(trimmed)) {
      return trimmed.replace(/^Level\s+/i, 'Level ');
    }
    if (/^\d+$/.test(trimmed)) {
      return `Level ${trimmed}`;
    }
    return trimmed;
  }

  private normalizeNeo4jInteger(value: any): any {
    return value && typeof value.toNumber === 'function' ? value.toNumber() : value;
  }

  /**
   * 获取时间范围内的新闻数据
   * @param startTime 开始时间（北京时间）
   * @param endTime 结束时间（北京时间）
   */
  async getNewsInTimeRange(startTime: string, endTime: string): Promise<any> {
    try {
      // 转换北京时间为UTC时间进行数据库查询
      const utcStartTime = TimeZoneUtils.toUTC(startTime);
      const utcEndTime = TimeZoneUtils.toUTC(endTime);
      const processedStartTime = new Date(utcStartTime).getTime();
      const processedEndTime = new Date(utcEndTime).getTime();

      const buildSummaryQuery = (whereClause: string) => `
        MATCH (n:${NodeType.NEWS})
        WHERE ${whereClause}
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

      let result = await neo4jConnection.executeQuery(buildSummaryQuery('n.timestamp >= $startTime AND n.timestamp <= $endTime'), {
        startTime: utcStartTime,
        endTime: utcEndTime
      });

      let record = result.records[0];
      let newsCount = record?.get('news_count')?.toNumber() || 0;

      if (newsCount === 0) {
        console.warn(
          `按新闻时间未找到数据，改用 processedAt 查询: ${utcStartTime} - ${utcEndTime}`
        );

        result = await neo4jConnection.executeQuery(
          buildSummaryQuery('n.processedAt >= $processedStartTime AND n.processedAt < $processedEndTime'),
          {
            processedStartTime,
            processedEndTime
          }
        );
        record = result.records[0];
        newsCount = record?.get('news_count')?.toNumber() || 0;
      }

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

      return {
        news_count: newsCount,
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
   * 获取高级别新闻（Level 1）
   * @param startTime 开始时间（北京时间）
   * @param endTime 结束时间（北京时间）
   */
  async getHighLevelNews(startTime: string, endTime: string): Promise<any[]> {
    try {
      // 转换北京时间为UTC时间进行数据库查询
      const utcStartTime = TimeZoneUtils.toUTC(startTime);
      const utcEndTime = TimeZoneUtils.toUTC(endTime);

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

      const result = await neo4jConnection.executeQuery(cypher, {
        startTime: utcStartTime,
        endTime: utcEndTime
      });

      return result.records.map((record: any) => ({
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
        event_levels: record.get('event_levels').filter(Boolean)
      }));
    } catch (error: any) {
      console.error('获取高级别新闻失败:', error);
      throw error;
    }
  }

  /**
   * 分页查询新闻列表
   * @param params.startTime UTC时间字符串（由时区感知包装器传入）
   * @param params.endTime UTC时间字符串（由时区感知包装器传入）
   */
  async getNewsWithPagination(params: {
    page?: number;
    limit?: number;
    startTime?: string;
    endTime?: string;
    keyword?: string;
    level?: string;
    sortBy?: 'timestamp' | 'processedAt';
    sortOrder?: 'asc' | 'desc';
  }): Promise<{ news: any[]; total: number }> {
    try {
      const {
        page = 1,
        limit = 20,
        startTime,
        endTime,
        keyword,
        level,
        sortBy = 'timestamp',
        sortOrder = 'desc'
      } = params;

      const normalizedLevel = this.normalizeNewsLevel(level);
      const offset = (page - 1) * limit;
      const whereConditions: string[] = [];
      const queryParams: any = { limit, offset };

      // 时间范围筛选（期望接收UTC时间）
      if (startTime) {
        whereConditions.push('n.timestamp >= $startTime');
        queryParams.startTime = startTime; // 直接使用UTC时间
      }
      
      if (endTime) {
        whereConditions.push('n.timestamp <= $endTime');
        queryParams.endTime = endTime; // 直接使用UTC时间
      }

      // 新闻级别筛选
      if (normalizedLevel) {
        whereConditions.push('n.news_level = $level');
        queryParams.level = normalizedLevel;
      }

      // 关键词搜索
      if (keyword) {
        whereConditions.push('(toLower(n.title) CONTAINS toLower($keyword) OR toLower(n.content) CONTAINS toLower($keyword))');
        queryParams.keyword = keyword;
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // 排序字段映射
      const sortField = sortBy === 'processedAt' ? 'n.processedAt' : 'n.timestamp';
      const sortDirection = sortOrder.toUpperCase();

      // 获取新闻列表的查询
      const newsQuery = `
        MATCH (n:News)
        ${whereClause}
        RETURN 
          n.id as id,
          n.title as title,
          n.content as content,
          n.news_level as level,
          n.timestamp as timestamp,
          n.processedAt as processedAt,
          n.source as source,
          n.url as url
        ORDER BY ${sortField} ${sortDirection}
        SKIP $offset
        LIMIT $limit
      `;

      // 获取总数的查询
      const countQuery = `
        MATCH (n:News)
        ${whereClause}
        RETURN count(n) as total
      `;

      // 执行查询
      const [newsResult, countResult] = await Promise.all([
        neo4jConnection.executeQuery(newsQuery, queryParams),
        neo4jConnection.executeQuery(countQuery, queryParams)
      ]);

      const news = newsResult.records.map((record: any) => {
        const processedAt = this.normalizeNeo4jInteger(record.get('processedAt'));

        return {
          id: record.get('id'),
          title: record.get('title'),
          content: record.get('content'),
          level: record.get('level'),
          timestamp: record.get('timestamp'),
          processedAt,
          source: record.get('source'),
          url: record.get('url'),
          // 保留原始UTC时间，时区格式化交给时区感知包装器处理
          displayTime: record.get('timestamp'),
          processedDisplayTime: processedAt
        };
      });

      const total = countResult.records[0]?.get('total')?.toNumber() || 0;

      return { news, total };
    } catch (error: any) {
      console.error('分页查询新闻失败:', error);
      throw error;
    }
  }

  /**
   * 搜索新闻（支持关键词高亮和相关性排序）
   * @param params.startTime UTC时间字符串（由时区感知包装器传入）
   * @param params.endTime UTC时间字符串（由时区感知包装器传入）
   */
  async searchNews(params: {
    keyword: string;
    page?: number;
    limit?: number;
    startTime?: string;
    endTime?: string;
    level?: string;
    searchFields?: 'title' | 'content' | 'both';
    sortBy?: 'relevance' | 'timestamp' | 'processedAt';
  }): Promise<{ news: any[]; total: number }> {
    try {
      const {
        keyword,
        page = 1,
        limit = 20,
        startTime,
        endTime,
        level,
        searchFields = 'both',
        sortBy = 'relevance'
      } = params;

      const normalizedLevel = this.normalizeNewsLevel(level);
      const offset = (page - 1) * limit;
      const whereConditions: string[] = [];
      const queryParams: any = { limit, offset, keyword };

      // 时间范围筛选（期望接收UTC时间）
      if (startTime) {
        whereConditions.push('n.timestamp >= $startTime');
        queryParams.startTime = startTime; // 直接使用UTC时间
      }
      
      if (endTime) {
        whereConditions.push('n.timestamp <= $endTime');
        queryParams.endTime = endTime; // 直接使用UTC时间
      }

      // 新闻级别筛选
      if (normalizedLevel) {
        whereConditions.push('n.news_level = $level');
        queryParams.level = normalizedLevel;
      }

      // 构建搜索字段条件
      let searchCondition = '';
      switch (searchFields) {
        case 'title':
          searchCondition = 'toLower(n.title) CONTAINS toLower($keyword)';
          break;
        case 'content':
          searchCondition = 'toLower(n.content) CONTAINS toLower($keyword)';
          break;
        case 'both':
        default:
          searchCondition = '(toLower(n.title) CONTAINS toLower($keyword) OR toLower(n.content) CONTAINS toLower($keyword))';
      }

      whereConditions.push(searchCondition);
      const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

      // 构建排序子句
      let orderClause = '';
      switch (sortBy) {
        case 'timestamp':
          orderClause = 'ORDER BY n.timestamp DESC';
          break;
        case 'processedAt':
          orderClause = 'ORDER BY n.processedAt DESC';
          break;
        case 'relevance':
        default:
          // 简单的相关性排序：标题匹配优先，然后按时间
          orderClause = `
            ORDER BY 
              CASE WHEN toLower(n.title) CONTAINS toLower($keyword) THEN 1 ELSE 2 END,
              n.timestamp DESC
          `;
      }

      // 搜索查询（包含相关性评分）
      const searchQuery = `
        MATCH (n:News)
        ${whereClause}
        WITH n,
          CASE 
            WHEN toLower(n.title) CONTAINS toLower($keyword) THEN 2
            WHEN toLower(n.content) CONTAINS toLower($keyword) THEN 1
            ELSE 0
          END as relevanceScore
        RETURN 
          n.id as id,
          n.title as title,
          n.content as content,
          n.news_level as level,
          n.timestamp as timestamp,
          n.processedAt as processedAt,
          n.source as source,
          n.url as url,
          relevanceScore
        ${orderClause}
        SKIP $offset
        LIMIT $limit
      `;

      // 获取搜索结果总数
      const countQuery = `
        MATCH (n:News)
        ${whereClause}
        RETURN count(n) as total
      `;

      // 执行查询
      const [searchResult, countResult] = await Promise.all([
        neo4jConnection.executeQuery(searchQuery, queryParams),
        neo4jConnection.executeQuery(countQuery, queryParams)
      ]);

      // 处理搜索结果，添加关键词高亮
      const news = searchResult.records.map((record: any) => {
        const title = record.get('title') || '';
        const content = record.get('content') || '';
        const processedAt = this.normalizeNeo4jInteger(record.get('processedAt'));
        
        // 简单的关键词高亮处理
        const highlightKeyword = (text: string, keyword: string) => {
          if (!text || !keyword) return text;
          const regex = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
          return text.replace(regex, '<mark>$1</mark>');
        };

        return {
          id: record.get('id'),
          title: record.get('title'),
          content: record.get('content'),
          level: record.get('level'),
          timestamp: record.get('timestamp'),
          processedAt,
          source: record.get('source'),
          url: record.get('url'),
          relevanceScore: record.get('relevanceScore'),
          // 高亮显示版本
          highlightedTitle: highlightKeyword(title, keyword),
          highlightedContent: content ? highlightKeyword(content.substring(0, 200) + '...', keyword) : '',
          // 保留原始UTC时间，时区格式化交给时区感知包装器处理
          displayTime: record.get('timestamp'),
          processedDisplayTime: processedAt
        };
      });

      const total = countResult.records[0]?.get('total')?.toNumber() || 0;

      return { news, total };
    } catch (error: any) {
      console.error('搜索新闻失败:', error);
      throw error;
    }
  }

  /**
   * 获取新闻的关联实体
   */
  async getNewsEntities(newsId: string): Promise<any[]> {
    try {
      console.log(`获取新闻 ${newsId} 的实体信息`);
      
      // 使用更精确的查询来获取新闻的所有实体
      const cypher = `
        MATCH (n:News {id: $newsId})-[r]->(entity)
        WHERE NOT entity:News AND NOT entity:Event
        RETURN 
          entity,
          labels(entity) as entityLabels,
          type(r) as relationType
      `;
      
      const result = await neo4jConnection.executeQuery(cypher, { newsId });
      
      const entities = result.records.map((record: any) => {
        const entity = record.get('entity');
        const labels = record.get('entityLabels');
        const relationType = record.get('relationType');
        
        // 根据实体类型获取名称属性
        let entityName = '';
        if (labels.includes('Company')) {
          entityName = entity.properties.company_name;
        } else if (labels.includes('Person')) {
          entityName = entity.properties.person_name;
        } else if (labels.includes('Organization')) {
          entityName = entity.properties.organization_name;
        } else if (labels.includes('Location')) {
          entityName = entity.properties.location_name;
        }
        
        return {
          id: entity.identity.toString(),
          name: entityName,
          type: labels[0],
          properties: entity.properties,
          relationType
        };
      }).filter((entity: any) => entity.name); // 过滤掉没有名称的实体
      
      console.log(`新闻 ${newsId} 找到 ${entities.length} 个实体`);
      return entities;
    } catch (error: any) {
      console.error(`获取新闻 ${newsId} 实体失败:`, error);
      return [];
    }
  }

  /**
   * 根据实体查询历史新闻
   */
  async getHistoricalNewsByEntities(entities: any[], startTime: string, endTime: string): Promise<any[]> {
    try {
      if (entities.length === 0) {
        return [];
      }
      
      console.log(`查询实体历史新闻: ${startTime} - ${endTime}`);
      
      // 为每个实体查询相关新闻
      const historicalNewsPromises = entities.map(async (entity: any) => {
        const cypher = `
          MATCH (entity)-[r]-(n:News)
          WHERE (entity.company_name = $entityName OR 
                 entity.person_name = $entityName OR 
                 entity.organization_name = $entityName OR 
                 entity.location_name = $entityName)
            AND n.timestamp >= $startTime 
            AND n.timestamp < $endTime
          RETURN DISTINCT
            n.id as id,
            n.title as title,
            n.content as content,
            n.news_level as level,
            n.timestamp as timestamp,
            type(r) as relationType
          ORDER BY n.timestamp DESC
          LIMIT 20
        `;
        
        const result = await neo4jConnection.executeQuery(cypher, {
          entityName: entity.name,
          startTime,
          endTime
        });
        
        return result.records.map((record: any) => ({
          id: record.get('id'),
          title: record.get('title'),
          content: record.get('content'),
          level: record.get('level'),
          timestamp: record.get('timestamp'),
          relationType: record.get('relationType'),
          relatedEntity: entity.name,
          relatedEntityType: entity.type
        }));
      });
      
      const results = await Promise.all(historicalNewsPromises);
      const allHistoricalNews = results.flat();
      
      // 去重（同一条新闻可能与多个实体相关）
      const uniqueNews = Array.from(new Map(
        allHistoricalNews.map(news => [news.id, news])
      ).values());
      
      console.log(`找到 ${uniqueNews.length} 条历史相关新闻`);
      return uniqueNews;
    } catch (error: any) {
      console.error('查询实体历史新闻失败:', error);
      return [];
    }
  }
}

export const neo4jNewsService = new Neo4jNewsService();
export { Neo4jNewsService }; 

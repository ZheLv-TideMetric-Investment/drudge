import { neo4jConnection } from './connection';
import { NodeType, EventLevel } from '../../../constants/enums';
import { TimeZoneUtils } from '../utils/timezone';

/**
 * Neo4j数据分析和统计服务
 * 提供各种图数据的分析和统计功能
 */
class Neo4jAnalyticsService {
  /**
   * 获取数据库统计信息
   */
  async getDatabaseStats(): Promise<any> {
    try {
      const cypher = `
        MATCH (n:${NodeType.NEWS}) WITH count(n) as news_count
        MATCH (c:${NodeType.COMPANY}) WITH news_count, count(c) as company_count
        MATCH (p:${NodeType.PERSON}) WITH news_count, company_count, count(p) as person_count
        MATCH (o:${NodeType.ORGANIZATION}) WITH news_count, company_count, person_count, count(o) as organization_count
        MATCH (l:${NodeType.LOCATION}) WITH news_count, company_count, person_count, organization_count, count(l) as location_count
        MATCH (e:${NodeType.EVENT}) WITH news_count, company_count, person_count, organization_count, location_count, count(e) as event_count
        MATCH ()-[r]->() WITH news_count, company_count, person_count, organization_count, location_count, event_count, count(r) as relationship_count
        RETURN 
          news_count + company_count + person_count + organization_count + location_count + event_count as totalNodes,
          relationship_count as relationships,
          news_count as news,
          company_count as companies,
          person_count as persons,
          organization_count as organizations,
          location_count as locations,
          event_count as events
      `;
      
      const result = await neo4jConnection.executeQuery(cypher);
      
      if (result.records.length === 0) {
        return { 
          totalNodes: 0, 
          relationships: 0,
          news: 0,
          companies: 0,
          persons: 0,
          organizations: 0,
          locations: 0,
          events: 0,
          connected: neo4jConnection.isConnected() 
        };
      }

      // 简化统计数据提取
      const simpleStats = await this.getSimpleStats();
      return {
        ...simpleStats,
        connected: neo4jConnection.isConnected()
      };
    } catch (error: any) {
      console.error('获取数据库统计信息失败:', error);
      return { error: error.message, connected: neo4jConnection.isConnected() };
    }
  }

  /**
   * 获取简化的统计信息
   */
  async getSimpleStats(): Promise<any> {
    try {
      const cypher = `
        MATCH (n:${NodeType.NEWS}) WITH count(n) as news_count
        MATCH (c:${NodeType.COMPANY}) WITH news_count, count(c) as company_count
        MATCH (p:${NodeType.PERSON}) WITH news_count, company_count, count(p) as person_count
        MATCH (o:${NodeType.ORGANIZATION}) WITH news_count, company_count, person_count, count(o) as organization_count
        MATCH (l:${NodeType.LOCATION}) WITH news_count, company_count, person_count, organization_count, count(l) as location_count
        MATCH (e:${NodeType.EVENT}) WITH news_count, company_count, person_count, organization_count, location_count, count(e) as event_count
        MATCH ()-[r]->() WITH news_count, company_count, person_count, organization_count, location_count, event_count, count(r) as relationship_count
        RETURN 
          news_count + company_count + person_count + organization_count + location_count + event_count as totalNodes,
          relationship_count as relationships,
          news_count as news,
          company_count as companies,
          person_count as persons,
          organization_count as organizations,
          location_count as locations,
          event_count as events
      `;

      const result = await neo4jConnection.executeQuery(cypher);
      
      if (result.records.length === 0) {
        return {
          totalNodes: 0,
          relationships: 0,
          news: 0,
          companies: 0,
          persons: 0,
          organizations: 0,
          locations: 0,
          events: 0
        };
      }

      const record = result.records[0];
      return {
        totalNodes: record.get('totalNodes').toNumber(),
        relationships: record.get('relationships').toNumber(),
        news: record.get('news').toNumber(),
        companies: record.get('companies').toNumber(),
        persons: record.get('persons').toNumber(),
        organizations: record.get('organizations').toNumber(),
        locations: record.get('locations').toNumber(),
        events: record.get('events').toNumber()
      };
    } catch (error: any) {
      console.error('获取简化统计信息失败:', error);
      throw error;
    }
  }

  /**
   * 获取新闻级别分布统计
   */
  async getNewsLevelDistribution(): Promise<any> {
    try {
      const cypher = `
        MATCH (n:${NodeType.NEWS})
        RETURN 
          n.news_level as level,
          count(n) as count
        ORDER BY n.news_level
      `;

      const result = await neo4jConnection.executeQuery(cypher);
      
      return {
        distribution: result.records.map((record: any) => ({
          level: record.get('level') || 'Unknown',
          count: record.get('count').toNumber()
        })),
        total: result.records.reduce((sum: number, record: any) => 
          sum + record.get('count').toNumber(), 0
        )
      };
    } catch (error: any) {
      console.error('获取新闻级别分布失败:', error);
      throw error;
    }
  }

  /**
   * 获取实体连接度统计
   */
  async getEntityConnectivityStats(limit: number = 10): Promise<any> {
    try {
      const cypher = `
        MATCH (entity)-[r]-()
        WHERE NOT entity:News
        WITH entity, count(r) as connections, labels(entity) as entityLabels
        RETURN 
          entityLabels[0] as entityType,
          entity.company_name as company_name,
          entity.person_name as person_name,
          entity.organization_name as organization_name,
          entity.location_name as location_name,
          entity.event_name as event_name,
          connections
        ORDER BY connections DESC
        LIMIT $limit
      `;

      const result = await neo4jConnection.executeQuery(cypher, { limit });
      
      return result.records.map((record: any) => {
        const entityType = record.get('entityType');
        let entityName = '';
        
        switch (entityType) {
          case 'Company':
            entityName = record.get('company_name') || '';
            break;
          case 'Person':
            entityName = record.get('person_name') || '';
            break;
          case 'Organization':
            entityName = record.get('organization_name') || '';
            break;
          case 'Location':
            entityName = record.get('location_name') || '';
            break;
          case 'Event':
            entityName = record.get('event_name') || '';
            break;
        }

        return {
          entityType,
          entityName,
          connections: record.get('connections').toNumber()
        };
      });
    } catch (error: any) {
      console.error('获取实体连接度统计失败:', error);
      throw error;
    }
  }

  /**
   * 获取新闻时间统计
   * @param startTime 开始时间（北京时间）
   * @param endTime 结束时间（北京时间）
   */
  async getNewsTimeStats(startTime: string, endTime: string): Promise<any> {
    try {
      // 转换北京时间为UTC时间进行数据库查询
      const utcStartTime = TimeZoneUtils.toUTC(startTime);
      const utcEndTime = TimeZoneUtils.toUTC(endTime);

      const cypher = `
        MATCH (n:${NodeType.NEWS})
        WHERE n.timestamp >= $startTime AND n.timestamp <= $endTime
        WITH n, date(datetime({epochMillis: apoc.date.parse(n.timestamp, 'ms', 'yyyy-MM-dd')})) as newsDate
        RETURN 
          newsDate,
          count(n) as dailyCount,
          sum(CASE WHEN n.news_level = '${EventLevel.LEVEL_1}' THEN 1 ELSE 0 END) as highLevelCount
        ORDER BY newsDate
      `;

      const result = await neo4jConnection.executeQuery(cypher, { 
        startTime: utcStartTime, 
        endTime: utcEndTime 
      });
      
      return {
        timeStats: result.records.map((record: any) => ({
          date: record.get('newsDate'),
          dailyCount: record.get('dailyCount').toNumber(),
          highLevelCount: record.get('highLevelCount').toNumber()
        })),
        summary: {
          totalDays: result.records.length,
          totalNews: result.records.reduce((sum: number, record: any) => 
            sum + record.get('dailyCount').toNumber(), 0
          ),
          totalHighLevel: result.records.reduce((sum: number, record: any) => 
            sum + record.get('highLevelCount').toNumber(), 0
          )
        }
      };
    } catch (error: any) {
      console.error('获取新闻时间统计失败:', error);
      throw error;
    }
  }

  /**
   * 获取实体类型分布统计
   */
  async getEntityTypeDistribution(): Promise<any> {
    try {
      const entityTypes = ['Company', 'Person', 'Organization', 'Location', 'Event'];
      const results: any[] = [];

      for (const entityType of entityTypes) {
        const cypher = `
          MATCH (n:${entityType})
          RETURN count(n) as count
        `;
        
        const result = await neo4jConnection.executeQuery(cypher);
        const count = result.records[0]?.get('count').toNumber() || 0;
        
        results.push({
          type: entityType,
          count
        });
      }

      const total = results.reduce((sum, item) => sum + item.count, 0);

      return {
        distribution: results.map(item => ({
          ...item,
          percentage: total > 0 ? (item.count / total * 100).toFixed(1) : '0.0'
        })),
        total
      };
    } catch (error: any) {
      console.error('获取实体类型分布失败:', error);
      throw error;
    }
  }

  /**
   * 获取关系类型统计
   */
  async getRelationshipTypeStats(): Promise<any> {
    try {
      const cypher = `
        MATCH ()-[r]->()
        RETURN 
          type(r) as relationshipType,
          count(r) as count
        ORDER BY count DESC
      `;

      const result = await neo4jConnection.executeQuery(cypher);
      
      const total = result.records.reduce((sum: number, record: any) => 
        sum + record.get('count').toNumber(), 0
      );

      return {
        relationships: result.records.map((record: any) => ({
          type: record.get('relationshipType'),
          count: record.get('count').toNumber(),
          percentage: total > 0 ? (record.get('count').toNumber() / total * 100).toFixed(1) : '0.0'
        })),
        total
      };
    } catch (error: any) {
      console.error('获取关系类型统计失败:', error);
      throw error;
    }
  }

  /**
   * 获取数据增长趋势
   */
  async getDataGrowthTrend(days: number = 30): Promise<any> {
    try {
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - days * 24 * 60 * 60 * 1000);

      const cypher = `
        MATCH (n)
        WHERE n.created_at >= $startTime AND n.created_at <= $endTime
        WITH date(datetime(n.created_at)) as createdDate, labels(n) as nodeLabels
        RETURN 
          createdDate,
          nodeLabels[0] as nodeType,
          count(n) as count
        ORDER BY createdDate, nodeType
      `;

      const result = await neo4jConnection.executeQuery(cypher, {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString()
      });

      // 按日期分组数据
      const dateGroups = new Map();
      
      result.records.forEach((record: any) => {
        const date = record.get('createdDate');
        const nodeType = record.get('nodeType');
        const count = record.get('count').toNumber();
        
        if (!dateGroups.has(date)) {
          dateGroups.set(date, {});
        }
        
        dateGroups.get(date)[nodeType] = count;
      });

      return {
        trend: Array.from(dateGroups.entries()).map(([date, types]) => ({
          date,
          ...types
        })),
        summary: {
          totalDays: dateGroups.size,
          totalNodes: result.records.reduce((sum: number, record: any) => 
            sum + record.get('count').toNumber(), 0
          )
        }
      };
    } catch (error: any) {
      console.error('获取数据增长趋势失败:', error);
      throw error;
    }
  }

  /**
   * 获取关系类型分布
   */
  async getRelationshipDistribution(): Promise<Record<string, number>> {
    try {
      const cypher = `
        MATCH ()-[r]->()
        RETURN type(r) as relationType, count(r) as count
        ORDER BY count DESC
      `;
      
      const result = await neo4jConnection.executeQuery(cypher);
      const distribution: Record<string, number> = {};
      
      result.records.forEach((record: any) => {
        const relationType = record.get('relationType');
        const count = record.get('count').toNumber();
        distribution[relationType] = count;
      });
      
      return distribution;
    } catch (error: any) {
      console.error('获取关系分布失败:', error);
      throw error;
    }
  }

  /**
   * 获取时间统计数据
   */
  async getTimeStats(): Promise<any> {
    try {
      // 先检查数据存在性和格式
      const checkQuery = `
        MATCH (n:News)
        RETURN n.timestamp as timestamp, n.news_level as level
        LIMIT 5
      `;
      
      const checkResult = await neo4jConnection.executeQuery(checkQuery);
      console.log('Sample news data:', checkResult.records.map((r: any) => ({
        timestamp: r.get('timestamp'),
        level: r.get('level')
      })));

      // 使用TimeZoneUtils获取北京时间的今日范围
      const todayRange = TimeZoneUtils.getTodayRange();
      const sevenDaysRange = TimeZoneUtils.getRecentDaysRange(7);
      
      // 获取今日按小时统计（按北京时间）
      const todayHourlyQuery = `
        MATCH (n:News)
        WHERE datetime(n.timestamp) >= datetime('${todayRange.startTime}')
        AND datetime(n.timestamp) < datetime('${todayRange.endTime}')
        WITH datetime(n.timestamp).hour + 8 as beijingHour, count(n) as newsCount,
             sum(CASE WHEN n.news_level IN ['${EventLevel.LEVEL_1}', '${EventLevel.LEVEL_2}'] THEN 1 ELSE 0 END) as highLevelCount
        WITH CASE WHEN beijingHour >= 24 THEN beijingHour - 24 ELSE beijingHour END as hour,
             newsCount, highLevelCount
        RETURN hour, newsCount, highLevelCount,
               toString(hour) + ':00' as time
        ORDER BY hour
      `;

      // 获取最近7天统计（按北京时间）
      const dailyQuery = `
        MATCH (n:News)
        WHERE datetime(n.timestamp) >= datetime('${sevenDaysRange.startTime}')
        WITH date(datetime(n.timestamp) + duration({hours: 8})) as beijingDate, count(n) as newsCount,
             sum(CASE WHEN n.news_level IN ['${EventLevel.LEVEL_1}', '${EventLevel.LEVEL_2}'] THEN 1 ELSE 0 END) as highLevelCount
        RETURN toString(beijingDate) as date,
               toString(beijingDate) as dateDisplay,
               newsCount, highLevelCount
        ORDER BY beijingDate DESC
      `;

      const [todayResult, dailyResult] = await Promise.all([
        neo4jConnection.executeQuery(todayHourlyQuery),
        neo4jConnection.executeQuery(dailyQuery)
      ]);

      const todayHourly = todayResult.records.map((record: any) => ({
        hour: record.get('hour').toNumber(),
        newsCount: record.get('newsCount').toNumber(),
        highLevelCount: record.get('highLevelCount').toNumber(),
        time: record.get('time')
      }));

      const daily = dailyResult.records.map((record: any) => ({
        date: record.get('date'),
        dateDisplay: record.get('dateDisplay'),
        newsCount: record.get('newsCount').toNumber(),
        highLevelCount: record.get('highLevelCount').toNumber()
      }));

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);

      return {
        todayHourly,
        daily,
        metadata: {
          todayStart: todayStart.toISOString(),
          yesterdayStart: yesterdayStart.toISOString(),
          sevenDaysAgo: sevenDaysAgo.toISOString()
        }
      };
    } catch (error: any) {
      console.error('获取时间统计失败:', error);
      throw error;
    }
  }
}

export const neo4jAnalyticsService = new Neo4jAnalyticsService();
export { Neo4jAnalyticsService }; 

import { neo4jService } from './neo4j';
import moment from 'moment-timezone';

/**
 * 查询服务
 * 提供从 Neo4j 数据库查询数据的方法
 */
class QueryService {
  neo4j = neo4jService;

  /**
   * 获取小时总结数据
   */
  async getHourlySummary(startTime: string, endTime: string): Promise<any> {
    try {
      const cypher = `
        MATCH (n:News)
        WHERE n.timestamp >= $startTime AND n.timestamp <= $endTime
        OPTIONAL MATCH (n)-[:DESCRIBES]->(e:Event)
        OPTIONAL MATCH (e)-[:INVOLVES]->(c:Company)
        OPTIONAL MATCH (e)-[:INVOLVES]->(p:Person)
        OPTIONAL MATCH (e)-[:INVOLVES]->(l:Location)
        
        RETURN 
          count(DISTINCT n) as news_count,
          count(DISTINCT e) as event_count,
          collect(DISTINCT c.company_name) as companies,
          collect(DISTINCT p.person_name) as persons,
          collect(DISTINCT l.location_name) as locations,
          collect({
            newsId: n.id,
            title: n.title,
            level: n.news_level,
            timestamp: n.timestamp
          }) as news_items
      `;

      const result = await this.neo4j.executeQuery(cypher, {
        startTime,
        endTime
      });

      if (result.records.length === 0) {
        return {
          news_count: 0,
          event_count: 0,
          companies: [],
          persons: [],
          locations: [],
          news_items: []
        };
      }

      const record = result.records[0];
      return {
        news_count: record.get('news_count').toNumber(),
        event_count: record.get('event_count').toNumber(),
        companies: record.get('companies').filter(Boolean),
        persons: record.get('persons').filter(Boolean),
        locations: record.get('locations').filter(Boolean),
        news_items: record.get('news_items').filter((item: any) => item.title)
      };
    } catch (error: any) {
      console.error('获取小时总结数据失败:', error);
      throw error;
    }
  }

  /**
   * 获取高级别新闻
   */
  async getHighLevelNews(startTime: string, endTime: string): Promise<any[]> {
    try {
      const cypher = `
        MATCH (n:News)
        WHERE n.timestamp >= $startTime 
          AND n.timestamp <= $endTime
          AND n.news_level IN ['Level 1', 'Level 2']
        OPTIONAL MATCH (n)-[:DESCRIBES]->(e:Event)
        OPTIONAL MATCH (e)-[:INVOLVES]->(c:Company)
        OPTIONAL MATCH (e)-[:INVOLVES]->(p:Person)
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
          collect(DISTINCT e.event_name) as events,
          collect(DISTINCT e.event_level) as event_levels
        ORDER BY n.timestamp DESC
      `;

      const result = await this.neo4j.executeQuery(cypher, {
        startTime,
        endTime
      });

      return result.records.map((record: any) => {
        const eventLevels = record.get('event_levels').filter(Boolean);
        const hasUrgentEvent = eventLevels.includes('Level 1');
        
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
          events: record.get('events').filter(Boolean),
          event_levels: eventLevels,
          urgency: hasUrgentEvent ? 'critical' : record.get('level') === 'Level 1' ? 'high' : 'medium'
        };
      });
    } catch (error: any) {
      console.error('获取高级别新闻失败:', error);
      throw error;
    }
  }

  /**
   * 获取每日新闻数据
   */
  async getDailyNewsData(startTime: string, endTime: string): Promise<any> {
    try {
      const cypher = `
        MATCH (n:News)
        WHERE n.timestamp >= $startTime AND n.timestamp <= $endTime
        OPTIONAL MATCH (n)-[:DESCRIBES]->(e:Event)
        OPTIONAL MATCH (e)-[:INVOLVES]->(c:Company)
        OPTIONAL MATCH (e)-[:INVOLVES]->(p:Person)
        
        RETURN 
          count(DISTINCT n) as news_count,
          count(DISTINCT e) as event_count,
          sum(CASE WHEN n.news_level IN ['Level 1', 'Level 2'] THEN 1 ELSE 0 END) as high_level_count,
          sum(CASE WHEN n.news_level = 'Level 1' THEN 1 ELSE 0 END) as critical_count,
          collect(DISTINCT c.company_name) as companies,
          collect(DISTINCT p.person_name) as persons,
          collect({
            newsId: n.id,
            title: n.title,
            level: n.news_level,
            timestamp: n.timestamp
          }) as news_items
      `;

      const result = await this.neo4j.executeQuery(cypher, {
        startTime,
        endTime
      });

      if (result.records.length === 0) {
        return {
          news_count: 0,
          event_count: 0,
          high_level_count: 0,
          critical_count: 0,
          companies: [],
          persons: [],
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
        news_items: record.get('news_items').filter((item: any) => item.title)
      };
    } catch (error: any) {
      console.error('获取每日新闻数据失败:', error);
      throw error;
    }
  }

  /**
   * 保存小时总结到 Neo4j
   */
  async saveHourlySummary(summary: any, hourStart: string, hourEnd: string, hourlyData: any): Promise<void> {
    try {
      const cypher = `
        CREATE (s:HourlySummary {
          hour_start: $hour_start,
          hour_end: $hour_end,
          overall_summary: $overall_summary,
          key_highlights: $key_highlights,
          market_impact: $market_impact,
          focus_areas: $focus_areas,
          severity_assessment: $severity_assessment,
          confidence: $confidence,
          news_count: $news_count,
          event_count: $event_count,
          high_level_count: $high_level_count,
          created_at: datetime()
        })
        RETURN s
      `;

      const highLevelCount = hourlyData.news_items.filter((item: any) => 
        item.level === 'Level 1' || item.level === 'Level 2'
      ).length;

      await this.neo4j.executeQuery(cypher, {
        hour_start: hourStart,
        hour_end: hourEnd,
        overall_summary: summary.overall_summary,
        key_highlights: summary.key_highlights,
        market_impact: summary.market_impact,
        focus_areas: summary.focus_areas,
        severity_assessment: summary.severity_assessment,
        confidence: summary.confidence,
        news_count: hourlyData.news_count,
        event_count: hourlyData.event_count,
        high_level_count: highLevelCount
      });

      console.log(`小时总结已保存到Neo4j: ${moment(hourStart).format('HH:00')}-${moment(hourEnd).format('HH:00')}`);
    } catch (error: any) {
      console.error('保存小时总结失败:', error);
      throw error;
    }
  }

  /**
   * 保存每日总结到 Neo4j
   */
  async saveDailySummary(summary: any, periodStart: string, periodEnd: string, dailyData: any): Promise<void> {
    try {
      const cypher = `
        CREATE (s:DailySummary {
          period_start: $period_start,
          period_end: $period_end,
          date: $date,
          overnight_overview: $overnight_overview,
          key_trends: $key_trends,
          market_risk_assessment: $market_risk_assessment,
          today_focus: $today_focus,
          overall_severity: $overall_severity,
          confidence: $confidence,
          news_count: $news_count,
          high_level_count: $high_level_count,
          critical_count: $critical_count,
          created_at: datetime()
        })
        RETURN s
      `;

      await this.neo4j.executeQuery(cypher, {
        period_start: periodStart,
        period_end: periodEnd,
        date: moment(periodEnd).format('YYYY-MM-DD'),
        overnight_overview: summary.overnight_overview,
        key_trends: summary.key_trends,
        market_risk_assessment: summary.market_risk_assessment,
        today_focus: summary.today_focus,
        overall_severity: summary.overall_severity,
        confidence: summary.confidence,
        news_count: dailyData.news_count,
        high_level_count: dailyData.high_level_count,
        critical_count: dailyData.critical_count
      });

      console.log(`每日总结已保存到Neo4j: ${moment(periodStart).format('MM-DD')} - ${moment(periodEnd).format('MM-DD')}`);
    } catch (error: any) {
      console.error('保存每日总结失败:', error);
      throw error;
    }
  }
}

export const queryService = new QueryService(); 
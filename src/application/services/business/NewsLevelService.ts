// @ts-nocheck
import logger from '../../../shared/utils/logger';
import moment from 'moment-timezone';
import notificationService from './NotificationService';
import queryService from './QueryService';
import aiService from '../../../infrastructure/external/AiService';
import { NewsLevel } from '../../../domain/value-objects/NewsLevel';

/**
 * 新闻级别服务
 * 负责新闻级别检查、评估和通知
 */
class NewsLevelService {
  constructor() {
    this.notification = notificationService;
    this.query = queryService;
    this.ai = aiService;
  }

  /**
   * 批量检查新闻级别（基于Neo4j）
   */
  async checkNewsLevels(limit: number = 50) {
    try {
      logger.info(`开始批量检查新闻级别，限制: ${limit} 条`);
      
      // 从Neo4j获取最近的新闻
      const cypher = `
        MATCH (n:News)
        WHERE n.news_level IS NOT NULL
        RETURN n.newsId as newsId, n.title as title, n.news_level as level, 
               n.timestamp as timestamp, n.content as content
        ORDER BY n.timestamp DESC
        LIMIT $limit
      `;

      const result = await this.query.neo4j.executeQuery(cypher, { limit });
      const newsItems = result.records.map(record => ({
        newsId: record.get('newsId'),
        title: record.get('title'),
        level: record.get('level'),
        timestamp: record.get('timestamp'),
        content: record.get('content')
      }));

      const results = [];
      let highLevelCount = 0;
      let breakNewsCount = 0;

      for (const newsItem of newsItems) {
        const isHighLevel = newsItem.level === 'Level 1' || newsItem.level === 'Level 2';
        const isBreakNews = newsItem.level === 'Level 1';
        
        if (isHighLevel) highLevelCount++;
        if (isBreakNews) breakNewsCount++;

        results.push({
          newsId: newsItem.newsId,
          title: newsItem.title,
          level: newsItem.level,
          isHighLevel,
          isBreakNews,
          timestamp: moment(newsItem.timestamp).format('YYYY-MM-DD HH:mm:ss')
        });
      }

      return {
        success: true,
        message: `检查完成，找到 ${highLevelCount} 条高级别新闻`,
        checked: newsItems.length,
        high_level: highLevelCount,
        break_news: breakNewsCount,
        results,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };

    } catch (error) {
      logger.error('批量检查新闻级别失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 检查最近新闻的级别（基于Neo4j）
   */
  async checkRecentNews(hours: number = 12) {
    try {
      const cutoffTime = moment().subtract(hours, 'hours');
      
      const cypher = `
        MATCH (n:News)
        WHERE n.timestamp >= $cutoff_time
          AND n.news_level IS NOT NULL
        RETURN n.newsId as newsId, n.title as title, n.news_level as level, 
               n.timestamp as timestamp
        ORDER BY n.timestamp DESC
      `;

      const result = await this.query.neo4j.executeQuery(cypher, { 
        cutoff_time: cutoffTime.toISOString() 
      });
      
      if (result.records.length === 0) {
        return {
          success: true,
          message: `最近 ${hours} 小时内没有新闻`,
          period: `${hours} 小时`,
          total_found: 0,
          high_level: 0,
          break_news: 0,
          results: [],
          timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
        };
      }

      const newsItems = result.records.map(record => ({
        newsId: record.get('newsId'),
        title: record.get('title'),
        level: record.get('level'),
        timestamp: record.get('timestamp')
      }));

      const results = [];
      let highLevelCount = 0;
      let breakNewsCount = 0;

      for (const newsItem of newsItems) {
        const isHighLevel = newsItem.level === 'Level 1' || newsItem.level === 'Level 2';
        const isBreakNews = newsItem.level === 'Level 1';
        
        if (isHighLevel) highLevelCount++;
        if (isBreakNews) breakNewsCount++;

        results.push({
          newsId: newsItem.newsId,
          title: newsItem.title,
          level: newsItem.level,
          isHighLevel,
          isBreakNews,
          time: moment(newsItem.timestamp).format('YYYY-MM-DD HH:mm:ss')
        });
      }

      return {
        success: true,
        message: `检查完成，找到 ${highLevelCount} 条高级别新闻`,
        period: `${hours} 小时`,
        total_found: newsItems.length,
        high_level: highLevelCount,
        break_news: breakNewsCount,
        results,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };

    } catch (error) {
      logger.error('检查最近新闻级别失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 检查单个新闻级别（基于Neo4j）
   */
  async checkSingleNews(newsId: string) {
    try {
      const cypher = `
        MATCH (n:News {newsId: $newsId})
        RETURN n.newsId as newsId, n.title as title, n.news_level as level, 
               n.timestamp as timestamp, n.content as content
      `;

      const result = await this.query.neo4j.executeQuery(cypher, { newsId });
      
      if (result.records.length === 0) {
        return {
          success: false,
          error: `未找到新闻 ID: ${newsId}`
        };
      }

      const record = result.records[0];
      const newsItem = {
        newsId: record.get('newsId'),
        title: record.get('title'),
        level: record.get('level'),
        timestamp: record.get('timestamp'),
        content: record.get('content')
      };

      const isHighLevel = newsItem.level === 'Level 1' || newsItem.level === 'Level 2';
      const isBreakNews = newsItem.level === 'Level 1';
      const shouldPush = isHighLevel || isBreakNews;

      return {
        success: true,
        message: `新闻级别检查完成`,
        newsId,
        title: newsItem.title,
        level: newsItem.level,
        isHighLevel,
        isBreakNews,
        shouldPush,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };

    } catch (error) {
      logger.error(`检查单个新闻级别失败: ${newsId}`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 重新扫描新闻级别
   */
  async rescanNews(limit: number = 100) {
    try {
      const result = await this.checkNewsLevels(limit);
      
      if (!result.success) {
        return result;
      }

      return {
        success: true,
        message: `重新扫描完成`,
        scanned: result.checked,
        updated: result.high_level,
        errors: result.checked - result.results.length,
        timestamp: result.timestamp
      };

    } catch (error) {
      logger.error('重新扫描新闻级别失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 发送突发新闻通知
   */
  async sendBreakNewsNotification(hours: number = 24) {
    try {
      // 这是一个简化版本，实际应该从数据库获取突发新闻
      return {
        success: true,
        message: `突发新闻通知发送完成`,
        sent: 0,
        period: `${hours} 小时`,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };

    } catch (error) {
      logger.error('发送突发新闻通知失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取级别统计（基于Neo4j）
   */
  async getLevelStats(days: number = 7) {
    try {
      const startTime = moment().subtract(days, 'days');
      
      const cypher = `
        MATCH (n:News)
        WHERE n.timestamp >= $start_time
          AND n.news_level IS NOT NULL
        RETURN 
          count(n) as total,
          sum(CASE WHEN n.news_level IN ['Level 1', 'Level 2'] THEN 1 ELSE 0 END) as highLevel,
          sum(CASE WHEN n.news_level = 'Level 1' THEN 1 ELSE 0 END) as breakNews,
          collect(n.news_level) as levels
      `;

      const result = await this.query.neo4j.executeQuery(cypher, {
        start_time: startTime.toISOString()
      });

      if (result.records.length === 0) {
        return {
          success: true,
          period: `${days} 天`,
          stats: {
            total: 0,
            highLevel: 0,
            breakNews: 0,
            levelDistribution: {}
          },
          timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
        };
      }

      const record = result.records[0];
      const levels = record.get('levels');
      const levelDistribution = {};
      
      levels.forEach(level => {
        levelDistribution[level] = (levelDistribution[level] || 0) + 1;
      });

      const stats = {
        total: record.get('total').toNumber(),
        highLevel: record.get('highLevel').toNumber(),
        breakNews: record.get('breakNews').toNumber(),
        avgImpactScore: 0, // 可以后续基于事件数据计算
        levelDistribution
      };

      return {
        success: true,
        period: `${days} 天`,
        stats,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };

    } catch (error) {
      logger.error('获取级别统计失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取突发新闻历史数据（基于Neo4j）
   */
  async getBreakNewsHistoryData(days: number = 30) {
    try {
      const startTime = moment().subtract(days, 'days');
      
      const cypher = `
        MATCH (n:News)
        WHERE n.timestamp >= $start_time
          AND n.news_level = 'Level 1'
        OPTIONAL MATCH (n)<-[:REPORTED_IN]-(e:Event)
        OPTIONAL MATCH (e)-[:INVOLVES]->(c:Company)
        RETURN 
          n.newsId as newsId,
          n.title as title,
          n.timestamp as detectedAt,
          collect(DISTINCT c.company_name) as companies
        ORDER BY n.timestamp DESC
      `;

      const result = await this.query.neo4j.executeQuery(cypher, {
        start_time: startTime.toISOString()
      });

      const history = result.records.map(record => ({
        newsId: record.get('newsId'),
        title: record.get('title'),
        detectedAt: record.get('detectedAt'),
        companies: record.get('companies').filter(Boolean),
        impactScore: null, // 可以后续添加
        reason: '高级别新闻自动检测'
      }));

      return {
        success: true,
        period: `${days} 天`,
        count: history.length,
        history,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };

    } catch (error) {
      logger.error('获取突发新闻历史失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default new NewsLevelService(); 
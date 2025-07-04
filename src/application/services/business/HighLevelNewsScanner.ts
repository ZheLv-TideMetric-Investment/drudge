// @ts-nocheck
import logger from '../../../shared/utils/logger';
import moment from 'moment-timezone';
import queryService from './QueryService';
import notificationService from './NotificationService';

/**
 * 高级别新闻扫描服务
 * 基于Neo4j数据，每5分钟扫描高等级新闻并发送通知
 */
class HighLevelNewsScanner {
  constructor() {
    this.query = queryService;
    this.notification = notificationService;
    this.lastScanTime = null;
    this.processedNewsIds = new Set(); // 记录已处理的新闻ID
  }

  /**
   * 扫描高级别新闻
   */
  async scanHighLevelNews(): Promise<any> {
    try {
      logger.info('开始扫描高级别新闻...');
      
      // 计算扫描时间范围
      const endTime = moment();
      const startTime = this.lastScanTime ? 
        moment(this.lastScanTime) : 
        moment().subtract(5, 'minutes'); // 首次运行扫描最近5分钟

      // 从Neo4j获取高级别新闻
      const highLevelNews = await this.getHighLevelNewsFromNeo4j(startTime, endTime);

      if (highLevelNews.length === 0) {
        this.lastScanTime = endTime.toISOString();
        return {
          success: true,
          found: 0,
          sent: 0,
          message: `${startTime.format('HH:mm')}-${endTime.format('HH:mm')} 时段没有发现高级别新闻`,
          period: `${startTime.format('HH:mm')}-${endTime.format('HH:mm')}`,
          timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
        };
      }

      // 过滤出未处理的新闻
      const newHighLevelNews = highLevelNews.filter(news => 
        !this.processedNewsIds.has(news.newsId)
      );

      if (newHighLevelNews.length === 0) {
        this.lastScanTime = endTime.toISOString();
        return {
          success: true,
          found: highLevelNews.length,
          sent: 0,
          message: `发现 ${highLevelNews.length} 条高级别新闻，但都已处理过`,
          period: `${startTime.format('HH:mm')}-${endTime.format('HH:mm')}`,
          timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
        };
      }

      // 发送通知
      let sentCount = 0;
      for (const news of newHighLevelNews) {
        try {
          await this.sendHighLevelNewsNotification(news);
          this.processedNewsIds.add(news.newsId);
          sentCount++;
        } catch (error) {
          logger.warn(`发送高级别新闻通知失败: ${news.newsId}`, error);
        }
      }

      // 更新最后扫描时间
      this.lastScanTime = endTime.toISOString();

      // 清理过期的已处理记录（保留最近4小时）
      this.cleanupProcessedNewsIds();

      return {
        success: true,
        found: highLevelNews.length,
        new_found: newHighLevelNews.length,
        sent: sentCount,
        message: `扫描完成：发现 ${highLevelNews.length} 条高级别新闻，新增 ${newHighLevelNews.length} 条，发送 ${sentCount} 条通知`,
        period: `${startTime.format('HH:mm')}-${endTime.format('HH:mm')}`,
        high_level_news: newHighLevelNews.map(news => ({
          newsId: news.newsId,
          title: news.title,
          level: news.level,
          urgency: news.urgency
        })),
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };

    } catch (error) {
      logger.error('扫描高级别新闻失败:', error);
      return {
        success: false,
        error: error.message,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };
    }
  }

  /**
   * 从Neo4j获取高级别新闻
   */
  private async getHighLevelNewsFromNeo4j(startTime: moment.Moment, endTime: moment.Moment): Promise<any[]> {
    const cypher = `
      MATCH (n:News)
      WHERE n.timestamp >= $start_time 
        AND n.timestamp <= $end_time
        AND n.news_level IN ['Level 1', 'Level 2']
      OPTIONAL MATCH (n)<-[:REPORTED_IN]-(e:Event)
      OPTIONAL MATCH (e)-[:INVOLVES]->(c:Company)
      OPTIONAL MATCH (e)-[:INVOLVES]->(p:Person)
      RETURN 
        n.newsId as newsId,
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

    const result = await this.query.neo4j.executeQuery(cypher, {
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString()
    });

    return result.records.map(record => {
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
  }

  /**
   * 发送高级别新闻通知
   */
  private async sendHighLevelNewsNotification(news: any): Promise<void> {
    const urgencyEmoji = {
      'critical': '🚨',
      'high': '🔴',
      'medium': '🟡'
    };

    const emoji = urgencyEmoji[news.urgency] || '⚠️';
    const timestamp = moment(news.timestamp).format('HH:mm:ss');

    let message = `${emoji} **高级别新闻提醒** [${news.level}]

📰 **标题**: ${news.title}
🕒 **时间**: ${timestamp}
📊 **级别**: ${news.level}
⚡ **紧急度**: ${news.urgency.toUpperCase()}`;

    if (news.companies.length > 0) {
      message += `\n🏢 **涉及公司**: ${news.companies.slice(0, 3).join(', ')}${news.companies.length > 3 ? '等' : ''}`;
    }

    if (news.persons.length > 0) {
      message += `\n👤 **涉及人物**: ${news.persons.slice(0, 3).join(', ')}${news.persons.length > 3 ? '等' : ''}`;
    }

    if (news.events.length > 0) {
      message += `\n📋 **相关事件**: ${news.events.slice(0, 2).join(', ')}${news.events.length > 2 ? '等' : ''}`;
    }

    if (news.source) {
      message += `\n📡 **来源**: ${news.source}`;
    }

    // 添加内容摘要（如果有）
    if (news.content && news.content.length > 50) {
      const summary = news.content.substring(0, 200);
      message += `\n\n📖 **内容摘要**: ${summary}...`;
    }

    if (news.url) {
      message += `\n🔗 **原文链接**: ${news.url}`;
    }

    await this.notification.webhook.sendMessage(message);
    logger.info(`高级别新闻通知已发送: ${news.newsId} - ${news.title}`);
  }

  /**
   * 清理过期的已处理新闻ID记录
   */
  private cleanupProcessedNewsIds(): void {
    // 简单实现：如果记录过多，清空部分旧记录
    if (this.processedNewsIds.size > 1000) {
      const idsArray = Array.from(this.processedNewsIds);
      const keepCount = 500; // 保留最近的500个
      this.processedNewsIds.clear();
      
      // 保留后半部分
      idsArray.slice(-keepCount).forEach(id => {
        this.processedNewsIds.add(id);
      });
      
      logger.info(`清理已处理新闻ID记录，保留最近 ${keepCount} 个`);
    }
  }

  /**
   * 获取扫描统计信息
   */
  async getScanStats(): Promise<any> {
    try {
      const last24Hours = moment().subtract(24, 'hours');
      
      const cypher = `
        MATCH (n:News)
        WHERE n.timestamp >= $start_time
          AND n.news_level IN ['Level 1', 'Level 2']
        RETURN 
          count(n) as total_high_level,
          sum(CASE WHEN n.news_level = 'Level 1' THEN 1 ELSE 0 END) as level_1_count,
          sum(CASE WHEN n.news_level = 'Level 2' THEN 1 ELSE 0 END) as level_2_count,
          collect(DISTINCT n.news_level) as levels
      `;

      const result = await this.query.neo4j.executeQuery(cypher, {
        start_time: last24Hours.toISOString()
      });

      const stats = result.records.length > 0 ? {
        total_high_level: result.records[0].get('total_high_level').toNumber(),
        level_1_count: result.records[0].get('level_1_count').toNumber(),
        level_2_count: result.records[0].get('level_2_count').toNumber(),
        processed_count: this.processedNewsIds.size,
        last_scan_time: this.lastScanTime
      } : {
        total_high_level: 0,
        level_1_count: 0,
        level_2_count: 0,
        processed_count: this.processedNewsIds.size,
        last_scan_time: this.lastScanTime
      };

      return {
        success: true,
        period: '最近24小时',
        stats,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };

    } catch (error) {
      logger.error('获取扫描统计失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 手动触发扫描（用于测试）
   */
  async manualScan(minutes: number = 30): Promise<any> {
    try {
      const endTime = moment();
      const startTime = moment().subtract(minutes, 'minutes');
      
      // 临时设置扫描时间范围
      const originalLastScanTime = this.lastScanTime;
      this.lastScanTime = startTime.toISOString();
      
      const result = await this.scanHighLevelNews();
      
      // 恢复原来的扫描时间
      if (originalLastScanTime) {
        this.lastScanTime = originalLastScanTime;
      }
      
      return {
        ...result,
        manual: true,
        manual_period: `${minutes}分钟`
      };

    } catch (error) {
      logger.error('手动扫描失败:', error);
      return {
        success: false,
        error: error.message,
        manual: true
      };
    }
  }
}

export default new HighLevelNewsScanner(); 
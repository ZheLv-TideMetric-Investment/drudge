// @ts-nocheck
import logger from '../../../shared/utils/logger';
import moment from 'moment-timezone';
import queryService from './QueryService';
import notificationService from './NotificationService';
import { callLLMWithJsonResponse, createMessages } from '../../../shared/utils/llm';
import { z } from 'zod';

/**
 * 每日总结服务
 * 基于Neo4j数据，次日10点总结前一天22点-今天10点的新闻
 */
class DailySummaryService {
  constructor() {
    this.query = queryService;
    this.notification = notificationService;
  }

  /**
   * 生成每日总结
   * 总结前一天22:00到今天10:00的新闻
   */
  async generateDailySummary(): Promise<any> {
    try {
      const currentTime = moment();
      
      // 只在每天10:00-11:00之间执行
      if (currentTime.hour() !== 10) {
        return {
          success: true,
          skipped: true,
          reason: `当前时间 ${currentTime.format('HH:mm')} 不是每日总结时间 (10:00)`,
          timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
        };
      }

      // 计算总结时间范围：前一天22:00 - 今天10:00
      const summaryEnd = moment().hour(10).minute(0).second(0).millisecond(0);
      const summaryStart = moment(summaryEnd).subtract(1, 'day').hour(22);
      
      logger.info(`开始生成每日总结: ${summaryStart.format('YYYY-MM-DD HH:00')} - ${summaryEnd.format('YYYY-MM-DD HH:00')}`);

      // 1. 从Neo4j获取该时段的新闻数据
      const dailyData = await this.getDailyNewsData(summaryStart, summaryEnd);

      if (dailyData.news_count === 0) {
        return {
          success: true,
          empty: true,
          message: `${summaryStart.format('MM-DD HH:00')} - ${summaryEnd.format('MM-DD HH:00')} 时段没有新闻`,
          period: `${summaryStart.format('MM-DD HH:00')} - ${summaryEnd.format('MM-DD HH:00')}`,
          timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
        };
      }

      // 2. 使用AI生成每日总结
      const summaryResult = await this.generateAIDailySummary(dailyData, summaryStart, summaryEnd);
      
      if (!summaryResult.success) {
        throw new Error(`AI每日总结生成失败: ${summaryResult.error}`);
      }

      // 3. 保存总结到Neo4j
      await this.saveDailySummaryToNeo4j(summaryResult.data, summaryStart, summaryEnd, dailyData);

      // 4. 发送每日总结通知
      await this.sendDailySummaryNotification(summaryResult.data, summaryStart, summaryEnd, dailyData);

      return {
        success: true,
        message: `每日总结生成完成`,
        period: `${summaryStart.format('MM-DD HH:00')} - ${summaryEnd.format('MM-DD HH:00')}`,
        news_count: dailyData.news_count,
        high_level_count: dailyData.high_level_count,
        critical_count: dailyData.critical_count,
        summary: summaryResult.data,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };

    } catch (error) {
      logger.error('生成每日总结失败:', error);
      return {
        success: false,
        error: error.message,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };
    }
  }

  /**
   * 获取每日新闻数据
   */
  private async getDailyNewsData(start: moment.Moment, end: moment.Moment): Promise<any> {
    const cypher = `
      MATCH (n:News)
      WHERE n.timestamp >= $start AND n.timestamp <= $end
      OPTIONAL MATCH (n)<-[:REPORTED_IN]-(e:Event)
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
          newsId: n.newsId,
          title: n.title,
          level: n.news_level,
          timestamp: n.timestamp
        }) as news_items
    `;

    const result = await this.query.neo4j.executeQuery(cypher, { 
      start: start.toISOString(), 
      end: end.toISOString() 
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
      news_items: record.get('news_items').filter(item => item.title)
    };
  }

  /**
   * 使用AI生成每日总结
   */
  private async generateAIDailySummary(dailyData: any, start: moment.Moment, end: moment.Moment): Promise<any> {
    const userPrompt = `
请为以下夜间新闻数据生成每日总结报告：

时间段：${start.format('YYYY-MM-DD HH:00')} - ${end.format('YYYY-MM-DD HH:00')} (夜间到早晨)
新闻总数：${dailyData.news_count}
事件总数：${dailyData.event_count}
高级别新闻：${dailyData.high_level_count}
紧急新闻：${dailyData.critical_count}

涉及主要公司：${dailyData.companies.slice(0, 15).join(', ')}
涉及重要人物：${dailyData.persons.slice(0, 10).join(', ')}

重要新闻列表：
${dailyData.news_items
  .filter(item => item.level === 'Level 1' || item.level === 'Level 2')
  .slice(0, 10)
  .map((item, index) => 
    `${index + 1}. [${item.level}] ${item.title}`
  ).join('\n')}

请生成一个综合的每日总结，包括：
1. 夜间总体情况概述
2. 关键事件和趋势分析
3. 市场影响和风险评估
4. 今日重点关注建议

总结应该专业、全面，适合作为晨间简报。`;

    const messages = createMessages(
      '你是一个资深的新闻分析师，擅长生成综合性的每日新闻总结报告。',
      userPrompt
    );

    const schema = z.object({
      overnight_overview: z.string().describe('夜间总体情况概述'),
      key_trends: z.array(z.string()).describe('关键事件和趋势分析'),
      market_risk_assessment: z.string().describe('市场影响和风险评估'),
      today_focus: z.array(z.string()).describe('今日重点关注建议'),
      overall_severity: z.enum(['low', 'medium', 'high', 'critical']).describe('整体严重程度评估'),
      confidence: z.number().min(0).max(1).describe('总结置信度')
    });

    return await callLLMWithJsonResponse(messages, {
      temperature: 0.3,
      schema
    });
  }

  /**
   * 保存每日总结到Neo4j
   */
  private async saveDailySummaryToNeo4j(summary: any, start: moment.Moment, end: moment.Moment, dailyData: any): Promise<void> {
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

    await this.query.neo4j.executeQuery(cypher, {
      period_start: start.toISOString(),
      period_end: end.toISOString(),
      date: end.format('YYYY-MM-DD'),
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

    logger.info(`每日总结已保存到Neo4j: ${start.format('MM-DD')} - ${end.format('MM-DD')}`);
  }

  /**
   * 发送每日总结通知
   */
  private async sendDailySummaryNotification(summary: any, start: moment.Moment, end: moment.Moment, dailyData: any): Promise<void> {
    const date = end.format('YYYY年MM月DD日');

    const message = `🌅 **每日新闻总结** ${date} 晨报

📅 **时间段**: ${start.format('MM-DD HH:00')} - ${end.format('MM-DD HH:00')}
📊 **数据概览**: ${dailyData.news_count}条新闻 | ${dailyData.high_level_count}条高级别

🌙 **夜间概况**
${summary.overnight_overview}

📈 **关键趋势**
${summary.key_trends.map((trend, index) => `${index + 1}. ${trend}`).join('\n')}

⚠️ **风险评估**
${summary.market_risk_assessment}

🎯 **今日关注**
${summary.today_focus.map((focus, index) => `• ${focus}`).join('\n')}

📊 **严重程度**: ${summary.overall_severity.toUpperCase()}
🎯 **置信度**: ${Math.round(summary.confidence * 100)}%`;

    await this.notification.webhook.sendMessage(message);
    logger.info(`每日总结通知已发送: ${date}`);
  }
}

export default new DailySummaryService(); 
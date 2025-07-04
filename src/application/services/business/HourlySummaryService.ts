// @ts-nocheck
import logger from '../../../shared/utils/logger';
import moment from 'moment-timezone';
import queryService from './QueryService';
import notificationService from './NotificationService';
import aiService from '../../../infrastructure/external/AiService';
import { callLLMWithJsonResponse, createMessages } from '../../../shared/utils/llm';
import { z } from 'zod';

/**
 * 小时总结服务
 * 基于Neo4j数据，生成11-22点的按小时新闻总结
 */
class HourlySummaryService {
  constructor() {
    this.query = queryService;
    this.notification = notificationService;
    this.ai = aiService;
  }

  /**
   * 生成小时总结
   * @param hour 小时数，如果不在11-22范围内则跳过
   */
  async generateHourlySummary(hour?: number): Promise<any> {
    try {
      const currentHour = hour || moment().hour();
      
      // 只在11-22点生成总结
      if (currentHour < 11 || currentHour > 22) {
        return {
          success: true,
          skipped: true,
          reason: `当前时间 ${currentHour}:00 不在工作时间范围 (11:00-22:00)`,
          hour: currentHour,
          timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
        };
      }

      const hourStart = moment().hour(currentHour).minute(0).second(0).millisecond(0);
      const hourEnd = moment(hourStart).add(1, 'hour');
      
      logger.info(`开始生成 ${hourStart.format('HH:00')}-${hourEnd.format('HH:00')} 小时总结`);

      // 1. 从Neo4j获取该小时的新闻数据
      const hourlyData = await this.query.getHourlySummary(
        hourStart.toISOString(),
        hourEnd.toISOString()
      );

      if (hourlyData.news_count === 0) {
        return {
          success: true,
          empty: true,
          message: `${hourStart.format('HH:00')}-${hourEnd.format('HH:00')} 时段没有新闻`,
          hour: currentHour,
          period: `${hourStart.format('HH:00')}-${hourEnd.format('HH:00')}`,
          timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
        };
      }

      // 2. 使用AI生成总结
      const summaryResult = await this.generateAISummary(hourlyData, hourStart, hourEnd);
      
      if (!summaryResult.success) {
        throw new Error(`AI总结生成失败: ${summaryResult.error}`);
      }

      // 3. 保存总结到Neo4j
      await this.saveSummaryToNeo4j(summaryResult.data, hourStart, hourEnd, hourlyData);

      // 4. 发送通知（如果有高级别新闻）
      const highLevelNews = hourlyData.news_items.filter(item => 
        item.level === 'Level 1' || item.level === 'Level 2'
      );

      if (highLevelNews.length > 0) {
        await this.sendHourlySummaryNotification(summaryResult.data, hourStart, hourEnd, highLevelNews);
      }

      return {
        success: true,
        message: `${hourStart.format('HH:00')}-${hourEnd.format('HH:00')} 小时总结生成完成`,
        hour: currentHour,
        period: `${hourStart.format('HH:00')}-${hourEnd.format('HH:00')}`,
        news_count: hourlyData.news_count,
        high_level_count: highLevelNews.length,
        summary: summaryResult.data,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };

    } catch (error) {
      logger.error('生成小时总结失败:', error);
      return {
        success: false,
        error: error.message,
        hour: hour || moment().hour(),
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };
    }
  }

  /**
   * 使用AI生成总结
   */
  private async generateAISummary(hourlyData: any, hourStart: moment.Moment, hourEnd: moment.Moment): Promise<any> {
    const userPrompt = `
请为以下小时新闻数据生成总结报告：

时间段：${hourStart.format('YYYY-MM-DD HH:00')} - ${hourEnd.format('HH:00')}
新闻总数：${hourlyData.news_count}
事件总数：${hourlyData.event_count}

涉及公司：${hourlyData.companies.slice(0, 10).join(', ')}
涉及人物：${hourlyData.persons.slice(0, 10).join(', ')}
涉及地点：${hourlyData.locations.slice(0, 5).join(', ')}

主要新闻：
${hourlyData.news_items.map((item, index) => 
  `${index + 1}. [${item.level}] ${item.title}`
).join('\n')}

请生成一个简洁的小时总结，包括：
1. 整体概况
2. 重要事件亮点
3. 市场影响评估
4. 关键关注点

总结应该专业、简洁，适合快速阅读。`;

    const messages = createMessages(
      '你是一个专业的新闻分析师，擅长生成简洁清晰的新闻总结报告。',
      userPrompt
    );

    const schema = z.object({
      overall_summary: z.string().describe('整体概况，2-3句话概括该小时的新闻情况'),
      key_highlights: z.array(z.string()).describe('重要事件亮点，最多5个要点'),
      market_impact: z.string().describe('市场影响评估，1-2句话'),
      focus_areas: z.array(z.string()).describe('关键关注点，最多3个'),
      severity_assessment: z.enum(['low', 'medium', 'high', 'critical']).describe('严重程度评估'),
      confidence: z.number().min(0).max(1).describe('总结置信度')
    });

    return await callLLMWithJsonResponse(messages, {
      temperature: 0.3,
      schema
    });
  }

  /**
   * 保存总结到Neo4j
   */
  private async saveSummaryToNeo4j(summary: any, hourStart: moment.Moment, hourEnd: moment.Moment, hourlyData: any): Promise<void> {
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

    const highLevelCount = hourlyData.news_items.filter(item => 
      item.level === 'Level 1' || item.level === 'Level 2'
    ).length;

    await this.query.neo4j.executeQuery(cypher, {
      hour_start: hourStart.toISOString(),
      hour_end: hourEnd.toISOString(),
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

    logger.info(`小时总结已保存到Neo4j: ${hourStart.format('HH:00')}-${hourEnd.format('HH:00')}`);
  }

  /**
   * 发送小时总结通知
   */
  private async sendHourlySummaryNotification(summary: any, hourStart: moment.Moment, hourEnd: moment.Moment, highLevelNews: any[]): Promise<void> {
    const message = `📊 **小时新闻总结** (${hourStart.format('HH:00')}-${hourEnd.format('HH:00')})

🔍 **整体概况**
${summary.overall_summary}

🎯 **重要亮点**
${summary.key_highlights.map((item, index) => `${index + 1}. ${item}`).join('\n')}

📈 **市场影响**
${summary.market_impact}

⚠️ **关注焦点**
${summary.focus_areas.map((item, index) => `• ${item}`).join('\n')}

🚨 **高级别新闻** (${highLevelNews.length}条)
${highLevelNews.slice(0, 3).map((item, index) => 
  `${index + 1}. [${item.level}] ${item.title}`
).join('\n')}

📊 **严重程度**: ${summary.severity_assessment.toUpperCase()}
🎯 **置信度**: ${Math.round(summary.confidence * 100)}%`;

    await this.notification.webhook.sendMessage(message);
    logger.info(`小时总结通知已发送: ${hourStart.format('HH:00')}-${hourEnd.format('HH:00')}`);
  }

  /**
   * 获取历史小时总结
   */
  async getHourlyHistory(hours: number = 24): Promise<any> {
    try {
      const endTime = moment();
      const startTime = moment().subtract(hours, 'hours');

      const cypher = `
        MATCH (s:HourlySummary)
        WHERE s.hour_start >= $start_time AND s.hour_start <= $end_time
        RETURN s
        ORDER BY s.hour_start DESC
      `;

      const result = await this.query.neo4j.executeQuery(cypher, {
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString()
      });

      const summaries = result.records.map(record => {
        const summary = record.get('s').properties;
        return {
          ...summary,
          hour_start: summary.hour_start,
          hour_end: summary.hour_end,
          created_at: summary.created_at
        };
      });

      return {
        success: true,
        period: `${startTime.format('YYYY-MM-DD HH:00')} - ${endTime.format('YYYY-MM-DD HH:00')}`,
        count: summaries.length,
        summaries,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };

    } catch (error) {
      logger.error('获取历史小时总结失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取当日总结统计
   */
  async getDailySummaryStats(): Promise<any> {
    try {
      const dayStart = moment().startOf('day');
      const dayEnd = moment().endOf('day');

      const cypher = `
        MATCH (s:HourlySummary)
        WHERE s.hour_start >= $day_start AND s.hour_start <= $day_end
        RETURN 
          count(s) as summary_count,
          sum(s.news_count) as total_news,
          sum(s.high_level_count) as total_high_level,
          collect(s.severity_assessment) as severity_levels,
          avg(s.confidence) as avg_confidence
      `;

      const result = await this.query.neo4j.executeQuery(cypher, {
        day_start: dayStart.toISOString(),
        day_end: dayEnd.toISOString()
      });

      if (result.records.length === 0) {
        return {
          success: true,
          date: dayStart.format('YYYY-MM-DD'),
          summary_count: 0,
          total_news: 0,
          total_high_level: 0,
          avg_confidence: 0,
          severity_distribution: {}
        };
      }

      const record = result.records[0];
      const severityLevels = record.get('severity_levels');
      const severityDistribution = {};
      severityLevels.forEach(level => {
        severityDistribution[level] = (severityDistribution[level] || 0) + 1;
      });

      return {
        success: true,
        date: dayStart.format('YYYY-MM-DD'),
        summary_count: record.get('summary_count').toNumber(),
        total_news: record.get('total_news').toNumber(),
        total_high_level: record.get('total_high_level').toNumber(),
        avg_confidence: record.get('avg_confidence'),
        severity_distribution: severityDistribution,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };

    } catch (error) {
      logger.error('获取当日总结统计失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default new HourlySummaryService(); 
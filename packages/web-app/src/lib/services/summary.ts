import moment from 'moment-timezone';
import { queryService } from './query';
import { notificationService } from './notification';
import { callLLMWithJsonResponse, createMessages } from '../utils/llm';
import { SummaryResult, CallSource } from '../../types/scheduler';
import { z } from 'zod';

/**
 * 总结服务
 * 包含小时总结和每日总结功能
 */
class SummaryService {
  /**
   * 生成小时总结
   * @param hour 小时数，如果不在11-22范围内则跳过
   * @param source 调用来源
   */
  async generateHourlySummary(hour?: number, source: CallSource = CallSource.API): Promise<SummaryResult> {
    try {
      const currentHour = hour || moment().hour();
      
      // 只在11-22点生成总结
      if (currentHour < 11 || currentHour > 22) {
        return {
          success: true,
          message: `当前时间 ${currentHour}:00 不在工作时间范围 (11:00-22:00)`,
          period: `${currentHour}:00`,
          timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
          data: { skipped: true, reason: '不在工作时间范围' }
        };
      }

      const hourStart = moment().hour(currentHour).minute(0).second(0).millisecond(0);
      const hourEnd = moment(hourStart).add(1, 'hour');
      
      console.log(`开始生成 ${hourStart.format('HH:00')}-${hourEnd.format('HH:00')} 小时总结`);

      // 1. 从Neo4j获取该小时的新闻数据
      const hourlyData = await queryService.getHourlySummary(
        hourStart.toISOString(),
        hourEnd.toISOString()
      );

      if (hourlyData.news_count === 0) {
        return {
          success: true,
          message: `${hourStart.format('HH:00')}-${hourEnd.format('HH:00')} 时段没有新闻`,
          period: `${hourStart.format('HH:00')}-${hourEnd.format('HH:00')}`,
          timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
          data: { empty: true }
        };
      }

      // 2. 使用AI生成总结
      const summaryResult = await this.generateAIHourlySummary(hourlyData, hourStart, hourEnd);
      
      if (!summaryResult.success) {
        throw new Error(`AI总结生成失败: ${summaryResult.error}`);
      }

      // 3. 保存总结到Neo4j
      await queryService.saveHourlySummary(summaryResult.data, hourStart.toISOString(), hourEnd.toISOString(), hourlyData);

      // 4. 发送通知（如果有高级别新闻）
      const highLevelNews = hourlyData.news_items.filter((item: any) => 
        item.level === 'Level 1' || item.level === 'Level 2'
      );

      if (highLevelNews.length > 0) {
        await notificationService.sendHourlySummaryNotification(
          summaryResult.data, 
          hourStart.toISOString(), 
          hourEnd.toISOString(), 
          highLevelNews, 
          source
        );
      }

      return {
        success: true,
        message: `${hourStart.format('HH:00')}-${hourEnd.format('HH:00')} 小时总结生成完成`,
        period: `${hourStart.format('HH:00')}-${hourEnd.format('HH:00')}`,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
        data: {
          news_count: hourlyData.news_count,
          high_level_count: highLevelNews.length,
          summary: summaryResult.data
        }
      };

    } catch (error: any) {
      console.error('生成小时总结失败:', error);
      return {
        success: false,
        message: '生成小时总结失败',
        period: hour ? `${hour}:00` : '',
        error: error.message,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };
    }
  }

  /**
   * 生成每日总结
   * 总结前一天22:00到今天10:00的新闻
   * @param source 调用来源
   */
  async generateDailySummary(source: CallSource = CallSource.API): Promise<SummaryResult> {
    try {
      const currentTime = moment();
      
      // 只在每天10:00-11:00之间执行
      if (currentTime.hour() !== 10) {
        return {
          success: true,
          message: `当前时间 ${currentTime.format('HH:mm')} 不是每日总结时间 (10:00)`,
          period: currentTime.format('HH:mm'),
          timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
          data: { skipped: true, reason: '不是每日总结时间' }
        };
      }

      // 计算总结时间范围：前一天22:00 - 今天10:00
      const summaryEnd = moment().hour(10).minute(0).second(0).millisecond(0);
      const summaryStart = moment(summaryEnd).subtract(1, 'day').hour(22);
      
      console.log(`开始生成每日总结: ${summaryStart.format('YYYY-MM-DD HH:00')} - ${summaryEnd.format('YYYY-MM-DD HH:00')}`);

      // 1. 从Neo4j获取该时段的新闻数据
      const dailyData = await queryService.getDailyNewsData(
        summaryStart.toISOString(),
        summaryEnd.toISOString()
      );

      if (dailyData.news_count === 0) {
        return {
          success: true,
          message: `${summaryStart.format('MM-DD HH:00')} - ${summaryEnd.format('MM-DD HH:00')} 时段没有新闻`,
          period: `${summaryStart.format('MM-DD HH:00')} - ${summaryEnd.format('MM-DD HH:00')}`,
          timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
          data: { empty: true }
        };
      }

      // 2. 使用AI生成每日总结
      const summaryResult = await this.generateAIDailySummary(dailyData, summaryStart, summaryEnd);
      
      if (!summaryResult.success) {
        throw new Error(`AI每日总结生成失败: ${summaryResult.error}`);
      }

      // 3. 保存总结到Neo4j
      await queryService.saveDailySummary(
        summaryResult.data, 
        summaryStart.toISOString(), 
        summaryEnd.toISOString(), 
        dailyData
      );

      // 4. 发送每日总结通知
      await notificationService.sendDailySummaryNotification(
        summaryResult.data, 
        summaryStart.toISOString(), 
        summaryEnd.toISOString(), 
        dailyData, 
        source
      );

      return {
        success: true,
        message: `每日总结生成完成`,
        period: `${summaryStart.format('MM-DD HH:00')} - ${summaryEnd.format('MM-DD HH:00')}`,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
        data: {
          news_count: dailyData.news_count,
          high_level_count: dailyData.high_level_count,
          critical_count: dailyData.critical_count,
          summary: summaryResult.data
        }
      };

    } catch (error: any) {
      console.error('生成每日总结失败:', error);
      return {
        success: false,
        message: '生成每日总结失败',
        period: '',
        error: error.message,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };
    }
  }

  /**
   * 使用AI生成小时总结
   */
  private async generateAIHourlySummary(hourlyData: any, hourStart: moment.Moment, hourEnd: moment.Moment): Promise<any> {
    const userPrompt = `
请为以下小时新闻数据生成总结报告：

时间段：${hourStart.format('YYYY-MM-DD HH:00')} - ${hourEnd.format('HH:00')}
新闻总数：${hourlyData.news_count}
事件总数：${hourlyData.event_count}

涉及公司：${hourlyData.companies.slice(0, 10).join(', ')}
涉及人物：${hourlyData.persons.slice(0, 10).join(', ')}
涉及机构：${hourlyData.organizations?.slice(0, 10).join(', ') || '无'}
涉及地点：${hourlyData.locations.slice(0, 5).join(', ')}

主要新闻：
${hourlyData.news_items.map((item: any, index: number) => 
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
涉及关键机构：${dailyData.organizations?.slice(0, 10).join(', ') || '无'}

重要新闻列表：
${dailyData.news_items
  .filter((item: any) => item.level === 'Level 1' || item.level === 'Level 2')
  .slice(0, 10)
  .map((item: any, index: number) => 
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
}

export const summaryService = new SummaryService(); 
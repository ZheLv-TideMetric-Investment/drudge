import moment from 'moment-timezone';
import { queryService } from './query';
import { notificationService } from './notification';
import { callLLMWithJsonResponse, createMessages } from '../utils/llm';
import { SummaryResult, CallSource } from '../../types/scheduler';
import { z } from 'zod';

/**
 * 总结类型枚举
 */
export enum SummaryType {
  HOURLY = 'hourly',
  DAILY = 'daily',
  CUSTOM = 'custom'
}

/**
 * 总结服务
 * 提供统一的新闻总结功能
 */
class SummaryService {
  /**
   * 生成新闻总结
   * @param startTime 开始时间（ISO字符串或moment对象）
   * @param endTime 结束时间（ISO字符串或moment对象）
   * @param summaryType 总结类型
   * @param source 调用来源
   */
  async generateSummary(
    startTime: string | moment.Moment,
    endTime: string | moment.Moment,
    summaryType: SummaryType = SummaryType.CUSTOM,
    source: CallSource = CallSource.API
  ): Promise<SummaryResult> {
    try {
      // 转换时间格式
      const start = moment(startTime);
      const end = moment(endTime);
      
      if (!start.isValid() || !end.isValid()) {
        throw new Error('无效的时间格式');
      }

      if (start.isAfter(end)) {
        throw new Error('开始时间不能晚于结束时间');
      }

      console.log(`开始生成${this.getSummaryTypeName(summaryType)}总结: ${start.format('YYYY-MM-DD HH:mm')} - ${end.format('YYYY-MM-DD HH:mm')}`);

      // 1. 从Neo4j获取时间范围内的新闻数据
      const newsData = await this.getNewsData(start, end, summaryType);

      if (newsData.news_count === 0) {
        return {
          success: true,
          message: `${start.format('MM-DD HH:mm')} - ${end.format('MM-DD HH:mm')} 时段没有新闻`,
          period: this.formatPeriod(start, end),
          timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
          data: { empty: true, type: summaryType }
        };
      }

      // 2. 使用AI生成总结
      const summaryResult = await this.generateAISummary(newsData, start, end, summaryType);
      
      if (!summaryResult.success) {
        throw new Error(`AI总结生成失败: ${summaryResult.error}`);
      }

      // 3. 保存总结到Neo4j
      await this.saveSummary(summaryResult.data, start, end, newsData, summaryType);

      // 4. 发送通知（如果需要）
      await this.sendNotificationIfNeeded(summaryResult.data, start, end, newsData, summaryType, source);

      return {
        success: true,
        message: `${this.getSummaryTypeName(summaryType)}总结生成完成`,
        period: this.formatPeriod(start, end),
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
        data: {
          type: summaryType,
          news_count: newsData.news_count,
          high_level_count: this.getHighLevelCount(newsData),
          summary: summaryResult.data,
          time_range: {
            start: start.toISOString(),
            end: end.toISOString()
          }
        }
      };

    } catch (error: any) {
      console.error('生成总结失败:', error);
      return {
        success: false,
        message: `生成${this.getSummaryTypeName(summaryType)}总结失败`,
        period: this.formatPeriod(moment(startTime), moment(endTime)),
        error: error.message,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };
    }
  }

  /**
   * 生成小时总结的便捷方法
   * @param hour 小时数，默认为当前小时
   * @param source 调用来源
   */
  async generateHourlySummary(hour?: number, source: CallSource = CallSource.API): Promise<SummaryResult> {
    const currentHour = hour || moment().hour();
    
    // 只在11-22点生成总结
    if (currentHour < 11 || currentHour > 22) {
      return {
        success: true,
        message: `当前时间 ${currentHour}:00 不在工作时间范围 (11:00-22:00)`,
        period: `${currentHour}:00`,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
        data: { skipped: true, reason: '不在工作时间范围', type: SummaryType.HOURLY }
      };
    }

    const hourStart = moment().hour(currentHour).minute(0).second(0).millisecond(0);
    const hourEnd = moment(hourStart).add(1, 'hour');
    
    return this.generateSummary(hourStart, hourEnd, SummaryType.HOURLY, source);
  }

  /**
   * 生成每日总结的便捷方法
   * @param source 调用来源
   */
  async generateDailySummary(source: CallSource = CallSource.API): Promise<SummaryResult> {
    const currentTime = moment();
    
    // 只在每天10:00-11:00之间执行
    if (currentTime.hour() !== 10) {
      return {
        success: true,
        message: `当前时间 ${currentTime.format('HH:mm')} 不是每日总结时间 (10:00)`,
        period: currentTime.format('HH:mm'),
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
        data: { skipped: true, reason: '不是每日总结时间', type: SummaryType.DAILY }
      };
    }

    // 计算总结时间范围：前一天22:00 - 今天10:00
    const summaryEnd = moment().hour(10).minute(0).second(0).millisecond(0);
    const summaryStart = moment(summaryEnd).subtract(1, 'day').hour(22);
    
    return this.generateSummary(summaryStart, summaryEnd, SummaryType.DAILY, source);
  }

  /**
   * 获取新闻数据
   */
  private async getNewsData(start: moment.Moment, end: moment.Moment, summaryType: SummaryType): Promise<any> {
    if (summaryType === SummaryType.DAILY) {
      return await queryService.getDailyNewsData(start.toISOString(), end.toISOString());
    } else {
      return await queryService.getHourlySummary(start.toISOString(), end.toISOString());
    }
  }

  /**
   * 使用AI生成总结
   */
  private async generateAISummary(
    newsData: any, 
    start: moment.Moment, 
    end: moment.Moment, 
    summaryType: SummaryType
  ): Promise<any> {
    const isDaily = summaryType === SummaryType.DAILY;
    
    const userPrompt = isDaily ? this.createDailyPrompt(newsData, start, end) : this.createHourlyPrompt(newsData, start, end);
    
    const systemPrompt = isDaily ? 
      '你是一个资深的新闻分析师，擅长生成综合性的每日新闻总结报告。' :
      '你是一个专业的新闻分析师，擅长生成简洁清晰的新闻总结报告。';

    const messages = createMessages(systemPrompt, userPrompt);

    const schema = isDaily ? this.getDailySchema() : this.getHourlySchema();

    return await callLLMWithJsonResponse(messages, {
      temperature: 0.3,
      schema
    });
  }

  /**
   * 创建小时总结提示词
   */
  private createHourlyPrompt(newsData: any, start: moment.Moment, end: moment.Moment): string {
    return `
请为以下时段新闻数据生成总结报告：

时间段：${start.format('YYYY-MM-DD HH:mm')} - ${end.format('HH:mm')}
新闻总数：${newsData.news_count}
事件总数：${newsData.event_count || 0}

涉及公司：${newsData.companies?.slice(0, 10).join(', ') || '无'}
涉及人物：${newsData.persons?.slice(0, 10).join(', ') || '无'}
涉及机构：${newsData.organizations?.slice(0, 10).join(', ') || '无'}
涉及地点：${newsData.locations?.slice(0, 5).join(', ') || '无'}

主要新闻：
${newsData.news_items?.map((item: any, index: number) => 
  `${index + 1}. [${item.level || 'N/A'}] ${item.title}`
).join('\n') || '无'}

请生成一个简洁的总结，包括：
1. 整体概况
2. 重要事件亮点
3. 市场影响评估
4. 关键关注点

总结应该专业、简洁，适合快速阅读。`;
  }

  /**
   * 创建每日总结提示词
   */
  private createDailyPrompt(newsData: any, start: moment.Moment, end: moment.Moment): string {
    return `
请为以下夜间新闻数据生成每日总结报告：

时间段：${start.format('YYYY-MM-DD HH:mm')} - ${end.format('YYYY-MM-DD HH:mm')} (夜间到早晨)
新闻总数：${newsData.news_count}
事件总数：${newsData.event_count || 0}
高级别新闻：${newsData.high_level_count || 0}
紧急新闻：${newsData.critical_count || 0}

涉及主要公司：${newsData.companies?.slice(0, 15).join(', ') || '无'}
涉及重要人物：${newsData.persons?.slice(0, 10).join(', ') || '无'}
涉及关键机构：${newsData.organizations?.slice(0, 10).join(', ') || '无'}

重要新闻列表：
${newsData.news_items
  ?.filter((item: any) => item.level === 'Level 1' || item.level === 'Level 2')
  .slice(0, 10)
  .map((item: any, index: number) => 
    `${index + 1}. [${item.level}] ${item.title}`
  ).join('\n') || '无'}

请生成一个综合的每日总结，包括：
1. 夜间总体情况概述
2. 关键事件和趋势分析
3. 市场影响和风险评估
4. 今日重点关注建议

总结应该专业、全面，适合作为晨间简报。`;
  }

  /**
   * 获取小时总结Schema
   */
  private getHourlySchema() {
    return z.object({
      overall_summary: z.string().describe('整体概况，2-3句话概括该时段的新闻情况'),
      key_highlights: z.array(z.string()).describe('重要事件亮点，最多5个要点'),
      market_impact: z.string().describe('市场影响评估，1-2句话'),
      focus_areas: z.array(z.string()).describe('关键关注点，最多3个'),
      severity_assessment: z.enum(['low', 'medium', 'high', 'critical']).describe('严重程度评估'),
      confidence: z.number().min(0).max(1).describe('总结置信度')
    });
  }

  /**
   * 获取每日总结Schema
   */
  private getDailySchema() {
    return z.object({
      overnight_overview: z.string().describe('夜间总体情况概述'),
      key_trends: z.array(z.string()).describe('关键事件和趋势分析'),
      market_risk_assessment: z.string().describe('市场影响和风险评估'),
      today_focus: z.array(z.string()).describe('今日重点关注建议'),
      overall_severity: z.enum(['low', 'medium', 'high', 'critical']).describe('整体严重程度评估'),
      confidence: z.number().min(0).max(1).describe('总结置信度')
    });
  }

  /**
   * 保存总结到数据库
   */
  private async saveSummary(
    summaryData: any, 
    start: moment.Moment, 
    end: moment.Moment, 
    newsData: any, 
    summaryType: SummaryType
  ): Promise<void> {
    if (summaryType === SummaryType.DAILY) {
      await queryService.saveDailySummary(summaryData, start.toISOString(), end.toISOString(), newsData);
    } else {
      await queryService.saveHourlySummary(summaryData, start.toISOString(), end.toISOString(), newsData);
    }
  }

  /**
   * 发送通知（如果需要）
   */
  private async sendNotificationIfNeeded(
    summaryData: any,
    start: moment.Moment,
    end: moment.Moment,
    newsData: any,
    summaryType: SummaryType,
    source: CallSource
  ): Promise<void> {
    if (summaryType === SummaryType.DAILY) {
      // 每日总结总是发送通知
      await notificationService.sendDailySummaryNotification(
        summaryData, 
        start.toISOString(), 
        end.toISOString(), 
        newsData, 
        source
      );
    } else {
      // 小时总结只在有高级别新闻时发送通知
      const highLevelNews = newsData.news_items?.filter((item: any) => 
        item.level === 'Level 1' || item.level === 'Level 2'
      ) || [];

      if (highLevelNews.length > 0) {
        await notificationService.sendHourlySummaryNotification(
          summaryData, 
          start.toISOString(), 
          end.toISOString(), 
          highLevelNews, 
          source
        );
      }
    }
  }

  /**
   * 获取高级别新闻数量
   */
  private getHighLevelCount(newsData: any): number {
    return newsData.news_items?.filter((item: any) => 
      item.level === 'Level 1' || item.level === 'Level 2'
    ).length || 0;
  }

  /**
   * 获取总结类型名称
   */
  private getSummaryTypeName(summaryType: SummaryType): string {
    switch (summaryType) {
      case SummaryType.HOURLY:
        return '小时';
      case SummaryType.DAILY:
        return '每日';
      case SummaryType.CUSTOM:
        return '自定义';
      default:
        return '';
    }
  }

  /**
   * 格式化时间段
   */
  private formatPeriod(start: moment.Moment, end: moment.Moment): string {
    if (start.isSame(end, 'day')) {
      return `${start.format('MM-DD HH:mm')}-${end.format('HH:mm')}`;
    } else {
      return `${start.format('MM-DD HH:mm')}-${end.format('MM-DD HH:mm')}`;
    }
  }
}

export const summaryService = new SummaryService();
export { SummaryService }; 
import { deepseek } from '@ai-sdk/deepseek';
import { generateText } from 'ai';
import { logger } from '../utils/logger.js';
import { NewsItem, SummaryType, SummaryResult } from '../types/index.js';
import moment from 'moment-timezone';

export class SummaryService {
  private apiKey: string;
  
  constructor() {
    this.apiKey = process.env.DEEPSEEK_API_KEY || '';
  }

  async initialize() {
    logger.info('📊 初始化总结服务...');
    
    if (!this.apiKey) {
      logger.warn('⚠️ DEEPSEEK_API_KEY 未设置，总结生成功能将受限');
    }
    
    logger.info('✅ 总结服务初始化完成');
  }

  async generateHourlySummary(hour?: number): Promise<SummaryResult> {
    try {
      const targetHour = hour || moment().tz('Asia/Shanghai').hour();
      const date = moment().tz('Asia/Shanghai').format('YYYY-MM-DD');
      
      logger.info(`📊 生成小时总结: ${date} ${targetHour}:00`);
      
      // 这里应该从数据库获取新闻数据
      // 为了演示，我们使用模拟数据
      const newsItems: NewsItem[] = []; // 实际应用中从数据库获取
      
      if (newsItems.length === 0) {
        logger.warn(`⚠️ ${date} ${targetHour}:00 时段没有新闻数据`);
        return {
          type: SummaryType.HOURLY,
          period: `${date} ${targetHour}:00`,
          summary: '本时段暂无重要新闻',
          highlights: [],
          newsCount: 0,
          generatedAt: new Date()
        };
      }
      
      const summary = await this.generateSummary(newsItems, SummaryType.HOURLY, `${date} ${targetHour}:00`);
      
      logger.info(`✅ 小时总结生成完成: ${date} ${targetHour}:00`);
      return summary;
      
    } catch (error) {
      logger.error('❌ 生成小时总结失败:', error);
      throw error;
    }
  }

  async generateDailySummary(date?: string): Promise<SummaryResult> {
    try {
      const targetDate = date || moment().tz('Asia/Shanghai').subtract(1, 'day').format('YYYY-MM-DD');
      
      logger.info(`📈 生成每日总结: ${targetDate}`);
      
      // 这里应该从数据库获取新闻数据
      // 为了演示，我们使用模拟数据
      const newsItems: NewsItem[] = []; // 实际应用中从数据库获取
      
      if (newsItems.length === 0) {
        logger.warn(`⚠️ ${targetDate} 没有新闻数据`);
        return {
          type: SummaryType.DAILY,
          period: targetDate,
          summary: '本日暂无重要新闻',
          highlights: [],
          newsCount: 0,
          generatedAt: new Date()
        };
      }
      
      const summary = await this.generateSummary(newsItems, SummaryType.DAILY, targetDate);
      
      logger.info(`✅ 每日总结生成完成: ${targetDate}`);
      return summary;
      
    } catch (error) {
      logger.error('❌ 生成每日总结失败:', error);
      throw error;
    }
  }

  async generateCustomSummary(newsItems: NewsItem[], title: string): Promise<SummaryResult> {
    try {
      logger.info(`📝 生成自定义总结: ${title} (${newsItems.length} 条新闻)`);
      
      const summary = await this.generateSummary(newsItems, SummaryType.CUSTOM, title);
      
      logger.info(`✅ 自定义总结生成完成: ${title}`);
      return summary;
      
    } catch (error) {
      logger.error('❌ 生成自定义总结失败:', error);
      throw error;
    }
  }

  private async generateSummary(newsItems: NewsItem[], type: SummaryType, period: string): Promise<SummaryResult> {
    try {
      const prompt = this.buildSummaryPrompt(newsItems, type, period);
      
      const { text } = await generateText({
        model: deepseek('deepseek-chat'),
        prompt,
        maxTokens: 1500,
        temperature: 0.4
      });
      
      const result = this.parseSummaryResult(text, type, period, newsItems.length);
      
      return result;
      
    } catch (error) {
      logger.error('❌ AI总结生成失败:', error);
      throw error;
    }
  }

  private buildSummaryPrompt(newsItems: NewsItem[], type: SummaryType, period: string): string {
    const newsText = newsItems.map(item => 
      `标题: ${item.title}\n描述: ${item.description || ''}\n来源: ${item.source}\n级别: ${item.level}`
    ).join('\n\n');
    
    const typeText = {
      [SummaryType.HOURLY]: '小时',
      [SummaryType.DAILY]: '每日',
      [SummaryType.CUSTOM]: '专题'
    }[type];
    
    return `
请为以下新闻生成${typeText}总结报告，并以JSON格式返回。

时间段: ${period}
新闻数量: ${newsItems.length}

新闻内容:
${newsText}

请生成包含以下内容的总结：
1. 整体概述（200-300字）
2. 重点事件（3-5个最重要的事件）
3. 趋势分析（如果适用）

返回格式：
{
  "summary": "整体概述文字",
  "highlights": [
    "重点事件1",
    "重点事件2", 
    "重点事件3"
  ],
  "trends": "趋势分析文字（可选）"
}

请只返回JSON格式，不要包含其他文字。
`;
  }

  private parseSummaryResult(text: string, type: SummaryType, period: string, newsCount: number): SummaryResult {
    try {
      const cleaned = text.trim();
      let jsonStr = cleaned;
      
      // 提取JSON部分
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }
      
      const result = JSON.parse(jsonStr);
      
      return {
        type,
        period,
        summary: result.summary || '总结生成失败',
        highlights: Array.isArray(result.highlights) ? result.highlights : [],
        trends: result.trends,
        newsCount,
        generatedAt: new Date()
      };
      
    } catch (error) {
      logger.warn(`⚠️ 无法解析总结结果: "${text.substring(0, 100)}..."`, error);
      
      return {
        type,
        period,
        summary: '总结解析失败，请查看原始数据',
        highlights: [],
        newsCount,
        generatedAt: new Date()
      };
    }
  }
} 
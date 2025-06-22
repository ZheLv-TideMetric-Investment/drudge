import logger from '../../shared/utils/logger.js';
import knowledgeGraphService from './knowledgeGraphService.js';
import aiService from '../../infrastructure/external/AiService.js';
import webhookService from '../../infrastructure/external/WebhookService.js';
import { callLLM } from '../../shared/utils/llm.js';
import { HourlySummary } from '../../domain/entities/index.js';
import moment from 'moment-timezone';

/**
 * 按小时总结服务
 * 每小时对新闻进行聚合总结和分析
 */
class HourlySummaryService {
  constructor() {
    this.initialized = false;
  }

  /**
   * 初始化服务
   */
  async initialize() {
    try {
      this.initialized = true;
      logger.info('按小时总结服务初始化完成');
    } catch (error) {
      logger.error('按小时总结服务初始化失败:', error);
      throw error;
    }
  }

  /**
   * 执行按小时总结
   * @param {Date} hourStart - 开始时间
   * @param {Date} hourEnd - 结束时间（可选，默认为开始时间+1小时）
   */
  async runHourlySummary(hourStart, hourEnd = null) {
    try {
      // 如果没有指定结束时间，默认为开始时间后1小时
      if (!hourEnd) {
        hourEnd = moment(hourStart).add(1, 'hour').toDate();
      }

      const hourStartISO = hourStart.toISOString();
      const hourEndISO = hourEnd.toISOString();

      logger.info(`开始执行按小时总结: ${hourStartISO} - ${hourEndISO}`);

      // 从图数据库获取该小时的统计数据
      const summary = await knowledgeGraphService.getHourlySummary(hourStartISO, hourEndISO);

      if (summary.total_news_count === 0) {
        logger.info(`${hourStartISO} - ${hourEndISO} 时段内无新闻，跳过总结`);
        return { success: true, message: '该时段无新闻' };
      }

      // 使用AI生成总结文本
      summary.summary_text = await this.generateSummaryText(summary);

      // 发送总结通知
      await this.sendHourlySummaryNotification(summary);

      logger.info(`按小时总结完成: ${summary.total_news_count}条新闻, ${summary.critical_news_count}条紧急新闻`);
      
      return { 
        success: true, 
        summary,
        message: `总结完成，处理${summary.total_news_count}条新闻`
      };
    } catch (error) {
      logger.error('执行按小时总结失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 使用AI生成总结文本
   * @param {HourlySummary} summary - 小时总结数据
   * @returns {string} - 生成的总结文本
   */
  async generateSummaryText(summary) {
    try {
      const messages = [
        {
          role: 'system',
          content: `
你是一个专业的新闻总结分析师。请根据提供的小时新闻数据，生成一份简洁而全面的总结报告。

## 总结要求：
1. 总结该小时内的主要新闻事件
2. 重点关注紧急新闻（Level 1）和高优先级新闻（Level 2）
3. 分析涉及的重要公司和事件类型
4. 提供市场影响分析和风险提醒
5. 语言简洁明了，适合快速阅读

## 输出格式：
- 使用markdown格式
- 重要信息用加粗标记
- 适当使用emoji增强可读性
- 控制在300字以内
          `,
        },
        {
          role: 'user',
          content: `
请为以下小时新闻数据生成总结：

时间段：${summary.hour_start} - ${summary.hour_end}
总新闻数：${summary.total_news_count}
紧急新闻数：${summary.critical_news_count}

重要事件：
${summary.top_events.map((event, index) => 
  `${index + 1}. ${event.event} (重要性: ${event.significance})`
).join('\n')}

活跃公司：
${summary.top_companies.map((company, index) => 
  `${index + 1}. ${company.company} (${company.count}次提及)`
).join('\n')}
          `,
        },
      ];

      const response = await callLLM(messages);
      return response.trim();
    } catch (error) {
      logger.error('AI生成总结文本失败:', error);
      
      // 回退到模板总结
      return this.generateFallbackSummary(summary);
    }
  }

  /**
   * 生成回退总结（当AI失败时使用）
   * @param {HourlySummary} summary - 小时总结数据
   * @returns {string} - 模板总结文本
   */
  generateFallbackSummary(summary) {
    const timeRange = `${moment(summary.hour_start).format('HH:mm')} - ${moment(summary.hour_end).format('HH:mm')}`;
    
    let text = `📊 **${timeRange} 新闻总结**\n\n`;
    
    text += `📰 本小时共处理 **${summary.total_news_count}** 条新闻`;
    
    if (summary.critical_news_count > 0) {
      text += `，其中 **${summary.critical_news_count}** 条紧急新闻`;
    }
    text += '\n\n';

    if (summary.top_events.length > 0) {
      text += '🔥 **重要事件**：\n';
      summary.top_events.slice(0, 3).forEach((event, index) => {
        text += `${index + 1}. ${event.event}\n`;
      });
      text += '\n';
    }

    if (summary.top_companies.length > 0) {
      text += '🏢 **活跃公司**：';
      const topCompanies = summary.top_companies.slice(0, 5).map(c => c.company);
      text += topCompanies.join('、') + '\n\n';
    }

    if (summary.critical_news_count > 0) {
      text += '⚠️ **风险提醒**：本小时出现紧急新闻，建议关注市场动态\n';
    } else {
      text += '📈 **市场状态**：新闻活动正常，未发现重大异常事件\n';
    }

    return text;
  }

  /**
   * 发送按小时总结通知
   * @param {HourlySummary} summary - 小时总结
   */
  async sendHourlySummaryNotification(summary) {
    try {
      const notification = this.buildHourlySummaryMessage(summary);
      
      await webhookService.sendMessage(
        moment(summary.hour_start).format('YYYY-MM-DD HH:mm:ss'),
        moment(summary.hour_end).format('YYYY-MM-DD HH:mm:ss'),
        notification,
        'HOURLY_SUMMARY'
      );
      
      logger.info('按小时总结通知发送成功');
    } catch (error) {
      logger.error('发送按小时总结通知失败:', error);
      throw error;
    }
  }

  /**
   * 构建按小时总结消息
   * @param {HourlySummary} summary - 小时总结
   * @returns {string} - 格式化的消息
   */
  buildHourlySummaryMessage(summary) {
    const timeRange = `${moment(summary.hour_start).format('YYYY-MM-DD HH:mm')} - ${moment(summary.hour_end).format('HH:mm')}`;
    
    let message = `📊 **按小时新闻总结** 📊\n`;
    message += `⏰ 时间段：${timeRange}\n\n`;
    
    // 基本统计
    message += `📈 **基本统计**\n`;
    message += `📰 总新闻数：${summary.total_news_count}\n`;
    message += `🚨 紧急新闻：${summary.critical_news_count}\n\n`;
    
    // AI生成的总结文本
    if (summary.summary_text) {
      message += `🤖 **智能总结**\n`;
      message += `${summary.summary_text}\n\n`;
    }
    
    // 重要事件列表
    if (summary.top_events.length > 0) {
      message += `🔥 **重要事件** (按重要性排序)\n`;
      summary.top_events.slice(0, 5).forEach((event, index) => {
        const significance = this.getSignificanceEmoji(event.significance);
        message += `${index + 1}. ${significance} ${event.event}\n`;
      });
      message += '\n';
    }
    
    // 活跃公司
    if (summary.top_companies.length > 0) {
      message += `🏢 **活跃公司** (按提及次数排序)\n`;
      summary.top_companies.slice(0, 8).forEach((company, index) => {
        message += `${index + 1}. ${company.company} (${company.count}次)\n`;
      });
      message += '\n';
    }
    
    // 市场分析
    message += this.generateMarketAnalysis(summary);
    
    return message;
  }

  /**
   * 获取重要性对应的emoji
   */
  getSignificanceEmoji(significance) {
    switch (significance) {
      case 4: return '🔴';
      case 3: return '🟠';
      case 2: return '🟡';
      case 1: return '🟢';
      default: return '⚪';
    }
  }

  /**
   * 生成市场分析
   * @param {HourlySummary} summary - 小时总结
   * @returns {string} - 市场分析文本
   */
  generateMarketAnalysis(summary) {
    let analysis = `📊 **市场分析**\n`;
    
    if (summary.critical_news_count > 0) {
      analysis += `⚠️ 本小时出现${summary.critical_news_count}条紧急新闻，市场可能出现波动\n`;
    }
    
    if (summary.total_news_count > 50) {
      analysis += `📈 新闻活动频繁（${summary.total_news_count}条），市场关注度较高\n`;
    } else if (summary.total_news_count < 10) {
      analysis += `📉 新闻活动较少（${summary.total_news_count}条），市场相对平静\n`;
    } else {
      analysis += `➡️ 新闻活动正常（${summary.total_news_count}条），市场运行平稳\n`;
    }
    
    // 根据重要事件数量分析
    const highImportanceEvents = summary.top_events.filter(e => e.significance >= 3);
    if (highImportanceEvents.length > 0) {
      analysis += `🎯 发现${highImportanceEvents.length}个高重要性事件，建议重点关注\n`;
    }
    
    return analysis;
  }

  /**
   * 获取历史按小时总结
   * @param {Date} startDate - 开始日期
   * @param {Date} endDate - 结束日期
   * @param {number} limit - 限制数量
   */
  async getHistoricalSummaries(startDate, endDate, limit = 24) {
    try {
      const summaries = [];
      const current = moment(startDate);
      const end = moment(endDate);
      
      while (current.isBefore(end) && summaries.length < limit) {
        const hourStart = current.toDate();
        const hourEnd = current.clone().add(1, 'hour').toDate();
        
        try {
          const summary = await knowledgeGraphService.getHourlySummary(
            hourStart.toISOString(),
            hourEnd.toISOString()
          );
          
          if (summary.total_news_count > 0) {
            summaries.push(summary);
          }
        } catch (error) {
          logger.warn(`获取 ${hourStart.toISOString()} 小时总结失败:`, error);
        }
        
        current.add(1, 'hour');
      }
      
      return summaries;
    } catch (error) {
      logger.error('获取历史按小时总结失败:', error);
      throw error;
    }
  }

  /**
   * 获取今日总结统计
   */
  async getTodaySummaryStats() {
    try {
      const today = moment().startOf('day');
      const tomorrow = moment().startOf('day').add(1, 'day');
      
      const todaySummaries = await this.getHistoricalSummaries(
        today.toDate(),
        tomorrow.toDate(),
        24
      );
      
      const totalNews = todaySummaries.reduce((sum, s) => sum + s.total_news_count, 0);
      const totalCriticalNews = todaySummaries.reduce((sum, s) => sum + s.critical_news_count, 0);
      
      // 获取最活跃的小时
      const mostActiveHour = todaySummaries.reduce((max, current) => 
        current.total_news_count > max.total_news_count ? current : max,
        { total_news_count: 0 }
      );
      
      // 获取所有涉及的公司
      const allCompanies = new Set();
      todaySummaries.forEach(summary => {
        summary.top_companies.forEach(company => {
          allCompanies.add(company.company);
        });
      });
      
      return {
        date: today.format('YYYY-MM-DD'),
        total_hours_with_news: todaySummaries.length,
        total_news_count: totalNews,
        total_critical_news_count: totalCriticalNews,
        most_active_hour: mostActiveHour.hour_start ? {
          time: moment(mostActiveHour.hour_start).format('HH:mm'),
          news_count: mostActiveHour.total_news_count
        } : null,
        total_companies_mentioned: allCompanies.size,
        hourly_summaries: todaySummaries.length,
      };
    } catch (error) {
      logger.error('获取今日总结统计失败:', error);
      throw error;
    }
  }

  /**
   * 执行上一小时总结
   */
  async runLastHourSummary() {
    const lastHour = moment().subtract(1, 'hour').startOf('hour');
    const thisHour = moment().startOf('hour');
    
    return await this.runHourlySummary(lastHour.toDate(), thisHour.toDate());
  }
}

export default new HourlySummaryService(); 
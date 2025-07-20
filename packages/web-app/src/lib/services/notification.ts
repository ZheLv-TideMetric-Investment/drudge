import { webhookService } from './webhook';
import moment from 'moment-timezone';
import { UrgencyLevel, EventLevel } from '../../../constants/enums';

/**
 * 通知服务
 * 统一管理所有通知推送功能，根据调用来源决定是否发送通知
 */
class NotificationService {
  private webhook: any;
  private initialized: boolean = false;

  constructor() {
    this.webhook = webhookService;
  }

  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    try {
      this.initialized = true;
      console.log('通知服务初始化完成');
    } catch (error) {
      console.error('通知服务初始化失败:', error);
      throw error;
    }
  }

  /**
   * 发送批量高级别新闻通知
   * @param newsItems 新闻数据数组
   * @param source 调用来源
   */
  async sendBatchHighLevelNewsNotification(newsItems: any[]): Promise<boolean> {
    if (newsItems.length === 0) {
      return false;
    }

    try {
      const currentTime = moment().tz('Asia/Shanghai').format('HH:mm:ss');

      let message = `🚨 **${EventLevel.LEVEL_1} 新闻批量提醒** (${newsItems.length}条) - ${currentTime}

`;

      // 聚合所有相关实体
      const allCompanies = new Set<string>();
      const allPersons = new Set<string>();
      const allEvents = new Set<string>();

      newsItems.forEach((news, index) => {
        const timestamp = moment(news.timestamp).tz('Asia/Shanghai').format('HH:mm');
        message += `📰 **${index + 1}. ${news.title}** *(${timestamp})*\n`;

        // 收集实体信息
        news.companies?.forEach((company: string) => allCompanies.add(company));
        news.persons?.forEach((person: string) => allPersons.add(person));
        news.events?.forEach((event: string) => allEvents.add(event));
      });

      // 添加聚合的实体信息
      if (allCompanies.size > 0) {
        const companies = Array.from(allCompanies).slice(0, 5);
        message += `\n🏢 **涉及公司**: ${companies.join(', ')}${allCompanies.size > 5 ? ` 等${allCompanies.size}家` : ''}`;
      }

      if (allPersons.size > 0) {
        const persons = Array.from(allPersons).slice(0, 5);
        message += `\n👤 **涉及人物**: ${persons.join(', ')}${allPersons.size > 5 ? ` 等${allPersons.size}人` : ''}`;
      }

      if (allEvents.size > 0) {
        const events = Array.from(allEvents).slice(0, 3);
        message += `\n📋 **相关事件**: ${events.join(', ')}${allEvents.size > 3 ? ` 等${allEvents.size}个` : ''}`;
      }

      // 添加时间范围信息
      const timestamps = newsItems.map(news => moment(news.timestamp));
      const earliestTime = moment.min(timestamps).tz('Asia/Shanghai').format('HH:mm');
      const latestTime = moment.max(timestamps).tz('Asia/Shanghai').format('HH:mm');

      if (earliestTime !== latestTime) {
        message += `\n⏰ **时间范围**: ${earliestTime} - ${latestTime}`;
      }

      await this.webhook.sendMessage(message);
      console.log(`批量高级别新闻通知已发送: ${newsItems.length} 条新闻`);
      return true;
    } catch (error: any) {
      console.error(`发送批量高级别新闻通知失败:`, error);
      return false;
    }
  }

  /**
   * 发送高级别新闻通知 (保留兼容性，但建议使用批量方法)
   * @param news 新闻数据
   * @param source 调用来源
   */
  async sendHighLevelNewsNotification(news: any): Promise<boolean> {
    try {
      const urgencyEmoji: { [key: string]: string } = {
        [UrgencyLevel.CRITICAL]: '🚨',
        [UrgencyLevel.HIGH]: '🔴',
        [UrgencyLevel.MEDIUM]: '🟡',
      };

      const emoji = urgencyEmoji[news.urgency] || '⚠️';
      const timestamp = moment(news.timestamp).tz('Asia/Shanghai').format('HH:mm:ss');

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

      await this.webhook.sendMessage(message);
      console.log(`高级别新闻通知已发送: ${news.newsId} - ${news.title}`);
      return true;
    } catch (error: any) {
      console.error(`发送高级别新闻通知失败: ${news.newsId}`, error);
      return false;
    }
  }

  /**
   * 发送小时总结通知
   * @param summary 总结数据（现在是markdown字符串）
   * @param hourStart 开始时间
   * @param hourEnd 结束时间
   * @param highLevelNews Level 1 新闻
   */
  async sendNormalSummaryNotification(
    summary: any,
    hourStart: string,
    hourEnd: string,
    highLevelNews: any[]
  ): Promise<boolean> {
    try {
      // 提取markdown总结内容
      const summaryContent = typeof summary === 'string' ? summary : summary.summary;

      const level1Message =
        highLevelNews.length > 0
          ? `🚨 **Level 1 新闻** (${highLevelNews.length}条)  
${highLevelNews
  .slice(0, 3)
  .map((item: any, index: number) => `${index + 1}. [${item.level}] ${item.title}`)
  .join('\n')}`.trim()
          : '';

      const message = `${level1Message}

📊 **总结** (${moment(hourStart).tz('Asia/Shanghai').format('MM-DD HH:mm')}-${moment(hourEnd).tz('Asia/Shanghai').format('MM-DD HH:mm')})  
${summaryContent}
`.trim();

      await this.webhook.sendMessage(message);
      console.log(
        `小时总结通知已发送: ${moment(hourStart).tz('Asia/Shanghai').format('HH:00')}-${moment(hourEnd).tz('Asia/Shanghai').format('HH:00')}`
      );
      return true;
    } catch (error: any) {
      console.error('发送小时总结通知失败:', error);
      return false;
    }
  }

  /**
   * 发送系统警报
   * @param title 标题
   * @param message 消息
   * @param source 调用来源
   */
  async sendSystemAlert(title: string, message: string): Promise<boolean> {
    try {
      const alertMessage = `🚨 **系统警报** - ${title}

📅 **时间**: ${moment().tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm:ss')}
📋 **详情**: ${message}
  `;

      await this.webhook.sendMessage(alertMessage);
      console.log(`系统警报已发送: ${title}`);
      return true;
    } catch (error: any) {
      console.error('发送系统警报失败:', error);
      return false;
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<any> {
    try {
      // 测试webhook连接
      await this.webhook.testConnection();

      return {
        status: 'healthy',
        service: 'NotificationService',
        timestamp: new Date().toISOString(),
        webhook_connection: 'connected',
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        service: 'NotificationService',
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    }
  }
}

export const notificationService = new NotificationService();

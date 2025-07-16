import { webhookService } from './webhook';
import { CallSource } from '../../types/scheduler';
import moment from 'moment-timezone';

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
   * 发送高级别新闻通知
   * @param news 新闻数据
   * @param source 调用来源
   */
  async sendHighLevelNewsNotification(news: any, source: CallSource = CallSource.API): Promise<boolean> {
    // 只有定时任务调用时才发送通知
    if (source !== CallSource.SCHEDULER) {
      console.log(`高级别新闻通知跳过发送 (来源: ${source})`);
      return false;
    }

    try {
      const urgencyEmoji: { [key: string]: string } = {
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
   * @param highLevelNews 高级别新闻
   * @param source 调用来源
   */
  async sendHourlySummaryNotification(
    summary: any, 
    hourStart: string, 
    hourEnd: string, 
    highLevelNews: any[], 
    source: CallSource = CallSource.API
  ): Promise<boolean> {
    // 只有定时任务调用时才发送通知
    if (source !== CallSource.SCHEDULER) {
      console.log(`小时总结通知跳过发送 (来源: ${source})`);
      return false;
    }

    try {
      // 提取markdown总结内容
      const summaryContent = typeof summary === 'string' ? summary : summary.summary;
      
      const message = `📊 **小时新闻总结** (${moment(hourStart).format('HH:00')}-${moment(hourEnd).format('HH:00')})

${summaryContent}

🚨 **高级别新闻** (${highLevelNews.length}条)
${highLevelNews.slice(0, 3).map((item: any, index: number) => 
  `${index + 1}. [${item.level}] ${item.title}`
).join('\n')}`;

      await this.webhook.sendMessage(message);
      console.log(`小时总结通知已发送: ${moment(hourStart).format('HH:00')}-${moment(hourEnd).format('HH:00')}`);
      return true;
    } catch (error: any) {
      console.error('发送小时总结通知失败:', error);
      return false;
    }
  }

  /**
   * 发送每日总结通知
   * @param summary 总结数据（现在是markdown字符串）
   * @param start 开始时间
   * @param end 结束时间
   * @param dailyData 每日数据
   * @param source 调用来源
   */
  async sendDailySummaryNotification(
    summary: any, 
    start: string, 
    end: string, 
    dailyData: any, 
    source: CallSource = CallSource.API
  ): Promise<boolean> {
    // 只有定时任务调用时才发送通知
    if (source !== CallSource.SCHEDULER) {
      console.log(`每日总结通知跳过发送 (来源: ${source})`);
      return false;
    }

    try {
      const date = moment(end).format('YYYY年MM月DD日');

      // 提取markdown总结内容
      const summaryContent = typeof summary === 'string' ? summary : summary.summary;

      const message = `🌅 **每日新闻总结** ${date} 晨报

📅 **时间段**: ${moment(start).format('MM-DD HH:00')} - ${moment(end).format('MM-DD HH:00')}
📊 **数据概览**: ${dailyData.news_count}条新闻 | ${dailyData.high_level_count || 0}条高级别

${summaryContent}`;

      await this.webhook.sendMessage(message);
      console.log(`每日总结通知已发送: ${date}`);
      return true;
    } catch (error: any) {
      console.error('发送每日总结通知失败:', error);
      return false;
    }
  }

  /**
   * 发送系统警报
   * @param title 标题
   * @param message 消息
   * @param source 调用来源
   */
  async sendSystemAlert(title: string, message: string, source: CallSource = CallSource.API): Promise<boolean> {
    try {
      const alertMessage = `🚨 **系统警报** - ${title}

📅 **时间**: ${moment().format('YYYY-MM-DD HH:mm:ss')}
📋 **详情**: ${message}
🔧 **来源**: ${source}`;

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
        webhook_connection: 'connected'
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        service: 'NotificationService',
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }
}

export const notificationService = new NotificationService(); 
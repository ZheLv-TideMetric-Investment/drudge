// @ts-nocheck
import logger from '../../../shared/utils/logger';
import webhookService from '../../../infrastructure/external/WebhookService';
import { NewsLevel, NewsLevelDescription } from '../../../shared/types/enums';
import { NewsExtractionResult } from '../../../domain/entities/index';
import moment from 'moment-timezone';

/**
 * 通知服务
 * 统一管理所有通知推送功能
 */
class NotificationService {
  private webhook: any;
  private initialized: boolean = false;
  private processedCache: Map<string, any> = new Map();
  private cacheExpiry: number = 24 * 60 * 60 * 1000; // 24小时

  // 级别推送配置
  private pushConfig = {
    [NewsLevel.LEVEL_1]: {
      enabled: true,
      immediate: true,
      title: '🚨 紧急新闻',
      emoji: '🚨',
    },
    [NewsLevel.LEVEL_2]: {
      enabled: true,
      immediate: false,
      title: '⚠️ 高优先级新闻',
      emoji: '⚠️',
    },
    [NewsLevel.LEVEL_3]: {
      enabled: false,
      immediate: false,
      title: '📊 中等优先级新闻',
      emoji: '📊',
    },
    [NewsLevel.LEVEL_4]: {
      enabled: false,
      immediate: false,
      title: '📋 低优先级新闻',
      emoji: '📋',
    },
    [NewsLevel.LEVEL_5]: {
      enabled: false,
      immediate: false,
      title: '📝 信息性新闻',
      emoji: '📝',
    },
  };

  constructor() {
    this.webhook = webhookService;
  }

  /**
   * 初始化服务
   */
  async initialize(): Promise<void> {
    try {
      this.initialized = true;
      logger.info('通知服务初始化完成');

      // 定期清理缓存
      setInterval(() => {
        this.cleanupCache();
      }, 60 * 60 * 1000); // 每小时清理一次
    } catch (error) {
      logger.error('通知服务初始化失败:', error);
      throw error;
    }
  }

  /**
   * 发送新闻级别通知
   */
  async sendNewsLevelNotification(newsItem: any, extractionResult: NewsExtractionResult): Promise<boolean> {
    try {
      const newsLevel = extractionResult.news_level || NewsLevel.LEVEL_5;
      const cacheKey = `${newsItem.id}_${newsLevel}`;

      // 检查是否已推送过
      if (this.processedCache.has(cacheKey)) {
        logger.debug(`新闻 ${newsItem.id} 已推送过，跳过`);
        return false;
      }

      // 检查是否需要推送
      if (!this.shouldPushNews(newsLevel)) {
        logger.debug(`新闻级别 ${newsLevel} 不需要推送`);
        return false;
      }

      const levelInfo = NewsLevelDescription[newsLevel];
      const pushInfo = this.pushConfig[newsLevel];

      if (!levelInfo || !pushInfo) {
        logger.warn(`无法获取新闻级别 ${newsLevel} 的配置信息`);
        return false;
      }

      const message = this.buildNewsLevelMessage(newsItem, extractionResult, levelInfo, pushInfo);
      
      await this.webhook.sendMessage(message);
      
      // 记录到缓存
      this.processedCache.set(cacheKey, {
        timestamp: Date.now(),
        newsLevel,
        newsId: newsItem.id,
      });

      logger.info(`新闻级别通知发送成功: ${newsItem.id}, 级别: ${newsLevel}`);
      return true;
    } catch (error) {
      logger.error(`发送新闻级别通知失败: ${newsItem.id}`, error);
      return false;
    }
  }

  /**
   * 发送突发新闻通知
   */
  async sendBreakingNewsNotification(newsItems: any[], timeRange: string): Promise<boolean> {
    try {
      if (newsItems.length === 0) {
        logger.info('没有突发新闻需要推送');
        return false;
      }

      const message = this.buildBreakingNewsMessage(newsItems, timeRange);
      await this.webhook.sendMessage(message);
      
      logger.info(`突发新闻通知发送成功: ${newsItems.length} 条新闻`);
      return true;
    } catch (error) {
      logger.error('发送突发新闻通知失败:', error);
      return false;
    }
  }

  /**
   * 发送系统健康报告
   */
  async sendHealthReport(healthData: any): Promise<boolean> {
    try {
      const message = this.buildHealthReportMessage(healthData);
      await this.webhook.sendMessage(message);
      
      logger.info('系统健康报告发送成功');
      return true;
    } catch (error) {
      logger.error('发送系统健康报告失败:', error);
      return false;
    }
  }

  /**
   * 发送处理进度通知
   */
  async sendProcessingProgress(progress: any): Promise<boolean> {
    try {
      const message = this.buildProgressMessage(progress);
      await this.webhook.sendMessage(message);
      
      logger.info(`处理进度通知发送成功: ${progress.percentage}%`);
      return true;
    } catch (error) {
      logger.error('发送处理进度通知失败:', error);
      return false;
    }
  }

  /**
   * 发送错误警报
   */
  async sendErrorAlert(error: any, context: string): Promise<boolean> {
    try {
      const message = this.buildErrorAlertMessage(error, context);
      await this.webhook.sendMessage(message);
      
      logger.info(`错误警报发送成功: ${context}`);
      return true;
    } catch (error) {
      logger.error('发送错误警报失败:', error);
      return false;
    }
  }

  /**
   * 判断是否需要推送新闻
   */
  private shouldPushNews(newsLevel: string): boolean {
    const config = this.pushConfig[newsLevel];
    return config && config.enabled;
  }

  /**
   * 构建新闻级别消息
   */
  private buildNewsLevelMessage(newsItem: any, extractionResult: NewsExtractionResult, levelInfo: any, pushInfo: any): string {
    const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
    const companies = extractionResult.companies?.map(c => c.company_name).filter(Boolean) || [];
    const events = extractionResult.events?.filter(e => e.event_name) || [];

    let message = `${pushInfo.emoji} **${levelInfo.nameCn}** - ${levelInfo.name}\n\n`;
    message += `📰 **新闻标题**: ${newsItem.title}\n`;
    message += `🕒 **发布时间**: ${timestamp}\n`;
    message += `📊 **级别**: ${extractionResult.news_level}\n`;
    message += `📝 **描述**: ${levelInfo.description}\n\n`;

    if (companies.length > 0) {
      message += `🏢 **涉及公司**: ${companies.slice(0, 3).join(', ')}${companies.length > 3 ? '等' : ''}\n`;
    }

    if (events.length > 0) {
      message += `📋 **主要事件**:\n`;
      events.slice(0, 2).forEach((event, index) => {
        message += `${index + 1}. ${event.event_name}\n`;
      });
      if (events.length > 2) {
        message += `... 等${events.length}个事件\n`;
      }
    }

    if (newsItem.content && newsItem.content.length > 100) {
      message += `\n📖 **内容摘要**: ${newsItem.content.substring(0, 200)}...\n`;
    }

    // 添加处理建议
    if (extractionResult.news_level === NewsLevel.LEVEL_1) {
      message += `\n🚨 **处理建议**: 立即关注，可能对市场产生重大影响`;
    } else if (extractionResult.news_level === NewsLevel.LEVEL_2) {
      message += `\n⚠️ **处理建议**: 重点关注，评估对相关业务的影响`;
    }

    return message;
  }

  /**
   * 构建突发新闻消息
   */
  private buildBreakingNewsMessage(newsItems: any[], timeRange: string): string {
    const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
    
    let message = `🚨 **突发新闻汇总** (${timeRange})\n\n`;
    message += `📅 **统计时间**: ${timestamp}\n`;
    message += `📊 **新闻数量**: ${newsItems.length} 条\n\n`;

    newsItems.slice(0, 5).forEach((item, index) => {
      message += `${index + 1}. **${item.title}**\n`;
      message += `   📊 级别: ${item.news_level || 'N/A'}\n`;
      message += `   🕒 时间: ${moment(item.timestamp).format('HH:mm')}\n\n`;
    });

    if (newsItems.length > 5) {
      message += `... 还有 ${newsItems.length - 5} 条新闻\n`;
    }

    return message;
  }

  /**
   * 构建健康报告消息
   */
  private buildHealthReportMessage(healthData: any): string {
    const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
    
    let message = `💊 **系统健康检查报告**\n\n`;
    message += `📅 **检查时间**: ${timestamp}\n`;
    message += `📊 **总体状态**: ${healthData.status === 'healthy' ? '✅ 健康' : '❌ 异常'}\n\n`;

    if (healthData.services) {
      message += `**服务状态**:\n`;
      healthData.services.forEach(service => {
        const status = service.status === 'healthy' ? '✅' : '❌';
        message += `${status} ${service.name}: ${service.status}\n`;
      });
    }

    if (healthData.error) {
      message += `\n⚠️ **错误信息**: ${healthData.error}`;
    }

    return message;
  }

  /**
   * 构建进度消息
   */
  private buildProgressMessage(progress: any): string {
    const progressBar = this.createProgressBar(progress.percentage);
    
    let message = `📊 **处理进度更新**\n\n`;
    message += `${progressBar} ${progress.percentage}%\n`;
    message += `📋 **已处理**: ${progress.processed}/${progress.total}\n`;
    message += `⏱️ **预计剩余**: ${progress.estimatedTimeLeft || 'N/A'}\n`;

    if (progress.currentTask) {
      message += `🔄 **当前任务**: ${progress.currentTask}\n`;
    }

    return message;
  }

  /**
   * 构建错误警报消息
   */
  private buildErrorAlertMessage(error: any, context: string): string {
    const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
    
    let message = `🚨 **系统错误警报**\n\n`;
    message += `📅 **发生时间**: ${timestamp}\n`;
    message += `📍 **错误位置**: ${context}\n`;
    message += `❌ **错误信息**: ${error.message || error}\n`;

    if (error.stack) {
      message += `\n📋 **堆栈跟踪**: \`\`\`\n${error.stack.substring(0, 500)}\n\`\`\``;
    }

    return message;
  }

  /**
   * 创建进度条
   */
  private createProgressBar(percentage: number): string {
    const barLength = 20;
    const filledLength = Math.round((percentage / 100) * barLength);
    const emptyLength = barLength - filledLength;
    
    return `[${'█'.repeat(filledLength)}${'░'.repeat(emptyLength)}]`;
  }

  /**
   * 清理缓存
   */
  private cleanupCache(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, value] of this.processedCache) {
      if (now - value.timestamp > this.cacheExpiry) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach(key => this.processedCache.delete(key));
    
    if (expiredKeys.length > 0) {
      logger.info(`清理过期缓存: ${expiredKeys.length} 个条目`);
    }
  }

  /**
   * 更新推送配置
   */
  updatePushConfig(level: string, config: any): void {
    if (this.pushConfig[level]) {
      this.pushConfig[level] = { ...this.pushConfig[level], ...config };
      logger.info(`更新推送配置: ${level}`, config);
    }
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): any {
    return {
      size: this.processedCache.size,
      expiry_hours: this.cacheExpiry / (60 * 60 * 1000),
    };
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
        cache_size: this.processedCache.size
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        service: 'NotificationService',
        timestamp: new Date().toISOString(),
        error: error.message
      };
    }
  }
}

export default new NotificationService(); 
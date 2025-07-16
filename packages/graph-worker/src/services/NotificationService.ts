/**
 * 通知服务 - Webhook通知功能 (Graph Worker)
 */
import axios from 'axios';
import { logger } from '../utils/logger';
import config from '../config/config';

export interface NotificationPayload {
  msgtype: string;
  markdown: {
    title: string;
    text: string;
  };
  at?: {
    isAtAll: boolean;
    atUserIds?: string[];
    atMobiles?: string[];
  };
}

export class NotificationService {
  private config: any;

  constructor() {
    this.config = config.notification;
  }

  /**
   * 发送实体提取失败通知
   */
  async sendEntityExtractionFailureNotification(newsId: string, error: string, retryCount?: number): Promise<void> {
    if (!this.config.enableWebhookNotification || !this.config.webhookUrl) {
      logger.debug('Webhook通知未启用或未配置URL');
      return;
    }

    let markdownText = `### ⚠️ Graph Worker - 实体提取失败\n\n`;
    markdownText += `**服务**: Graph Worker\n\n`;
    markdownText += `**模块**: 实体提取服务\n\n`;
    markdownText += `**新闻ID**: ${newsId}\n\n`;
    markdownText += `**错误信息**: ${error}\n\n`;
    if (retryCount !== undefined) {
      markdownText += `**重试次数**: ${retryCount}\n\n`;
    }
    markdownText += `**时间**: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n\n`;
    markdownText += `**建议**: 检查AI服务配置或新闻内容格式\n\n`;

    const payload: NotificationPayload = {
      msgtype: 'markdown',
      markdown: {
        title: '[tide] Graph Worker - 实体提取失败',
        text: markdownText
      },
      at: {
        isAtAll: false
      }
    };

    await this.sendWebhook(payload);
  }

  /**
   * 发送知识图谱写入失败通知
   */
  async sendGraphWriteFailureNotification(newsId: string, entityType: string, error: string): Promise<void> {
    if (!this.config.enableWebhookNotification || !this.config.webhookUrl) {
      return;
    }

    let markdownText = `### 🔴 Graph Worker - 知识图谱写入失败\n\n`;
    markdownText += `**服务**: Graph Worker\n\n`;
    markdownText += `**模块**: 知识图谱写入\n\n`;
    markdownText += `**新闻ID**: ${newsId}\n\n`;
    markdownText += `**实体类型**: ${entityType}\n\n`;
    markdownText += `**错误信息**: ${error}\n\n`;
    markdownText += `**时间**: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n\n`;
    markdownText += `**影响**: 部分实体数据可能丢失\n\n`;

    const payload: NotificationPayload = {
      msgtype: 'markdown',
      markdown: {
        title: '[tide] Graph Worker - 知识图谱写入失败',
        text: markdownText
      },
      at: {
        isAtAll: true  // 图谱写入失败比较严重，@all
      }
    };

    await this.sendWebhook(payload);
  }

  /**
   * 发送Neo4j连接失败通知
   */
  async sendNeo4jConnectionFailureNotification(error: string): Promise<void> {
    if (!this.config.enableWebhookNotification || !this.config.webhookUrl) {
      return;
    }

    let markdownText = `### 💥 Graph Worker - Neo4j连接失败\n\n`;
    markdownText += `**服务**: Graph Worker\n\n`;
    markdownText += `**模块**: Neo4j数据库\n\n`;
    markdownText += `**错误类型**: 数据库连接失败\n\n`;
    markdownText += `**错误信息**: ${error}\n\n`;
    markdownText += `**时间**: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n\n`;
    markdownText += `**影响**: 所有知识图谱功能不可用\n\n`;
    markdownText += `**建议**: 检查Neo4j服务状态和连接配置\n\n`;

    const payload: NotificationPayload = {
      msgtype: 'markdown',
      markdown: {
        title: '[tide] Graph Worker - Neo4j连接失败',
        text: markdownText
      },
      at: {
        isAtAll: true  // 数据库连接失败非常严重，@all
      }
    };

    await this.sendWebhook(payload);
  }

  /**
   * 发送AI服务失败通知
   */
  async sendAiServiceFailureNotification(provider: string, model: string, error: string): Promise<void> {
    if (!this.config.enableWebhookNotification || !this.config.webhookUrl) {
      return;
    }

    let markdownText = `### 🤖 Graph Worker - AI服务失败\n\n`;
    markdownText += `**服务**: Graph Worker\n\n`;
    markdownText += `**模块**: AI服务\n\n`;
    markdownText += `**Provider**: ${provider}\n\n`;
    markdownText += `**Model**: ${model}\n\n`;
    markdownText += `**错误信息**: ${error}\n\n`;
    markdownText += `**时间**: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n\n`;
    markdownText += `**影响**: 实体提取功能暂不可用\n\n`;
    markdownText += `**建议**: 检查API密钥、网络连接或切换备用模型\n\n`;

    const payload: NotificationPayload = {
      msgtype: 'markdown',
      markdown: {
        title: '[tide] Graph Worker - AI服务失败',
        text: markdownText
      },
      at: {
        isAtAll: false
      }
    };

    await this.sendWebhook(payload);
  }

  /**
   * 发送新闻处理失败通知
   */
  async sendNewsProcessingFailureNotification(fileName: string, newsCount: number, processedCount: number, error: string): Promise<void> {
    if (!this.config.enableWebhookNotification || !this.config.webhookUrl) {
      return;
    }

    let markdownText = `### 📰 Graph Worker - 新闻处理失败\n\n`;
    markdownText += `**服务**: Graph Worker\n\n`;
    markdownText += `**模块**: 新闻处理器\n\n`;
    markdownText += `**文件名**: ${fileName}\n\n`;
    markdownText += `**总新闻数**: ${newsCount} 条\n\n`;
    markdownText += `**已处理**: ${processedCount} 条\n\n`;
    markdownText += `**失败率**: ${((newsCount - processedCount) / newsCount * 100).toFixed(1)}%\n\n`;
    markdownText += `**错误信息**: ${error}\n\n`;
    markdownText += `**时间**: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n\n`;

    const payload: NotificationPayload = {
      msgtype: 'markdown',
      markdown: {
        title: '[tide] Graph Worker - 新闻处理失败',
        text: markdownText
      },
      at: {
        isAtAll: newsCount - processedCount > newsCount * 0.5  // 失败率超过50%时@all
      }
    };

    await this.sendWebhook(payload);
  }

  /**
   * 发送服务异常通知
   */
  async sendServiceErrorNotification(serviceName: string, error: string, context?: any): Promise<void> {
    if (!this.config.enableWebhookNotification || !this.config.webhookUrl) {
      return;
    }

    let markdownText = `### 🚨 Graph Worker - 服务异常\n\n`;
    markdownText += `**服务**: Graph Worker\n\n`;
    markdownText += `**异常模块**: ${serviceName}\n\n`;
    markdownText += `**错误信息**: ${error}\n\n`;
    if (context) {
      markdownText += `**上下文**: ${JSON.stringify(context, null, 2)}\n\n`;
    }
    markdownText += `**时间**: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n\n`;
    markdownText += `**建议**: 检查服务日志并及时处理\n\n`;

    const payload: NotificationPayload = {
      msgtype: 'markdown',
      markdown: {
        title: '[tide] Graph Worker - 服务异常',
        text: markdownText
      },
      at: {
        isAtAll: true  // 服务异常比较严重，@all
      }
    };

    await this.sendWebhook(payload);
  }

  /**
   * 发送成功恢复通知
   */
  async sendRecoveryNotification(serviceName: string, details?: string): Promise<void> {
    if (!this.config.enableWebhookNotification || !this.config.webhookUrl) {
      return;
    }

    let markdownText = `### ✅ Graph Worker - 服务恢复正常\n\n`;
    markdownText += `**服务**: Graph Worker\n\n`;
    markdownText += `**恢复模块**: ${serviceName}\n\n`;
    markdownText += `**状态**: 🟢 正常运行\n\n`;
    if (details) {
      markdownText += `**详情**: ${details}\n\n`;
    }
    markdownText += `**时间**: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n\n`;

    const payload: NotificationPayload = {
      msgtype: 'markdown',
      markdown: {
        title: '[tide] Graph Worker - 服务恢复正常',
        text: markdownText
      }
    };

    await this.sendWebhook(payload);
  }

  /**
   * 发送Webhook请求
   */
  private async sendWebhook(payload: NotificationPayload): Promise<void> {
    try {
      logger.info('发送Webhook通知', { title: payload.markdown.title, url: this.config.webhookUrl });

      const response = await axios.post(this.config.webhookUrl!, payload, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Graph-Worker-Webhook/2.0'
        }
      });

      if (response.status >= 200 && response.status < 300) {
        logger.info('Webhook通知发送成功', { 
          title: payload.markdown.title, 
          status: response.status 
        });
      } else {
        logger.warn('Webhook通知响应异常', { 
          title: payload.markdown.title, 
          status: response.status,
          data: response.data 
        });
      }
    } catch (error: any) {
      logger.error('发送Webhook通知失败', { 
        title: payload.markdown.title,
        error: error.message,
        url: this.config.webhookUrl 
      });
    }
  }

  /**
   * 验证Webhook配置
   */
  validateConfig(): boolean {
    if (this.config.enableWebhookNotification && !this.config.webhookUrl) {
      logger.error('Webhook通知已启用但未配置URL');
      return false;
    }
    return true;
  }
}

// 导出单例
export default new NotificationService(); 
/**
 * 通知服务 - Webhook通知功能 (Ingest Worker)
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
   * 发送新闻获取失败通知
   */
  async sendNewsApiFailureNotification(error: string, retryCount?: number): Promise<void> {
    if (!this.config.enableWebhookNotification || !this.config.webhookUrl) {
      logger.debug('Webhook通知未启用或未配置URL');
      return;
    }

    let markdownText = `### ⚠️ Ingest Worker - 新闻API获取失败\n\n`;
    markdownText += `**服务**: Ingest Worker\n\n`;
    markdownText += `**模块**: 富途新闻API\n\n`;
    markdownText += `**错误类型**: API请求失败\n\n`;
    markdownText += `**错误信息**: ${error}\n\n`;
    if (retryCount !== undefined) {
      markdownText += `**重试次数**: ${retryCount}\n\n`;
    }
    markdownText += `**时间**: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n\n`;
    markdownText += `**建议**: 检查网络连接、API配置或富途服务状态\n\n`;

    const payload: NotificationPayload = {
      msgtype: 'markdown',
      markdown: {
        title: 'Ingest Worker - 新闻API获取失败',
        text: markdownText
      },
      at: {
        isAtAll: false
      }
    };

    await this.sendWebhook(payload);
  }

  /**
   * 发送文件保存失败通知
   */
  async sendFileSaveFailureNotification(fileName: string, newsCount: number, error: string): Promise<void> {
    if (!this.config.enableWebhookNotification || !this.config.webhookUrl) {
      return;
    }

    let markdownText = `### 🔴 Ingest Worker - 文件保存失败\n\n`;
    markdownText += `**服务**: Ingest Worker\n\n`;
    markdownText += `**模块**: 文件存储\n\n`;
    markdownText += `**文件名**: ${fileName}\n\n`;
    markdownText += `**新闻数量**: ${newsCount} 条\n\n`;
    markdownText += `**错误信息**: ${error}\n\n`;
    markdownText += `**时间**: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n\n`;
    markdownText += `**影响**: 新闻数据可能丢失，需要重新获取\n\n`;

    const payload: NotificationPayload = {
      msgtype: 'markdown',
      markdown: {
        title: 'Ingest Worker - 文件保存失败',
        text: markdownText
      },
      at: {
        isAtAll: true  // 文件保存失败比较严重，@all
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

    let markdownText = `### 🚨 Ingest Worker - 服务异常\n\n`;
    markdownText += `**服务**: Ingest Worker\n\n`;
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
        title: 'Ingest Worker - 服务异常',
        text: markdownText
      },
      at: {
        isAtAll: true  // 服务异常比较严重，@all
      }
    };

    await this.sendWebhook(payload);
  }

  /**
   * 发送健康检查失败通知
   */
  async sendHealthCheckFailureNotification(checkName: string, error: string): Promise<void> {
    if (!this.config.enableWebhookNotification || !this.config.webhookUrl) {
      return;
    }

    let markdownText = `### 💔 Ingest Worker - 健康检查失败\n\n`;
    markdownText += `**服务**: Ingest Worker\n\n`;
    markdownText += `**检查项**: ${checkName}\n\n`;
    markdownText += `**状态**: ❌ 失败\n\n`;
    markdownText += `**错误信息**: ${error}\n\n`;
    markdownText += `**时间**: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n\n`;
    markdownText += `**建议**: 检查服务依赖项和配置\n\n`;

    const payload: NotificationPayload = {
      msgtype: 'markdown',
      markdown: {
        title: 'Ingest Worker - 健康检查失败',
        text: markdownText
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

    let markdownText = `### ✅ Ingest Worker - 服务恢复正常\n\n`;
    markdownText += `**服务**: Ingest Worker\n\n`;
    markdownText += `**恢复模块**: ${serviceName}\n\n`;
    markdownText += `**状态**: 🟢 正常运行\n\n`;
    if (details) {
      markdownText += `**详情**: ${details}\n\n`;
    }
    markdownText += `**时间**: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n\n`;

    const payload: NotificationPayload = {
      msgtype: 'markdown',
      markdown: {
        title: 'Ingest Worker - 服务恢复正常',
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
          'User-Agent': 'Ingest-Worker-Webhook/2.0'
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
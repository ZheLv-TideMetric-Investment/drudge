import axios from 'axios';
import { buildNotificationTitle, createMarkdownPayload, formatBeijingLocaleString } from '@drudge/common';
import type { NotificationPayload } from '@drudge/common';
import { config } from '../config';

/**
 * Webhook 通知服务
 */
class WebhookService {
  private webhookUrls: string[];
  private enabled: boolean;

  constructor() {
    this.webhookUrls = config.notification.webhookUrls;
    this.enabled = config.notification.enableWebhookNotification;
  }

  /**
   * 发送消息（markdown格式）
   */
  async sendMessage(message: string, title?: string): Promise<boolean> {
    if (!this.enabled) {
      console.log('Webhook 通知未启用，跳过发送');
      return false;
    }

    if (!this.webhookUrls || this.webhookUrls.length === 0) {
      console.warn('Webhook URLs 未配置');
      return false;
    }

    const markdownTitle = buildNotificationTitle('Web App', title ?? '系统通知');

    const payload: NotificationPayload = createMarkdownPayload(
      markdownTitle,
      message,
      { isAtAll: false }
    );

    const results = await Promise.allSettled(
      this.webhookUrls.map(async (webhookUrl) => {
        try {
          const response = await axios.post(webhookUrl, payload, {
            timeout: 10000,
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'Web-App-Webhook/2.0',
            },
          });

          if (response.status >= 200 && response.status < 300) {
            console.log('Webhook 消息发送成功', {
              title: markdownTitle,
              status: response.status,
              url: webhookUrl,
            });
            return true;
          } else {
            console.warn('Webhook 消息发送失败，状态码:', response.status, response.data, 'URL:', webhookUrl);
            return false;
          }
        } catch (error: any) {
          console.error('Webhook 消息发送异常:', {
            error: error.message,
            url: webhookUrl,
          });
          return false;
        }
      })
    );

    const successCount = results.filter(result => 
      result.status === 'fulfilled' && result.value === true
    ).length;

    return successCount > 0;
  }

  /**
   * 发送系统状态通知
   */
  async sendSystemStatusNotification(
    status: 'success' | 'warning' | 'error',
    message: string,
    details?: string
  ): Promise<boolean> {
    if (!this.enabled || !this.webhookUrls || this.webhookUrls.length === 0) {
      return false;
    }

    const statusEmojis = {
      success: '✅',
      warning: '⚠️',
      error: '🚨',
    };

    const statusTexts = {
      success: '正常',
      warning: '警告',
      error: '错误',
    };

    let markdownText = `### ${statusEmojis[status]} Web App - 系统状态\n\n`;
    markdownText += `**服务**: Web App\n\n`;
    markdownText += `**状态**: ${statusTexts[status]}\n\n`;
    markdownText += `**消息**: ${message}\n\n`;
    if (details) {
      markdownText += `**详情**: ${details}\n\n`;
    }
    markdownText += `**时间**: ${formatBeijingLocaleString()}\n\n`;

    const payload: NotificationPayload = createMarkdownPayload(
      buildNotificationTitle('Web App', `系统${statusTexts[status]}`),
      markdownText,
      { isAtAll: status === 'error' } // 错误状态时@all
    );

    const results = await Promise.allSettled(
      this.webhookUrls.map(async (webhookUrl) => {
        try {
          const response = await axios.post(webhookUrl, payload, {
            timeout: 10000,
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'Web-App-Webhook/2.0',
            },
          });

          return response.status >= 200 && response.status < 300;
        } catch (error: any) {
          console.error('系统状态通知发送失败:', error.message, 'URL:', webhookUrl);
          return false;
        }
      })
    );

    const successCount = results.filter(result => 
      result.status === 'fulfilled' && result.value === true
    ).length;

    return successCount > 0;
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<boolean> {
    if (!this.enabled || !this.webhookUrls || this.webhookUrls.length === 0) {
      return false;
    }

    try {
      const testMessage = '连接测试成功';
      return await this.sendMessage(testMessage, '连接测试');
    } catch (error: any) {
      console.error('Webhook 连接测试失败:', error.message);
      return false;
    }
  }

  /**
   * 获取配置状态
   */
  getStatus(): any {
    return {
      enabled: this.enabled,
      webhookUrls: this.webhookUrls.length > 0 ? `已配置 ${this.webhookUrls.length} 个URL` : '未配置',
      urlCount: this.webhookUrls.length,
      timestamp: new Date().toISOString(),
    };
  }
}

export const webhookService = new WebhookService();

import axios from 'axios';
import { config } from '../config';

/**
 * Webhook通知载荷接口
 */
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

/**
 * Webhook 通知服务
 */
class WebhookService {
  private webhookUrl: string;
  private enabled: boolean;

  constructor() {
    this.webhookUrl = config.notification.webhookUrl;
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

    if (!this.webhookUrl) {
      console.warn('Webhook URL 未配置');
      return false;
    }

    try {
      // 构建markdown格式的消息
      const markdownTitle = title ? `[tide] Web App - ${title}` : '[tide] Web App - 系统通知';

      const payload: NotificationPayload = {
        msgtype: 'markdown',
        markdown: {
          title: markdownTitle,
          text: message,
        },
        at: {
          isAtAll: false,
        },
      };

      const response = await axios.post(this.webhookUrl, payload, {
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
        });
        return true;
      } else {
        console.warn('Webhook 消息发送失败，状态码:', response.status, response.data);
        return false;
      }
    } catch (error: any) {
      console.error('Webhook 消息发送异常:', {
        error: error.message,
        url: this.webhookUrl,
      });
      return false;
    }
  }

  /**
   * 发送系统状态通知
   */
  async sendSystemStatusNotification(
    status: 'success' | 'warning' | 'error',
    message: string,
    details?: string
  ): Promise<boolean> {
    if (!this.enabled || !this.webhookUrl) {
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
    markdownText += `**时间**: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}\n\n`;

    const payload: NotificationPayload = {
      msgtype: 'markdown',
      markdown: {
        title: `[tide] Web App - 系统${statusTexts[status]}`,
        text: markdownText,
      },
      at: {
        isAtAll: status === 'error', // 错误状态时@all
      },
    };

    try {
      const response = await axios.post(this.webhookUrl, payload, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Web-App-Webhook/2.0',
        },
      });

      return response.status >= 200 && response.status < 300;
    } catch (error: any) {
      console.error('系统状态通知发送失败:', error.message);
      return false;
    }
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<boolean> {
    if (!this.enabled || !this.webhookUrl) {
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
      webhookUrl: this.webhookUrl ? '已配置' : '未配置',
      timestamp: new Date().toISOString(),
    };
  }
}

export const webhookService = new WebhookService();

import axios from 'axios';
import { config } from '../config';

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
   * 发送消息
   */
  async sendMessage(message: string): Promise<boolean> {
    if (!this.enabled) {
      console.log('Webhook 通知未启用，跳过发送');
      return false;
    }

    if (!this.webhookUrl) {
      console.warn('Webhook URL 未配置');
      return false;
    }

    try {
      const response = await axios.post(this.webhookUrl, {
        text: message,
        timestamp: new Date().toISOString()
      }, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.status === 200) {
        console.log('Webhook 消息发送成功');
        return true;
      } else {
        console.warn(`Webhook 消息发送失败，状态码: ${response.status}`);
        return false;
      }
    } catch (error: any) {
      console.error('Webhook 消息发送异常:', error.message);
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
      const testMessage = `🔔 Web App Webhook 连接测试 - ${new Date().toLocaleString()}`;
      return await this.sendMessage(testMessage);
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
      timestamp: new Date().toISOString()
    };
  }
}

export const webhookService = new WebhookService(); 
import { saveBriefing } from './briefing-store';
import { dingtalkMessageService } from './dingtalk-message';
import {
  BriefingDraft,
  buildBatchNewsBriefing,
  buildSingleNewsBriefing,
  buildSummaryBriefing,
  buildSystemAlertBriefing,
} from './notification-briefing';

/**
 * 通知编排层：先保存完整简报，再向显式指定收件人发送图片摘要与 H5 入口。
 */
class NotificationService {
  private async deliver(briefing: BriefingDraft): Promise<boolean> {
    const document = await saveBriefing(briefing);
    return dingtalkMessageService.sendBriefing(document);
  }

  async initialize(): Promise<void> {
    console.log('通知服务初始化完成（钉钉显式单收件人图片摘要 + H5 详情）');
  }

  async sendBatchHighLevelNewsNotification(newsItems: any[]): Promise<boolean> {
    if (newsItems.length === 0) return false;

    try {
      const sent = await this.deliver(buildBatchNewsBriefing(newsItems));
      if (sent) {
        console.log(`批量高级别新闻通知已发送: ${newsItems.length} 条新闻`);
      }
      return sent;
    } catch (error) {
      console.error('发送批量高级别新闻通知失败:', error);
      return false;
    }
  }

  async sendHighLevelNewsNotification(news: any): Promise<boolean> {
    try {
      const sent = await this.deliver(buildSingleNewsBriefing(news));
      if (sent) {
        console.log(`高级别新闻通知已发送: ${news.newsId} - ${news.title}`);
      }
      return sent;
    } catch (error) {
      console.error(`发送高级别新闻通知失败: ${news.newsId}`, error);
      return false;
    }
  }

  async sendNormalSummaryNotification(
    summary: any,
    hourStart: string,
    hourEnd: string,
    newsItems: any[]
  ): Promise<boolean> {
    try {
      const summaryContent = typeof summary === 'string' ? summary : summary.summary;
      const sent = await this.deliver(
        buildSummaryBriefing(String(summaryContent || ''), hourStart, hourEnd, newsItems)
      );
      if (sent) {
        console.log(`财经总结通知已发送: ${hourStart} - ${hourEnd}`);
      }
      return sent;
    } catch (error) {
      console.error('发送财经总结通知失败:', error);
      return false;
    }
  }

  async sendSystemAlert(title: string, message: string): Promise<boolean> {
    try {
      const sent = await this.deliver(buildSystemAlertBriefing(title, message));
      if (sent) {
        console.log(`系统警报已发送: ${title}`);
      }
      return sent;
    } catch (error) {
      console.error('发送系统警报失败:', error);
      return false;
    }
  }

  async healthCheck(): Promise<any> {
    const connected = await dingtalkMessageService.healthCheck();
    if (connected) {
      return {
        status: 'healthy',
        service: 'NotificationService',
        timestamp: new Date().toISOString(),
        dingtalk_message_connection: 'connected',
      };
    }

    return {
      status: 'unhealthy',
      service: 'NotificationService',
      timestamp: new Date().toISOString(),
      error: '钉钉图片摘要通知未启用、配置不完整或鉴权失败',
    };
  }
}

export const notificationService = new NotificationService();

import moment from 'moment-timezone';
import { queryService } from './query';
import { notificationService } from './notification';
import { HighLevelScanResult, CallSource } from '../../types/scheduler';

/**
 * 高级别新闻扫描服务
 * 基于Neo4j数据，扫描高等级新闻并发送通知
 */
class HighLevelNewsScanner {
  private lastScanTime: string | null = null;
  private processedNewsIds: Set<string> = new Set();

  constructor() {
    this.lastScanTime = null;
  }

  /**
   * 扫描高级别新闻
   * @param source 调用来源
   */
  async scanHighLevelNews(source: CallSource = CallSource.API): Promise<HighLevelScanResult> {
    try {
      console.log('开始扫描高级别新闻...');
      
      // 计算扫描时间范围
      const endTime = moment();
      const startTime = this.lastScanTime ? 
        moment(this.lastScanTime) : 
        moment().subtract(5, 'minutes'); // 首次运行扫描最近5分钟

      // 从Neo4j获取高级别新闻
      const highLevelNews = await queryService.getHighLevelNews(
        startTime.toISOString(),
        endTime.toISOString()
      );

      if (highLevelNews.length === 0) {
        this.lastScanTime = endTime.toISOString();
        return {
          success: true,
          found: 0,
          sent: 0,
          message: `${startTime.format('HH:mm')}-${endTime.format('HH:mm')} 时段没有发现高级别新闻`,
          period: `${startTime.format('HH:mm')}-${endTime.format('HH:mm')}`,
          timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
        };
      }

      // 过滤出未处理的新闻
      const newHighLevelNews = highLevelNews.filter(news => 
        !this.processedNewsIds.has(news.newsId)
      );

      if (newHighLevelNews.length === 0) {
        this.lastScanTime = endTime.toISOString();
        return {
          success: true,
          found: highLevelNews.length,
          sent: 0,
          message: `发现 ${highLevelNews.length} 条高级别新闻，但都已处理过`,
          period: `${startTime.format('HH:mm')}-${endTime.format('HH:mm')}`,
          timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
        };
      }

      // 发送通知
      let sentCount = 0;
      for (const news of newHighLevelNews) {
        try {
          const notificationSent = await notificationService.sendHighLevelNewsNotification(news, source);
          if (notificationSent) {
            sentCount++;
            this.processedNewsIds.add(news.newsId);
          }
        } catch (notificationError: any) {
          console.error(`发送高级别新闻通知失败 (ID: ${news.newsId}):`, notificationError.message);
        }
      }

      // 清理过期的已处理新闻ID
      this.cleanupProcessedNewsIds();

      this.lastScanTime = endTime.toISOString();

      return {
        success: true,
        found: newHighLevelNews.length,
        sent: sentCount,
        message: `扫描完成：发现 ${newHighLevelNews.length} 条新的高级别新闻，成功发送 ${sentCount} 条通知`,
        period: `${startTime.format('HH:mm')}-${endTime.format('HH:mm')}`,
        high_level_news: newHighLevelNews.map(news => ({
          newsId: news.newsId,
          title: news.title,
          level: news.level,
          urgency: news.urgency,
          companies: news.companies,
          persons: news.persons,
          organizations: news.organizations || [], // 新增：包含organizations数据
          events: news.events,
          timestamp: news.timestamp
        })),
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };

    } catch (error: any) {
      console.error('扫描高级别新闻失败:', error);
      return {
        success: false,
        found: 0,
        sent: 0,
        message: '扫描高级别新闻失败',
        error: error.message,
        period: '',
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };
    }
  }

  /**
   * 手动扫描高级别新闻
   * @param minutes 扫描最近几分钟的新闻
   * @param source 调用来源
   */
  async manualScan(minutes: number = 30, source: CallSource = CallSource.API): Promise<HighLevelScanResult> {
    try {
      console.log(`开始手动扫描最近 ${minutes} 分钟的高级别新闻...`);
      
      // 计算扫描时间范围
      const endTime = moment();
      const startTime = moment().subtract(minutes, 'minutes');

      // 从Neo4j获取高级别新闻
      const highLevelNews = await queryService.getHighLevelNews(
        startTime.toISOString(),
        endTime.toISOString()
      );

      if (highLevelNews.length === 0) {
        return {
          success: true,
          found: 0,
          sent: 0,
          message: `最近 ${minutes} 分钟内没有发现高级别新闻`,
          period: `${startTime.format('HH:mm')}-${endTime.format('HH:mm')}`,
          timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
        };
      }

      // 手动扫描时，不过滤已处理的新闻ID，重新发送所有找到的新闻
      let sentCount = 0;
      for (const news of highLevelNews) {
        try {
          const notificationSent = await notificationService.sendHighLevelNewsNotification(news, source);
          if (notificationSent) {
            sentCount++;
          }
        } catch (notificationError: any) {
          console.error(`发送高级别新闻通知失败 (ID: ${news.newsId}):`, notificationError.message);
        }
      }

      return {
        success: true,
        found: highLevelNews.length,
        sent: sentCount,
        message: `手动扫描完成：发现 ${highLevelNews.length} 条高级别新闻，发送 ${sentCount} 条通知`,
        period: `${startTime.format('HH:mm')}-${endTime.format('HH:mm')}`,
        high_level_news: highLevelNews.map(news => ({
          newsId: news.newsId,
          title: news.title,
          level: news.level,
          urgency: news.urgency,
          companies: news.companies,
          persons: news.persons,
          organizations: news.organizations || [], // 新增：包含organizations数据
          events: news.events,
          timestamp: news.timestamp
        })),
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };

    } catch (error: any) {
      console.error('手动扫描高级别新闻失败:', error);
      return {
        success: false,
        found: 0,
        sent: 0,
        message: '手动扫描失败',
        error: error.message,
        period: '',
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };
    }
  }

  /**
   * 获取扫描状态
   */
  getStatus(): any {
    return {
      lastScanTime: this.lastScanTime,
      processedNewsCount: this.processedNewsIds.size,
      isRunning: false,
      timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
    };
  }

  /**
   * 重置扫描状态
   */
  reset(): void {
    this.lastScanTime = null;
    this.processedNewsIds.clear();
    console.log('高级别新闻扫描器状态已重置');
  }

  /**
   * 清理过期的已处理新闻ID（保留最近24小时的记录）
   */
  private cleanupProcessedNewsIds(): void {
    // 这里可以添加更智能的清理逻辑
    // 目前简单地限制最大数量
    const maxSize = 1000;
    if (this.processedNewsIds.size > maxSize) {
      // 清理一半的记录
      const idsArray = Array.from(this.processedNewsIds);
      const toRemove = idsArray.slice(0, Math.floor(idsArray.length / 2));
      toRemove.forEach(id => this.processedNewsIds.delete(id));
      console.log(`清理了 ${toRemove.length} 条过期的已处理新闻ID记录`);
    }
  }
}

export const highLevelNewsScanner = new HighLevelNewsScanner(); 
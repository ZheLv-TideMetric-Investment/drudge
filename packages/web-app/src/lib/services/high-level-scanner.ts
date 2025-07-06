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
          await notificationService.sendHighLevelNewsNotification(news, source);
          this.processedNewsIds.add(news.newsId);
          sentCount++;
        } catch (error) {
          console.warn(`发送高级别新闻通知失败: ${news.newsId}`, error);
        }
      }

      // 更新最后扫描时间
      this.lastScanTime = endTime.toISOString();

      // 清理过期的已处理记录（保留最近4小时）
      this.cleanupProcessedNewsIds();

      return {
        success: true,
        found: highLevelNews.length,
        sent: sentCount,
        message: `扫描完成：发现 ${highLevelNews.length} 条高级别新闻，新增 ${newHighLevelNews.length} 条，发送 ${sentCount} 条通知`,
        period: `${startTime.format('HH:mm')}-${endTime.format('HH:mm')}`,
        high_level_news: newHighLevelNews.map(news => ({
          newsId: news.newsId,
          title: news.title,
          level: news.level,
          urgency: news.urgency
        })),
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };

    } catch (error: any) {
      console.error('扫描高级别新闻失败:', error);
      return {
        success: false,
        found: 0,
        sent: 0,
        message: '扫描失败',
        period: '',
        error: error.message,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };
    }
  }

  /**
   * 清理过期的已处理新闻ID记录
   */
  private cleanupProcessedNewsIds(): void {
    // 简单实现：如果记录过多，清空部分旧记录
    if (this.processedNewsIds.size > 1000) {
      const idsArray = Array.from(this.processedNewsIds);
      const keepCount = 500; // 保留最近的500个
      this.processedNewsIds.clear();
      
      // 保留后半部分
      idsArray.slice(-keepCount).forEach(id => {
        this.processedNewsIds.add(id);
      });
      
      console.log(`清理已处理新闻ID记录，保留最近 ${keepCount} 个`);
    }
  }

  /**
   * 手动触发扫描（用于测试）
   */
  async manualScan(minutes: number = 30, source: CallSource = CallSource.API): Promise<HighLevelScanResult> {
    try {
      const endTime = moment();
      const startTime = moment().subtract(minutes, 'minutes');
      
      // 临时设置扫描时间范围
      const originalLastScanTime = this.lastScanTime;
      this.lastScanTime = startTime.toISOString();
      
      const result = await this.scanHighLevelNews(source);
      
      // 恢复原来的扫描时间
      if (originalLastScanTime) {
        this.lastScanTime = originalLastScanTime;
      }
      
      return {
        ...result,
        message: `手动扫描: ${result.message}`
      };

    } catch (error: any) {
      console.error('手动扫描失败:', error);
      return {
        success: false,
        found: 0,
        sent: 0,
        message: '手动扫描失败',
        period: '',
        error: error.message,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };
    }
  }
}

export const highLevelNewsScanner = new HighLevelNewsScanner(); 
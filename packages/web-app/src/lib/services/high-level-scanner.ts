import moment from 'moment-timezone';
import { queryService } from './query';
import { notificationService } from './notification';
import { HighLevelScanResult, CallSource } from '../../types/scheduler';

/**
 * 扫描选项接口
 */
export interface ScanOptions {
  /** 是否发送通知 */
  sendNotifications?: boolean;
  /** 是否跳过已处理的新闻 */
  skipProcessed?: boolean;
  /** 扫描来源 */
  source?: CallSource;
}

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
   * @param startTime 开始时间（ISO字符串或moment对象），如果不提供则使用上次扫描时间或5分钟前
   * @param endTime 结束时间（ISO字符串或moment对象），如果不提供则使用当前时间
   * @param options 扫描选项
   */
  async scanHighLevelNews(
    startTime?: string | moment.Moment,
    endTime?: string | moment.Moment,
    options: ScanOptions = {}
  ): Promise<HighLevelScanResult> {
    try {
      // 设置默认选项
      const {
        sendNotifications = true,
        skipProcessed = true,
        source = CallSource.API
      } = options;

      console.log('开始扫描高级别新闻...');
      
      // 计算扫描时间范围
      const end = endTime ? moment(endTime) : moment();
      const start = startTime ? 
        moment(startTime) : 
        (this.lastScanTime ? moment(this.lastScanTime) : moment().subtract(5, 'minutes'));

      if (!start.isValid() || !end.isValid()) {
        throw new Error('无效的时间格式');
      }

      if (start.isAfter(end)) {
        throw new Error('开始时间不能晚于结束时间');
      }

      console.log(`扫描时间范围: ${start.format('YYYY-MM-DD HH:mm')} - ${end.format('YYYY-MM-DD HH:mm')}`);

      // 从Neo4j获取高级别新闻
      const highLevelNews = await queryService.getHighLevelNews(
        start.toISOString(),
        end.toISOString()
      );

      if (highLevelNews.length === 0) {
        this.updateLastScanTime(end);
        return {
          success: true,
          found: 0,
          sent: 0,
          message: `${start.format('HH:mm')}-${end.format('HH:mm')} 时段没有发现高级别新闻`,
          period: this.formatPeriod(start, end),
          timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
        };
      }

      // 过滤新闻（根据skipProcessed选项）
      const newsToProcess = skipProcessed ? 
        highLevelNews.filter(news => !this.processedNewsIds.has(news.newsId)) :
        highLevelNews;

      if (newsToProcess.length === 0 && skipProcessed) {
        this.updateLastScanTime(end);
        return {
          success: true,
          found: highLevelNews.length,
          sent: 0,
          message: `发现 ${highLevelNews.length} 条高级别新闻，但都已处理过`,
          period: this.formatPeriod(start, end),
          timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
        };
      }

      // 发送通知
      let sentCount = 0;
      if (sendNotifications) {
        sentCount = await this.sendNotifications(newsToProcess, source);
        
        // 标记为已处理（仅在skipProcessed为true时）
        if (skipProcessed) {
          newsToProcess.forEach(news => {
            this.processedNewsIds.add(news.newsId);
          });
        }
      }

      // 清理过期的已处理新闻ID
      this.cleanupProcessedNewsIds();

      this.updateLastScanTime(end);

      const scanType = startTime || endTime ? '自定义' : '定时';
      const processType = skipProcessed ? '新发现' : '全部';
      
      return {
        success: true,
        found: newsToProcess.length,
        sent: sentCount,
        message: `${scanType}扫描完成：发现 ${newsToProcess.length} 条${processType}高级别新闻${sendNotifications ? `，成功发送 ${sentCount} 条通知` : ''}`,
        period: this.formatPeriod(start, end),
        high_level_news: newsToProcess.map(news => this.formatNewsItem(news)),
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
   * 定时扫描高级别新闻（向后兼容方法）
   * @param source 调用来源
   */
  async scanHighLevelNewsScheduled(source: CallSource = CallSource.SCHEDULER): Promise<HighLevelScanResult> {
    return this.scanHighLevelNews(undefined, undefined, {
      sendNotifications: true,
      skipProcessed: true,
      source
    });
  }

  /**
   * 手动扫描高级别新闻（向后兼容方法）
   * @param minutes 扫描最近几分钟的新闻
   * @param source 调用来源
   */
  async manualScan(minutes: number = 30, source: CallSource = CallSource.API): Promise<HighLevelScanResult> {
    const endTime = moment();
    const startTime = moment().subtract(minutes, 'minutes');
    
    return this.scanHighLevelNews(startTime, endTime, {
      sendNotifications: true,
      skipProcessed: false, // 手动扫描时不跳过已处理的新闻
      source
    });
  }

  /**
   * 扫描指定时间范围的高级别新闻
   * @param startTime 开始时间
   * @param endTime 结束时间
   * @param source 调用来源
   */
  async scanTimeRange(
    startTime: string | moment.Moment,
    endTime: string | moment.Moment,
    source: CallSource = CallSource.API
  ): Promise<HighLevelScanResult> {
    return this.scanHighLevelNews(startTime, endTime, {
      sendNotifications: true,
      skipProcessed: false,
      source
    });
  }

  /**
   * 仅查询高级别新闻（不发送通知）
   * @param startTime 开始时间
   * @param endTime 结束时间
   */
  async queryHighLevelNews(
    startTime: string | moment.Moment,
    endTime: string | moment.Moment
  ): Promise<HighLevelScanResult> {
    return this.scanHighLevelNews(startTime, endTime, {
      sendNotifications: false,
      skipProcessed: false,
      source: CallSource.API
    });
  }

  /**
   * 发送通知
   */
  private async sendNotifications(newsItems: any[], source: CallSource): Promise<number> {
    let sentCount = 0;
    
    for (const news of newsItems) {
      try {
        const notificationSent = await notificationService.sendHighLevelNewsNotification(news, source);
        if (notificationSent) {
          sentCount++;
        }
      } catch (notificationError: any) {
        console.error(`发送高级别新闻通知失败 (ID: ${news.newsId}):`, notificationError.message);
      }
    }
    
    return sentCount;
  }

  /**
   * 格式化新闻项
   */
  private formatNewsItem(news: any): any {
    return {
      newsId: news.newsId,
      title: news.title,
      level: news.level,
      urgency: news.urgency,
      companies: news.companies,
      persons: news.persons,
      organizations: news.organizations || [],
      events: news.events,
      timestamp: news.timestamp
    };
  }

  /**
   * 更新最后扫描时间
   */
  private updateLastScanTime(time: moment.Moment): void {
    this.lastScanTime = time.toISOString();
  }

  /**
   * 格式化时间段 - 显示北京时间
   */
  private formatPeriod(start: moment.Moment, end: moment.Moment): string {
    // 转换为北京时间显示
    const beijingStart = start.clone().tz('Asia/Shanghai');
    const beijingEnd = end.clone().tz('Asia/Shanghai');
    
    if (beijingStart.isSame(beijingEnd, 'day')) {
      return `${beijingStart.format('MM-DD HH:mm')}-${beijingEnd.format('HH:mm')}`;
    } else {
      return `${beijingStart.format('MM-DD HH:mm')}-${beijingEnd.format('MM-DD HH:mm')}`;
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
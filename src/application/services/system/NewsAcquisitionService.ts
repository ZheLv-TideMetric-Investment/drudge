// @ts-nocheck
import logger from '../../../shared/utils/logger';
import moment from 'moment-timezone';
import newsApiService from '../../../infrastructure/external/NewsApiService';
import fileStorage from '../../../infrastructure/storage/FileStorage';

/**
 * 新闻获取服务
 * 负责从外部API获取新闻并存储到本地
 */
class NewsAcquisitionService {
  private newsApi: any;
  private storage: any;

  constructor() {
    this.newsApi = newsApiService;
    this.storage = fileStorage;
  }

  /**
   * 获取最新新闻
   */
  async fetchLatestNews() {
    try {
      logger.info('🔄 开始获取最新新闻...');
      
      const newsItems = await this.newsApi.fetchLatestNews();
      
      if (newsItems.length === 0) {
        return { 
          success: true, 
          fetched: 0,
          saved: 0,
          message: '没有获取到新的新闻',
          timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
        };
      }

      const savedCount = await this.saveNews(newsItems);

      const message = `成功获取并保存 ${savedCount}/${newsItems.length} 条新闻`;
      logger.info(message);

      return {
        success: true,
        fetched: newsItems.length,
        saved: savedCount,
        message,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };

    } catch (error) {
      logger.error('获取新闻失败:', error);
      return { 
        success: false, 
        error: error.message,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };
    }
  }

  /**
   * 批量获取历史新闻
   */
  async fetchBatchNews(days: number = 1) {
    try {
      const daysNum = parseInt(days.toString()) || 1;
      logger.info(`🔄 开始批量获取最近 ${daysNum} 天的新闻...`);

      const endTime = moment();
      const startTime = moment().subtract(daysNum, 'days');

      const newsItems = await this.newsApi.fetchNewsByTimeRange(startTime, endTime);

      if (newsItems.length === 0) {
        return { 
          success: true, 
          fetched: 0,
          saved: 0,
          period: `${daysNum} 天`,
          message: `最近 ${daysNum} 天没有新闻`,
          timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
        };
      }

      const savedCount = await this.saveBatchNews(newsItems);

      const message = `批量获取完成: ${savedCount}/${newsItems.length} 条新闻已保存`;
      logger.info(message);

      return {
        success: true,
        period: `${daysNum} 天`,
        fetched: newsItems.length,
        saved: savedCount,
        message,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };

    } catch (error) {
      logger.error('批量获取失败:', error);
      return { 
        success: false, 
        error: error.message,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };
    }
  }

  /**
   * 获取存储的新闻列表
   */
  async getStoredNewsList(limit: number = 10) {
    try {
      const limitNum = parseInt(limit.toString()) || 10;
      const allNews = await this.storage.getAll();
      const newsItems = allNews.slice(0, limitNum);

      return {
        success: true,
        count: newsItems.length,
        total: allNews.length,
        news: newsItems.map(item => ({
          id: item.id,
          title: item.title,
          time: moment(item.time * 1000).format('YYYY-MM-DD HH:mm:ss'),
          source: item.source || '未知'
        })),
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };

    } catch (error) {
      logger.error('获取新闻列表失败:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  /**
   * 获取新闻数量统计
   */
  async getNewsCount() {
    try {
      const allNews = await this.storage.getAll();
      const totalCount = allNews.length;

      if (totalCount === 0) {
        return { 
          success: true, 
          total: 0,
          message: '本地没有存储的新闻',
          timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
        };
      }

      // 按时间统计
      const now = moment();
      const statistics = {
        total: totalCount,
        today: allNews.filter(item => 
          moment(item.time * 1000).isSame(now, 'day')
        ).length,
        this_week: allNews.filter(item => 
          moment(item.time * 1000).isSame(now, 'week')
        ).length,
        this_month: allNews.filter(item => 
          moment(item.time * 1000).isSame(now, 'month')
        ).length
      };

      return {
        success: true,
        statistics,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };

    } catch (error) {
      logger.error('获取新闻统计失败:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  /**
   * 清理旧新闻
   */
  async cleanOldNews(days: number = 30) {
    try {
      const daysNum = parseInt(days.toString()) || 30;
      const cutoffTime = moment().subtract(daysNum, 'days');
      
      const allNews = await this.storage.getAll();
      const oldNews = allNews.filter(item => 
        moment(item.time * 1000).isBefore(cutoffTime)
      );

      if (oldNews.length === 0) {
        return {
          success: true,
          cleaned: 0,
          remaining: allNews.length,
          message: `没有超过 ${daysNum} 天的旧新闻需要清理`,
          timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
        };
      }

      // 保留不超过指定天数的新闻
      const recentNews = allNews.filter(item => 
        moment(item.time * 1000).isAfter(cutoffTime)
      );

      await this.storage.save(recentNews);

      const message = `清理完成: 删除了 ${oldNews.length} 条旧新闻，保留 ${recentNews.length} 条`;
      logger.info(message);

      return {
        success: true,
        cleaned: oldNews.length,
        remaining: recentNews.length,
        cutoff_date: cutoffTime.format('YYYY-MM-DD HH:mm:ss'),
        message,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };

    } catch (error) {
      logger.error('清理旧新闻失败:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  /**
   * 获取服务状态
   */
  async getStatus() {
    try {
      const allNews = await this.storage.getAll();
      
      // 检查新闻API状态
      let apiStatus = 'unknown';
      try {
        await this.newsApi.testConnection();
        apiStatus = 'healthy';
      } catch (error) {
        apiStatus = 'error';
      }

      const latestNews = allNews.length > 0 ? 
        allNews.sort((a, b) => b.time - a.time)[0] : null;

      return {
        success: true,
        status: {
          api_connection: apiStatus,
          total_news: allNews.length,
          latest_news_time: latestNews ? 
            moment(latestNews.time * 1000).format('YYYY-MM-DD HH:mm:ss') : null,
          storage_healthy: true
        },
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };

    } catch (error) {
      logger.error('获取状态失败:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }

  /**
   * 私有辅助方法：保存新闻
   */
  private async saveNews(newsItems: any[]) {
    let savedCount = 0;
    try {
      await this.storage.save(newsItems);
      savedCount = newsItems.length;
    } catch (error) {
      logger.warn(`批量保存新闻失败，尝试逐个保存`, error);
      // 如果批量保存失败，尝试逐个保存
      for (const newsItem of newsItems) {
        try {
          await this.storage.save([newsItem]);
          savedCount++;
        } catch (error) {
          logger.warn(`保存新闻失败: ${newsItem.id}`, error);
        }
      }
    }
    return savedCount;
  }

  /**
   * 私有辅助方法：批量保存新闻
   */
  private async saveBatchNews(newsItems: any[]) {
    let savedCount = 0;
    const batchSize = 10;
    
    for (let i = 0; i < newsItems.length; i += batchSize) {
      const batch = newsItems.slice(i, i + batchSize);
      
      try {
        await this.storage.save(batch);
        savedCount += batch.length;
      } catch (error) {
        logger.warn(`批量保存失败，尝试逐个保存`, error);
        // 如果批量保存失败，尝试逐个保存
        for (const newsItem of batch) {
          try {
            await this.storage.save([newsItem]);
            savedCount++;
          } catch (error) {
            logger.warn(`保存新闻失败: ${newsItem.id}`, error);
          }
        }
      }

      // 批次间延迟
      if (i + batchSize < newsItems.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return savedCount;
  }
}

export default new NewsAcquisitionService(); 
import axios from 'axios';
import { logger } from '../utils/logger';
import config from '../config/config';
import fileStorage, { NewsItem } from '../storage/FileStorage';
import notificationService from './NotificationService';
import { logErrorWithDetails } from '../utils/error';

/**
 * 随机生成 User-Agent
 */
function getRandomUserAgent(): string {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3.1 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
  ];
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

/**
 * 随机生成 Referer
 */
function getRandomReferer(): string {
  const referers = [
    'https://www.google.com/',
    'https://www.bing.com/',
    'https://www.baidu.com/',
    'https://www.sogou.com/',
    'https://www.so.com/',
  ];
  return referers[Math.floor(Math.random() * referers.length)];
}

/**
 * AWTMT新闻服务
 * 专门负责从AWTMT API获取新闻数据
 */
export class AwtmtLiveService {
  private isFirstRun: boolean = true;
  private lastRequestTime: number = 0;
  private minRequestInterval: number = 2000; // 最小请求间隔 2 秒
  private baseUrl: string = 'https://api-one-wscn.awtmt.com/apiv1/content/lives';

  /**
   * 过滤新新闻
   */
  private async filterNewNews(news: NewsItem[]): Promise<NewsItem[]> {
    const lastNewsId = await fileStorage.getLatestNewsId('awtmt_live');
    logger.info(`🔄 [AWTMT] 过滤新新闻，最后一条新闻ID: ${lastNewsId}`);
    if (!lastNewsId) {
      // 如果没有最后一条新闻的ID，说明是首次运行，返回所有新闻
      return news;
    }

    // 找到最后一条新闻的位置
    const lastNewsIndex = news.findIndex(item => item.id === lastNewsId);
    logger.info(`🔄 [AWTMT] 过滤新新闻，所有新闻id: ${news.map(item => item.id)}`);
    logger.info(`🔄 [AWTMT] 过滤新新闻，最后一条新闻索引: ${lastNewsIndex}`);
    if (lastNewsIndex === -1) {
      // 如果找不到最后一条新闻，说明都是新数据
      return news;
    }

    // 返回最后一条新闻之前的所有新闻
    return news.slice(0, lastNewsIndex);
  }

  /**
   * 转换AWTMT数据格式为标准NewsItem格式
   */
  private transformNewsItem(item: any): NewsItem {
    return {
      id: item.id.toString(),
      title: item.title || '',
      content: item.content_text || item.content || '',
      source: 'awtmt_live',
      time: item.display_time * 1000, // 转换为毫秒时间戳
      url: item.uri || '',
      author: '',
      category: item.global_channel_name || '',
      summary: item.content_text ? item.content_text.substring(0, 200) : '',
      raw: item, // 保存原始数据
    };
  }

  /**
   * 发起HTTP请求
   */
  private async makeRequest(cursor?: string): Promise<any> {
    const params: any = {
      channel: 'global-channel',
      client: 'pc',
      limit: 20,
      accept: 'live,vip-live',
    };

    try {
      // 控制请求频率
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      if (timeSinceLastRequest < this.minRequestInterval) {
        await new Promise(resolve =>
          setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest)
        );
      }

      if (cursor) {
        params.cursor = cursor;
        params.first_page = false;
      } else {
        params.first_page = true;
      }

      // 添加请求头伪装
      const headers = {
        'User-Agent': getRandomUserAgent(),
        Referer: getRandomReferer(),
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        Connection: 'keep-alive',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        DNT: '1',
        'Upgrade-Insecure-Requests': '1',
      };

      // 添加随机延迟
      const randomDelay = Math.floor(Math.random() * 1000) + 500; // 500-1500ms
      await new Promise(resolve => setTimeout(resolve, randomDelay));

      const response = await axios.get(this.baseUrl, {
        params,
        headers,
        timeout: 10000, // 10 秒超时
        validateStatus: function (status: number) {
          return status >= 200 && status < 300; // 只接受 2xx 的状态码
        },
      });

      this.lastRequestTime = Date.now();
      return response;
    } catch (error: any) {
      const errorDetails = logErrorWithDetails('[AWTMT] 请求AWTMT新闻API失败:', error, {
        params,
        cursor,
      });

      // 发送API失败通知
      try {
        await notificationService.sendNewsApiFailureNotification(`[AWTMT] ${errorDetails.message}`);
      } catch (notifyError) {
        logger.error('[AWTMT] 发送API失败通知失败:', notifyError);
      }

      // 如果是网络错误，等待更长时间后重试
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      return null;
    }
  }

  /**
   * 核心新闻获取功能
   */
  async fetchNews(): Promise<NewsItem[]> {
    try {
      // 首次运行，获取一页新数据
      if (this.isFirstRun) {
        logger.info('🔄 [AWTMT] 新闻首次运行，获取最新一页新闻');
        const response = await this.makeRequest();

        if (
          !response ||
          !response.data ||
          response.data.code !== 20000 ||
          !response.data.data ||
          !response.data.data.items
        ) {
          const errorMsg = '[AWTMT] 获取新闻失败: 响应格式错误';
          logger.error(`❌ ${errorMsg}`);

          // 发送API响应格式错误通知
          try {
            await notificationService.sendNewsApiFailureNotification(errorMsg);
          } catch (notifyError) {
            logger.error('[AWTMT] 发送API响应格式错误通知失败:', notifyError);
          }

          return [];
        }

        const { items } = response.data.data;
        if (items && items.length > 0) {
          const transformedNews = items.map((item: any) => this.transformNewsItem(item));
          // 首次运行也需要过滤新闻
          const newNews = await this.filterNewNews(transformedNews);
          if (newNews.length > 0) {
            await fileStorage.saveNews(newNews);
            logger.info(`✅ [AWTMT] 新闻首次运行获取成功，新数据数量: ${newNews.length}`);
          } else {
            logger.info('📰 [AWTMT] 新闻首次运行没有获取到新新闻');
          }
        }
        this.isFirstRun = false;
        return items.map((item: any) => this.transformNewsItem(item));
      }

      // 非首次运行，执行完整的分页获取
      let allNews: NewsItem[] = [];
      let cursor: string | undefined = undefined;
      let hasNewData = true;
      let maxPage = 10;
      let page = 0;

      while (hasNewData && page < maxPage) {
        logger.info(`🔄 [AWTMT] 新闻请求第 ${page} 页`);
        const response = await this.makeRequest(cursor);

        if (
          !response ||
          !response.data ||
          response.data.code !== 20000 ||
          !response.data.data ||
          !response.data.data.items
        ) {
          logger.error('❌ [AWTMT] 获取新闻失败: 响应格式错误');
          break;
        }

        const { items, next_cursor } = response.data.data;
        const transformedNews = items.map((item: any) => this.transformNewsItem(item));

        // 检查是否有新数据
        const newNews = await this.filterNewNews(transformedNews);
        allNews = [...allNews, ...newNews];

        if (newNews.length === 0 || newNews.length < transformedNews.length) {
          logger.info(`📰 [AWTMT] 新闻没有更多新新闻，停止获取`);
          hasNewData = false;
          break;
        }

        cursor = next_cursor || undefined;

        page++;

        // 控制请求间隔
        await new Promise(resolve => setTimeout(resolve, config.newsApi.requestInterval));
      }

      if (hasNewData && page >= maxPage) {
        logger.info(`🔄 [AWTMT] 新闻命中最大页数${maxPage}，停止获取`);
      }

      if (allNews.length > 0) {
        await fileStorage.saveNews(allNews);
        logger.info(`✅ [AWTMT] 新闻本次获取到 ${allNews.length} 条新新闻`);
      } else {
        logger.info('📰 [AWTMT] 新闻本次没有获取到新新闻');
      }

      return allNews;
    } catch (error: any) {
      const errorDetails = logErrorWithDetails('❌ [AWTMT] 新闻获取失败:', error, {
        isFirstRun: this.isFirstRun,
        lastRequestTime: this.lastRequestTime,
      });

      // 发送服务异常通知
      try {
        await notificationService.sendServiceErrorNotification(
          'AwtmtLiveService',
          errorDetails.message || '[AWTMT] 新闻获取失败',
          {
            isFirstRun: this.isFirstRun,
            lastRequestTime: this.lastRequestTime,
          }
        );
      } catch (notifyError) {
        logger.error('[AWTMT] 发送服务异常通知失败:', notifyError);
      }

      return [];
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.makeRequest();
      return response && response.status === 200 && response.data && response.data.code === 20000;
    } catch (error: any) {
      logErrorWithDetails('[AWTMT] 新闻API健康检查失败:', error);
      return false;
    }
  }

  /**
   * 获取服务状态
   */
  getStatus(): any {
    return {
      service: 'AwtmtLiveService',
      source: 'awtmt_live',
      isFirstRun: this.isFirstRun,
      lastRequestTime: this.lastRequestTime,
      minRequestInterval: this.minRequestInterval,
      baseUrl: this.baseUrl,
    };
  }
}

export default new AwtmtLiveService();

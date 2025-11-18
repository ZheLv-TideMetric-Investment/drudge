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
 * 富途新闻服务
 * 专门负责从富途API获取新闻数据
 */
export class FutuLiveService {
  private isFirstRun: boolean = true;
  private lastRequestTime: number = 0;
  private minRequestInterval: number = 2000; // 最小请求间隔 2 秒

  /**
   * 转换富途数据格式为标准NewsItem格式
   */
  private transformNewsItem(item: any): NewsItem {
    return {
      id: item.id.toString(),
      title: item.title || '',
      content: item.content || '',
      source: 'futu_live', // 添加source字段
      time: item.time * 1000, // 转换为毫秒时间戳
      url: item.detailUrl || '',
      author: '',
      category: '',
      summary: item.content ? item.content.substring(0, 200) : '',
      raw: item // 保存原始数据
    };
  }

  /**
   * 过滤新新闻
   */
  private async filterNewNews(news: NewsItem[]): Promise<NewsItem[]> {
    const lastNewsId = await fileStorage.getLatestNewsId('futu_live');
    logger.info(`🔄 [FUTU] 过滤新新闻，最后一条新闻ID: ${lastNewsId}`);
    if (!lastNewsId) {
      // 如果没有最后一条新闻的ID，说明是首次运行，返回所有新闻
      return news;
    }

    // 找到最后一条新闻的位置
    const lastNewsIndex = news.findIndex(item => item.id === lastNewsId);
    logger.info(`🔄 [FUTU] 过滤新新闻，所有新闻id: ${news.map(item => item.id)}`);
    logger.info(`🔄 [FUTU] 过滤新新闻，最后一条新闻索引: ${lastNewsIndex}`);
    if (lastNewsIndex === -1) {
      // 如果找不到最后一条新闻，说明都是新数据
      return news;
    }

    // 返回最后一条新闻之前的所有新闻
    return news.slice(0, lastNewsIndex);
  }

  /**
   * 发起HTTP请求
   */
  private async makeRequest(seqMark?: string): Promise<any> {
    const params: any = {
      pageSize: config.newsApi.pageSize,
      lang: 'zh-cn',
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

      params._t = Date.now();

      if (seqMark) {
        params.seqMark = seqMark;
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

      const response = await axios.get(config.newsApi.url, {
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
      const errorDetails = logErrorWithDetails('请求富途新闻API失败:', error, {
        params,
        seqMark
      });

      // 发送API失败通知
      try {
        await notificationService.sendNewsApiFailureNotification(
          errorDetails.message,
          undefined
        );
      } catch (notifyError) {
        logger.error('发送API失败通知失败:', notifyError);
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
        logger.info('🔄 富途新闻首次运行，获取最新一页新闻');
        const response = await this.makeRequest();

        if (!response || !response.data || !response.data.data || !response.data.data.data) {
          const errorMsg = '获取富途新闻失败: 响应格式错误';
          logger.error(`❌ ${errorMsg}`);

          // 发送API响应格式错误通知
          try {
            await notificationService.sendNewsApiFailureNotification(errorMsg);
          } catch (notifyError) {
            logger.error('发送API响应格式错误通知失败:', notifyError);
          }

          return [];
        }

        const { news } = response.data.data.data;
        if (news && news.length > 0) {
          const transformedNews = news.map((item: any) => this.transformNewsItem(item));
          // 首次运行也需要过滤新闻
          const newNews = await this.filterNewNews(transformedNews);
          if (newNews.length > 0) {
            await fileStorage.saveNews(newNews);
            logger.info(`✅ 富途新闻首次运行获取成功，新数据数量: ${newNews.length}`);
          } else {
            logger.info('📰 富途新闻首次运行没有获取到新新闻');
          }
        }
        this.isFirstRun = false;
        return news ? news.map((item: any) => this.transformNewsItem(item)) : [];
      }

      // 非首次运行，执行完整的瀑布流获取
      let allNews: NewsItem[] = [];
      let seqMark: string | undefined = undefined;
      let hasNewData = true;
      let maxPage = 10;
      let page = 0;

      while (hasNewData && page < maxPage) {
        logger.info(`🔄 富途新闻请求第 ${page} 页`);
        const response = await this.makeRequest(seqMark);

        if (!response || !response.data || !response.data.data || !response.data.data.data) {
          logger.error('❌ 获取富途新闻失败: 响应格式错误');
          break;
        }

        const { news, seqMark: nextSeqMark } = response.data.data.data;
        const transformedNews = news ? news.map((item: any) => this.transformNewsItem(item)) : [];

        // 检查是否有新数据
        const newNews = await this.filterNewNews(transformedNews);
        allNews = [...allNews, ...newNews];

        if (newNews.length === 0 || newNews.length < transformedNews.length) {
          logger.info(`📰 富途新闻没有更多新新闻，停止获取`);
          hasNewData = false;
          break;
        }

        seqMark = nextSeqMark || undefined;

        page++;

        // 控制请求间隔
        await new Promise(resolve => setTimeout(resolve, config.newsApi.requestInterval));
      }

      if (hasNewData && page >= maxPage) {
        logger.info(`🔄 富途新闻命中最大页数${maxPage}，停止获取`);
      }

      if (allNews.length > 0) {
        await fileStorage.saveNews(allNews);
        logger.info(`✅ 富途新闻本次获取到 ${allNews.length} 条新新闻`);
      } else {
        logger.info('📰 富途新闻本次没有获取到新新闻');
      }

      return allNews;
    } catch (error: any) {
      const errorDetails = logErrorWithDetails('❌ 富途新闻获取失败:', error, {
        isFirstRun: this.isFirstRun,
        lastRequestTime: this.lastRequestTime
      });

      // 发送服务异常通知
      try {
        await notificationService.sendServiceErrorNotification(
          'FutuLiveService',
          errorDetails.message || '富途新闻获取失败',
          {
            isFirstRun: this.isFirstRun,
            lastRequestTime: this.lastRequestTime,
          }
        );
      } catch (notifyError) {
        logger.error('发送服务异常通知失败:', notifyError);
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
      return response && response.status === 200;
    } catch (error: any) {
      logErrorWithDetails('富途新闻API健康检查失败:', error);
      return false;
    }
  }

  /**
   * 获取服务状态
   */
  getStatus(): any {
    return {
      service: 'FutuLiveService',
      source: 'futu_live',
      isFirstRun: this.isFirstRun,
      lastRequestTime: this.lastRequestTime,
      minRequestInterval: this.minRequestInterval,
    };
  }
}

export default new FutuLiveService();

const axios = require('axios');
const config = require('../config/config');
const logger = require('../utils/logger');
const storageService = require('./storageService');
const moment = require('moment-timezone');

// 设置默认时区为北京时间
moment.tz.setDefault('Asia/Shanghai');

// 随机生成 User-Agent
function getRandomUserAgent() {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3.1 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
  ];
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

// 随机生成 Referer
function getRandomReferer() {
  const referers = [
    'https://www.google.com/',
    'https://www.bing.com/',
    'https://www.baidu.com/',
    'https://www.sogou.com/',
    'https://www.so.com/',
  ];
  return referers[Math.floor(Math.random() * referers.length)];
}

class NewsService {
  constructor() {
    this.isFirstRun = true;
    this.lastRequestTime = 0;
    this.minRequestInterval = 2000; // 最小请求间隔 2 秒
  }

  async getLastNewsId() {
    const latestNews = await storageService.getLatest();
    return latestNews ? latestNews.id : null;
  }

  async fetchNews() {
    try {
      // 首次运行，获取一页新数据
      if (this.isFirstRun) {
        logger.info('首次运行，获取最新一页新闻');
        const response = await this.makeRequest();

        if (!response || !response.data || !response.data.data || !response.data.data.data) {
          logger.error('获取新闻失败: 响应格式错误');
          return [];
        }

        const { news } = response.data.data.data;
        if (news && news.length > 0) {
          // 首次运行也需要过滤新闻
          const newNews = await this.filterNewNews(news);
          if (newNews.length > 0) {
            await storageService.save(newNews);
            logger.info(`首次运行获取新闻成功，新数据数量: ${newNews.length}`);
          } else {
            logger.info('首次运行没有获取到新新闻');
          }
        }
        this.isFirstRun = false;
        return news;
      }

      // 非首次运行，执行完整的瀑布流获取
      let allNews = [];
      let seqMark = null;
      let hasNewData = true;

      while (hasNewData) {
        const response = await this.makeRequest(seqMark);

        if (!response || !response.data || !response.data.data || !response.data.data.data) {
          logger.error('获取新闻失败: 响应格式错误');
          break;
        }

        const { news, seqMark: nextSeqMark } = response.data.data.data;

        // 检查是否有新数据
        const newNews = await this.filterNewNews(news);
        allNews = [...allNews, ...newNews];

        if (newNews.length < config.newsApi.pageSize) {
          logger.info(`最新的新闻只有${newNews.length}条，停止获取`);
          hasNewData = false;
          break;
        }

        seqMark = nextSeqMark;

        // 控制请求间隔
        await new Promise(resolve => setTimeout(resolve, config.newsApi.requestInterval));
      }

      if (allNews.length > 0) {
        await storageService.save(allNews);
        logger.info(`本次获取到 ${allNews.length} 条新新闻`);
      } else {
        logger.info('本次没有获取到新新闻');
      }

      return allNews;
    } catch (error) {
      logger.error('获取新闻失败:', error);
      return [];
    }
  }

  async makeRequest(seqMark) {
    try {
      // 控制请求频率
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      if (timeSinceLastRequest < this.minRequestInterval) {
        await new Promise(resolve =>
          setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest)
        );
      }

      const params = {
        pageSize: config.newsApi.pageSize,
        _t: Date.now(),
        lang: 'zh-cn',
      };

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
        validateStatus: function (status) {
          return status >= 200 && status < 300; // 只接受 2xx 的状态码
        },
      });

      this.lastRequestTime = Date.now();
      return response;
    } catch (error) {
      logger.error('请求新闻API失败:', error);
      // 如果是网络错误，等待更长时间后重试
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      return null;
    }
  }

  async filterNewNews(news) {
    const lastNewsId = await this.getLastNewsId();

    if (!lastNewsId) {
      // 如果没有最后一条新闻的ID，说明是首次运行，返回所有新闻
      return news;
    }

    // 找到最后一条新闻的位置
    const lastNewsIndex = news.findIndex(item => item.id === lastNewsId);
    if (lastNewsIndex === -1) {
      // 如果找不到最后一条新闻，说明都是新数据
      return news;
    }

    // 返回最后一条新闻之前的所有新闻
    return news.slice(0, lastNewsIndex);
  }

  async getLastHourNews() {
    const oneHourAgo = moment().subtract(1, 'hour');
    const now = moment();
    return await this.getNewsByTimeRange(oneHourAgo, now);
  }

  async getNewsByTimeRange(startTime, endTime) {
    return await storageService.getByTimeRange(startTime, endTime);
  }
}

module.exports = new NewsService();

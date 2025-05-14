const axios = require('axios');
const config = require('../config/config');
const logger = require('../utils/logger');
const storageService = require('./storageService');
const moment = require('moment');

class NewsService {
  constructor() {
    this.isFirstRun = true;
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
        if (newNews.length < config.newsApi.pageSize) {
          logger.info(`最新的新闻只有${newNews.length}条，停止获取`);
          hasNewData = false;
          break;
        }

        allNews = [...allNews, ...newNews];
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
      const params = {
        pageSize: config.newsApi.pageSize,
        _t: Date.now(),
        lang: 'zh-cn',
      };

      if (seqMark) {
        params.seqMark = seqMark;
      }

      const response = await axios.get(config.newsApi.url, { params });
      return response;
    } catch (error) {
      logger.error('请求新闻API失败:', error);
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

  async getNewsByTimeRange(startTime, endTime) {
    return await storageService.getByTimeRange(startTime, endTime);
  }
}

module.exports = new NewsService();

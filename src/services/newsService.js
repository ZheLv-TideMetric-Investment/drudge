const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const config = require('../config/config');
const logger = require('../utils/logger');

class NewsService {
  constructor() {
    this.newsData = [];
    this.lastNewsIds = new Set();
    this.ensureStorageDirectory();
  }

  async ensureStorageDirectory() {
    try {
      await fs.mkdir(config.storage.path, { recursive: true });
    } catch (error) {
      logger.error('创建存储目录失败:', error);
    }
  }

  async fetchNews() {
    try {
      let allNews = [];
      let seqMark = null;
      let hasMore = true;
      let isFirstRequest = true;

      while (hasMore) {
        const response = await this.makeRequest(seqMark);

        if (!response || !response.data || !response.data.data || !response.data.data.data) {
          logger.error('获取新闻失败: 响应格式错误');
          break;
        }

        const { news, seqMark: nextSeqMark, hasMore: nextHasMore } = response.data.data.data;

        // 检查是否有新数据
        const newNews = this.filterNewNews(news);
        if (newNews.length === 0 && !isFirstRequest) {
          logger.info('没有新的新闻数据');
          break;
        }

        allNews = [...allNews, ...newNews];
        seqMark = nextSeqMark;
        hasMore = nextHasMore;
        isFirstRequest = false;

        // 控制请求间隔
        if (hasMore) {
          await new Promise(resolve => setTimeout(resolve, config.newsApi.requestInterval));
        }
      }

      if (allNews.length > 0) {
        await this.saveNews(allNews);
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

  filterNewNews(news) {
    const newNews = news.filter(item => !this.lastNewsIds.has(item.id));
    news.forEach(item => this.lastNewsIds.add(item.id));
    return newNews;
  }

  async saveNews(news) {
    try {
      const timestamp = new Date().toISOString();
      const fileName = `news_${timestamp.replace(/[:.]/g, '-')}.json`;
      const filePath = path.join(config.storage.path, fileName);

      await fs.writeFile(filePath, JSON.stringify(news, null, 2));
      this.newsData.push(...news);
      logger.info(`保存新闻成功: ${fileName}, 数量: ${news.length}`);
    } catch (error) {
      logger.error('保存新闻失败:', error);
    }
  }

  async getLastHourNews() {
    const oneHourAgo = new Date(Date.now() - config.summary.interval);
    return this.newsData.filter(news => new Date(news.time * 1000) > oneHourAgo);
  }

  clearOldNews() {
    const oneHourAgo = new Date(Date.now() - config.summary.interval);
    this.newsData = this.newsData.filter(news => new Date(news.time * 1000) > oneHourAgo);
    // 清理过期的新闻ID
    const oldIds = new Set(this.newsData.map(news => news.id));
    this.lastNewsIds = new Set(Array.from(this.lastNewsIds).filter(id => oldIds.has(id)));
  }
}

module.exports = new NewsService();

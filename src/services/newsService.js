const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const config = require('../config/config');
const logger = require('../utils/logger');

class NewsService {
  constructor() {
    this.newsData = [];
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
      const response = await axios.get(config.newsApi.url, {
        params: {
          pageSize: config.newsApi.pageSize,
          _t: Date.now(),
        },
      });

      if (response.data && response.data.data && response.data.data.data) {
        const news = response.data.data.data.news;
        await this.saveNews(news);
        return news;
      }
      return [];
    } catch (error) {
      logger.error('获取新闻失败:', error);
      return [];
    }
  }

  async saveNews(news) {
    try {
      const timestamp = new Date().toISOString();
      const fileName = `news_${timestamp.replace(/[:.]/g, '-')}.json`;
      const filePath = path.join(config.storage.path, fileName);

      await fs.writeFile(filePath, JSON.stringify(news, null, 2));
      this.newsData.push(...news);
      logger.info(`保存新闻成功: ${fileName}`);
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
  }
}

module.exports = new NewsService();

const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
const moment = require('moment');

class StorageService {
  constructor() {
    this.storagePath = path.join(process.cwd(), 'data', 'news');
    this.ensureStorageDirectory();
  }

  async ensureStorageDirectory() {
    try {
      await fs.mkdir(this.storagePath, { recursive: true });
    } catch (error) {
      logger.error('创建存储目录失败:', error);
    }
  }

  async save(data) {
    try {
      const now = moment();
      const fileName = `news_${now.format('YYYY-MM-DD_HH-mm-ss')}.json`;
      const filePath = path.join(this.storagePath, fileName);

      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      logger.info(`保存数据成功: ${fileName}, 数量: ${data.length}`);
      return fileName;
    } catch (error) {
      logger.error('保存数据失败:', error);
      throw error;
    }
  }

  async getLatest() {
    try {
      const files = await fs.readdir(this.storagePath);
      const newsFiles = files.filter(file => file.startsWith('news_') && file.endsWith('.json'));

      if (newsFiles.length === 0) {
        return null;
      }

      newsFiles.sort().reverse();
      const latestFile = newsFiles[0];
      const filePath = path.join(this.storagePath, latestFile);

      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      // 只返回最后一条新闻
      const latestNews = data[0];
      logger.info(`读取最新新闻: ${latestFile}, ID: ${latestNews.id}`);
      return latestNews;
    } catch (error) {
      logger.error('读取最新新闻失败:', error);
      return null;
    }
  }

  async getByTimeRange(startTime, endTime) {
    try {
      const files = await fs.readdir(this.storagePath);
      const newsFiles = files.filter(file => file.startsWith('news_') && file.endsWith('.json'));

      // 只处理时间范围内的文件
      const relevantFiles = newsFiles.filter(file => {
        // 从文件名中提取时间戳
        const timestamp = file.replace('news_', '').replace('.json', '');
        const fileTime = moment(timestamp, 'YYYY-MM-DD_HH-mm-ss');
        return fileTime.isSameOrAfter(startTime) && fileTime.isBefore(endTime);
      });

      if (relevantFiles.length === 0) {
        logger.info('指定时间范围内没有数据文件');
        return [];
      }

      let allData = [];
      for (const file of relevantFiles) {
        const filePath = path.join(this.storagePath, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const data = JSON.parse(content);

        const filteredData = data.filter(item => {
          const itemTime = moment(item.time * 1000);
          return itemTime.isAfter(startTime) && itemTime.isBefore(endTime);
        });

        allData = [...allData, ...filteredData];
      }

      // 按时间排序
      allData.sort((a, b) => b.time - a.time);
      logger.info(
        `查询时间范围数据: ${moment(startTime).format('YYYY-MM-DD HH:mm:ss')} 到 ${moment(endTime).format('YYYY-MM-DD HH:mm:ss')}, 数量: ${allData.length}`
      );
      return allData;
    } catch (error) {
      logger.error('按时间范围读取数据失败:', error);
      return [];
    }
  }
}

module.exports = new StorageService();

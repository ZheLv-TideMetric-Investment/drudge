const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
const moment = require('moment-timezone');

// 设置默认时区为北京时间
moment.tz.setDefault('Asia/Shanghai');

class StorageService {
  constructor() {
    this.basePath = path.join(process.cwd(), 'data', 'news');
    this.ensureStorageDirectory();
  }

  async ensureStorageDirectory() {
    try {
      await fs.mkdir(this.basePath, { recursive: true });
    } catch (error) {
      logger.error('创建存储目录失败:', error);
    }
  }

  // 获取新闻存储的完整路径
  getNewsPath(timestamp) {
    const date = moment(timestamp);
    const year = date.format('YYYY');
    const month = date.format('MM');
    const day = date.format('DD');
    return path.join(this.basePath, year, month, day);
  }

  // 确保目录存在
  async ensureDirectoryExists(dirPath) {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      logger.error(`创建目录失败: ${dirPath}`, error);
    }
  }

  async save(data) {
    try {
      const now = moment();
      const fileName = `news_${now.format('YYYY-MM-DD_HH-mm-ss')}.json`;
      const dirPath = this.getNewsPath(now);
      
      await this.ensureDirectoryExists(dirPath);
      const filePath = path.join(dirPath, fileName);

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
      // 获取所有年份目录
      const years = await fs.readdir(this.basePath);
      if (years.length === 0) return null;

      // 按年份倒序排序
      years.sort().reverse();

      // 遍历年份目录
      for (const year of years) {
        const yearPath = path.join(this.basePath, year);
        const months = await fs.readdir(yearPath);
        months.sort().reverse();

        // 遍历月份目录
        for (const month of months) {
          const monthPath = path.join(yearPath, month);
          const days = await fs.readdir(monthPath);
          days.sort().reverse();

          // 遍历日期目录
          for (const day of days) {
            const dayPath = path.join(monthPath, day);
            const files = await fs.readdir(dayPath);
            const newsFiles = files.filter(file => file.startsWith('news_') && file.endsWith('.json'));

            if (newsFiles.length > 0) {
              // 找到最新的文件
              newsFiles.sort().reverse();
              const latestFile = newsFiles[0];
              const filePath = path.join(dayPath, latestFile);

              const content = await fs.readFile(filePath, 'utf-8');
              const data = JSON.parse(content);

              // 只返回最后一条新闻
              const latestNews = data[0];
              logger.info(`读取最新新闻: ${latestFile}, ID: ${latestNews.id}`);
              return latestNews;
            }
          }
        }
      }

      return null;
    } catch (error) {
      logger.error('读取最新新闻失败:', error);
      return null;
    }
  }

  async getByTimeRange(startTime, endTime) {
    try {
      const start = moment(startTime);
      const end = moment(endTime);
      
      // 获取时间范围内的所有日期
      const dates = [];
      let current = start.clone();
      while (current.isSameOrBefore(end, 'day')) {
        dates.push(current.clone());
        current.add(1, 'day');
      }

      let allData = [];
      // 遍历每个日期
      for (const date of dates) {
        const dirPath = this.getNewsPath(date);
        try {
          const files = await fs.readdir(dirPath);
          const newsFiles = files.filter(file => file.startsWith('news_') && file.endsWith('.json'));

          // 只处理时间范围内的文件
          const relevantFiles = newsFiles.filter(file => {
            const timestamp = file.replace('news_', '').replace('.json', '');
            const fileTime = moment(timestamp, 'YYYY-MM-DD_HH-mm-ss');
            return fileTime.isSameOrAfter(startTime) && fileTime.isSameOrBefore(endTime);
          });

          // 读取相关文件
          for (const file of relevantFiles) {
            const filePath = path.join(dirPath, file);
            const content = await fs.readFile(filePath, 'utf-8');
            const data = JSON.parse(content);

            const filteredData = data.filter(item => {
              const itemTime = moment(item.time * 1000);
              return itemTime.isSameOrAfter(startTime) && itemTime.isSameOrBefore(endTime);
            });

            allData = [...allData, ...filteredData];
          }
        } catch (error) {
          // 如果目录不存在，继续下一个日期
          if (error.code === 'ENOENT') continue;
          throw error;
        }
      }

      // 按时间排序
      allData.sort((a, b) => b.time - a.time);
      logger.info(
        `查询时间范围数据: ${start.format('YYYY-MM-DD HH:mm:ss')} 到 ${end.format('YYYY-MM-DD HH:mm:ss')}, 数量: ${allData.length}`
      );
      return allData;
    } catch (error) {
      logger.error('按时间范围读取数据失败:', error);
      return [];
    }
  }
}

module.exports = new StorageService();

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';
import moment from 'moment-timezone';
import ohnService from './ohnService.js';
import aiService from './aiService.js';
import webhookService from './webhookService.js';

// 设置默认时区为北京时间
moment.tz.setDefault('Asia/Shanghai');

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class HNSService {
  constructor() {
    this.basePath = path.join(process.cwd(), 'data', 'hns');
    this.ensureStorageDirectory();
  }

  async ensureStorageDirectory() {
    try {
      await fs.mkdir(this.basePath, { recursive: true });
    } catch (error) {
      logger.error('创建HNS存储目录失败:', error);
    }
  }

  // 获取HNS存储路径
  getHNSPath(timestamp) {
    const date = moment(timestamp);
    const dateFolder = date.format('YYYYMMDD');
    return path.join(this.basePath, dateFolder);
  }

  // 确保目录存在
  async ensureDirectoryExists(dirPath) {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      logger.error(`创建目录失败: ${dirPath}`, error);
    }
  }

  // 执行小时新闻摘要
  async runHourSummary(timestamp = null) {
    try {
      const now = timestamp ? moment(timestamp) : moment();
      const lastHourStart = now.clone().subtract(1, 'hour').startOf('hour');
      const lastHourEnd = now.clone().startOf('hour');

      logger.info(
        `开始生成HNS: ${lastHourStart.format('YYYY-MM-DD HH:mm:ss')} 到 ${lastHourEnd.format('YYYY-MM-DD HH:mm:ss')}`
      );

      // 获取上一小时的OHN数据
      const ohnData = await ohnService.getOHNByTimeRange(lastHourStart, lastHourEnd);

      if (ohnData.length === 0) {
        logger.info('上一小时没有OHN数据');
        return null;
      }

      // 使用AI服务生成摘要
      const summary = await aiService.summarizeNews(ohnData);

      // 构建HNS数据
      const hnsData = {
        timeRange: {
          start: lastHourStart.toISOString(),
          end: lastHourEnd.toISOString(),
        },
        sourceCount: ohnData.length,
        summary: summary,
        generatedAt: now.toISOString(),
      };

      // 保存HNS数据
      await this.saveHNS(lastHourStart, hnsData);

      // 如果在工作时间(11-22点)，推送钉钉
      if (now.hour() >= 11 && now.hour() <= 22) {
        await this.pushToDingTalk(lastHourStart, lastHourEnd, summary);
      }

      logger.info(`HNS生成完成，源数据量: ${ohnData.length}`);
      return hnsData;
    } catch (error) {
      logger.error('HNS生成失败:', error);
      throw error;
    }
  }

  // 保存HNS数据
  async saveHNS(timestamp, data) {
    try {
      const dirPath = this.getHNSPath(timestamp);
      await this.ensureDirectoryExists(dirPath);

      const fileName = `${timestamp.format('HH')}.json`;
      const filePath = path.join(dirPath, fileName);

      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      logger.info(`保存HNS数据成功: ${fileName}`);
    } catch (error) {
      logger.error('保存HNS数据失败:', error);
      throw error;
    }
  }

  // 推送到钉钉
  async pushToDingTalk(startTime, endTime, summary) {
    try {
      await webhookService.sendMessage(startTime, endTime, summary);
      logger.info('HNS钉钉推送成功');
    } catch (error) {
      logger.error('HNS钉钉推送失败:', error);
    }
  }

  // 获取指定时间范围的HNS数据
  async getHNSByTimeRange(startTime, endTime) {
    try {
      const start = moment(startTime);
      const end = moment(endTime);

      // 获取时间范围内的所有日期
      const dates = [];
      let current = start.clone().startOf('day');
      while (current.isSameOrBefore(end, 'day')) {
        dates.push(current.clone());
        current.add(1, 'day');
      }

      let allData = [];

      // 遍历每个日期
      for (const date of dates) {
        const dirPath = this.getHNSPath(date);
        try {
          const files = await fs.readdir(dirPath);
          const hnsFiles = files.filter(file => file.endsWith('.json'));

          // 读取相关文件
          for (const file of hnsFiles) {
            const hour = parseInt(file.replace('.json', ''));
            const fileTime = date.clone().hour(hour);

            // 检查是否在时间范围内
            if (fileTime.isSameOrAfter(start) && fileTime.isSameOrBefore(end)) {
              const filePath = path.join(dirPath, file);
              const content = await fs.readFile(filePath, 'utf-8');
              const data = JSON.parse(content);
              allData.push({
                ...data,
                hour: hour,
                date: date.format('YYYYMMDD'),
              });
            }
          }
        } catch (error) {
          // 如果目录不存在，继续下一个日期
          if (error.code === 'ENOENT') continue;
          throw error;
        }
      }

      // 按时间排序
      allData.sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt));
      logger.info(
        `查询HNS时间范围数据: ${start.format('YYYY-MM-DD HH:mm:ss')} 到 ${end.format('YYYY-MM-DD HH:mm:ss')}, 数量: ${allData.length}`
      );
      return allData;
    } catch (error) {
      logger.error('获取HNS时间范围数据失败:', error);
      return [];
    }
  }
}

export default new HNSService();

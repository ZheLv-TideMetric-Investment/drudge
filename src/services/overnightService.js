import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';
import moment from 'moment-timezone';
import ohnService from './ohnService.js';
import aiService from './aiService.js';
import webhookService from './webhookService.js';

moment.tz.setDefault('Asia/Shanghai');

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class OvernightService {
  constructor() {
    this.basePath = path.join(process.cwd(), 'data', 'overnight');
    this.ensureStorageDirectory();
  }

  async ensureStorageDirectory() {
    try {
      await fs.mkdir(this.basePath, { recursive: true });
    } catch (error) {
      logger.error('创建夜间汇总存储目录失败:', error);
    }
  }

  async ensureDirectoryExists(dirPath) {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      logger.error(`创建目录失败: ${dirPath}`, error);
    }
  }

  async runOvernightSummary(timestamp = null) {
    try {
      const now = timestamp ? moment(timestamp) : moment();
      const today = now.clone().startOf('day');
      const yesterday = today.clone().subtract(1, 'day');

      const startTime = yesterday.clone().hour(22).minute(0).second(0);
      const endTime = today.clone().hour(10).minute(0).second(0);

      logger.info(
        `开始生成夜间汇总: ${startTime.format('YYYY-MM-DD HH:mm:ss')} 到 ${endTime.format('YYYY-MM-DD HH:mm:ss')}`
      );

      const overnightData = await ohnService.getOHNByTimeRange(startTime, endTime);

      if (overnightData.length === 0) {
        logger.info('夜间时段没有新闻数据');
        return null;
      }

      const summary = await aiService.summarizeNews(overnightData);

      const overnightSummary = {
        timeRange: {
          start: startTime.toISOString(),
          end: endTime.toISOString(),
        },
        sourceCount: overnightData.length,
        summary: summary,
        generatedAt: now.toISOString(),
        type: 'overnight',
      };

      await this.saveOvernightSummary(yesterday, overnightSummary);
      await this.pushToDingTalk(startTime, endTime, summary);

      logger.info(`夜间汇总生成完成，源数据量: ${overnightData.length}`);
      return overnightSummary;
    } catch (error) {
      logger.error('夜间汇总生成失败:', error);
      throw error;
    }
  }

  async saveOvernightSummary(date, data) {
    try {
      await this.ensureDirectoryExists(this.basePath);
      const fileName = `${date.format('YYYYMMDD')}.json`;
      const filePath = path.join(this.basePath, fileName);

      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
      logger.info(`保存夜间汇总数据成功: ${fileName}`);
    } catch (error) {
      logger.error('保存夜间汇总数据失败:', error);
      throw error;
    }
  }

  async pushToDingTalk(startTime, endTime, summary) {
    try {
      await webhookService.sendMessage(startTime, endTime, summary);
      logger.info('夜间汇总钉钉推送成功');
    } catch (error) {
      logger.error('夜间汇总钉钉推送失败:', error);
    }
  }
}

export default new OvernightService();

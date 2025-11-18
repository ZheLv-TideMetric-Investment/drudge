import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';
import { formatForFilename, parseTime, startOfToday, daysAgo } from '../utils/time';
import config from '../config/config';
import notificationService from '../services/NotificationService';
import { buildErrorDetails, logErrorWithDetails } from '../utils/error';

/**
 * 新闻数据接口
 */
export interface NewsItem {
  id: string;
  title: string;
  content?: string;
  source: string;
  time: number;
  url?: string;
  author?: string;
  category?: string;
  summary?: string;
  [key: string]: any;
}

/**
 * 文件存储服务
 * 负责新闻数据的本地文件存储和管理
 */
export class FileStorage {
  private dataPath: string;
  private defaultSource: string = 'mixed';

  constructor() {
    const storagePath = config.storage.path || '../../data';
    this.dataPath = path.join(storagePath, 'news');
    this.ensureDataPath();
  }

  /**
   * 确保数据目录存在
   */
  private async ensureDataPath(): Promise<void> {
    try {
      await fs.promises.mkdir(this.dataPath, { recursive: true });
    } catch (error: any) {
      logErrorWithDetails('创建数据目录失败:', error, { dataPath: this.dataPath });
    }
  }

  /**
   * 保存新闻到文件
   */
  async saveNews(news: NewsItem[]): Promise<string> {
    // 按源分组保存
    const groupedNews: { [source: string]: NewsItem[] } = {};
    
    news.forEach(item => {
      const source = item.source || this.defaultSource;
      if (!groupedNews[source]) {
        groupedNews[source] = [];
      }
      groupedNews[source].push(item);
    });
    
    const savedFiles: string[] = [];
    
    for (const [source, sourceNews] of Object.entries(groupedNews)) {
      const timestamp = formatForFilename();
      const filename = `${source}_${timestamp}.json`;
      const filePath = path.join(this.dataPath, filename);
      
      try {
        await fs.promises.writeFile(filePath, JSON.stringify(sourceNews, null, 2));
        logger.info(`✅ 保存新闻到文件: ${filename} (${sourceNews.length}条)`);
        savedFiles.push(filename);
      } catch (error: any) {
        const errorDetails = logErrorWithDetails(`❌ 保存新闻文件失败: ${filename}`, error, {
          source,
          count: sourceNews.length,
          filePath
        });
        
        // 发送文件保存失败通知
        try {
          await notificationService.sendFileSaveFailureNotification(
            filename,
            sourceNews.length,
            errorDetails.message || '文件写入失败'
          );
        } catch (notifyError) {
          logger.error('发送文件保存失败通知失败:', notifyError);
        }
        
        throw error; // 重新抛出错误，让调用方知道保存失败
      }
    }
    
    return savedFiles.join(', ');
  }

  /**
   * 获取最新新闻的ID (按源过滤)
   */
  async getLatestNewsId(source?: string): Promise<string | null> {
    try {
      const files = await this.getNewsFiles(source);
      if (files.length === 0) return null;

      const latestFile = files[0];
      const filePath = path.join(this.dataPath, latestFile);
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const news: NewsItem[] = JSON.parse(content);
      
      return news.length > 0 ? news[0].id : null;
    } catch (error: any) {
      const errorDetails = buildErrorDetails(error, { source });
      logger.warn(`获取最新新闻ID失败 (source: ${source}):`, errorDetails);
      return null;
    }
  }

  /**
   * 获取所有新闻文件列表（按时间排序）
   */
  private async getNewsFiles(source?: string): Promise<string[]> {
    const files = await fs.promises.readdir(this.dataPath);
    return files
      .filter(file => {
        if (!file.endsWith('.json')) return false;
        if (source) {
          return file.startsWith(`${source}_`);
        }
        // 如果没有指定源，返回所有新闻文件
        return file.includes('_') && file.endsWith('.json');
      })
      .sort((a, b) => b.localeCompare(a)); // 按文件名降序排序（最新的在前面）
  }

  /**
   * 获取所有新闻
   */
  async getAllNews(): Promise<NewsItem[]> {
    try {
      const files = await this.getNewsFiles();
      const allNews: NewsItem[] = [];
      
      for (const file of files) {
        try {
          const filePath = path.join(this.dataPath, file);
          const content = await fs.promises.readFile(filePath, 'utf-8');
          const news: NewsItem[] = JSON.parse(content);
          allNews.push(...news);
        } catch (error: any) {
          const errorDetails = buildErrorDetails(error, { file });
          logger.warn(`读取文件失败: ${file}`, errorDetails);
        }
      }
      
      return allNews.sort((a, b) => b.time - a.time);
    } catch (error: any) {
      logErrorWithDetails('获取所有新闻失败:', error);
      return [];
    }
  }

  /**
   * 按数量获取新闻
   */
  async getNewsByLimit(limit: number): Promise<NewsItem[]> {
    const allNews = await this.getAllNews();
    return allNews.slice(0, limit);
  }

  /**
   * 按时间范围获取新闻
   */
  async getNewsByTimeRange(startTime: any, endTime: any): Promise<NewsItem[]> {
    try {
      const files = await this.getNewsFiles();
      const allNews: NewsItem[] = [];
      
      for (const file of files) {
        try {
          const filePath = path.join(this.dataPath, file);
          const content = await fs.promises.readFile(filePath, 'utf-8');
          const news: NewsItem[] = JSON.parse(content);
          
          const filteredNews = news.filter(item => {
            const newsTime = parseTime(item.time * 1000);
            return newsTime.isAfter(startTime) && newsTime.isBefore(endTime);
          });
          
          allNews.push(...filteredNews);
        } catch (error: any) {
          const errorDetails = buildErrorDetails(error, { file });
          logger.warn(`读取文件失败: ${file}`, errorDetails);
        }
      }
      
      return allNews.sort((a, b) => b.time - a.time);
    } catch (error: any) {
      logger.error('按时间范围获取新闻失败:', error);
      return [];
    }
  }

  /**
   * 获取新闻统计信息
   */
  async getNewsStats(): Promise<any> {
    try {
      const files = await this.getNewsFiles(); // 获取所有源的文件
      let totalCount = 0;
      let todayCount = 0;
      let recentCount = 0;
      const sourceStats: { [source: string]: number } = {};
      
      const today = startOfToday();
      const threeDaysAgo = daysAgo(3);
      
      for (const file of files) {
        try {
          const filePath = path.join(this.dataPath, file);
          const content = await fs.promises.readFile(filePath, 'utf-8');
          const news: NewsItem[] = JSON.parse(content);
          
          totalCount += news.length;
          
          // 按源统计
          news.forEach(item => {
            const source = item.source || 'unknown';
            sourceStats[source] = (sourceStats[source] || 0) + 1;
          });
          
          // 统计今天的新闻
          const todayNews = news.filter(item => {
            const newsTime = parseTime(item.time * 1000);
            return newsTime.isAfter(today);
          });
          todayCount += todayNews.length;
          
          // 统计最近3天的新闻
          const recentNews = news.filter(item => {
            const newsTime = parseTime(item.time * 1000);
            return newsTime.isAfter(threeDaysAgo);
          });
          recentCount += recentNews.length;
          
        } catch (error: any) {
          const errorDetails = buildErrorDetails(error, { file });
          logger.warn(`读取文件失败: ${file}`, errorDetails);
        }
      }
      
      return {
        totalCount,
        todayCount,
        recentCount,
        fileCount: files.length,
        sourceStats,
        sources: Object.keys(sourceStats)
      };
    } catch (error: any) {
      logger.error('获取新闻统计失败:', error);
      return {
        totalCount: 0,
        todayCount: 0,
        recentCount: 0,
        fileCount: 0,
        sourceStats: {},
        sources: []
      };
    }
  }

  /**
   * 清理旧文件
   */
  async cleanOldFiles(days: number = 7): Promise<any> {
    try {
      const files = await this.getNewsFiles(); // 获取所有源的文件
      const cutoffTime = daysAgo(days);
      let deletedCount = 0;
      let remainingCount = 0;
      
      for (const file of files) {
        try {
          const filePath = path.join(this.dataPath, file);
          const stats = await fs.promises.stat(filePath);
          
          const fileTime = parseTime(stats.mtime);
          if (fileTime.isBefore(cutoffTime)) {
            await fs.promises.unlink(filePath);
            deletedCount++;
            logger.info(`🗑️ 删除旧文件: ${file}`);
          } else {
            remainingCount++;
          }
        } catch (error: any) {
          const errorDetails = buildErrorDetails(error, { file });
          logger.warn(`处理文件失败: ${file}`, errorDetails);
        }
      }
      
      return {
        deletedCount,
        remainingCount,
        message: `清理完成: 删除 ${deletedCount} 个文件，保留 ${remainingCount} 个文件`
      };
    } catch (error: any) {
      logErrorWithDetails('清理旧文件失败:', error);
      throw error;
    }
  }
}

export default new FileStorage(); 

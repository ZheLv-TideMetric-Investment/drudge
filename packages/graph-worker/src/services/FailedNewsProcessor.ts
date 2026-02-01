import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';
import { NewsItem } from '../types/index';
import knowledgeGraphService from './KnowledgeGraphService';
import config from '../config/config';

export interface FailedNewsFile {
  newsItem: NewsItem;
  error: {
    message: string;
    stack: string;
    timestamp: string;
    service: string;
  };
  metadata: {
    failedAt: string;
    originalId: string;
    source: string;
    title: string;
  };
}

export interface RetryResult {
  success: boolean;
  newsId: string;
  fileName: string;
  error?: string;
}

export interface RetryStats {
  total: number;
  successful: number;
  failed: number;
  results: RetryResult[];
}

/**
 * 失败新闻处理器
 * 负责扫描失败目录、解析失败文件并重新处理新闻
 */
class FailedNewsProcessor {
  private failedNewsDir = config.dataSource.failedNewsDirectory;

  /**
   * 扫描失败目录，获取所有失败的新闻文件
   */
  async scanFailedFiles(): Promise<string[]> {
    try {
      if (!fs.existsSync(this.failedNewsDir)) {
        logger.warn(`失败新闻目录不存在: ${this.failedNewsDir}`);
        return [];
      }

      const files = fs.readdirSync(this.failedNewsDir);
      const failedFiles = files.filter(
        file => file.startsWith('failed_') && file.endsWith('.json')
      );

      logger.info(`🔍 发现 ${failedFiles.length} 个失败新闻文件`);
      return failedFiles.map(file => path.join(this.failedNewsDir, file));
    } catch (error) {
      logger.error('扫描失败新闻目录时出错:', error);
      return [];
    }
  }

  /**
   * 解析失败新闻文件
   */
  async parseFailedFile(filePath: string): Promise<FailedNewsFile | null> {
    try {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const failedData = JSON.parse(fileContent) as FailedNewsFile;

      // 验证文件格式
      if (!failedData.newsItem || !failedData.error || !failedData.metadata) {
        logger.warn(`❌ 失败文件格式无效: ${path.basename(filePath)}`);
        return null;
      }

      return failedData;
    } catch (error) {
      logger.error(`解析失败文件时出错 ${path.basename(filePath)}:`, error);
      return null;
    }
  }

  /**
   * 重新处理单个失败的新闻
   */
  async reprocessSingleNews(failedData: FailedNewsFile, filePath: string): Promise<RetryResult> {
    const fileName = path.basename(filePath);
    const newsId = failedData.newsItem.id;

    try {
      logger.info(`🔄 重新处理新闻: ${newsId} (${fileName})`);

      // 确保知识图谱服务已初始化
      if (!knowledgeGraphService['initialized']) {
        await knowledgeGraphService.initialize();
      }

      // 重新处理新闻
      const processResult = await knowledgeGraphService.processNews(failedData.newsItem);

      if (processResult.success) {
        // 处理成功，删除失败文件
        await this.deleteFailedFile(filePath);
        logger.info(`✅ 新闻 ${newsId} 重新处理成功，已删除失败文件`);

        return {
          success: true,
          newsId,
          fileName,
        };
      } else {
        logger.warn(`⚠️ 新闻 ${newsId} 重新处理仍然失败: ${processResult.error}`);
        return {
          success: false,
          newsId,
          fileName,
          error: processResult.error || '重新处理失败',
        };
      }
    } catch (error: any) {
      logger.error(`❌ 重新处理新闻 ${newsId} 时出错:`, error);
      return {
        success: false,
        newsId,
        fileName,
        error: error.message || '重新处理异常',
      };
    }
  }

  /**
   * 批量重新处理失败的新闻
   */
  async retryFailedNews(limit?: number): Promise<RetryStats> {
    try {
      logger.info('🔄 开始批量重新处理失败的新闻...');

      const failedFiles = await this.scanFailedFiles();

      if (failedFiles.length === 0) {
        logger.info('✅ 没有找到失败的新闻文件');
        return {
          total: 0,
          successful: 0,
          failed: 0,
          results: [],
        };
      }

      // 如果设置了限制，只处理前N个文件
      const filesToProcess = limit ? failedFiles.slice(0, limit) : failedFiles;

      logger.info(`📊 准备重新处理 ${filesToProcess.length} 个失败新闻文件`);

      const results: RetryResult[] = [];
      let successful = 0;
      let failed = 0;

      // 逐个处理失败文件（避免并发过高）
      for (const filePath of filesToProcess) {
        const failedData = await this.parseFailedFile(filePath);

        if (!failedData) {
          const fileName = path.basename(filePath);
          results.push({
            success: false,
            newsId: 'unknown',
            fileName,
            error: '文件解析失败',
          });
          failed++;
          continue;
        }

        const retryResult = await this.reprocessSingleNews(failedData, filePath);
        results.push(retryResult);

        if (retryResult.success) {
          successful++;
        } else {
          failed++;
        }

        // 添加小延迟，避免系统负载过高
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      logger.info(`✅ 批量重新处理完成: 成功 ${successful} 个，失败 ${failed} 个`);

      return {
        total: filesToProcess.length,
        successful,
        failed,
        results,
      };
    } catch (error) {
      logger.error('批量重新处理失败新闻时出错:', error);
      throw error;
    }
  }

  /**
   * 根据新闻ID重新处理失败的新闻
   */
  async retryFailedNewsByIds(newsIds: string[]): Promise<RetryStats> {
    try {
      logger.info(`🔄 根据ID重新处理失败的新闻: ${newsIds.join(', ')}`);

      const failedFiles = await this.scanFailedFiles();
      const results: RetryResult[] = [];
      let successful = 0;
      let failed = 0;

      for (const newsId of newsIds) {
        // 查找对应的失败文件
        const matchingFile = failedFiles.find(filePath => {
          const fileName = path.basename(filePath);
          return fileName.includes(`failed_${newsId}_`);
        });

        if (!matchingFile) {
          logger.warn(`⚠️ 未找到新闻ID ${newsId} 对应的失败文件`);
          results.push({
            success: false,
            newsId,
            fileName: 'not_found',
            error: '未找到对应的失败文件',
          });
          failed++;
          continue;
        }

        const failedData = await this.parseFailedFile(matchingFile);

        if (!failedData) {
          results.push({
            success: false,
            newsId,
            fileName: path.basename(matchingFile),
            error: '文件解析失败',
          });
          failed++;
          continue;
        }

        const retryResult = await this.reprocessSingleNews(failedData, matchingFile);
        results.push(retryResult);

        if (retryResult.success) {
          successful++;
        } else {
          failed++;
        }
      }

      logger.info(`✅ 按ID重新处理完成: 成功 ${successful} 个，失败 ${failed} 个`);

      return {
        total: newsIds.length,
        successful,
        failed,
        results,
      };
    } catch (error) {
      logger.error('按ID重新处理失败新闻时出错:', error);
      throw error;
    }
  }

  /**
   * 列出失败的新闻
   */
  async listFailedNews(limit: number = 50): Promise<FailedNewsFile[]> {
    try {
      const failedFiles = await this.scanFailedFiles();

      if (failedFiles.length === 0) {
        return [];
      }

      // 按文件修改时间排序（最新的在前）
      const sortedFiles = failedFiles
        .map(filePath => ({
          filePath,
          mtime: fs.statSync(filePath).mtime,
        }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime())
        .slice(0, limit)
        .map(item => item.filePath);

      const failedNewsList: FailedNewsFile[] = [];

      for (const filePath of sortedFiles) {
        const failedData = await this.parseFailedFile(filePath);
        if (failedData) {
          failedNewsList.push(failedData);
        }
      }

      return failedNewsList;
    } catch (error) {
      logger.error('列出失败新闻时出错:', error);
      return [];
    }
  }

  /**
   * 删除失败文件
   */
  private async deleteFailedFile(filePath: string): Promise<void> {
    try {
      fs.unlinkSync(filePath);
      logger.debug(`🗑️ 已删除失败文件: ${path.basename(filePath)}`);
    } catch (error) {
      logger.error(`删除失败文件时出错 ${path.basename(filePath)}:`, error);
    }
  }

  /**
   * 清理旧的失败文件（超过指定天数）
   */
  async cleanOldFailedFiles(daysOld: number = 30): Promise<number> {
    try {
      const failedFiles = await this.scanFailedFiles();
      const cutoffTime = Date.now() - daysOld * 24 * 60 * 60 * 1000;
      let deletedCount = 0;

      for (const filePath of failedFiles) {
        const stats = fs.statSync(filePath);
        if (stats.mtime.getTime() < cutoffTime) {
          await this.deleteFailedFile(filePath);
          deletedCount++;
        }
      }

      logger.info(`🧹 清理完成: 删除了 ${deletedCount} 个超过 ${daysOld} 天的失败文件`);
      return deletedCount;
    } catch (error) {
      logger.error('清理旧失败文件时出错:', error);
      return 0;
    }
  }
}

export default new FailedNewsProcessor();

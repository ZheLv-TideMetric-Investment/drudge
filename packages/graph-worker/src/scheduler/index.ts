import * as cron from 'node-cron';
import { BEIJING_TIMEZONE } from '@drudge/common';
import config from '../config/config';
import { logger } from '../utils/logger';
import { getCurrentTime } from '../utils/timeUtils';

/**
 * 调度器服务
 * 负责定时扫描新闻文件并进行图谱化处理
 */
export class SchedulerService {
  private initialized: boolean = false;
  private tasks: Map<string, any> = new Map();
  private isProcessing: boolean = false;

  /**
   * 初始化调度器
   */
  async initialize(): Promise<void> {
    try {
      logger.info('⏰ 正在初始化调度器服务...');
      this.initialized = true;
      logger.info('✅ 调度器服务初始化完成');
    } catch (error) {
      logger.error('❌ 调度器服务初始化失败:', error);
      throw error;
    }
  }

  /**
   * 启动所有定时任务
   */
  start(): void {
    this.startNewsProcessingTask();
    logger.info('📅 定时任务调度器已启动');
  }

  /**
   * 停止所有定时任务
   */
  stop(): void {
    this.tasks.forEach((task, name) => {
      task.stop();
      logger.info(`⏹️ 停止定时任务: ${name}`);
    });
    this.tasks.clear();
    logger.info('📅 定时任务调度器已停止');
  }

  /**
   * 启动新闻图谱化定时任务
   * 每1分钟扫描一次文件
   */
  private startNewsProcessingTask(): void {
    const newsTask = cron.schedule(
      '* * * * *',
      async () => {
        logger.info('⏰ 定时任务：开始扫描新闻文件');
        const startTime = Date.now();

        try {
          const result = await this.scanAndProcessNews();

          const duration = Date.now() - startTime;

          if (result.success) {
            if (result.skipped) {
              logger.warn(`⏭️ 定时任务：${result.message}，耗时${duration}ms`);
            } else if (result.processed > 0) {
              logger.info(
                `✅ 定时任务：图谱化完成，处理${result.processed}个文件，耗时${duration}ms`
              );
            } else {
              logger.debug(`✅ 定时任务：无新文件需要处理，耗时${duration}ms`);
            }
          } else {
            logger.error(`❌ 定时任务：文件扫描失败 - ${result.error}`);
          }
        } catch (error: any) {
          const duration = Date.now() - startTime;
          logger.error(`❌ 定时任务：文件扫描异常，耗时${duration}ms`, error);
        }
      },
      {
        timezone: BEIJING_TIMEZONE,
      }
    );

    this.tasks.set('news-processing', newsTask);
    newsTask.start();

    logger.info('🔄 启动新闻图谱化定时任务 (每1分钟扫描一次)');
  }

  /**
   * 扫描并处理新闻文件
   */
  private async scanAndProcessNews(): Promise<any> {
    if (this.isProcessing) {
      logger.warn('⏭️ 上一轮新闻图谱化仍在运行，跳过本轮扫描');
      return {
        success: true,
        processed: 0,
        skipped: true,
        message: '上一轮扫描仍在运行',
      };
    }

    this.isProcessing = true;

    try {
      // 动态导入避免循环依赖
      const { scanUnprocessedFiles } = await import('../services/FileScanner');
      const { processNewsFilesInParallel } = await import('../services/NewsProcessor');

      // 扫描未处理的文件
      const unprocessedFiles = await scanUnprocessedFiles();

      if (unprocessedFiles.length === 0) {
        return {
          success: true,
          processed: 0,
          message: '没有需要处理的新文件',
        };
      }

      const maxFilesPerScan = config.processing.maxFilesPerScan;
      const filesToProcess = unprocessedFiles.slice(0, maxFilesPerScan);
      const remainingFiles = unprocessedFiles.length - filesToProcess.length;

      logger.info(
        `📄 发现 ${unprocessedFiles.length} 个未处理的新闻文件，本轮处理 ${filesToProcess.length} 个`
      );

      if (remainingFiles > 0) {
        logger.warn(`⏳ 仍有 ${remainingFiles} 个文件留待后续扫描处理`);
      }

      // 并行处理本轮文件
      const results = await processNewsFilesInParallel(filesToProcess);

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      return {
        success: true,
        processed: successful,
        failed,
        total: filesToProcess.length,
        remaining: remainingFiles,
        message: `成功处理 ${successful} 个文件${failed > 0 ? `，失败 ${failed} 个` : ''}`,
      };
    } catch (error: any) {
      logger.error('扫描处理新闻文件失败:', error);
      return {
        success: false,
        error: error.message,
      };
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 手动触发扫描处理
   */
  async triggerManualScan(): Promise<any> {
    try {
      logger.info('🔄 手动触发新闻文件扫描处理...');
      return await this.scanAndProcessNews();
    } catch (error: any) {
      logger.error('手动触发扫描失败:', error);
      throw error;
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<any> {
    try {
      return {
        status: 'healthy',
        service: 'SchedulerService',
        timestamp: getCurrentTime(),
        initialized: this.initialized,
        activeTasks: this.tasks.size,
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        service: 'SchedulerService',
        timestamp: getCurrentTime(),
        error: error.message,
      };
    }
  }

  /**
   * 获取服务信息
   */
  getServiceInfo(): any {
    return {
      version: '1.0',
      description: '调度器服务，负责定时扫描新闻文件并进行图谱化处理',
      initialized: this.initialized,
      activeTasks: this.tasks.size,
      mainTask: '每分钟扫描新闻文件并进行图谱化处理',
    };
  }

  /**
   * 关闭调度器
   */
  async close(): Promise<void> {
    try {
      logger.info('⏰ 正在关闭调度器服务...');
      this.stop();
      this.initialized = false;
      logger.info('✅ 调度器服务已关闭');
    } catch (error) {
      logger.error('❌ 关闭调度器服务失败:', error);
      throw error;
    }
  }
}

export default new SchedulerService();

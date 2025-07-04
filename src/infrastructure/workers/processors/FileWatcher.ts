// @ts-nocheck
import fs from 'fs';
import logger from '../../../shared/utils/logger';
import config from '../../../shared/config/config';

/**
 * 文件监听器
 * 负责监听文件变化并触发处理
 */
export class FileWatcher {
  private fileWatcher: any = null;
  private processInterval: any = null;
  private onFileChange: () => void;

  constructor(onFileChange: () => void) {
    this.onFileChange = onFileChange;
  }

  /**
   * 启动文件监听
   */
  startFileWatcher(): void {
    const dataPath = config.storage?.path || './data';
    
    if (!fs.existsSync(dataPath)) {
      logger.warn(`数据目录不存在: ${dataPath}`);
      return;
    }

    this.fileWatcher = fs.watch(dataPath, (eventType, filename) => {
      if (eventType === 'rename' && filename && filename.startsWith('news_')) {
        logger.info(`检测到新文件: ${filename}，准备处理新闻`);
        // 延迟一点等文件写入完成
        setTimeout(() => {
          this.onFileChange();
        }, 1000);
      }
    });

    logger.info(`文件监听已启动，监听目录: ${dataPath}`);
  }

  /**
   * 启动定时检查
   */
  startIntervalCheck(interval: number = 30000): void {
    this.processInterval = setInterval(() => {
      this.onFileChange();
    }, interval);

    logger.info(`定时检查已启动，检查间隔: ${interval}ms`);
  }

  /**
   * 停止文件监听
   */
  stopFileWatcher(): void {
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = null;
      logger.info('文件监听已停止');
    }
  }

  /**
   * 停止定时检查
   */
  stopIntervalCheck(): void {
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
      logger.info('定时检查已停止');
    }
  }

  /**
   * 停止所有监听
   */
  stopAll(): void {
    this.stopFileWatcher();
    this.stopIntervalCheck();
    logger.info('所有文件监听已停止');
  }

  /**
   * 获取状态
   */
  getStatus(): any {
    return {
      hasFileWatcher: !!this.fileWatcher,
      hasIntervalCheck: !!this.processInterval,
      timestamp: Date.now()
    };
  }
} 
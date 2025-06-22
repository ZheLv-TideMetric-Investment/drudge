import { parentPort } from 'worker_threads';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger.js';
import knowledgeGraphService from '../services/knowledgeGraphService.js';
import newsLevelService from '../services/newsLevelService.js';
import storageService from '../services/storageService.js';
import config from '../config/config.js';

/**
 * 新闻处理工作线程
 * 专门负责持续处理本地存储的未处理新闻，支持文件监听和消息驱动
 */
class NewsProcessorWorker {
  constructor() {
    this.initialized = false;
    this.isProcessing = false;
    this.fileWatcher = null;
    this.processInterval = null;
    this.stats = {
      totalProcessed: 0,
      totalSkipped: 0,
      totalErrors: 0,
      lastProcessTime: null,
      processingTime: 0
    };
  }

  async initialize() {
    try {
      logger.info('新闻处理工作线程开始初始化...');
      
      await knowledgeGraphService.initialize();
      await newsLevelService.initialize();
      
      this.initialized = true;
      logger.info('新闻处理工作线程初始化完成');
    } catch (error) {
      logger.error('新闻处理工作线程初始化失败:', error);
      throw error;
    }
  }

  /**
   * 启动新闻处理
   * 可以通过文件监听或定时检查的方式
   */
  async startProcessing(options = {}) {
    if (!this.initialized) {
      throw new Error('新闻处理工作线程未初始化');
    }

    const { 
      useFileWatcher = true, 
      intervalCheck = true, 
      checkInterval = 30000 // 30秒检查一次
    } = options;

    logger.info('开始启动新闻处理服务...');

    // 1. 启动文件监听（如果启用）
    if (useFileWatcher) {
      this.startFileWatcher();
    }

    // 2. 启动定时检查（如果启用）
    if (intervalCheck) {
      this.startIntervalCheck(checkInterval);
    }

    // 3. 立即执行一次处理
    await this.processUnhandledNews();

    logger.info('新闻处理服务已启动');
  }

  /**
   * 启动文件监听
   */
  startFileWatcher() {
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
          this.processUnhandledNews();
        }, 1000);
      }
    });

    logger.info(`文件监听已启动，监听目录: ${dataPath}`);
  }

  /**
   * 启动定时检查
   */
  startIntervalCheck(interval) {
    this.processInterval = setInterval(() => {
      if (!this.isProcessing) {
        this.processUnhandledNews();
      }
    }, interval);

    logger.info(`定时检查已启动，检查间隔: ${interval}ms`);
  }

  /**
   * 处理未处理的新闻
   */
  async processUnhandledNews() {
    if (this.isProcessing) {
      logger.debug('新闻处理正在进行中，跳过本次处理');
      return;
    }

    this.isProcessing = true;
    const startTime = Date.now();

    try {
      logger.info('开始检查和处理未处理的新闻...');

      // 1. 获取所有本地存储的新闻
      const allNews = await storageService.getAll(1000); // 限制最多1000条避免内存过载
      
      if (allNews.length === 0) {
        logger.debug('没有找到本地存储的新闻');
        return;
      }

      // 2. 过滤出未处理的新闻
      const newsIds = allNews.map(item => item.id);
      const unprocessedIds = await knowledgeGraphService.getUnprocessedNewsIds(newsIds);
      const unprocessedNews = allNews.filter(item => unprocessedIds.includes(item.id));

      if (unprocessedNews.length === 0) {
        logger.info(`所有${allNews.length}条新闻都已处理过`);
        return;
      }

      logger.info(`发现${unprocessedNews.length}条未处理的新闻（总计${allNews.length}条）`);

      // 3. 处理新闻
      const results = await this.batchProcessNews(unprocessedNews);

      // 4. 统计结果
      const processedCount = results.filter(r => r.success && !r.skipped).length;
      const skippedCount = results.filter(r => r.skipped).length;
      const errorCount = results.filter(r => !r.success).length;
      const highLevelCount = results.filter(r => r.newsLevel === 'Level 1' || r.newsLevel === 'Level 2').length;

      // 5. 更新统计信息
      this.stats.totalProcessed += processedCount;
      this.stats.totalSkipped += skippedCount;
      this.stats.totalErrors += errorCount;
      this.stats.lastProcessTime = Date.now();
      this.stats.processingTime = Date.now() - startTime;

      logger.info(
        `新闻处理完成：处理${processedCount}条，跳过${skippedCount}条，错误${errorCount}条，` +
        `发现${highLevelCount}条高级别新闻，耗时${this.stats.processingTime}ms`
      );

      // 6. 通知主线程处理结果
      this.notifyMainThread('NEWS_PROCESSED', {
        totalNews: allNews.length,
        unprocessedCount: unprocessedNews.length,
        processedCount,
        skippedCount,
        errorCount,
        highLevelCount,
        processingTime: this.stats.processingTime,
        timestamp: Date.now()
      });

    } catch (error) {
      logger.error('处理未处理新闻时发生错误:', error);
      this.notifyMainThread('PROCESSING_ERROR', {
        error: error.message,
        timestamp: Date.now()
      });
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 批量处理新闻
   */
  async batchProcessNews(newsItems) {
    const results = [];
    
    if (newsItems.length >= 3) {
      // 使用批量处理
      logger.info(`开始批量处理${newsItems.length}条新闻`);
      const batchResults = await knowledgeGraphService.batchProcessNews(newsItems);
      
      for (let i = 0; i < batchResults.length; i++) {
        const newsItem = newsItems[i];
        const graphResult = batchResults[i];
        
        if (graphResult.success && !graphResult.skipped) {
          // 处理新闻级别
          let levelResult = null;
          if (graphResult.extractionResult) {
            try {
              levelResult = await newsLevelService.checkAndHandleNewsLevel(
                newsItem, 
                graphResult.extractionResult
              );
            } catch (error) {
              logger.warn(`新闻级别处理失败: ${newsItem.id}`, error);
            }
          }

          results.push({
            success: true,
            newsId: newsItem.id,
            stats: graphResult.stats,
            newsLevel: graphResult.extractionResult?.news_level,
            shouldPush: levelResult?.shouldPush || false
          });
        } else {
          results.push({
            success: graphResult.success,
            newsId: newsItem.id,
            skipped: graphResult.skipped || false,
            error: graphResult.error
          });
        }
      }
    } else {
      // 单条处理
      logger.info(`开始单条处理${newsItems.length}条新闻`);
      for (const newsItem of newsItems) {
        try {
          const result = await this.processSingleNews(newsItem);
          results.push(result);
        } catch (error) {
          logger.error(`单条处理失败: ${newsItem.id}`, error);
          results.push({
            success: false,
            newsId: newsItem.id,
            error: error.message
          });
        }
      }
    }

    return results;
  }

  /**
   * 处理单条新闻
   */
  async processSingleNews(newsItem) {
    try {
      // 1. 构建知识图谱
      const graphResult = await knowledgeGraphService.processNews(newsItem);
      
      if (!graphResult.success) {
        return {
          success: false,
          newsId: newsItem.id,
          error: graphResult.error
        };
      }

      // 2. 处理新闻级别
      let levelResult = null;
      if (graphResult.extractionResult) {
        levelResult = await newsLevelService.checkAndHandleNewsLevel(
          newsItem, 
          graphResult.extractionResult
        );
      }

      return {
        success: true,
        newsId: newsItem.id,
        skipped: graphResult.skipped || false,
        stats: graphResult.stats,
        newsLevel: graphResult.extractionResult?.news_level,
        shouldPush: levelResult?.shouldPush || false
      };
      
    } catch (error) {
      logger.error(`处理新闻失败: ${newsItem.id}`, error);
      return {
        success: false,
        newsId: newsItem.id,
        error: error.message
      };
    }
  }

  /**
   * 停止新闻处理
   */
  stopProcessing() {
    logger.info('停止新闻处理服务...');

    // 停止文件监听
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = null;
      logger.info('文件监听已停止');
    }

    // 停止定时检查
    if (this.processInterval) {
      clearInterval(this.processInterval);
      this.processInterval = null;
      logger.info('定时检查已停止');
    }

    logger.info('新闻处理服务已停止');
  }

  /**
   * 触发立即处理（响应外部消息）
   */
  async triggerProcessing() {
    logger.info('收到外部触发信号，开始处理新闻...');
    await this.processUnhandledNews();
  }

  /**
   * 通知主线程
   */
  notifyMainThread(type, data) {
    if (parentPort) {
      parentPort.postMessage({
        type,
        data,
        timestamp: Date.now()
      });
    }
  }

  /**
   * 获取当前状态
   */
  getStatus() {
    return {
      initialized: this.initialized,
      isProcessing: this.isProcessing,
      hasFileWatcher: !!this.fileWatcher,
      hasIntervalCheck: !!this.processInterval,
      stats: this.stats,
      timestamp: Date.now()
    };
  }
}

// 监听主线程消息
if (parentPort) {
  const processor = new NewsProcessorWorker();
  
  parentPort.on('message', async (message) => {
    try {
      const { type, data, taskId } = message;
      
      switch (type) {
        case 'INITIALIZE':
          await processor.initialize();
          parentPort.postMessage({
            type: 'RESULT',
            taskId,
            result: { success: true, message: '新闻处理器初始化完成' }
          });
          break;
          
        case 'START_PROCESSING':
          await processor.startProcessing(data);
          parentPort.postMessage({
            type: 'RESULT',
            taskId,
            result: { success: true, message: '新闻处理服务已启动' }
          });
          break;
          
        case 'STOP_PROCESSING':
          processor.stopProcessing();
          parentPort.postMessage({
            type: 'RESULT',
            taskId,
            result: { success: true, message: '新闻处理服务已停止' }
          });
          break;
          
        case 'TRIGGER_PROCESSING':
          await processor.triggerProcessing();
          parentPort.postMessage({
            type: 'RESULT',
            taskId,
            result: { success: true, message: '处理已触发' }
          });
          break;
          
        case 'GET_STATUS':
          const status = processor.getStatus();
          parentPort.postMessage({
            type: 'RESULT',
            taskId,
            result: status
          });
          break;
          
        case 'PING':
          parentPort.postMessage({
            type: 'PONG',
            taskId,
            timestamp: Date.now()
          });
          break;
          
        default:
          parentPort.postMessage({
            type: 'ERROR',
            taskId,
            error: `未知的消息类型: ${type}`
          });
      }
    } catch (error) {
      parentPort.postMessage({
        type: 'ERROR',
        taskId: message.taskId,
        error: error.message
      });
    }
  });
  
  // 通知主线程工作线程已就绪
  parentPort.postMessage({
    type: 'READY',
    timestamp: Date.now()
  });
}

export default NewsProcessorWorker; 
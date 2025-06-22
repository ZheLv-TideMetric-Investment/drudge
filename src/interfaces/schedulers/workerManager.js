import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import path from 'path';
import logger from '../../shared/utils/logger.js';
import config from '../../shared/config/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 新闻处理工作线程管理器
 * 管理专门负责新闻处理的工作线程，支持文件监听和消息驱动
 */
class WorkerManager {
  constructor() {
    this.newsProcessor = null;
    this.taskCounter = 0;
    this.pendingTasks = new Map();
    this.workerTimeout = config.workers?.timeout || 300000; // 5分钟超时
    this.initialized = false;
    
    // 统计信息
    this.stats = {
      totalProcessed: 0,
      totalErrors: 0,
      lastActivity: null,
      processingRequests: 0
    };
  }

  /**
   * 初始化新闻处理工作线程
   */
  async initialize() {
    try {
      logger.info('初始化新闻处理工作线程管理器...');
      
      await this.createNewsProcessor();
      await this.initializeNewsProcessor();
      await this.startNewsProcessing();
      
      this.initialized = true;
      logger.info('新闻处理工作线程管理器初始化完成');
    } catch (error) {
      logger.error('新闻处理工作线程管理器初始化失败:', error);
      throw error;
    }
  }

  /**
   * 创建新闻处理工作线程
   */
  async createNewsProcessor() {
    return new Promise((resolve, reject) => {
      const workerPath = path.join(__dirname, '../../workers/newsProcessorWorker.js');
      const worker = new Worker(workerPath);
      
      worker.lastActivity = Date.now();
      
      // 监听工作线程消息
      worker.on('message', (message) => {
        this.handleWorkerMessage(message);
      });
      
      // 监听工作线程错误
      worker.on('error', (error) => {
        logger.error('新闻处理工作线程发生错误:', error);
        this.handleWorkerError(error);
      });
      
      // 监听工作线程退出
      worker.on('exit', (code) => {
        logger.warn(`新闻处理工作线程退出，代码: ${code}`);
        this.handleWorkerExit();
      });
      
      // 等待工作线程就绪
      const readyTimeout = setTimeout(() => {
        reject(new Error('新闻处理工作线程初始化超时'));
      }, 30000);
      
      const readyHandler = (message) => {
        if (message.type === 'READY') {
          clearTimeout(readyTimeout);
          worker.off('message', readyHandler);
          
          this.newsProcessor = worker;
          
          logger.info('新闻处理工作线程创建完成');
          resolve(worker);
        }
      };
      
      worker.on('message', readyHandler);
    });
  }

  /**
   * 处理工作线程消息
   */
  handleWorkerMessage(message) {
    if (this.newsProcessor) {
      this.newsProcessor.lastActivity = Date.now();
    }
    
    const { type, taskId, result, error, data } = message;
    
    switch (type) {
      case 'READY':
        // 工作线程就绪，已在createNewsProcessor中处理
        break;
        
      case 'RESULT':
        this.handleTaskResult(taskId, result);
        break;
        
      case 'ERROR':
        this.handleTaskError(taskId, error);
        break;
        
      case 'PONG':
        // 心跳响应，更新活动时间即可
        break;
        
      case 'NEWS_PROCESSED':
        this.handleNewsProcessed(data);
        break;
        
      case 'PROCESSING_ERROR':
        this.handleProcessingError(data);
        break;
        
      default:
        logger.warn(`新闻处理工作线程发送未知消息类型: ${type}`);
    }
  }

  /**
   * 处理任务结果
   */
  handleTaskResult(taskId, result) {
    const pendingTask = this.pendingTasks.get(taskId);
    if (pendingTask) {
      clearTimeout(pendingTask.timeout);
      pendingTask.resolve(result);
      this.pendingTasks.delete(taskId);
    }
  }

  /**
   * 处理任务错误
   */
  handleTaskError(taskId, error) {
    const pendingTask = this.pendingTasks.get(taskId);
    if (pendingTask) {
      clearTimeout(pendingTask.timeout);
      pendingTask.reject(new Error(error));
      this.pendingTasks.delete(taskId);
    }
  }

  /**
   * 处理新闻处理完成事件
   */
  handleNewsProcessed(data) {
    this.stats.totalProcessed += data.processedCount;
    this.stats.lastActivity = new Date(data.timestamp);
    
    logger.info(`📰 新闻处理统计更新: 本次处理${data.processedCount}条，发现${data.highLevelCount}条高级别新闻`);
  }

  /**
   * 处理新闻处理错误事件
   */
  handleProcessingError(data) {
    this.stats.totalErrors++;
    this.stats.lastActivity = new Date(data.timestamp);
    
    logger.error(`新闻处理发生错误: ${data.error}`);
  }

  /**
   * 处理工作线程错误
   */
  handleWorkerError(error) {
    logger.error('新闻处理工作线程发生严重错误，尝试重启...', error);
    
    // 取消所有待处理任务
    for (const [taskId, pendingTask] of this.pendingTasks.entries()) {
      clearTimeout(pendingTask.timeout);
      pendingTask.reject(error);
    }
    this.pendingTasks.clear();
    
    // 尝试重新创建工作线程
    this.restartNewsProcessor();
  }

  /**
   * 处理工作线程退出
   */
  handleWorkerExit() {
    logger.warn('新闻处理工作线程意外退出，尝试重启...');
    
    if (this.initialized) {
      this.restartNewsProcessor();
    }
  }

  /**
   * 重启新闻处理工作线程
   */
  async restartNewsProcessor() {
    try {
      logger.info('正在重启新闻处理工作线程...');
      
      // 清理现有工作线程
      if (this.newsProcessor) {
        try {
          await this.newsProcessor.terminate();
        } catch (error) {
          logger.warn('终止工作线程时出错:', error);
        }
        this.newsProcessor = null;
      }
      
      // 重新创建和初始化
      await this.createNewsProcessor();
      await this.initializeNewsProcessor();
      await this.startNewsProcessing();
      
      logger.info('新闻处理工作线程重启完成');
    } catch (error) {
      logger.error('重启新闻处理工作线程失败:', error);
    }
  }

  /**
   * 初始化新闻处理器
   */
  async initializeNewsProcessor() {
    return this.executeTask('INITIALIZE');
  }

  /**
   * 启动新闻处理服务
   */
  async startNewsProcessing(options = {}) {
    return this.executeTask('START_PROCESSING', options);
  }

  /**
   * 停止新闻处理服务
   */
  async stopNewsProcessing() {
    return this.executeTask('STOP_PROCESSING');
  }

  /**
   * 触发立即处理
   */
  async triggerProcessing() {
    return this.executeTask('TRIGGER_PROCESSING');
  }

  /**
   * 执行任务
   */
  async executeTask(type, data = null) {
    if (!this.newsProcessor && type !== 'INITIALIZE') {
      throw new Error('新闻处理工作线程未初始化');
    }
    
    return new Promise((resolve, reject) => {
      const taskId = ++this.taskCounter;
      
      // 设置任务超时
      const timeout = setTimeout(() => {
        if (this.pendingTasks.has(taskId)) {
          this.pendingTasks.delete(taskId);
          reject(new Error(`任务超时: ${type}`));
        }
      }, this.workerTimeout);
      
      // 记录待处理任务
      this.pendingTasks.set(taskId, {
        resolve,
        reject,
        timeout,
        startTime: Date.now()
      });
      
      // 发送任务到工作线程
      if (this.newsProcessor) {
        this.newsProcessor.postMessage({
          type,
          data,
          taskId
        });
      } else {
        reject(new Error('新闻处理工作线程不可用'));
      }
    });
  }

  /**
   * 获取新闻处理器状态
   */
  async getProcessorStatus() {
    if (!this.newsProcessor) {
      return {
        initialized: false,
        available: false
      };
    }
    
    try {
      return await this.executeTask('GET_STATUS');
    } catch (error) {
      logger.warn('获取新闻处理器状态失败:', error);
      return {
        initialized: this.initialized,
        available: false,
        error: error.message
      };
    }
  }

  /**
   * 获取工作线程管理器状态
   */
  getStatus() {
    return {
      initialized: this.initialized,
      hasNewsProcessor: !!this.newsProcessor,
      pendingTasks: this.pendingTasks.size,
      stats: this.stats,
      processorLastActivity: this.newsProcessor?.lastActivity || null
    };
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    if (!this.newsProcessor) {
      return {
        healthy: false,
        error: '新闻处理工作线程不存在'
      };
    }
    
    try {
      const startTime = Date.now();
      
      const taskId = ++this.taskCounter;
      
      const pingPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.pendingTasks.delete(taskId);
          reject(new Error('健康检查超时'));
        }, 5000);
        
        this.pendingTasks.set(taskId, {
          resolve: () => {
            clearTimeout(timeout);
            resolve(Date.now() - startTime);
          },
          reject: (error) => {
            clearTimeout(timeout);
            reject(error);
          },
          timeout
        });
      });
      
      this.newsProcessor.postMessage({
        type: 'PING',
        taskId
      });
      
      const responseTime = await pingPromise;
      
      return {
        healthy: true,
        responseTime,
        initialized: this.initialized,
        stats: this.stats
      };
      
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        initialized: this.initialized
      };
    }
  }

  /**
   * 关闭新闻处理工作线程管理器
   */
  async shutdown() {
    logger.info('开始关闭新闻处理工作线程管理器...');
    
    this.initialized = false;
    
    // 停止新闻处理服务
    if (this.newsProcessor) {
      try {
        await this.stopNewsProcessing();
      } catch (error) {
        logger.warn('停止新闻处理服务失败:', error);
      }
    }
    
    // 取消所有待处理任务
    for (const [taskId, pendingTask] of this.pendingTasks.entries()) {
      clearTimeout(pendingTask.timeout);
      pendingTask.reject(new Error('系统关闭'));
    }
    this.pendingTasks.clear();
    
    // 终止新闻处理工作线程
    if (this.newsProcessor) {
      try {
        await this.newsProcessor.terminate();
      } catch (error) {
        logger.warn('终止新闻处理工作线程失败:', error);
      }
      this.newsProcessor = null;
    }
    
    logger.info('新闻处理工作线程管理器关闭完成');
  }
}

export default new WorkerManager(); 
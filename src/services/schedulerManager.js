import { Worker } from 'worker_threads';
import { fileURLToPath } from 'url';
import path from 'path';
import logger from '../utils/logger.js';
import config from '../config/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 调度器管理器
 * 管理调度器工作线程，将所有定时任务移到工作线程中执行
 */
class SchedulerManager {
  constructor() {
    this.schedulerWorker = null;
    this.taskCounter = 0;
    this.pendingTasks = new Map();
    this.initialized = false;
    this.started = false;
    this.taskTimeout = 30000; // 30秒超时
    
    // 统计信息
    this.stats = {
      totalNewsProcessed: 0,
      totalHighLevelNews: 0,
      totalSummariesGenerated: 0,
      totalTrackingRuns: 0,
      lastActivity: null,
      errors: []
    };
  }

  /**
   * 初始化调度器管理器
   */
  async initialize() {
    try {
      logger.info('初始化调度器管理器...');
      
      await this.createSchedulerWorker();
      
      // 🚨 定时任务最高优先级 - 工作线程会自动初始化和启动定时任务
      // 主线程只负责创建工作线程，不干预定时任务的启动
      this.initialized = true;
      this.started = true; // 标记为已启动，因为定时任务会自动启动
      
      logger.info('调度器管理器初始化完成');
    } catch (error) {
      this.initialized = false;
      logger.error('调度器管理器初始化失败:', error);
      throw error;
    }
  }

  /**
   * 创建调度器工作线程
   */
  async createSchedulerWorker() {
    return new Promise((resolve, reject) => {
      const workerPath = path.join(__dirname, '../workers/schedulerWorker.js');
      const worker = new Worker(workerPath);
      
      worker.on('message', (message) => {
        this.handleWorkerMessage(message);
      });
      
      worker.on('error', (error) => {
        logger.error('调度器工作线程发生错误:', error);
        this.handleWorkerError(error);
      });
      
      worker.on('exit', (code) => {
        logger.warn(`调度器工作线程退出，代码: ${code}`);
        this.handleWorkerExit();
      });
      
      // 等待工作线程就绪
      const readyTimeout = setTimeout(() => {
        reject(new Error('调度器工作线程初始化超时'));
      }, 30000);
      
      const readyHandler = (message) => {
        if (message.type === 'READY') {
          clearTimeout(readyTimeout);
          worker.off('message', readyHandler);
          
          this.schedulerWorker = worker;
          logger.info('调度器工作线程创建完成');
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
    const { type, taskId, result, error, data } = message;
    
    switch (type) {
      case 'READY':
        // 工作线程就绪，已在createSchedulerWorker中处理
        break;
        
      case 'RESULT':
        this.handleTaskResult(taskId, result);
        break;
        
      case 'ERROR':
        this.handleTaskError(taskId, error);
        break;
        
      case 'PONG':
        // 心跳响应
        break;
        
      case 'NEWS_FETCHED':
        this.handleNewsFetched(data);
        break;
        
      case 'SUMMARY_GENERATED':
        this.handleSummaryGenerated(data);
        break;
        
      case 'TRACKING_COMPLETED':
        this.handleTrackingCompleted(data);
        break;
        
      case 'TASK_ERROR':
        this.handleScheduledTaskError(data);
        break;
        

        
      default:
        logger.warn(`调度器工作线程发送未知消息类型: ${type}`);
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
   * 处理新闻获取完成事件
   */
  handleNewsFetched(data) {
    this.stats.lastActivity = new Date(data.timestamp);
    
    logger.info(`📰 新闻获取完成: ${data.message}`);
    
    // 通知新闻处理工作线程有新数据
    this.notifyNewsProcessor();
  }

  /**
   * 通知新闻处理工作线程
   */
  notifyNewsProcessor() {
    // 这里可以通过主线程来通知新闻处理工作线程
    // 主线程会监听这个事件并转发给新闻处理工作线程
    this.notifyMainThread('TRIGGER_NEWS_PROCESSING', {
      reason: 'new_data_fetched',
      timestamp: Date.now()
    });
  }



  /**
   * 处理总结生成完成事件
   */
  handleSummaryGenerated(data) {
    this.stats.totalSummariesGenerated++;
    this.stats.lastActivity = new Date(data.timestamp);
    
    logger.info(`📊 总结生成完成: ${data.hour}，总计生成${this.stats.totalSummariesGenerated}份总结`);
  }

  /**
   * 处理追踪完成事件
   */
  handleTrackingCompleted(data) {
    this.stats.totalTrackingRuns++;
    this.stats.lastActivity = new Date(data.timestamp);
    
    logger.info(`🐍 草蛇灰线追踪完成，总计执行${this.stats.totalTrackingRuns}次`);
  }

  /**
   * 处理定时任务错误
   */
  handleScheduledTaskError(data) {
    const errorInfo = {
      taskType: data.taskType,
      error: data.error,
      timestamp: new Date(data.timestamp)
    };
    
    this.stats.errors.push(errorInfo);
    
    // 只保留最近10个错误
    if (this.stats.errors.length > 10) {
      this.stats.errors = this.stats.errors.slice(-10);
    }
    
    logger.error(`定时任务错误 [${data.taskType}]: ${data.error}`);
  }

  /**
   * 处理工作线程错误
   */
  handleWorkerError(error) {
    logger.error('调度器工作线程发生严重错误，尝试重启...', error);
    this.restartScheduler();
  }

  /**
   * 处理工作线程退出
   */
  handleWorkerExit() {
    if (this.initialized) {
      logger.warn('调度器工作线程意外退出，尝试重启...');
      this.restartScheduler();
    }
  }

  /**
   * 重启调度器
   */
  async restartScheduler() {
    try {
      logger.info('正在重启调度器工作线程...');
      
      // 清理现有工作线程
      if (this.schedulerWorker) {
        try {
          await this.schedulerWorker.terminate();
        } catch (error) {
          logger.warn('终止工作线程时出错:', error);
        }
      }
      
      // 重新创建和初始化
      await this.createSchedulerWorker();
      await this.initializeScheduler();
      
      if (this.started) {
        await this.startScheduledTasks();
      }
      
      logger.info('调度器工作线程重启完成');
    } catch (error) {
      logger.error('重启调度器工作线程失败:', error);
    }
  }

  /**
   * 执行工作线程任务
   */
  async executeTask(type, data = null) {
    if (!this.initialized) {
      throw new Error('调度器管理器未初始化');
    }
    
    return new Promise((resolve, reject) => {
      const taskId = ++this.taskCounter;
      
      // 设置任务超时
      const timeout = setTimeout(() => {
        if (this.pendingTasks.has(taskId)) {
          this.pendingTasks.delete(taskId);
          reject(new Error(`任务超时: ${type}`));
        }
      }, this.taskTimeout);
      
      // 记录待处理任务
      this.pendingTasks.set(taskId, {
        resolve,
        reject,
        timeout,
        startTime: Date.now()
      });
      
      // 发送任务到工作线程
      this.schedulerWorker.postMessage({
        type,
        data,
        taskId
      });
    });
  }

  /**
   * 初始化调度器工作线程
   */
  async initializeScheduler() {
    return this.executeTask('INITIALIZE');
  }

  /**
   * 启动定时任务
   */
  async startScheduledTasks() {
    if (!this.initialized) {
      throw new Error('调度器管理器未初始化');
    }
    
    const result = await this.executeTask('START_TASKS');
    this.started = true;
    logger.info('定时任务已在工作线程中启动');
    return result;
  }

  /**
   * 停止定时任务
   */
  async stopScheduledTasks() {
    if (!this.started) {
      return;
    }
    
    const result = await this.executeTask('STOP_TASKS');
    this.started = false;
    logger.info('定时任务已停止');
    return result;
  }

  /**
   * 获取调度器状态
   */
  async getSchedulerStatus() {
    if (!this.initialized) {
      return {
        initialized: false,
        started: false
      };
    }
    
    try {
      const status = await this.executeTask('GET_STATUS');
      return {
        initialized: this.initialized,
        started: this.started,
        scheduler: status,
        stats: this.stats,
        pendingTasks: this.pendingTasks.size
      };
    } catch (error) {
      logger.warn('获取调度器状态失败:', error);
      return {
        initialized: this.initialized,
        started: this.started,
        error: error.message,
        stats: this.stats
      };
    }
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    if (!this.initialized) {
      return {
        healthy: false,
        error: '调度器管理器未初始化'
      };
    }
    
    try {
      const startTime = Date.now();
      await this.executeTask('PING');
      const responseTime = Date.now() - startTime;
      
      return {
        healthy: true,
        responseTime,
        initialized: this.initialized,
        started: this.started,
        stats: this.stats
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message
      };
    }
  }

  /**
   * 关闭调度器管理器
   */
  async shutdown() {
    logger.info('开始关闭调度器管理器...');
    
    this.initialized = false;
    
    // 停止定时任务
    if (this.started) {
      try {
        await this.stopScheduledTasks();
      } catch (error) {
        logger.warn('停止定时任务失败:', error);
      }
    }
    
    // 取消所有待处理任务
    for (const [taskId, pendingTask] of this.pendingTasks.entries()) {
      clearTimeout(pendingTask.timeout);
      pendingTask.reject(new Error('系统关闭'));
    }
    this.pendingTasks.clear();
    
    // 终止工作线程
    if (this.schedulerWorker) {
      try {
        await this.schedulerWorker.terminate();
      } catch (error) {
        logger.warn('终止调度器工作线程失败:', error);
      }
      this.schedulerWorker = null;
    }
    
    logger.info('调度器管理器关闭完成');
  }
}

export default new SchedulerManager(); 
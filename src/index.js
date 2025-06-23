import logger from './shared/utils/logger.js';
import schedulerManager from './interfaces/schedulers/schedulerManager.js';
import workerManager from './interfaces/schedulers/workerManager.js';
import webhookService from './infrastructure/external/WebhookService.js';
import moment from 'moment-timezone';
import config from './shared/config/config.js';
import { NewsLevelDescription } from './shared/types/enums.js';

// 设置默认时区为北京时间
moment.tz.setDefault('Asia/Shanghai');

/**
 * 新闻处理系统主控制器
 * 使用调度器工作线程执行所有定时任务，主线程只负责管理和监控
 */
class NewsProcessingSystem {
  constructor() {
    this.initialized = false;
    this.started = false;
  }

  /**
   * 初始化系统
   */
  async initialize() {
    try {
      logger.info('开始初始化新闻处理系统主控制器...');

      // 初始化调度器管理器（包含所有服务的初始化）
      await schedulerManager.initialize();
      
      // 设置调度器消息监听
      this.setupSchedulerMessageListening();
      
      // 初始化新闻处理工作线程（如果启用）
      if (config.workers.enabled) {
        await workerManager.initialize();
        logger.info('新闻处理工作线程已启用');
      } else {
        logger.info('新闻处理工作线程已禁用');
  }

      this.initialized = true;
      logger.info('新闻处理系统主控制器初始化完成');
    } catch (error) {
      logger.error('系统初始化失败:', error);
      throw error;
    }
  }

  /**
   * 设置调度器消息监听
   */
  setupSchedulerMessageListening() {
    // 重写 schedulerManager 的 notifyMainThread 方法来处理消息
    const originalNotifyMainThread = schedulerManager.constructor.prototype.notifyMainThread;
    schedulerManager.notifyMainThread = (type, data) => {
      if (type === 'TRIGGER_NEWS_PROCESSING') {
        this.handleTriggerNewsProcessing(data);
      }
      // 调用原始方法（如果需要）
      if (originalNotifyMainThread) {
        originalNotifyMainThread.call(schedulerManager, type, data);
      }
    };
  }

  /**
   * 处理触发新闻处理请求
   */
  async handleTriggerNewsProcessing(data) {
    if (config.workers.enabled && workerManager.initialized) {
      try {
        logger.info(`收到新闻处理触发请求: ${data.reason}，通知新闻处理工作线程`);
        await workerManager.triggerProcessing();
    } catch (error) {
        logger.error('触发新闻处理失败:', error);
      }
    } else {
      logger.debug('新闻处理工作线程未启用或未初始化，忽略处理请求');
    }
  }

  /**
   * 启动定时任务
   */
  async startScheduledTasks() {
    if (!this.initialized) {
      throw new Error('系统未初始化');
    }
    
    try {
      await schedulerManager.startScheduledTasks();
      this.started = true;
      logger.info('所有定时任务已在调度器工作线程中启动');
    } catch (error) {
      logger.error('启动定时任务失败:', error);
      throw error;
    }
  }

  /**
   * 停止定时任务
   */
  async stopScheduledTasks() {
    if (!this.started) {
      return;
    }
    
    try {
      await schedulerManager.stopScheduledTasks();
      this.started = false;
      logger.info('所有定时任务已停止');
    } catch (error) {
      logger.error('停止定时任务失败:', error);
      throw error;
    }
  }





  /**
   * 错误通知
   */
  async sendErrorNotification(error, context) {
    const errorMessage = `[系统异常] ${context}\n时间：${moment().format('YYYY-MM-DD HH:mm:ss')}\n错误信息：${error.message || error}\n${error.stack || ''}`;
    try {
      await webhookService.sendMessage(
        moment().format('YYYY-MM-DD HH:mm:ss'),
        moment().format('YYYY-MM-DD HH:mm:ss'),
        errorMessage,
        'ERROR'
      );
    } catch (sendError) {
      logger.error('发送错误通知失败:', sendError);
    }
  }



  /**
   * 获取系统状态
   */
  async getSystemStatus() {
    const schedulerStatus = await schedulerManager.getSchedulerStatus();
    
    return {
      initialized: this.initialized,
      started: this.started,
      scheduler: schedulerStatus,
      workers: {
        enabled: config.workers.enabled,
        status: config.workers.enabled ? workerManager.getStatus() : null
      },
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    };
  }
}

// 创建系统实例
const system = new NewsProcessingSystem();

// ===== 系统启动和调度 =====

async function startSystem() {
  try {
    // 初始化系统（定时任务会在调度器工作线程中自动启动）
    await system.initialize();
    
    // 🚨 定时任务最高优先级 - 已在调度器工作线程中自动启动，无需手动启动
    system.started = true; // 标记为已启动
    
    logger.info('🚀 新闻处理系统完全启动完成');
    logger.info('📊 所有定时任务已在调度器工作线程中自动启动');
    
    } catch (error) {
    logger.error('系统启动失败:', error);
    await system.sendErrorNotification(error, '系统启动失败');
    process.exit(1);
    }
}

// 启动系统
startSystem();

// ===== 错误处理 =====

process.on('uncaughtException', async error => {
  logger.error('未捕获的异常:', error);
  await system.sendErrorNotification(error, '系统发生未捕获的异常');
});

process.on('unhandledRejection', async (reason, promise) => {
  logger.error('未处理的Promise拒绝:', reason);
  await system.sendErrorNotification(reason, '系统发生未处理的Promise拒绝');
});

// 优雅关闭
process.on('SIGINT', async () => {
  logger.info('收到SIGINT信号，开始优雅关闭...');
  await gracefulShutdown();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('收到SIGTERM信号，开始优雅关闭...');
  await gracefulShutdown();
  process.exit(0);
});

async function gracefulShutdown() {
  try {
    // 停止定时任务
    if (system.started) {
      await system.stopScheduledTasks();
    }
    
    // 关闭调度器管理器
    await schedulerManager.shutdown();
    
    // 关闭新闻处理工作线程
    if (config.workers.enabled) {
      await workerManager.shutdown();
    }
    
    logger.info('系统优雅关闭完成');
  } catch (error) {
    logger.error('优雅关闭过程中发生错误:', error);
  }
}

logger.info('🚀 新闻处理与图数据库存储系统启动完成');
logger.info('📊 支持功能：News Level分级、按小时总结、知识图谱构建');
logger.info('📈 系统状态: 调度器工作线程模式，支持5级新闻分类');

// 导出系统实例供外部使用
export { system };

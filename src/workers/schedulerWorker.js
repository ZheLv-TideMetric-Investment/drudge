import { parentPort } from 'worker_threads';
import cron from 'node-cron';
import logger from '../shared/utils/logger.js';
import newsService from '../infrastructure/external/NewsApiService.js';
import hourlySummaryService from '../application/services/hourlySummaryService.js';
import snakeTrackingService from '../application/services/snakeTrackingService.js';
import newsLevelService from '../application/services/newsLevelService.js';
import moment from 'moment-timezone';

/**
 * 调度器工作线程
 * 专门负责执行定时任务，将数据获取与处理完全分离
 */
class SchedulerWorker {
  constructor() {
    this.initialized = false;
    this.cronJobs = [];
    moment.tz.setDefault('Asia/Shanghai');
  }

  async initialize() {
    try {
      logger.info('调度器工作线程开始初始化...');
      
      // 只初始化数据获取相关的服务
      await hourlySummaryService.initialize();
      await snakeTrackingService.initialize();
      await newsLevelService.initialize();
      
      this.initialized = true;
      logger.info('调度器工作线程初始化完成');
      
      // 🚨 定时任务是最高优先级 - 初始化完成后立即启动，不等待任何外部指令
      logger.info('🚨 定时任务最高优先级 - 立即启动所有定时任务');
      this.startScheduledTasks();
      
    } catch (error) {
      logger.error('调度器工作线程初始化失败:', error);
      throw error;
    }
  }

  /**
   * 启动所有定时任务
   */
  startScheduledTasks() {
    if (!this.initialized) {
      throw new Error('调度器工作线程未初始化');
    }

    logger.info('开始启动定时任务...');

    // 1. 每分钟获取新闻数据（快速执行，不跳过）
    const newsTask = cron.schedule('* * * * *', async () => {
      console.log('分钟定时任务开始');
      try {
        logger.info('定时任务：开始获取新闻数据');
        const startTime = Date.now();
        
        // 只负责获取数据并存储到本地
        const newsItems = await newsService.fetchNews();
        
        const duration = Date.now() - startTime;
        logger.info(`定时任务：新闻获取完成，获取${newsItems.length}条，耗时${duration}ms`);
        
        // 通知主线程有新数据需要处理
        if (newsItems.length > 0) {
          this.notifyMainThread('NEWS_FETCHED', {
            count: newsItems.length,
            timestamp: Date.now(),
            message: `获取到${newsItems.length}条新闻，已存储到本地`
          });
        }
        
      } catch (error) {
        logger.error('新闻获取任务失败:', error);
        this.notifyMainThread('TASK_ERROR', {
          taskType: 'news_fetching',
          error: error.message,
          timestamp: Date.now()
        });
      }
    }, {
      scheduled: false,
      timezone: 'Asia/Shanghai'
    });

    // 2. 每小时生成总结（定点执行）
    const summaryTask = cron.schedule('0 * * * *', async () => {
      try {
        logger.info('定时任务：开始生成小时总结');
        const startTime = Date.now();
        
        const currentTime = moment();
        const lastHour = moment().subtract(1, 'hour');
        
        await hourlySummaryService.generateHourlySummary(lastHour, currentTime);
        
        const duration = Date.now() - startTime;
        logger.info(`定时任务：小时总结完成，耗时${duration}ms`);
        
        this.notifyMainThread('SUMMARY_GENERATED', {
          hour: lastHour.format('YYYY-MM-DD HH:00'),
          timestamp: Date.now()
        });
        
      } catch (error) {
        logger.error('小时总结任务失败:', error);
        this.notifyMainThread('TASK_ERROR', {
          taskType: 'hourly_summary',
          error: error.message,
          timestamp: Date.now()
        });
      }
    }, {
      scheduled: false,
      timezone: 'Asia/Shanghai'
    });

    // 3. 每10分钟执行草蛇灰线追踪
    const trackingTask = cron.schedule('*/10 * * * *', async () => {
      try {
        logger.info('定时任务：开始草蛇灰线追踪');
        const startTime = Date.now();
        
        await snakeTrackingService.performTracking();
        
        const duration = Date.now() - startTime;
        logger.info(`定时任务：草蛇灰线追踪完成，耗时${duration}ms`);
        
        this.notifyMainThread('TRACKING_COMPLETED', {
          timestamp: Date.now()
        });
        
      } catch (error) {
        logger.error('草蛇灰线追踪任务失败:', error);
        this.notifyMainThread('TASK_ERROR', {
          taskType: 'snake_tracking',
          error: error.message,
          timestamp: Date.now()
        });
      }
    }, {
      scheduled: false,
      timezone: 'Asia/Shanghai'
    });

    // 4. 每5分钟执行高级别新闻扫描
    const levelScanTask = cron.schedule('*/5 * * * *', async () => {
      try {
        logger.info('定时任务：开始高级别新闻扫描');
        const startTime = Date.now();
        
        const result = await newsLevelService.scanForHighLevelNews();
        
        const duration = Date.now() - startTime;
        logger.info(`定时任务：高级别新闻扫描完成，发现${result.totalFound}条，推送${result.newPushed}条，耗时${duration}ms`);
        
        this.notifyMainThread('LEVEL_SCAN_COMPLETED', {
          totalFound: result.totalFound,
          newPushed: result.newPushed,
          timestamp: Date.now()
        });
        
      } catch (error) {
        logger.error('高级别新闻扫描任务失败:', error);
        this.notifyMainThread('TASK_ERROR', {
          taskType: 'level_scan',
          error: error.message,
          timestamp: Date.now()
        });
      }
    }, {
      scheduled: false,
      timezone: 'Asia/Shanghai'
    });

    // 5. 每天早上9:00发送新闻级别统计
    const dailyStatsTask = cron.schedule('0 9 * * *', async () => {
      try {
        logger.info('定时任务：开始生成昨日新闻级别统计');
        const startTime = Date.now();
        
        const yesterday = moment().subtract(1, 'day').toDate();
        const today = moment().toDate();
        
        const stats = await newsLevelService.getNewsLevelStats(yesterday, today);
        
        if (stats.total > 0) {
          const duration = Date.now() - startTime;
          logger.info(`定时任务：昨日新闻级别统计完成，统计${stats.total}条新闻，耗时${duration}ms`);
          
          this.notifyMainThread('DAILY_STATS_GENERATED', {
            stats,
            timestamp: Date.now()
          });
        }
        
      } catch (error) {
        logger.error('昨日新闻级别统计任务失败:', error);
        this.notifyMainThread('TASK_ERROR', {
          taskType: 'daily_stats',
          error: error.message,
          timestamp: Date.now()
        });
      }
    }, {
      scheduled: false,
      timezone: 'Asia/Shanghai'
    });

    // 启动所有任务
    newsTask.start();
    summaryTask.start();
    trackingTask.start();
    levelScanTask.start();
    dailyStatsTask.start();

    this.cronJobs = [newsTask, summaryTask, trackingTask, levelScanTask, dailyStatsTask];
    logger.info(`所有定时任务已启动，共${this.cronJobs.length}个任务`);
  }

  /**
   * 停止所有定时任务
   */
  stopScheduledTasks() {
    logger.info('正在停止所有定时任务...');
    
    this.cronJobs.forEach(job => {
      if (job) {
        job.stop();
        job.destroy();
      }
    });
    
    this.cronJobs = [];
    logger.info('所有定时任务已停止');
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
      activeCronJobs: this.cronJobs.length,
      timestamp: Date.now()
    };
  }
}

// 调度器工作线程启动
if (parentPort) {
  const scheduler = new SchedulerWorker();
  
  // 🚨 定时任务最高优先级 - 立即初始化并启动
  scheduler.initialize()
    .then(() => {
      // 通知主线程调度器已就绪并开始运行
      parentPort.postMessage({
        type: 'READY',
        message: '调度器工作线程已就绪，定时任务自动启动完成',
        timestamp: Date.now()
      });
    })
    .catch((error) => {
      logger.error('调度器工作线程启动失败:', error);
      parentPort.postMessage({
        type: 'ERROR',
        error: error.message,
        timestamp: Date.now()
      });
    });
  
  // 监听主线程消息（仅用于状态查询和健康检查）
  parentPort.on('message', async (message) => {
    try {
      const { type, taskId } = message;
      
      switch (type) {
        case 'GET_STATUS':
          const status = scheduler.getStatus();
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
          
        case 'STOP_TASKS':
          scheduler.stopScheduledTasks();
          parentPort.postMessage({
            type: 'RESULT',
            taskId,
            result: { success: true, message: '定时任务已停止' }
          });
          break;
          
        default:
          // 其他消息忽略，因为定时任务是自动运行的
          logger.debug(`调度器工作线程收到消息: ${type}，但定时任务自动运行，无需处理`);
          if (taskId) {
            parentPort.postMessage({
              type: 'RESULT',
              taskId,
              result: { success: true, message: '定时任务自动运行中' }
            });
          }
      }
    } catch (error) {
      parentPort.postMessage({
        type: 'ERROR',
        taskId: message.taskId,
        error: error.message
      });
    }
  });
}

export default SchedulerWorker; 
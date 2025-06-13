import cron from 'node-cron';
import logger from './utils/logger.js';
import newsService from './services/newsService.js';
import aiService from './services/aiService.js';
import webhookService from './services/webhookService.js';
import ohnService from './services/ohnService.js';
import hnsService from './services/hnsService.js';
import overnightService from './services/overnightService.js';
import snakeTrackingService from './services/snakeTrackingService.js';
import moment from 'moment-timezone';

// 设置默认时区为北京时间
moment.tz.setDefault('Asia/Shanghai');

// 启动新闻获取
newsService.fetchNews();

// 初始化草蛇灰线系统
snakeTrackingService.initialize().catch(error => {
  logger.error('草蛇灰线系统初始化失败:', error);
});

// 错误通知函数
async function sendErrorNotification(error, context) {
  const errorMessage = `[系统异常] ${context}\n时间：${moment().format('YYYY-MM-DD HH:mm:ss')}\n错误信息：${error.message || error}\n${error.stack || ''}`;
  try {
    await webhookService.sendMessage(
      moment().format('YYYY-MM-DD HH:mm:ss'),
      moment().format('YYYY-MM-DD HH:mm:ss'),
      errorMessage
    );
  } catch (sendError) {
    logger.error('发送错误通知失败:', sendError);
  }
}

// === 草蛇灰线系统调度任务 ===

// 每分钟检查捕猎对象的新进展
cron.schedule(
  '* * * * *',
  async () => {
    try {
      await snakeTrackingService.runProgressCheck();
    } catch (error) {
      logger.error('草蛇灰线进展检查失败:', error);
      await sendErrorNotification(error, '草蛇灰线进展检查失败');
    }
  },
  {
    timezone: 'Asia/Shanghai',
  }
);

// 每5分钟检查是否有新的特级事件需要捕猎
cron.schedule(
  '*/5 * * * *',
  async () => {
    try {
      await snakeTrackingService.runHuntCheck();
    } catch (error) {
      logger.error('草蛇灰线事件捕猎检查失败:', error);
      await sendErrorNotification(error, '草蛇灰线事件捕猎检查失败');
    }
  },
  {
    timezone: 'Asia/Shanghai',
  }
);

// 每小时检查是否有捕猎对象需要终止
cron.schedule(
  '0 * * * *',
  async () => {
    try {
      await snakeTrackingService.runTerminationCheck();
    } catch (error) {
      logger.error('草蛇灰线终止检查失败:', error);
      await sendErrorNotification(error, '草蛇灰线终止检查失败');
    }
  },
  {
    timezone: 'Asia/Shanghai',
  }
);

// === 原有系统调度任务 ===

// 每分钟执行新闻获取
cron.schedule(
  '* * * * *',
  async () => {
    try {
      await newsService.fetchNews();
    } catch (error) {
      logger.error('新闻获取任务失败:', error);
      await sendErrorNotification(error, '新闻获取任务失败');
    }
  },
  {
    timezone: 'Asia/Shanghai',
  }
);

// 每小时HH:02执行OHN处理
cron.schedule(
  '2 * * * *',
  async () => {
    try {
      await ohnService.runOriginalHour();
    } catch (error) {
      logger.error('OHN处理任务失败:', error);
      await sendErrorNotification(error, 'OHN处理任务失败');
    }
  },
  {
    timezone: 'Asia/Shanghai',
  }
);

// 每小时HH:05执行HNS生成
cron.schedule(
  '5 * * * *',
  async () => {
    try {
      await hnsService.runHourSummary();
    } catch (error) {
      logger.error('HNS生成任务失败:', error);
      await sendErrorNotification(error, 'HNS生成任务失败');
    }
  },
  {
    timezone: 'Asia/Shanghai',
  }
);

// 每天10:05执行夜间汇总
cron.schedule(
  '5 10 * * *',
  async () => {
    try {
      await overnightService.runOvernightSummary();
    } catch (error) {
      logger.error('夜间汇总任务失败:', error);
      await sendErrorNotification(error, '夜间汇总任务失败');
    }
  },
  {
    timezone: 'Asia/Shanghai',
  }
);

// === 保持现有的兼容性任务 ===

// 每小时执行新闻总结（11:01-22:01）
cron.schedule(
  '1 11-22 * * *',
  async () => {
    try {
      // 获取上一个小时的新闻（精确到整点）
      const currentHour = moment().hour();
      const startTime = moment()
        .hour(currentHour - 1)
        .minute(0)
        .second(0);
      const endTime = moment().hour(currentHour).minute(0).second(0);

      logger.info(
        `开始总结 ${startTime.format('YYYY-MM-DD HH:mm:ss')} 到 ${endTime.format('YYYY-MM-DD HH:mm:ss')} 的新闻`
      );
      const lastHourNews = await newsService.getNewsByTimeRange(startTime, endTime);

      if (lastHourNews.length > 0) {
        const summary = await aiService.summarizeNews(lastHourNews);
        await webhookService.sendMessage(startTime, endTime, summary);
      }
    } catch (error) {
      logger.error('新闻总结任务失败:', error);
      await sendErrorNotification(error, '新闻总结任务失败');
    }
  },
  {
    timezone: 'Asia/Shanghai',
  }
);

// 每天早上10:01总结前一天22点后的新闻
cron.schedule(
  '1 10 * * *',
  async () => {
    try {
      const yesterday = moment().subtract(1, 'day');
      const startTime = yesterday.hour(22).minute(0).second(0);
      const endTime = moment().hour(10).minute(0).second(0);
      const overnightNews = await newsService.getNewsByTimeRange(startTime, endTime);
      if (overnightNews.length > 0) {
        const summary = await aiService.summarizeNews(overnightNews);
        await webhookService.sendMessage(startTime, endTime, summary);
      }
    } catch (error) {
      logger.error('夜间新闻总结任务失败:', error);
      await sendErrorNotification(error, '夜间新闻总结任务失败');
    }
  },
  {
    timezone: 'Asia/Shanghai',
  }
);

// 错误处理
process.on('uncaughtException', async error => {
  logger.error('未捕获的异常:', error);
  await sendErrorNotification(error, '系统发生未捕获的异常');
});

process.on('unhandledRejection', async (_reason, _promise) => {
  logger.error('未处理的Promise拒绝:', _reason);
  await sendErrorNotification(_reason, '系统发生未处理的Promise拒绝');
});

logger.info('服务已启动，包含草蛇灰线系统和分层处理功能');

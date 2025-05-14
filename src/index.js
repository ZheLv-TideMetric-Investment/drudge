const cron = require('node-cron');
const logger = require('./utils/logger');
const newsService = require('./services/newsService');
const aiService = require('./services/aiService');
const webhookService = require('./services/webhookService');
const moment = require('moment');

// newsService.fetchNews();

(async () => {
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
    await webhookService.sendMessage(summary);
  }
})();

// 错误通知函数
async function sendErrorNotification(error, context) {
  const errorMessage = `[系统异常] ${context}\n时间：${moment().format('YYYY-MM-DD HH:mm:ss')}\n错误信息：${error.message || error}\n${error.stack || ''}`;
  try {
    await webhookService.sendMessage(errorMessage);
  } catch (sendError) {
    logger.error('发送错误通知失败:', sendError);
  }
}

// 每分钟执行新闻获取
cron.schedule('* * * * *', async () => {
  try {
    await newsService.fetchNews();
  } catch (error) {
    logger.error('新闻获取任务失败:', error);
    await sendErrorNotification(error, '新闻获取任务失败');
  }
});

// 每小时执行新闻总结（11:01-22:01）
cron.schedule('1 11-22 * * *', async () => {
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
      await webhookService.sendMessage(summary);
    }
  } catch (error) {
    logger.error('新闻总结任务失败:', error);
    await sendErrorNotification(error, '新闻总结任务失败');
  }
});

// 每天早上10:01总结前一天22点后的新闻
cron.schedule('1 10 * * *', async () => {
  try {
    const yesterday = moment().subtract(1, 'day');
    const startTime = yesterday.hour(22).minute(0).second(0);
    const endTime = moment().hour(10).minute(0).second(0);
    const overnightNews = await newsService.getNewsByTimeRange(startTime, endTime);
    if (overnightNews.length > 0) {
      const summary = await aiService.summarizeNews(overnightNews);
      await webhookService.sendMessage(summary);
    }
  } catch (error) {
    logger.error('夜间新闻总结任务失败:', error);
    await sendErrorNotification(error, '夜间新闻总结任务失败');
  }
});

// 错误处理
process.on('uncaughtException', async error => {
  logger.error('未捕获的异常:', error);
  await sendErrorNotification(error, '系统发生未捕获的异常');
});

process.on('unhandledRejection', async (_reason, _promise) => {
  logger.error('未处理的Promise拒绝:', _reason);
  await sendErrorNotification(_reason, '系统发生未处理的Promise拒绝');
});

logger.info('服务已启动');

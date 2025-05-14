const cron = require('node-cron');
const config = require('./config/config');
const logger = require('./utils/logger');
const newsService = require('./services/newsService');
const aiService = require('./services/aiService');
const webhookService = require('./services/webhookService');

// newsService.fetchNews();

(async () => {
  const lastHourNews = await newsService.getLastHourNews();
  if (lastHourNews.length > 0) {
    const summary = await aiService.summarizeNews(lastHourNews);
    await webhookService.sendMessage(summary);
  }
})();

// 每分钟执行新闻获取
cron.schedule('* * * * *', async () => {
  try {
    await newsService.fetchNews();
  } catch (error) {
    logger.error('新闻获取任务失败:', error);
  }
});

// 每小时执行新闻总结
cron.schedule('0 * * * *', async () => {
  try {
    const lastHourNews = await newsService.getLastHourNews();
    if (lastHourNews.length > 0) {
      const summary = await aiService.summarizeNews(lastHourNews);
      await webhookService.sendMessage(summary);
      newsService.clearOldNews();
    }
  } catch (error) {
    logger.error('新闻总结任务失败:', error);
  }
});

// 错误处理
process.on('uncaughtException', error => {
  logger.error('未捕获的异常:', error);
});

process.on('unhandledRejection', error => {
  logger.error('未处理的Promise拒绝:', error);
});

logger.info('服务已启动');

const moment = require('moment-timezone');
const logger = require('../utils/logger');
const newsService = require('../services/newsService');
const aiService = require('../services/aiService');
const webhookService = require('../services/webhookService');

// 设置默认时区为北京时间
moment.tz.setDefault('Asia/Shanghai');

/**
 * 手动触发新闻获取
 */
async function triggerNewsFetch() {
  try {
    logger.info('开始手动触发新闻获取');
    const news = await newsService.fetchNews();
    logger.info(`手动触发新闻获取完成，获取到 ${news.length} 条新闻`);
    return news;
  } catch (error) {
    logger.error('手动触发新闻获取失败:', error);
    throw error;
  }
}

/**
 * 手动触发新闻总结
 * @param {moment.Moment} startTime 开始时间
 * @param {moment.Moment} endTime 结束时间
 */
async function triggerNewsSummary(startTime, endTime) {
  try {
    logger.info(
      `开始手动触发新闻总结: ${startTime.format('YYYY-MM-DD HH:mm:ss')} 到 ${endTime.format('YYYY-MM-DD HH:mm:ss')}`
    );
    
    const news = await newsService.getNewsByTimeRange(startTime, endTime);
    if (news.length === 0) {
      logger.info('指定时间范围内没有新闻');
      return;
    }

    const summary = await aiService.summarizeNews(news);
    await webhookService.sendMessage(startTime, endTime, summary);
    logger.info('手动触发新闻总结完成');
  } catch (error) {
    logger.error('手动触发新闻总结失败:', error);
    throw error;
  }
}

/**
 * 手动触发最近一小时的新闻总结
 */
async function triggerLastHourSummary() {
  const endTime = moment();
  const startTime = moment().subtract(1, 'hour');
  await triggerNewsSummary(startTime, endTime);
}

/**
 * 手动触发指定时间范围的新闻总结
 * @param {string} startTimeStr 开始时间字符串 (YYYY-MM-DD HH:mm:ss)
 * @param {string} endTimeStr 结束时间字符串 (YYYY-MM-DD HH:mm:ss)
 */
async function triggerCustomTimeSummary(startTimeStr, endTimeStr) {
  const startTime = moment(startTimeStr);
  const endTime = moment(endTimeStr);
  
  if (!startTime.isValid() || !endTime.isValid()) {
    throw new Error('无效的时间格式，请使用 YYYY-MM-DD HH:mm:ss 格式');
  }
  
  if (endTime.isBefore(startTime)) {
    throw new Error('结束时间不能早于开始时间');
  }
  
  await triggerNewsSummary(startTime, endTime);
}

// 如果直接运行此脚本
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  async function main() {
    try {
      switch (command) {
        case 'fetch':
          await triggerNewsFetch();
          break;
        case 'last-hour':
          await triggerLastHourSummary();
          break;
        case 'custom':
          if (args.length !== 3) {
            console.error('用法: node manualTrigger.js custom <开始时间> <结束时间>');
            console.error('时间格式: YYYY-MM-DD HH:mm:ss');
            process.exit(1);
          }
          await triggerCustomTimeSummary(args[1], args[2]);
          break;
        default:
          console.error('未知命令');
          console.error('可用命令:');
          console.error('  fetch        - 获取最新新闻');
          console.error('  last-hour    - 总结最近一小时的新闻');
          console.error('  custom       - 总结指定时间范围的新闻');
          console.error('    用法: node manualTrigger.js custom <开始时间> <结束时间>');
          console.error('    时间格式: YYYY-MM-DD HH:mm:ss');
          process.exit(1);
      }
    } catch (error) {
      console.error('执行失败:', error.message);
      process.exit(1);
    }
  }

  main();
}

module.exports = {
  triggerNewsFetch,
  triggerNewsSummary,
  triggerLastHourSummary,
  triggerCustomTimeSummary,
}; 
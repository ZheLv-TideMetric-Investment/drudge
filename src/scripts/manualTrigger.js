import moment from 'moment-timezone';
import logger from '../utils/logger.js';
import newsService from '../services/newsService.js';
import aiService from '../services/aiService.js';
import webhookService from '../services/webhookService.js';
import ohnService from '../services/ohnService.js';
import hnsService from '../services/hnsService.js';
import overnightService from '../services/overnightService.js';

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

async function handleCommand() {
  const command = process.argv[2];
  const customDate = process.argv[3];
  let currentHour, startTime, endTime, lastHourNews, summary;
  let customStartTime, customEndTime, customNews, customSummary;
  let ohnResult, hnsResult, overnightResult;
  let testTime, testOhnResult;

  try {
    switch (command) {
      case 'fetch':
        console.log('手动触发新闻获取...');
        await newsService.fetchNews();
        console.log('新闻获取完成');
        break;

      case 'last-hour':
        console.log('手动触发上一小时新闻总结...');
        currentHour = moment().hour();
        startTime = moment()
          .hour(currentHour - 1)
          .minute(0)
          .second(0);
        endTime = moment().hour(currentHour).minute(0).second(0);

        console.log(
          `获取 ${startTime.format('YYYY-MM-DD HH:mm:ss')} 到 ${endTime.format('YYYY-MM-DD HH:mm:ss')} 的新闻`
        );
        lastHourNews = await newsService.getNewsByTimeRange(startTime, endTime);

        if (lastHourNews.length > 0) {
          summary = await aiService.summarizeNews(lastHourNews);
          await webhookService.sendMessage(startTime, endTime, summary);
          console.log(`总结完成，处理 ${lastHourNews.length} 条新闻`);
        } else {
          console.log('没有找到新闻数据');
        }
        break;

      case 'custom':
        if (!customDate) {
          console.log('请提供日期参数，格式：YYYY-MM-DD HH 或 YYYY-MM-DD');
          process.exit(1);
        }

        console.log(`手动触发自定义时间总结: ${customDate}`);
        if (customDate.includes(' ')) {
          // 包含小时，处理单个小时
          customStartTime = moment(customDate, 'YYYY-MM-DD HH');
          customEndTime = customStartTime.clone().add(1, 'hour');
        } else {
          // 只有日期，处理整天
          customStartTime = moment(customDate, 'YYYY-MM-DD').startOf('day');
          customEndTime = customStartTime.clone().endOf('day');
        }

        console.log(
          `时间范围: ${customStartTime.format('YYYY-MM-DD HH:mm:ss')} 到 ${customEndTime.format('YYYY-MM-DD HH:mm:ss')}`
        );
        customNews = await newsService.getNewsByTimeRange(customStartTime, customEndTime);

        if (customNews.length > 0) {
          customSummary = await aiService.summarizeNews(customNews);
          await webhookService.sendMessage(customStartTime, customEndTime, customSummary);
          console.log(`总结完成，处理 ${customNews.length} 条新闻`);
        } else {
          console.log('没有找到新闻数据');
        }
        break;

      // === 新增：分层处理功能测试 ===

      case 'ohn':
        console.log('手动触发OHN AI处理...');
        ohnResult = await ohnService.runOriginalHour('2025-06-13 16:19:42');
        if (ohnResult) {
          console.log(`OHN AI处理完成，压缩后数据量: ${ohnResult.totalProcessed}`);
          console.log('分类统计:');
          Object.entries(ohnResult.categorizedNews).forEach(([category, news]) => {
            if (news && news.length > 0) {
              console.log(`  ${category}: ${news.length}条`);
            }
          });
        } else {
          console.log('OHN处理完成，没有数据');
        }
        break;

      case 'hns':
        console.log('手动触发HNS生成...');
        hnsResult = await hnsService.runHourSummary('2025-06-13 16:19:42');
        if (hnsResult) {
          console.log(`HNS生成完成，源数据量: ${hnsResult.sourceCount}`);
        } else {
          console.log('HNS生成完成，没有数据');
        }
        break;

      case 'overnight':
        console.log('手动触发夜间汇总...');
        overnightResult = await overnightService.runOvernightSummary('2025-06-13 16:43:51');
        if (overnightResult) {
          console.log(`夜间汇总完成，源数据量: ${overnightResult.sourceCount}`);
        } else {
          console.log('夜间汇总完成，没有数据');
        }
        break;

      case 'test-ohn-custom':
        if (!customDate) {
          console.log('请提供时间参数，格式：YYYY-MM-DD-HH');
          process.exit(1);
        }
        console.log(`手动触发指定时间OHN处理: ${customDate}`);
        testTime = moment(customDate, 'YYYY-MM-DD-HH');
        testOhnResult = await ohnService.runOriginalHour(testTime);
        if (testOhnResult) {
          console.log(`OHN处理完成，处理数据量: ${testOhnResult.length}`);
        } else {
          console.log('OHN处理完成，没有数据');
        }
        break;

      default:
        console.log('可用命令:');
        console.log('  fetch                    - 获取最新新闻');
        console.log('  last-hour               - 总结上一小时新闻');
        console.log('  custom <YYYY-MM-DD HH>  - 总结指定时间新闻');
        console.log('  ohn                     - 运行OHN处理');
        console.log('  hns                     - 运行HNS生成');
        console.log('  overnight               - 运行夜间汇总');
        console.log('  test-ohn-custom <YYYY-MM-DD-HH> - 测试指定时间OHN处理');
        process.exit(1);
    }
  } catch (error) {
    logger.error('手动触发任务失败:', error);
    console.error('任务执行失败:', error.message);
    process.exit(1);
  }
}

handleCommand();

export { triggerNewsFetch, triggerNewsSummary, triggerLastHourSummary, triggerCustomTimeSummary };

import moment from 'moment-timezone';
import logger from '../utils/logger.js';
import newsService from '../services/newsService.js';
import aiService from '../services/aiService.js';
import webhookService from '../services/webhookService.js';
import knowledgeGraphService from '../services/knowledgeGraphService.js';
import newsLevelService from '../services/newsLevelService.js';
import storageService from '../services/storageService.js';
import workerManager from '../services/workerManager.js';
import config from '../config/config.js';

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

/**
 * 手动触发脚本
 * 支持多种手动操作功能
 */
class ManualTrigger {
  constructor() {
    this.operations = {
      'fetch_news': this.fetchAndSaveNews.bind(this),
      'process_all': this.processAllStoredNews.bind(this),
      'process_recent': this.processRecentNews.bind(this),
      'health_check': this.performHealthCheck.bind(this),
      'worker_health': this.performWorkerHealthCheck.bind(this),
      'status': this.getSystemStatus.bind(this),
      'help': this.showHelp.bind(this)
    };
  }

  /**
   * 获取并保存新闻
   */
  async fetchAndSaveNews() {
    try {
      logger.info('开始手动获取新闻...');
      const newsItems = await newsService.fetchNews();
      
      if (newsItems.length > 0) {
        logger.info(`成功获取${newsItems.length}条新闻并保存到本地`);
        return {
          success: true,
          message: `成功获取${newsItems.length}条新闻并保存到本地`,
          count: newsItems.length
        };
      } else {
        return {
          success: true,
          message: '没有获取到新的新闻',
          count: 0
        };
      }
    } catch (error) {
      logger.error('手动获取新闻失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 处理所有本地存储的新闻
   */
  async processAllStoredNews(limit = 1000) {
    try {
      logger.info('开始手动处理所有本地存储的新闻...');
      
      // 初始化服务
      await knowledgeGraphService.initialize();
      await newsLevelService.initialize();
      
      // 获取所有本地存储的新闻
      const allStoredNews = await storageService.getAll(limit);
      
      if (allStoredNews.length === 0) {
        return {
          success: true,
          message: '没有找到本地存储的新闻',
          processed: 0
        };
      }
      
      logger.info(`找到${allStoredNews.length}条本地存储的新闻，开始处理...`);
      
      // 过滤掉已处理的新闻
      const newsIds = allStoredNews.map(item => item.id);
      const unprocessedIds = await knowledgeGraphService.getUnprocessedNewsIds(newsIds);
      const unprocessedNews = allStoredNews.filter(item => unprocessedIds.includes(item.id));
      
      if (unprocessedNews.length === 0) {
        return {
          success: true,
          message: `所有${allStoredNews.length}条新闻都已处理过`,
          processed: 0,
          skipped: allStoredNews.length
        };
      }
      
      logger.info(`开始处理${unprocessedNews.length}条未处理的新闻（跳过${allStoredNews.length - unprocessedNews.length}条已处理）`);
      
      let processedCount = 0;
      let errorCount = 0;
      const highLevelNews = [];
      
      // 批量处理或单条处理
      const batchSize = 5;
      for (let i = 0; i < unprocessedNews.length; i += batchSize) {
        const batch = unprocessedNews.slice(i, i + batchSize);
        
        for (const newsItem of batch) {
          try {
            // 处理单条新闻
            const result = await knowledgeGraphService.processNews(newsItem);
            
            if (result.success && !result.skipped) {
              processedCount++;
              
              // 检查是否是高级别新闻
              if (result.extractionResult && (result.extractionResult.news_level === 'Level 1' || result.extractionResult.news_level === 'Level 2')) {
                highLevelNews.push({
                  newsItem,
                  extractionResult: result.extractionResult
                });
              }
              
              logger.debug(`处理成功: ${newsItem.id}`);
            } else if (result.skipped) {
              logger.debug(`跳过已处理: ${newsItem.id}`);
            }
          } catch (error) {
            errorCount++;
            logger.error(`处理失败: ${newsItem.id}`, error);
          }
        }
        
        // 批次间延迟
        if (i + batchSize < unprocessedNews.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // 进度日志
        logger.info(`处理进度: ${Math.min(i + batchSize, unprocessedNews.length)}/${unprocessedNews.length}`);
      }
      
      // 处理高级别新闻
      for (const { newsItem, extractionResult } of highLevelNews) {
        try {
          await newsLevelService.checkAndHandleNewsLevel(newsItem, extractionResult);
        } catch (error) {
          logger.error(`高级别新闻处理失败: ${newsItem.id}`, error);
        }
      }
      
      const message = `手动处理完成：处理${processedCount}条，错误${errorCount}条，发现${highLevelNews.length}条高级别新闻`;
      logger.info(message);
      
      // 发送完成通知
      await webhookService.sendMessage(
        moment().format('YYYY-MM-DD HH:mm:ss'),
        moment().format('YYYY-MM-DD HH:mm:ss'),
        `🔧 **手动处理完成**\n\n${message}`,
        'MANUAL_PROCESS_COMPLETE'
      );
      
      return {
        success: true,
        message,
        total_found: allStoredNews.length,
        processed: processedCount,
        errors: errorCount,
        skipped: allStoredNews.length - unprocessedNews.length,
        high_level_news: highLevelNews.length
      };
      
    } catch (error) {
      logger.error('手动处理失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 处理最近的新闻
   */
  async processRecentNews(hours = 24) {
    try {
      logger.info(`开始处理最近${hours}小时的新闻...`);
      
      await knowledgeGraphService.initialize();
      await newsLevelService.initialize();
      
      const endTime = moment();
      const startTime = moment().subtract(hours, 'hours');
      
      const recentNews = await storageService.getByTimeRange(startTime, endTime);
      
      if (recentNews.length === 0) {
        return {
          success: true,
          message: `最近${hours}小时没有新闻`,
          processed: 0
        };
      }
      
      // 过滤未处理的新闻
      const newsIds = recentNews.map(item => item.id);
      const unprocessedIds = await knowledgeGraphService.getUnprocessedNewsIds(newsIds);
      const unprocessedNews = recentNews.filter(item => unprocessedIds.includes(item.id));
      
      let processedCount = 0;
      for (const newsItem of unprocessedNews) {
        try {
          const result = await knowledgeGraphService.processNews(newsItem);
          if (result.success && !result.skipped) {
            processedCount++;
            
            // 处理新闻级别
            if (result.extractionResult) {
              await newsLevelService.checkAndHandleNewsLevel(newsItem, result.extractionResult);
            }
          }
        } catch (error) {
          logger.error(`处理新闻失败: ${newsItem.id}`, error);
        }
      }
      
      const message = `处理最近${hours}小时新闻完成：共${recentNews.length}条，处理${processedCount}条`;
      logger.info(message);
      
      return {
        success: true,
        message,
        total_found: recentNews.length,
        processed: processedCount,
        skipped: recentNews.length - unprocessedNews.length
      };
      
    } catch (error) {
      logger.error('处理最近新闻失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 执行健康检查
   */
  async performHealthCheck() {
    try {
      logger.info('开始执行健康检查...');
      
      const healthResult = await knowledgeGraphService.healthCheck();
      const graphStats = await knowledgeGraphService.getGraphStats();
      const latestNews = await storageService.getLatest();
      
      const result = {
        success: true,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
        database_health: healthResult,
        graph_stats: graphStats,
        latest_news: latestNews ? {
          id: latestNews.id,
          title: latestNews.title,
          time: moment(latestNews.time * 1000).format('YYYY-MM-DD HH:mm:ss')
        } : null,
        system_uptime: process.uptime()
      };
      
      logger.info('健康检查完成:', result);
      return result;
      
    } catch (error) {
      logger.error('健康检查失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 执行工作线程健康检查
   */
  async performWorkerHealthCheck() {
    try {
      logger.info('开始执行工作线程健康检查...');
      
      if (!config.workers.enabled) {
        return {
          success: true,
          message: '工作线程未启用',
          workers_enabled: false
        };
      }
      
      // 初始化工作线程池（如果还未初始化）
      if (!workerManager.initialized) {
        await workerManager.initialize();
      }
      
      const workerStatus = workerManager.getStatus();
      const healthResults = await workerManager.healthCheck();
      
      const result = {
        success: true,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
        workers_enabled: true,
        worker_pool_status: workerStatus,
        worker_health_results: healthResults,
        overall_health: healthResults.every(result => result.healthy)
      };
      
      logger.info('工作线程健康检查完成:', result);
      return result;
      
    } catch (error) {
      logger.error('工作线程健康检查失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取系统状态
   */
  async getSystemStatus() {
    try {
      const allStoredNews = await storageService.getAll(1);
      const graphStats = await knowledgeGraphService.getGraphStats();
      
      // 获取工作线程状态
      let workerStatus = null;
      if (config.workers.enabled) {
        try {
          workerStatus = workerManager.getStatus();
        } catch (error) {
          logger.warn('获取工作线程状态失败:', error);
          workerStatus = { error: error.message };
        }
      }
      
      return {
        success: true,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
        system_uptime: process.uptime(),
        latest_news_count: allStoredNews.length,
        graph_stats: graphStats,
        workers: {
          enabled: config.workers.enabled,
          status: workerStatus
        }
      };
    } catch (error) {
      logger.error('获取系统状态失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 显示帮助信息
   */
  showHelp() {
    const helpText = `
手动触发脚本使用说明：

可用操作：
  fetch_news     - 获取并保存新闻到本地
  process_all    - 处理所有本地存储的新闻（可选参数：limit）
  process_recent - 处理最近N小时的新闻（可选参数：hours，默认24）
  health_check   - 执行系统健康检查
  worker_health  - 执行工作线程健康检查
  status         - 获取系统状态（包含工作线程状态）
  help          - 显示此帮助信息

使用示例：
  npm run manual fetch_news
  npm run manual process_all
  npm run manual process_all 500
  npm run manual process_recent 12
  npm run manual health_check
  npm run manual worker_health
  npm run manual status
    `;
    
    console.log(helpText);
    return { success: true, message: '帮助信息已显示' };
  }

  /**
   * 执行操作
   */
  async execute(operation, ...args) {
    if (!this.operations[operation]) {
      logger.error(`未知操作: ${operation}`);
      this.showHelp();
      return { success: false, error: `未知操作: ${operation}` };
    }
    
    try {
      logger.info(`开始执行操作: ${operation}`);
      const result = await this.operations[operation](...args);
      logger.info(`操作完成: ${operation}`, result);
      return result;
    } catch (error) {
      logger.error(`操作失败: ${operation}`, error);
      return { success: false, error: error.message };
    }
  }
}

// 主执行逻辑
async function main() {
  const operation = process.argv[2];
  const args = process.argv.slice(3);
  
  if (!operation) {
    console.log('请指定操作，使用 help 查看可用操作');
          process.exit(1);
        }
  
  const trigger = new ManualTrigger();
  const result = await trigger.execute(operation, ...args);
  
  if (result.success) {
    console.log('✅ 操作成功:', result.message || '完成');
    if (result.details) {
      console.log('详细信息:', JSON.stringify(result, null, 2));
    }
  } else {
    console.error('❌ 操作失败:', result.error);
    process.exit(1);
  }
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('执行失败:', error);
    process.exit(1);
  });
}

export default ManualTrigger;

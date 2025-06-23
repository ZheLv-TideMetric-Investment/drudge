import logger from '../shared/utils/logger.js';
import moment from 'moment-timezone';
import newsLevelService from '../application/services/newsLevelService.js';
import knowledgeGraphService from '../application/services/knowledgeGraphService.js';
import fileStorage from '../infrastructure/storage/FileStorage.js';
import webhookService from '../infrastructure/external/WebhookService.js';

// 设置默认时区为北京时间
moment.tz.setDefault('Asia/Shanghai');

/**
 * 新闻等级检查脚本
 * 专门负责新闻等级分析、Break News识别和高级别新闻处理
 */
class NewsLevelChecker {
  constructor() {
    this.newsLevelService = newsLevelService;
    this.knowledgeGraph = knowledgeGraphService;
    this.storage = fileStorage;
    this.webhook = webhookService;
    this.commands = {
      'check': this.checkNewsLevels.bind(this),
      'check-recent': this.checkRecentNews.bind(this),
      'check-single': this.checkSingleNews.bind(this),
      'break-news': this.findBreakNews.bind(this),
      'high-level': this.findHighLevelNews.bind(this),
      'rescan': this.rescanNews.bind(this),
      'stats': this.getLevelStats.bind(this),
      'history': this.getBreakNewsHistory.bind(this),
      'notify': this.sendBreakNewsNotification.bind(this),
      'status': this.getStatus.bind(this),
      'help': this.showHelp.bind(this)
    };
  }

  /**
   * 初始化服务
   */
  async initialize() {
    try {
      await this.newsLevelService.initialize();
      await this.knowledgeGraph.initialize();
      return true;
    } catch (error) {
      logger.error('初始化新闻等级服务失败:', error);
      throw error;
    }
  }

  /**
   * 检查新闻等级
   */
  async checkNewsLevels(limit = 50) {
    try {
      await this.initialize();

      const limitNum = parseInt(limit) || 50;
      logger.info(`📊 开始检查新闻等级，限制: ${limitNum} 条`);

      // 获取最新新闻
      const latestNews = await this.storage.getLatest(limitNum);

      if (latestNews.length === 0) {
        console.log('📰 没有找到新闻');
        return { success: true, checked: 0 };
      }

      console.log(`📊 将检查 ${latestNews.length} 条新闻的等级`);

      let checkedCount = 0;
      let highLevelCount = 0;
      let breakNewsCount = 0;
      const results = [];

      for (const newsItem of latestNews) {
        try {
          // 获取已存在的提取结果
          const existingResult = await this.knowledgeGraph.getNewsExtractionResult(newsItem.id);
          
          if (!existingResult) {
            console.log(`⚠️  新闻 ${newsItem.id} 尚未进行实体提取，跳过等级检查`);
            continue;
          }

          const levelResult = await this.newsLevelService.checkAndHandleNewsLevel(newsItem, existingResult);
          checkedCount++;

          if (levelResult.isHighLevel) {
            highLevelCount++;
            if (levelResult.isBreakNews) {
              breakNewsCount++;
            }
          }

          results.push({
            newsId: newsItem.id,
            title: newsItem.title,
            level: existingResult.news_level || 'Unknown',
            isHighLevel: levelResult.isHighLevel,
            isBreakNews: levelResult.isBreakNews,
            timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
          });

          // 显示结果
          const levelIcon = this.getLevelIcon(existingResult.news_level);
          const typeIndicator = levelResult.isBreakNews ? '🚨 Break News' : (levelResult.isHighLevel ? '⚡ 高级别' : '📰 普通');
          console.log(`${levelIcon} ${typeIndicator} | ${newsItem.title.substring(0, 60)}...`);

        } catch (error) {
          logger.error(`检查新闻等级失败: ${newsItem.id}`, error);
        }

        // 处理间延迟
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const message = `✅ 等级检查完成: 检查${checkedCount}条，高级别${highLevelCount}条，Break News ${breakNewsCount}条`;
      console.log('\n' + message);
      logger.info(message);

      return {
        success: true,
        checked: checkedCount,
        high_level: highLevelCount,
        break_news: breakNewsCount,
        results,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };

    } catch (error) {
      console.error(`❌ 检查失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 检查最近新闻的等级
   */
  async checkRecentNews(hours = 12) {
    try {
      await this.initialize();

      const hoursNum = parseInt(hours) || 12;
      logger.info(`📊 开始检查最近 ${hoursNum} 小时的新闻等级`);

      const endTime = moment();
      const startTime = moment().subtract(hoursNum, 'hours');

      const recentNews = await this.storage.getByTimeRange(startTime, endTime);

      if (recentNews.length === 0) {
        console.log(`📰 最近 ${hoursNum} 小时没有新闻`);
        return { success: true, checked: 0 };
      }

      console.log(`📊 找到 ${recentNews.length} 条最近的新闻`);

      const results = [];
      let highLevelCount = 0;
      let breakNewsCount = 0;

      for (const newsItem of recentNews) {
        try {
          const existingResult = await this.knowledgeGraph.getNewsExtractionResult(newsItem.id);
          
          if (!existingResult) continue;

          const levelResult = await this.newsLevelService.checkAndHandleNewsLevel(newsItem, existingResult);

          if (levelResult.isHighLevel) {
            highLevelCount++;
            if (levelResult.isBreakNews) {
              breakNewsCount++;
            }

            results.push({
              newsId: newsItem.id,
              title: newsItem.title,
              level: existingResult.news_level,
              isBreakNews: levelResult.isBreakNews,
              time: moment(newsItem.time * 1000).format('YYYY-MM-DD HH:mm:ss')
            });
          }

        } catch (error) {
          logger.error(`检查新闻失败: ${newsItem.id}`, error);
        }
      }

      if (results.length > 0) {
        console.log(`\n📈 最近 ${hoursNum} 小时的高级别新闻:`);
        console.log(''.padEnd(80, '='));

        results.forEach((result, index) => {
          const typeIndicator = result.isBreakNews ? '🚨 Break News' : '⚡ 高级别';
          console.log(`${index + 1}. ${typeIndicator} [${result.level}]`);
          console.log(`   ${result.title}`);
          console.log(`   时间: ${result.time}`);
          console.log('');
        });
      }

      const message = `✅ 最近新闻检查完成: 总共${recentNews.length}条，高级别${highLevelCount}条，Break News ${breakNewsCount}条`;
      console.log(message);

      return {
        success: true,
        period: `${hoursNum} 小时`,
        total: recentNews.length,
        high_level: highLevelCount,
        break_news: breakNewsCount,
        high_level_news: results,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };

    } catch (error) {
      console.error(`❌ 检查最近新闻失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 检查单条新闻的等级
   */
  async checkSingleNews(newsId) {
    try {
      await this.initialize();

      if (!newsId) {
        console.error('❌ 请提供新闻ID');
        return { success: false, error: '缺少新闻ID' };
      }

      logger.info(`📊 检查单条新闻等级: ${newsId}`);

      const newsItem = await this.storage.getById(newsId);
      if (!newsItem) {
        console.error(`❌ 未找到新闻: ${newsId}`);
        return { success: false, error: '新闻不存在' };
      }

      const existingResult = await this.knowledgeGraph.getNewsExtractionResult(newsId);
      if (!existingResult) {
        console.error(`❌ 新闻 ${newsId} 尚未进行实体提取`);
        return { success: false, error: '新闻未进行实体提取' };
      }

      const levelResult = await this.newsLevelService.checkAndHandleNewsLevel(newsItem, existingResult);

      console.log('📊 新闻等级检查结果:');
      console.log(`   新闻ID: ${newsId}`);
      console.log(`   标题: ${newsItem.title}`);
      console.log(`   等级: ${existingResult.news_level || 'Unknown'}`);
      console.log(`   高级别: ${levelResult.isHighLevel ? '✅ 是' : '❌ 否'}`);
      console.log(`   Break News: ${levelResult.isBreakNews ? '🚨 是' : '❌ 否'}`);
      console.log(`   检查时间: ${moment().format('YYYY-MM-DD HH:mm:ss')}`);

      if (existingResult.entities && existingResult.entities.length > 0) {
        console.log(`   主要实体: ${existingResult.entities.slice(0, 5).join(', ')}`);
      }

      return {
        success: true,
        newsId,
        title: newsItem.title,
        level: existingResult.news_level,
        isHighLevel: levelResult.isHighLevel,
        isBreakNews: levelResult.isBreakNews,
        entities: existingResult.entities,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };

    } catch (error) {
      console.error(`❌ 检查失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 查找Break News
   */
  async findBreakNews(days = 1) {
    try {
      await this.initialize();

      const daysNum = parseInt(days) || 1;
      logger.info(`🚨 查找最近 ${daysNum} 天的Break News`);

      const endTime = moment();
      const startTime = moment().subtract(daysNum, 'days');

      const breakNewsList = await this.newsLevelService.getBreakNewsByTimeRange(startTime, endTime);

      if (breakNewsList.length === 0) {
        console.log(`🚨 最近 ${daysNum} 天没有Break News`);
        return { success: true, count: 0 };
      }

      console.log(`🚨 找到 ${breakNewsList.length} 条Break News:`);
      console.log(''.padEnd(80, '='));

      breakNewsList.forEach((item, index) => {
        console.log(`${index + 1}. 🚨 [${item.level}] ${item.title}`);
        console.log(`   时间: ${moment(item.detectedAt).format('YYYY-MM-DD HH:mm:ss')}`);
        console.log(`   影响度: ${item.impactScore || 'N/A'}`);
        if (item.reason) {
          console.log(`   原因: ${item.reason}`);
        }
        console.log('');
      });

      return {
        success: true,
        period: `${daysNum} 天`,
        count: breakNewsList.length,
        break_news: breakNewsList,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };

    } catch (error) {
      console.error(`❌ 查找Break News失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 查找高级别新闻
   */
  async findHighLevelNews(days = 7) {
    try {
      await this.initialize();

      const daysNum = parseInt(days) || 7;
      logger.info(`⚡ 查找最近 ${daysNum} 天的高级别新闻`);

      const endTime = moment();
      const startTime = moment().subtract(daysNum, 'days');

      const highLevelNews = await this.newsLevelService.getHighLevelNewsByTimeRange(startTime, endTime);

      if (highLevelNews.length === 0) {
        console.log(`⚡ 最近 ${daysNum} 天没有高级别新闻`);
        return { success: true, count: 0 };
      }

      // 按等级分组
      const grouped = highLevelNews.reduce((acc, item) => {
        const level = item.level || 'Unknown';
        if (!acc[level]) acc[level] = [];
        acc[level].push(item);
        return acc;
      }, {});

      console.log(`⚡ 找到 ${highLevelNews.length} 条高级别新闻:`);
      console.log(''.padEnd(80, '='));

      // 按等级分组显示
      Object.keys(grouped).sort().forEach(level => {
        const items = grouped[level];
        console.log(`\n📊 等级 ${level} (${items.length} 条):`);
        console.log(''.padEnd(60, '-'));
        
        items.forEach((item, index) => {
          const typeIndicator = item.isBreakNews ? '🚨 Break News' : '⚡ 高级别';
          console.log(`${index + 1}. ${typeIndicator} [${level}] ${item.title}`);
          console.log(`   时间: ${moment(item.detectedAt).format('YYYY-MM-DD HH:mm:ss')}`);
          if (item.impactScore) {
            console.log(`   影响度: ${item.impactScore}`);
          }
          console.log('');
        });
      });

      return {
        success: true,
        period: `${daysNum} 天`,
        count: highLevelNews.length,
        high_level_news: highLevelNews,
        grouped,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };

    } catch (error) {
      console.error(`❌ 查找高级别新闻失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 重新扫描新闻等级
   */
  async rescanNews(limit = 100) {
    try {
      await this.initialize();

      const limitNum = parseInt(limit) || 100;
      logger.info(`🔄 重新扫描新闻等级，限制: ${limitNum} 条`);

      const latestNews = await this.storage.getLatest(limitNum);
      
      if (latestNews.length === 0) {
        console.log('📰 没有找到新闻');
        return { success: true, rescanned: 0 };
      }

      console.log(`🔄 将重新扫描 ${latestNews.length} 条新闻的等级`);

      let rescannedCount = 0;
      let updatedCount = 0;

      for (const newsItem of latestNews) {
        try {
          const existingResult = await this.knowledgeGraph.getNewsExtractionResult(newsItem.id);
          
          if (!existingResult) {
            console.log(`⚠️  新闻 ${newsItem.id} 尚未进行实体提取，跳过`);
            continue;
          }

          // 强制重新检查等级
          const levelResult = await this.newsLevelService.checkAndHandleNewsLevel(newsItem, existingResult, true);
          rescannedCount++;

          if (levelResult.updated) {
            updatedCount++;
            console.log(`✅ 更新: ${newsItem.title.substring(0, 50)}...`);
          }

        } catch (error) {
          logger.error(`重新扫描新闻失败: ${newsItem.id}`, error);
        }

        await new Promise(resolve => setTimeout(resolve, 300));
      }

      const message = `✅ 重新扫描完成: 扫描${rescannedCount}条，更新${updatedCount}条`;
      console.log(message);

      return {
        success: true,
        rescanned: rescannedCount,
        updated: updatedCount,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };

    } catch (error) {
      console.error(`❌ 重新扫描失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取等级统计信息
   */
  async getLevelStats(days = 7) {
    try {
      await this.initialize();

      const daysNum = parseInt(days) || 7;
      logger.info(`📊 获取最近 ${daysNum} 天的等级统计`);

      const endTime = moment();
      const startTime = moment().subtract(daysNum, 'days');

      const stats = await this.newsLevelService.getLevelStatistics(startTime, endTime);

      console.log(`📊 最近 ${daysNum} 天新闻等级统计:`);
      console.log(''.padEnd(80, '='));
      console.log(`总新闻数: ${stats.total}`);
      console.log(`高级别新闻: ${stats.highLevel}`);
      console.log(`Break News: ${stats.breakNews}`);
      console.log(`平均影响度: ${stats.avgImpactScore?.toFixed(2) || 'N/A'}`);

      if (stats.levelDistribution) {
        console.log('\n📈 等级分布:');
        Object.entries(stats.levelDistribution).forEach(([level, count]) => {
          console.log(`  等级 ${level}: ${count} 条`);
        });
      }

      return {
        success: true,
        period: `${daysNum} 天`,
        stats,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };

    } catch (error) {
      console.error(`❌ 获取统计失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取Break News历史
   */
  async getBreakNewsHistory(days = 30) {
    try {
      await this.initialize();

      const daysNum = parseInt(days) || 30;
      logger.info(`📚 获取最近 ${daysNum} 天的Break News历史`);

      const endTime = moment();
      const startTime = moment().subtract(daysNum, 'days');

      const history = await this.newsLevelService.getBreakNewsHistory(startTime, endTime);

      if (history.length === 0) {
        console.log(`📚 最近 ${daysNum} 天没有Break News历史`);
        return { success: true, count: 0 };
      }

      console.log(`📚 最近 ${daysNum} 天Break News历史 (${history.length} 条):`);
      console.log(''.padEnd(80, '='));

      history.forEach((item, index) => {
        console.log(`${index + 1}. 🚨 [${item.level}] ${item.title}`);
        console.log(`   检测时间: ${moment(item.detectedAt).format('YYYY-MM-DD HH:mm:ss')}`);
        console.log(`   影响度: ${item.impactScore || 'N/A'}`);
        if (item.reason) {
          console.log(`   触发原因: ${item.reason}`);
        }
        console.log('');
      });

      return {
        success: true,
        period: `${daysNum} 天`,
        count: history.length,
        history,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };

    } catch (error) {
      console.error(`❌ 获取历史失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 发送Break News通知
   */
  async sendBreakNewsNotification(hours = 24) {
    try {
      await this.initialize();

      const hoursNum = parseInt(hours) || 24;
      logger.info(`📢 发送最近 ${hoursNum} 小时的Break News通知`);

      const endTime = moment();
      const startTime = moment().subtract(hoursNum, 'hours');

      const breakNews = await this.newsLevelService.getBreakNewsByTimeRange(startTime, endTime);

      if (breakNews.length === 0) {
        console.log(`📢 最近 ${hoursNum} 小时没有Break News，无需发送通知`);
        return { success: true, sent: 0 };
      }

      console.log(`📢 准备发送 ${breakNews.length} 条Break News通知`);

      const notificationData = {
        type: 'break_news_summary',
        period: `${hoursNum} 小时`,
        count: breakNews.length,
        news: breakNews.map(item => ({
          title: item.title,
          level: item.level,
          detectedAt: item.detectedAt,
          impactScore: item.impactScore,
          reason: item.reason
        })),
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };

      const result = await this.webhook.sendNotification(notificationData);

      if (result.success) {
        console.log(`✅ 成功发送 ${breakNews.length} 条Break News通知`);
      } else {
        console.error(`❌ 发送通知失败: ${result.error}`);
      }

      return {
        success: result.success,
        sent: breakNews.length,
        notification: notificationData,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };

    } catch (error) {
      console.error(`❌ 发送通知失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取服务状态
   */
  async getStatus() {
    try {
      await this.initialize();

      const status = {
        service: 'NewsLevelChecker',
        status: 'running',
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
        services: {
          newsLevelService: 'connected',
          knowledgeGraph: 'connected',
          storage: 'connected',
          webhook: 'connected'
        }
      };

      console.log('📊 新闻等级检查服务状态:');
      console.log(''.padEnd(50, '='));
      console.log(`服务: ${status.service}`);
      console.log(`状态: ${status.status}`);
      console.log(`时间: ${status.timestamp}`);
      console.log('\n📡 依赖服务:');
      Object.entries(status.services).forEach(([service, state]) => {
        const icon = state === 'connected' ? '✅' : '❌';
        console.log(`   ${icon} ${service}: ${state}`);
      });

      return status;

    } catch (error) {
      console.error(`❌ 获取状态失败: ${error.message}`);
      return { 
        service: 'NewsLevelChecker',
        status: 'error',
        error: error.message,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };
    }
  }

  /**
   * 显示帮助信息
   */
  showHelp() {
    console.log(`
📊 新闻等级检查脚本 - 帮助信息
=====================================

可用命令:
  check [limit]          检查新闻等级 (默认50条)
  check-recent [hours]   检查最近新闻等级 (默认12小时)
  check-single <newsId>  检查单条新闻等级
  break-news [days]      查找Break News (默认1天)
  high-level [days]      查找高级别新闻 (默认7天)
  rescan [limit]         重新扫描新闻等级 (默认100条)
  stats [days]           获取等级统计 (默认7天)
  history [days]         获取Break News历史 (默认30天)
  notify [hours]         发送Break News通知 (默认24小时)
  status                 获取服务状态
  help                   显示此帮助信息

示例:
  npm run level check 100
  npm run level check-recent 24
  npm run level break-news 3
  npm run level check-single news_123456
`);
  }

  /**
   * 获取等级图标
   */
  getLevelIcon(level) {
    const icons = {
      '1': '🔵',
      '2': '🟢', 
      '3': '🟡',
      '4': '🟠',
      '5': '🔴'
    };
    return icons[level] || '⚪';
  }

  /**
   * 运行命令
   */
  async runCommand(command, ...args) {
    if (!this.commands[command]) {
      console.error(`❌ 未知命令: ${command}`);
      this.showHelp();
      return;
    }

    try {
      const result = await this.commands[command](...args);
      return result;
    } catch (error) {
      console.error(`❌ 执行命令失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}

// 主程序入口
async function main() {
  const checker = new NewsLevelChecker();
  const command = process.argv[2];
  const args = process.argv.slice(3);

  if (!command || command === 'help') {
    checker.showHelp();
    return;
  }

  try {
    const result = await checker.runCommand(command, ...args);
    if (result && !result.success) {
      process.exit(1);
    }
  } catch (error) {
    console.error(`❌ 程序执行失败: ${error.message}`);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default NewsLevelChecker;
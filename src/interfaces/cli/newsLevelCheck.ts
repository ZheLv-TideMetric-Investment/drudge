// @ts-nocheck
import logger from '../../shared/utils/logger';
import moment from 'moment-timezone';
import notificationService from '../../application/services/business/NotificationService';
import knowledgeGraphServiceV2 from '../../application/services/KnowledgeGraphServiceV2';
import fileStorage from '../../infrastructure/storage/FileStorage';
import newsLevelService from '../../application/services/business/NewsLevelService';

// 设置默认时区为北京时间
moment.tz.setDefault('Asia/Shanghai');

/**
 * 新闻级别检查脚本 - 命令行入口
 * 所有业务逻辑已移到 NewsLevelService 中
 */
class NewsLevelCheckScript {
  constructor() {
    this.notification = notificationService;
    this.knowledgeGraph = knowledgeGraphServiceV2;
    this.storage = fileStorage;
    this.newsLevel = newsLevelService;
    this.commands = {
      'check': this.checkNewsLevels.bind(this),
      'check-recent': this.checkRecentNews.bind(this),
      'check-single': this.checkSingleNews.bind(this),
      'rescan': this.rescanNews.bind(this),
      'notify': this.sendBreakNewsNotification.bind(this),
      'stats': this.getLevelStats.bind(this),
      'history': this.getBreakNewsHistory.bind(this),
      'help': this.showHelp.bind(this)
    };
  }

  /**
   * 批量检查新闻级别
   */
  async checkNewsLevels(limit = 50) {
    const limitNum = parseInt(limit) || 50;
    console.log(`🔍 开始检查新闻级别，限制: ${limitNum} 条...\n`);
    
    const result = await this.newsLevel.checkNewsLevels(limitNum);
    
    if (result.success) {
      console.log(`✅ ${result.message}`);
      console.log(`📊 检查: ${result.checked} 条`);
      console.log(`🔴 高级别: ${result.high_level} 条`);
      console.log(`🚨 突发新闻: ${result.break_news} 条`);
      console.log(`🕒 时间: ${result.timestamp}`);

      if (result.results && result.results.length > 0) {
        console.log('\n🔴 高级别新闻:');
        console.log(''.padEnd(80, '='));
        result.results.filter(r => r.isHighLevel).forEach((news, index) => {
          console.log(`${index + 1}. [${news.level}] ${news.title}`);
          console.log(`   ID: ${news.newsId}`);
          console.log(`   时间: ${news.timestamp}`);
          if (news.isBreakNews) console.log('   🚨 突发新闻');
          console.log('');
        });
      }
    } else {
      console.error(`❌ 检查失败: ${result.error}`);
    }
    
    return result;
  }

  /**
   * 检查最近新闻的级别
   */
  async checkRecentNews(hours = 12) {
    const hoursNum = parseInt(hours) || 12;
    console.log(`🔍 开始检查最近 ${hoursNum} 小时的新闻级别...\n`);
    
    const result = await this.newsLevel.checkRecentNews(hoursNum);
    
    if (result.success) {
      console.log(`✅ ${result.message}`);
      console.log(`📊 时间段: ${result.period}`);
      console.log(`📊 总找到: ${result.total_found} 条`);
      console.log(`🔴 高级别: ${result.high_level} 条`);
      console.log(`🚨 突发新闻: ${result.break_news} 条`);
      console.log(`🕒 时间: ${result.timestamp}`);

      if (result.results && result.results.length > 0) {
        console.log('\n🔴 高级别新闻列表:');
        console.log(''.padEnd(80, '='));
        result.results.forEach((news, index) => {
          console.log(`${index + 1}. [${news.level}] ${news.title}`);
          console.log(`   ID: ${news.newsId}`);
          console.log(`   时间: ${news.time}`);
          if (news.isBreakNews) console.log('   🚨 突发新闻');
          console.log('');
        });
      }
    } else {
      console.error(`❌ 检查失败: ${result.error}`);
    }
    
    return result;
  }

  /**
   * 检查单个新闻级别
   */
  async checkSingleNews(newsId) {
    if (!newsId) {
      console.error('❌ 请提供新闻ID');
      return { success: false, error: '缺少新闻ID参数' };
    }

    console.log(`🔍 开始检查新闻级别: ${newsId}...\n`);
    
    const result = await this.newsLevel.checkSingleNews(newsId);
    
    if (result.success) {
      console.log(`✅ ${result.message}`);
      console.log(`📊 新闻ID: ${result.newsId}`);
      console.log(`📰 标题: ${result.title}`);
      console.log(`📊 级别: ${result.level}`);
      console.log(`🔴 高级别: ${result.isHighLevel ? '是' : '否'}`);
      console.log(`🚨 突发新闻: ${result.isBreakNews ? '是' : '否'}`);
      console.log(`📡 需要推送: ${result.shouldPush ? '是' : '否'}`);
      console.log(`🕒 时间: ${result.timestamp}`);
    } else {
      console.error(`❌ 检查失败: ${result.error}`);
    }
    
    return result;
  }

  /**
   * 重新扫描新闻级别
   */
  async rescanNews(limit = 100) {
    const limitNum = parseInt(limit) || 100;
    console.log(`🔄 开始重新扫描新闻级别，限制: ${limitNum} 条...\n`);
    
    const result = await this.newsLevel.rescanNews(limitNum);
    
    if (result.success) {
      console.log(`✅ ${result.message}`);
      console.log(`📊 扫描: ${result.scanned} 条`);
      console.log(`🔄 更新: ${result.updated} 条`);
      console.log(`❌ 失败: ${result.errors} 条`);
      console.log(`🕒 时间: ${result.timestamp}`);
    } else {
      console.error(`❌ 重新扫描失败: ${result.error}`);
    }
    
    return result;
  }

  /**
   * 发送突发新闻通知
   */
  async sendBreakNewsNotification(hours = 24) {
    const hoursNum = parseInt(hours) || 24;
    console.log(`📡 开始发送最近 ${hoursNum} 小时的突发新闻通知...\n`);
    
    const result = await this.newsLevel.sendBreakNewsNotification(hoursNum);
    
    if (result.success) {
      console.log(`✅ ${result.message}`);
      console.log(`📡 发送: ${result.sent} 条通知`);
      console.log(`📊 时间段: ${result.period}`);
      console.log(`🕒 时间: ${result.timestamp}`);
    } else {
      console.error(`❌ 发送失败: ${result.error}`);
    }
    
    return result;
  }

  /**
   * 获取级别统计
   */
  async getLevelStats(days = 7) {
    const daysNum = parseInt(days) || 7;
    console.log(`📊 获取最近 ${daysNum} 天的级别统计...\n`);
    
    const result = await this.newsLevel.getLevelStats(daysNum);
    
    if (result.success) {
      console.log('📊 新闻级别统计:');
      console.log(''.padEnd(40, '='));
      console.log(`📊 时间段: ${result.period}`);
      
      const stats = result.stats;
      console.log(`📰 总数: ${stats.total} 条`);
      console.log(`🔴 高级别: ${stats.highLevel} 条`);
      console.log(`🚨 突发新闻: ${stats.breakNews} 条`);
      console.log(`📊 平均影响分: ${(stats.avgImpactScore || 0).toFixed(2)}`);
      
      if (stats.levelDistribution) {
        console.log('\n📊 级别分布:');
        Object.entries(stats.levelDistribution).forEach(([level, count]) => {
          console.log(`   ${level}: ${count} 条`);
        });
      }
      
      console.log(`\n🕒 时间: ${result.timestamp}`);
    } else {
      console.error(`❌ 获取统计失败: ${result.error}`);
    }
    
    return result;
  }

  /**
   * 获取突发新闻历史
   */
  async getBreakNewsHistory(days = 30) {
    const daysNum = parseInt(days) || 30;
    console.log(`📜 获取最近 ${daysNum} 天的突发新闻历史...\n`);
    
    const result = await this.newsLevel.getBreakNewsHistoryData(daysNum);
    
    if (result.success) {
      console.log(`📜 突发新闻历史 (最近 ${result.period}):`);
      console.log(''.padEnd(80, '='));
      console.log(`📊 总计: ${result.count} 条突发新闻`);
      
      if (result.history && result.history.length > 0) {
        console.log('\n🚨 突发新闻列表:');
        result.history.forEach((news, index) => {
          console.log(`${index + 1}. ${news.title}`);
          console.log(`   ID: ${news.newsId}`);
          console.log(`   时间: ${moment(news.detectedAt).format('YYYY-MM-DD HH:mm:ss')}`);
          console.log(`   影响分: ${news.impactScore || 'N/A'}`);
          if (news.companies && news.companies.length > 0) {
            console.log(`   公司: ${news.companies.join(', ')}`);
          }
          if (news.reason) {
            console.log(`   原因: ${news.reason}`);
          }
          console.log('');
        });
      } else {
        console.log('\n📰 在指定时间段内没有突发新闻');
      }
      
      console.log(`🕒 时间: ${result.timestamp}`);
    } else {
      console.error(`❌ 获取历史失败: ${result.error}`);
    }
    
    return result;
  }

  /**
   * 显示帮助信息
   */
  showHelp() {
    console.log(`
📊 新闻级别检查工具

用法:
  npm run level <command> [options]

命令:
  check [限制数]            批量检查新闻级别 (默认50条)
  check-recent [小时数]     检查最近N小时新闻级别 (默认12小时)
  check-single <新闻ID>     检查单个新闻级别
  rescan [限制数]           重新扫描新闻级别 (默认100条)
  notify [小时数]           发送突发新闻通知 (默认24小时)
  stats [天数]              获取级别统计 (默认7天)
  history [天数]            获取突发新闻历史 (默认30天)
  help                      显示帮助信息

示例:
  npm run level check 30              # 检查30条新闻级别
  npm run level check-recent 6        # 检查最近6小时新闻
  npm run level check-single 19035854 # 检查指定新闻级别
  npm run level rescan 50             # 重新扫描50条新闻
  npm run level notify 12             # 发送最近12小时突发新闻通知
  npm run level stats 14              # 获取最近14天统计
  npm run level history 60            # 获取最近60天突发新闻历史
`);
  }

  /**
   * 执行命令
   */
  async execute(command, ...args) {
    const handler = this.commands[command];
    if (!handler) {
      console.error(`❌ 未知命令: ${command}`);
      this.showHelp();
      return { success: false, error: `未知命令: ${command}` };
    }

    try {
      return await handler(...args);
    } catch (error) {
      console.error(`❌ 执行命令失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}

// 主函数
async function main() {
  const script = new NewsLevelCheckScript();
  const command = process.argv[2] || 'help';
  const args = process.argv.slice(3);

  // 如果需要访问数据库，先初始化连接
  const dbCommands = ['check', 'check-recent', 'check-single', 'rescan', 'stats', 'history'];
  if (dbCommands.includes(command)) {
    try {
      // 初始化知识图谱服务
      await script.knowledgeGraph.initialize();
      logger.info('知识图谱服务已初始化');
    } catch (error) {
      console.error(`❌ 数据库初始化失败: ${error.message}`);
      process.exit(1);
    }
  }

  const result = await script.execute(command, ...args);
  
  if (result && !result.success) {
    process.exit(1);
  }
}

// 错误处理
process.on('unhandledRejection', (error) => {
  console.error('未处理的Promise拒绝:', error);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error);
  process.exit(1);
});

// 运行主函数
// @ts-ignore
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default NewsLevelCheckScript;
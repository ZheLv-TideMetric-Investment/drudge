// @ts-nocheck
import logger from '../../shared/utils/logger';
import moment from 'moment-timezone';
import newsProcessingServiceV2 from '../../application/services/NewsProcessingServiceV2';
import knowledgeGraphServiceV2 from '../../application/services/KnowledgeGraphServiceV2';
import fileStorage from '../../infrastructure/storage/FileStorage';
import hourlySummaryService from '../../application/services/business/HourlySummaryService';
import highLevelNewsScanner from '../../application/services/business/HighLevelNewsScanner';
import dailySummaryService from '../../application/services/business/DailySummaryService';

// 设置默认时区为北京时间
moment.tz.setDefault('Asia/Shanghai');

/**
 * 知识图谱脚本 - 命令行入口
 * 所有业务逻辑已移到相应的服务中
 */
class KnowledgeGraphScript {
  constructor() {
    this.newsProcessing = newsProcessingServiceV2;
    this.knowledgeGraph = knowledgeGraphServiceV2;
    this.storage = fileStorage;
    this.hourlySummary = hourlySummaryService;
    this.highLevelScanner = highLevelNewsScanner;
    this.dailySummary = dailySummaryService;
    this.commands = {
      'process': this.processUnprocessedNews.bind(this),
      'process-batch': this.processBatchNews.bind(this),
      'process-recent': this.processRecentNews.bind(this),
      'reprocess': this.reprocessNews.bind(this),
      'query': this.queryGraph.bind(this),
      'stats': this.getGraphStats.bind(this),
      'export': this.exportGraph.bind(this),
      'rebuild': this.rebuildGraph.bind(this),
      'hourly-summary': this.generateHourlySummary.bind(this),
      'daily-summary': this.generateDailySummary.bind(this),
      'scan-high-level': this.scanHighLevelNews.bind(this),
      'status': this.getStatus.bind(this),
      'help': this.showHelp.bind(this)
    };
  }

  /**
   * 处理未处理的新闻
   */
  async processUnprocessedNews(limit = 100) {
    const limitNum = parseInt(limit) || 100;
    console.log(`🔄 开始处理未处理的新闻，限制: ${limitNum} 条...\n`);
    
    const result = await this.newsProcessing.processUnprocessedNews(this.storage, limitNum);
    
    if (result.success) {
      console.log(`✅ ${result.message}`);
      console.log(`📊 找到: ${result.total_found} 条未处理新闻`);
      console.log(`✅ 成功: ${result.processed} 条`);
      console.log(`❌ 失败: ${result.errors} 条`);
      console.log(`🕒 时间: ${result.timestamp}`);
    } else {
      console.error(`❌ 处理失败: ${result.error}`);
    }
    
    return result;
  }

  /**
   * 批量处理指定数量的新闻
   */
  async processBatchNews(count = 50) {
    const countNum = parseInt(count) || 50;
    console.log(`🔄 开始批量处理 ${countNum} 条新闻...\n`);

    const allNews = await this.storage.getAll();
    
    if (allNews.length === 0) {
      console.log('📰 没有找到新闻');
      return { success: true, processed: 0 };
    }

    const newsToProcess = allNews.slice(0, countNum);
    console.log(`📊 将处理 ${newsToProcess.length} 条新闻`);

    let processedCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    // 定义批次完成回调函数
    const onBatchComplete = async (batchInfo) => {
      const { batchResults, batchSummary, overallProgress } = batchInfo;
      
      // 统计结果
      for (const result of batchResults) {
        if (result.success && !result.skipped) {
          processedCount++;
        } else if (result.skipped) {
          skippedCount++;
        } else {
          errorCount++;
        }
      }

      console.log(`📊 批次进度: ${overallProgress.processed}/${overallProgress.total} (成功: ${batchSummary.success}, 失败: ${batchSummary.failed})`);
    };

    const batchSize = 5;
    await this.newsProcessing.batchProcessNews(newsToProcess, batchSize, onBatchComplete);

    const message = `批量处理完成: 成功 ${processedCount} 条，跳过 ${skippedCount} 条，失败 ${errorCount} 条`;
    console.log(`\n✅ ${message}`);
    logger.info(message);

    return {
      success: true,
      processed: processedCount,
      skipped: skippedCount,
      errors: errorCount,
      message,
      timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
    };
  }

  /**
   * 处理最近的新闻
   */
  async processRecentNews(hours = 24) {
    const hoursNum = parseInt(hours) || 24;
    console.log(`🔄 开始处理最近 ${hoursNum} 小时的新闻...\n`);
    
    const result = await this.newsProcessing.processRecentNews(this.storage, hoursNum);
    
    if (result.success) {
      console.log(`✅ ${result.message}`);
      console.log(`📊 时间段: ${result.period}`);
      console.log(`📊 找到: ${result.total_found} 条新闻`);
      console.log(`✅ 成功: ${result.processed} 条`);
      console.log(`⏭️ 跳过: ${result.skipped} 条`);
      console.log(`❌ 失败: ${result.errors} 条`);
      console.log(`🕒 时间: ${result.timestamp}`);
    } else {
      console.error(`❌ 处理失败: ${result.error}`);
    }
    
    return result;
  }

  /**
   * 重新处理指定新闻
   */
  async reprocessNews(newsId) {
    if (!newsId) {
      console.error('❌ 请提供新闻ID');
      return { success: false, error: '缺少新闻ID参数' };
    }

    console.log(`🔄 开始重新处理新闻: ${newsId}...\n`);
    
    const result = await this.newsProcessing.reprocessNews(this.storage, newsId);
    
    if (result.success) {
      console.log(`✅ ${result.message}`);
      console.log(`📊 新闻ID: ${result.newsId}`);
      if (result.stats) {
        console.log(`📊 统计: 事件${result.stats.events}个，公司${result.stats.companies}个，人物${result.stats.persons}个`);
      }
      console.log(`🕒 时间: ${result.timestamp}`);
    } else {
      console.error(`❌ 重新处理失败: ${result.error}`);
    }
    
    return result;
  }

  /**
   * 查询知识图谱
   */
  async queryGraph(query, limit = 10) {
    if (!query) {
      console.error('❌ 请提供查询关键词');
      return { success: false, error: '缺少查询关键词' };
    }

    const limitInt = parseInt(limit) || 10;
    console.log(`🔍 查询知识图谱: "${query}"，限制${limitInt}条结果...\n`);

    const results = await this.knowledgeGraph.searchRelatedNews(query, limitInt);
    
    if (results.length === 0) {
      console.log('📰 没有找到相关新闻');
      return { success: true, results: [] };
    }

    console.log(`🎯 找到 ${results.length} 条相关新闻:`);
    console.log(''.padEnd(80, '='));

    results.forEach((result, index) => {
      console.log(`${index + 1}. [相关度: ${result.relevance || 'N/A'}%] ${result.title}`);
      console.log(`   ID: ${result.newsId}`);
      if (result.companies && result.companies.length > 0) {
        console.log(`   公司: ${result.companies.join(', ')}`);
      }
      if (result.events && result.events.length > 0) {
        console.log(`   事件: ${result.events.join(', ')}`);
      }
      if (result.detectedAt) {
        console.log(`   时间: ${moment(result.detectedAt).format('YYYY-MM-DD HH:mm:ss')}`);
      }
      console.log('');
    });

    return {
      success: true,
      query,
      count: results.length,
      results,
      timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
    };
  }

  /**
   * 获取图谱统计
   */
  async getGraphStats() {
    console.log('📊 获取知识图谱统计信息...\n');
    
    const stats = await this.knowledgeGraph.getStats();
    
    console.log('📊 知识图谱统计:');
    console.log(''.padEnd(40, '='));
    console.log(`📰 新闻节点: ${stats.news || 0} 个`);
    console.log(`🏢 公司节点: ${stats.companies || 0} 个`);
    console.log(`👤 人物节点: ${stats.persons || 0} 个`);
    console.log(`📍 地点节点: ${stats.locations || 0} 个`);
    console.log(`⏰ 时间节点: ${stats.times || 0} 个`);
    console.log(`📋 事件节点: ${stats.events || 0} 个`);
    console.log(`🔗 关系总数: ${stats.relationships || 0} 个`);
    console.log(`📊 总节点数: ${stats.nodes || 0} 个`);
    console.log(`🕒 统计时间: ${moment().format('YYYY-MM-DD HH:mm:ss')}`);

    return {
      success: true,
      stats,
      timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
    };
  }

  /**
   * 导出图谱数据
   */
  async exportGraph(format = 'json') {
    console.log(`📤 导出知识图谱数据 (格式: ${format})...\n`);
    
    const result = await this.knowledgeGraph.exportGraph(format);
    
    if (result.success) {
      console.log(`✅ 导出完成: ${result.fileName}`);
      console.log(`📊 导出数据: ${result.nodeCount} 个节点，${result.relationshipCount} 个关系`);
      console.log(`💾 文件大小: ${result.fileSize || 'N/A'}`);
      console.log(`🕒 时间: ${result.timestamp}`);
    } else {
      console.error(`❌ 导出失败: ${result.error}`);
    }
    
    return result;
  }

  /**
   * 重建图谱
   */
  async rebuildGraph() {
    console.log('🔄 开始重建知识图谱...\n');
    
    const result = await this.knowledgeGraph.rebuildGraph();
    
    if (result.success) {
      console.log(`✅ 重建完成`);
      console.log(`📊 处理: ${result.processed} 条新闻`);
      console.log(`⏱️ 耗时: ${result.duration || 'N/A'}`);
      console.log(`🕒 时间: ${result.timestamp}`);
    } else {
      console.error(`❌ 重建失败: ${result.error}`);
    }
    
    return result;
  }

  /**
   * 获取服务状态
   */
  async getStatus() {
    console.log('📊 检查知识图谱服务状态...\n');
    
    const healthCheck = await this.knowledgeGraph.healthCheck();
    const stats = await this.knowledgeGraph.getStats();
    
    console.log('📊 服务状态:');
    console.log(''.padEnd(40, '='));
    console.log(`🔗 数据库连接: ${this.getStatusIcon(healthCheck.status)} ${healthCheck.status || 'unknown'}`);
    console.log(`📰 新闻数量: ${stats.news || 0} 条`);
    console.log(`📊 总节点数: ${stats.nodes || 0} 个`);
    console.log(`🔗 总关系数: ${stats.relationships || 0} 个`);
    console.log(`🚀 服务状态: ${this.getStatusIcon(healthCheck.status)} ${healthCheck.status === 'healthy' ? '正常' : '异常'}`);
    console.log(`🕒 检查时间: ${moment().format('YYYY-MM-DD HH:mm:ss')}`);

    return {
      success: healthCheck.status === 'healthy',
      health: healthCheck,
      stats,
      timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
    };
  }

  /**
   * 生成小时总结
   */
  async generateHourlySummary(hour) {
    const targetHour = hour ? parseInt(hour) : moment().hour();
    console.log(`📊 开始生成 ${targetHour}:00 的小时总结...\n`);
    
    const result = await this.hourlySummary.generateHourlySummary(targetHour);
    
    if (result.success) {
      if (result.skipped) {
        console.log(`⏭️ ${result.reason}`);
      } else if (result.empty) {
        console.log(`📊 ${result.message}`);
      } else {
        console.log(`✅ ${result.message}`);
        console.log(`📊 时间段: ${result.period}`);
        console.log(`📰 新闻数量: ${result.news_count} 条`);
        console.log(`🔴 高级别新闻: ${result.high_level_count} 条`);
        
        if (result.summary) {
          console.log('\n📋 总结内容:');
          console.log(''.padEnd(60, '='));
          console.log(`🔍 整体概况: ${result.summary.overall_summary}`);
          console.log(`📈 市场影响: ${result.summary.market_impact}`);
          
          if (result.summary.key_highlights && result.summary.key_highlights.length > 0) {
            console.log('\n🎯 重要亮点:');
            result.summary.key_highlights.forEach((highlight, index) => {
              console.log(`  ${index + 1}. ${highlight}`);
            });
          }
          
          if (result.summary.focus_areas && result.summary.focus_areas.length > 0) {
            console.log('\n⚠️ 关注焦点:');
            result.summary.focus_areas.forEach((area) => {
              console.log(`  • ${area}`);
            });
          }
          
          console.log(`\n📊 严重程度: ${result.summary.severity_assessment.toUpperCase()}`);
          console.log(`🎯 置信度: ${Math.round(result.summary.confidence * 100)}%`);
        }
      }
      console.log(`🕒 时间: ${result.timestamp}`);
    } else {
      console.error(`❌ 生成失败: ${result.error}`);
    }
    
    return result;
  }

  /**
   * 生成每日总结
   */
  async generateDailySummary(date) {
    if (date) {
      console.log(`📊 开始生成 ${date} 的每日总结...\n`);
      // 注意：手动生成功能待实现
      console.log('⚠️ 手动指定日期的功能待实现，将生成今天的总结');
    } else {
      console.log(`📊 开始生成今天的每日总结...\n`);
    }
    
    const result = await this.dailySummary.generateDailySummary();
    
    if (result.success) {
      if (result.skipped) {
        console.log(`⏭️ ${result.reason}`);
      } else if (result.empty) {
        console.log(`📊 ${result.message}`);
      } else {
        console.log(`✅ ${result.message}`);
        console.log(`📊 时间段: ${result.period}`);
        console.log(`📰 新闻数量: ${result.news_count} 条`);
        console.log(`🔴 高级别新闻: ${result.high_level_count} 条`);
        console.log(`🚨 紧急新闻: ${result.critical_count} 条`);
        
        if (result.summary) {
          console.log('\n📋 每日总结:');
          console.log(''.padEnd(60, '='));
          console.log(`🌙 夜间概况: ${result.summary.overnight_overview}`);
          console.log(`⚠️ 风险评估: ${result.summary.market_risk_assessment}`);
          
          if (result.summary.key_trends && result.summary.key_trends.length > 0) {
            console.log('\n📈 关键趋势:');
            result.summary.key_trends.forEach((trend, index) => {
              console.log(`  ${index + 1}. ${trend}`);
            });
          }
          
          if (result.summary.today_focus && result.summary.today_focus.length > 0) {
            console.log('\n🎯 今日关注:');
            result.summary.today_focus.forEach((focus) => {
              console.log(`  • ${focus}`);
            });
          }
          
          console.log(`\n📊 严重程度: ${result.summary.overall_severity.toUpperCase()}`);
          console.log(`🎯 置信度: ${Math.round(result.summary.confidence * 100)}%`);
        }
      }
      console.log(`🕒 时间: ${result.timestamp}`);
    } else {
      console.error(`❌ 生成失败: ${result.error}`);
    }
    
    return result;
  }

  /**
   * 扫描高级别新闻
   */
  async scanHighLevelNews(minutes = 30) {
    const minutesNum = parseInt(minutes) || 30;
    console.log(`🔍 开始扫描最近 ${minutesNum} 分钟的高级别新闻...\n`);
    
    const result = await this.highLevelScanner.manualScan(minutesNum);
    
    if (result.success) {
      console.log(`✅ ${result.message}`);
      console.log(`📊 时间段: ${result.period}`);
      console.log(`🔍 发现: ${result.found || 0} 条高级别新闻`);
      console.log(`🆕 新增: ${result.new_found || 0} 条`);
      console.log(`📡 发送通知: ${result.sent || 0} 条`);
      
      if (result.high_level_news && result.high_level_news.length > 0) {
        console.log('\n🔴 高级别新闻列表:');
        console.log(''.padEnd(80, '='));
        result.high_level_news.forEach((news, index) => {
          const urgencyEmoji = {
            'critical': '🚨',
            'high': '🔴',
            'medium': '🟡'
          };
          const emoji = urgencyEmoji[news.urgency] || '⚠️';
          
          console.log(`${index + 1}. ${emoji} [${news.level}] ${news.title}`);
          console.log(`   ID: ${news.newsId}`);
          console.log(`   紧急度: ${news.urgency.toUpperCase()}`);
          console.log('');
        });
      }
      
      if (result.manual) {
        console.log(`📋 手动扫描时间段: ${result.manual_period}`);
      }
      console.log(`🕒 时间: ${result.timestamp}`);
    } else {
      console.error(`❌ 扫描失败: ${result.error}`);
    }
    
    return result;
  }

  /**
   * 显示帮助信息
   */
  showHelp() {
    console.log(`
🧠 知识图谱工具

用法:
  npm run graph <command> [options]

命令:
  process [限制数]           处理未处理的新闻 (默认100条)
  process-batch [数量]       批量处理新闻 (默认50条)
  process-recent [小时]      处理最近N小时的新闻 (默认24小时)
  reprocess <新闻ID>         重新处理指定新闻
  query <关键词> [限制数]    查询知识图谱 (默认10条结果)
  stats                      显示图谱统计信息
  export [格式]              导出图谱数据 (默认json格式)
  rebuild                    重建整个知识图谱
  hourly-summary [小时]      生成小时总结 (默认当前小时)
  daily-summary [日期]       生成每日总结 (默认今天)
  scan-high-level [分钟数]   手动扫描高级别新闻 (默认30分钟)
  status                     检查服务状态
  help                       显示帮助信息

示例:
  npm run graph process 50              # 处理50条未处理新闻
  npm run graph process-batch 20        # 批量处理20条新闻
  npm run graph process-recent 12       # 处理最近12小时新闻
  npm run graph reprocess 19035854      # 重新处理指定新闻
  npm run graph query "小米" 5          # 查询"小米"相关新闻，限制5条
  npm run graph stats                   # 显示统计信息
  npm run graph export csv              # 导出为CSV格式
  npm run graph rebuild                 # 重建图谱
  npm run graph hourly-summary 15      # 生成15点的小时总结
  npm run graph daily-summary          # 生成今天的每日总结
  npm run graph scan-high-level 60     # 扫描最近60分钟的高级别新闻
  npm run graph status                  # 检查状态
`);
  }

  /**
   * 获取状态图标
   */
  getStatusIcon(status) {
    const icons = {
      'healthy': '✅',
      'unhealthy': '❌',
      'unknown': '❓'
    };
    return icons[status] || '❓';
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
  const script = new KnowledgeGraphScript();
  const command = process.argv[2] || 'help';
  const args = process.argv.slice(3);

  // 如果需要访问数据库，先初始化连接
  const dbCommands = ['hourly-summary', 'daily-summary', 'scan-high-level', 'query', 'stats', 'status'];
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

export default KnowledgeGraphScript; 
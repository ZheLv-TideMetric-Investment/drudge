// @ts-nocheck
import logger from '../shared/utils/logger';
import moment from 'moment-timezone';
import newsProcessingService from '../application/services/NewsProcessingService';
import knowledgeGraphService from '../application/services/knowledgeGraphService';
import fileStorage from '../infrastructure/storage/FileStorage';

// 设置默认时区为北京时间
moment.tz.setDefault('Asia/Shanghai');

/**
 * 知识图谱化脚本
 * 专门负责新闻实体提取和知识图谱构建
 */
class KnowledgeGraphProcessor {
  constructor() {
    this.newsProcessing = newsProcessingService;
    this.knowledgeGraph = knowledgeGraphService;
    this.storage = fileStorage;
    this.commands = {
      'process': this.processUnprocessedNews.bind(this),
      'process-batch': this.processBatchNews.bind(this),
      'process-recent': this.processRecentNews.bind(this),
      'reprocess': this.reprocessNews.bind(this),
      'query': this.queryGraph.bind(this),
      'stats': this.getGraphStats.bind(this),
      'export': this.exportGraph.bind(this),
      'rebuild': this.rebuildGraph.bind(this),
      'status': this.getStatus.bind(this),
      'help': this.showHelp.bind(this)
    };
  }

  /**
   * 初始化服务
   */
  async initialize() {
    try {
      await this.knowledgeGraph.initialize();
      return true;
    } catch (error) {
      logger.error('初始化知识图谱服务失败:', error);
      throw error;
    }
  }

  /**
   * 处理未处理的新闻
   */
  async processUnprocessedNews(limit = 100) {
    try {
      await this.initialize();
      
      const limitNum = parseInt(limit) || 100;
      logger.info(`🔄 开始处理未处理的新闻，限制: ${limitNum} 条`);

      // 获取所有本地新闻
      const allNews = await this.storage.getAll(); // 获取所有新闻
      
      if (allNews.length === 0) {
        console.log('📰 没有找到本地新闻');
        return { success: true, processed: 0, message: '没有本地新闻' };
      }

      // 筛选未处理的新闻
      const newsIds = allNews.map(item => item.id);
      const unprocessedIds = await this.newsProcessing.getUnprocessedNewsIds(newsIds);
      const unprocessedNews = allNews.filter(item => unprocessedIds.includes(item.id));

      if (unprocessedNews.length === 0) {
        console.log('✅ 所有新闻都已处理过');
        return { success: true, processed: 0, message: '没有需要处理的新闻' };
      }

      // 限制处理数量
      const newsToProcess = unprocessedNews.slice(0, limitNum);
      
      console.log(`📊 找到 ${unprocessedNews.length} 条未处理新闻，将处理 ${newsToProcess.length} 条`);

      let processedCount = 0;
      let errorCount = 0;

      // 流式批量处理
      const batchSize = 5;
      
      // 定义批次完成回调函数
      const onBatchComplete = async (batchInfo) => {
        const { batchResults, batchSummary, overallProgress } = batchInfo;
        
        // 统计结果
        for (const result of batchResults) {
          if (result.success && !result.skipped) {
            processedCount++;
          } else if (result.error) {
            errorCount++;
          }
        }

        console.log(`📊 批次完成: ${overallProgress.processed}/${overallProgress.total} (成功: ${batchSummary.success}, 失败: ${batchSummary.failed})`);
      };

      try {
        await this.newsProcessing.batchProcessNews(newsToProcess, batchSize, onBatchComplete);
      } catch (error) {
        logger.error(`批次处理失败:`, error);
        errorCount += newsToProcess.length;
      }

      const message = `✅ 图谱化处理完成: 成功 ${processedCount} 条，失败 ${errorCount} 条`;
      console.log(message);
      logger.info(message);

      return {
        success: true,
        total_found: unprocessedNews.length,
        processed: processedCount,
        errors: errorCount,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };

    } catch (error) {
      const errorMsg = `❌ 处理失败: ${error.message}`;
      console.error(errorMsg);
      logger.error('处理未处理新闻失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 批量处理指定数量的新闻
   */
  async processBatchNews(count = 50) {
    try {
      await this.initialize();

      const countNum = parseInt(count) || 50;
      logger.info(`🔄 开始批量处理 ${countNum} 条新闻...`);

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

      const message = `✅ 批量处理完成: 成功 ${processedCount} 条，跳过 ${skippedCount} 条，失败 ${errorCount} 条`;
      console.log(message);
      logger.info(message);

      return {
        success: true,
        processed: processedCount,
        skipped: skippedCount,
        errors: errorCount,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };

    } catch (error) {
      console.error(`❌ 批量处理失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 处理最近的新闻
   */
  async processRecentNews(hours = 24) {
    try {
      await this.initialize();

      const hoursNum = parseInt(hours) || 24;
      logger.info(`🔄 开始处理最近 ${hoursNum} 小时的新闻...`);

      const endTime = moment();
      const startTime = moment().subtract(hoursNum, 'hours');

      const recentNews = await this.storage.getByTimeRange(startTime, endTime);

      if (recentNews.length === 0) {
        console.log(`📰 最近 ${hoursNum} 小时没有新闻`);
        return { success: true, processed: 0 };
      }

      console.log(`📊 找到 ${recentNews.length} 条最近的新闻`);

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
      await this.newsProcessing.batchProcessNews(recentNews, batchSize, onBatchComplete);

      const message = `✅ 最近新闻处理完成: 成功 ${processedCount} 条，跳过 ${skippedCount} 条，失败 ${errorCount} 条`;
      console.log(message);

      return {
        success: true,
        period: `${hoursNum} 小时`,
        total_found: recentNews.length,
        processed: processedCount,
        skipped: skippedCount,
        errors: errorCount,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };

    } catch (error) {
      console.error(`❌ 处理最近新闻失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 重新处理指定新闻
   */
  async reprocessNews(newsId) {
    try {
      await this.initialize();

      if (!newsId) {
        console.error('❌ 请提供新闻ID');
        return { success: false, error: '缺少新闻ID' };
      }

      logger.info(`🔄 重新处理新闻: ${newsId}`);

      const newsItem = await this.storage.getById(newsId);
      if (!newsItem) {
        console.error(`❌ 未找到新闻: ${newsId}`);
        return { success: false, error: '新闻不存在' };
      }

      const result = await this.newsProcessing.processNews(newsItem, true); // 强制重新处理

      if (result.success) {
        console.log(`✅ 重新处理成功: ${newsId}`);
        return { success: true, newsId, result };
      } else {
        console.error(`❌ 重新处理失败: ${newsId}`);
        return { success: false, newsId, error: result.error };
      }

    } catch (error) {
      console.error(`❌ 重新处理失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 查询知识图谱
   */
  async queryGraph(query, limit = 10) {
    try {
      await this.initialize();

      if (!query) {
        console.error('❌ 请提供查询关键词');
        return { success: false, error: '缺少查询关键词' };
      }

      const limitNum = parseInt(limit) || 10;
      logger.info(`🔍 查询知识图谱: ${query}，限制: ${limitNum} 条`);

      const results = await this.knowledgeGraph.searchRelatedNews(query, limitNum);

      if (results.length === 0) {
        console.log(`📊 没有找到与 "${query}" 相关的结果`);
        return { success: true, count: 0, query };
      }

      console.log(`📊 找到 ${results.length} 条相关结果:`);
      console.log(''.padEnd(80, '='));

      results.forEach((result, index) => {
        console.log(`${index + 1}. ${result.title}`);
        console.log(`   相关度: ${(result.relevance * 100).toFixed(1)}%`);
        console.log(`   时间: ${moment(result.time * 1000).format('YYYY-MM-DD HH:mm:ss')}`);
        if (result.entities && result.entities.length > 0) {
          console.log(`   实体: ${result.entities.slice(0, 3).join(', ')}${result.entities.length > 3 ? '...' : ''}`);
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

    } catch (error) {
      console.error(`❌ 查询失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取图谱统计信息
   */
  async getGraphStats() {
    try {
      await this.initialize();

      const stats = await this.knowledgeGraph.getStats();

      console.log('📊 知识图谱统计信息:');
      console.log(`   节点总数: ${stats.nodes || 0}`);
      console.log(`   关系总数: ${stats.relationships || 0}`);
      console.log(`   新闻数量: ${stats.news || 0}`);
      console.log(`   实体数量: ${stats.entities || 0}`);
      
      if (stats.entity_types) {
        console.log('   实体类型分布:');
        Object.entries(stats.entity_types).forEach(([type, count]) => {
          console.log(`     ${type}: ${count}`);
        });
      }

      console.log(`   更新时间: ${moment().format('YYYY-MM-DD HH:mm:ss')}`);

      return {
        success: true,
        stats,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };

    } catch (error) {
      console.error(`❌ 获取统计失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 导出图谱数据
   */
  async exportGraph(format = 'json') {
    try {
      await this.initialize();

      logger.info(`📤 开始导出图谱数据，格式: ${format}`);

      const exportData = await this.knowledgeGraph.exportGraph(format);
      const timestamp = moment().format('YYYYMMDD_HHmmss');
      const filename = `graph_export_${timestamp}.${format}`;

      // 保存到文件
      const fs = await import('fs/promises');
      await fs.writeFile(filename, typeof exportData === 'string' ? exportData : JSON.stringify(exportData, null, 2));

      console.log(`✅ 图谱数据已导出到: ${filename}`);

      return {
        success: true,
        filename,
        format,
        timestamp
      };

    } catch (error) {
      console.error(`❌ 导出失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 重建图谱索引
   */
  async rebuildGraph() {
    try {
      await this.initialize();

      console.log('⚠️  即将重建知识图谱索引，这可能需要几分钟时间...');
      console.log('确认继续请在5秒内按Ctrl+C取消...');
      await new Promise(resolve => setTimeout(resolve, 5000));

      logger.info('🔧 开始重建知识图谱索引...');

      await this.knowledgeGraph.rebuildIndexes();

      console.log('✅ 知识图谱索引重建完成');

      return {
        success: true,
        message: '索引重建完成',
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };

    } catch (error) {
      console.error(`❌ 重建索引失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取模块状态
   */
  async getStatus() {
    try {
      await this.initialize();

      const healthCheck = await this.knowledgeGraph.healthCheck();
      const stats = await this.knowledgeGraph.getStats();

      console.log('📊 知识图谱模块状态:');
      console.log(`   数据库状态: ${healthCheck.status === 'healthy' ? '✅ 正常' : '❌ 异常'}`);
      console.log(`   节点数量: ${stats.nodes || 0}`);
      console.log(`   关系数量: ${stats.relationships || 0}`);
      console.log(`   检查时间: ${moment().format('YYYY-MM-DD HH:mm:ss')}`);

      return {
        success: true,
        health: healthCheck,
        stats,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };

    } catch (error) {
      console.error(`❌ 获取状态失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 显示帮助信息
   */
  showHelp() {
    const helpText = `
🧠 知识图谱化脚本使用说明

可用命令:
  process <数量>        - 处理未处理的新闻 (默认100条)
  process-batch <数量>  - 批量处理指定数量新闻 (默认50条)
  process-recent <小时> - 处理最近N小时新闻 (默认24小时)
  reprocess <新闻ID>    - 重新处理指定新闻
  query <关键词> <数量>  - 查询知识图谱 (默认10条)
  stats                - 获取图谱统计信息
  export <格式>         - 导出图谱数据 (支持json、cypher)
  rebuild              - 重建图谱索引
  status               - 获取模块状态
  help                 - 显示帮助信息

使用示例:
  npm run graph process                    # 处理未处理的新闻
  npm run graph process-batch 30          # 批量处理30条新闻
  npm run graph process-recent 12         # 处理最近12小时新闻
  npm run graph reprocess news_12345      # 重新处理指定新闻
  npm run graph query "苹果公司" 15        # 查询苹果公司相关新闻
  npm run graph stats                     # 查看图谱统计
  npm run graph export json               # 导出JSON格式数据
  npm run graph status                    # 查看模块状态
`;

    console.log(helpText);
    return { success: true, message: '帮助信息已显示' };
  }

  /**
   * 执行命令
   */
  async execute(command, ...args) {
    if (!this.commands[command]) {
      console.error(`❌ 未知命令: ${command}`);
      this.showHelp();
      return { success: false, error: `未知命令: ${command}` };
    }

    try {
      const result = await this.commands[command](...args);
      return result;
    } catch (error) {
      logger.error(`执行命令失败: ${command}`, error);
      return { success: false, error: error.message };
    }
  }
}

// 主执行逻辑
async function main() {
  const command = process.argv[2] || 'help';
  const args = process.argv.slice(3);

  const processor = new KnowledgeGraphProcessor();
  const result = await processor.execute(command, ...args);

  if (result.success) {
    logger.info(`知识图谱命令执行成功: ${command}`);
    process.exit(0);
  } else {
    logger.error(`知识图谱命令执行失败: ${command}`, result.error);
    process.exit(1);
  }
}

main().catch(error => {
  logger.error('知识图谱脚本执行失败:', error);
  process.exit(1);
}); 
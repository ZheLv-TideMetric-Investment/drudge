// @ts-nocheck
import logger from '../shared/utils/logger';
import moment from 'moment-timezone';
import newsApiService from '../infrastructure/external/NewsApiService';
import fileStorage from '../infrastructure/storage/FileStorage';

// 设置默认时区为北京时间
moment.tz.setDefault('Asia/Shanghai');

/**
 * 新闻获取脚本
 * 专门负责从外部API获取新闻并存储到本地
 */
class NewsAcquisition {
  constructor() {
    this.newsApi = newsApiService;
    this.storage = fileStorage;
    this.commands = {
      'fetch': this.fetchNews.bind(this),
      'fetch-batch': this.fetchBatchNews.bind(this),
      'list': this.listStoredNews.bind(this),
      'count': this.getNewsCount.bind(this),
      'clean': this.cleanOldNews.bind(this),
      'status': this.getStatus.bind(this),
      'help': this.showHelp.bind(this)
    };
  }

  /**
   * 获取最新新闻
   */
  async fetchNews() {
    try {
      logger.info('🔄 开始获取最新新闻...');
      
      const newsItems = await this.newsApi.fetchLatestNews();
      
      if (newsItems.length === 0) {
        console.log('📰 没有获取到新的新闻');
        return { success: true, count: 0, message: '没有新的新闻' };
      }

      // 保存到本地存储
      let savedCount = 0;
      try {
        await this.storage.save(newsItems);
        savedCount = newsItems.length;
      } catch (error) {
        logger.warn(`批量保存新闻失败，尝试逐个保存`, error);
        // 如果批量保存失败，尝试逐个保存（需要修改 storage 支持单个对象）
        for (const newsItem of newsItems) {
          try {
            await this.storage.save([newsItem]); // 包装成数组
            savedCount++;
          } catch (error) {
            logger.warn(`保存新闻失败: ${newsItem.id}`, error);
          }
        }
      }

      const message = `✅ 成功获取并保存 ${savedCount}/${newsItems.length} 条新闻`;
      console.log(message);
      logger.info(message);

      return {
        success: true,
        fetched: newsItems.length,
        saved: savedCount,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };

    } catch (error) {
      const errorMsg = `❌ 获取新闻失败: ${error.message}`;
      console.error(errorMsg);
      logger.error('获取新闻失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 批量获取历史新闻
   */
  async fetchBatchNews(days = 1) {
    try {
      const daysNum = parseInt(days) || 1;
      logger.info(`🔄 开始批量获取最近 ${daysNum} 天的新闻...`);

      const endTime = moment();
      const startTime = moment().subtract(daysNum, 'days');

      const newsItems = await this.newsApi.fetchNewsByTimeRange(startTime, endTime);

      if (newsItems.length === 0) {
        console.log(`📰 最近 ${daysNum} 天没有新闻`);
        return { success: true, count: 0 };
      }

      // 批量保存
      let savedCount = 0;
      const batchSize = 10;
      
      for (let i = 0; i < newsItems.length; i += batchSize) {
        const batch = newsItems.slice(i, i + batchSize);
        
        try {
          await this.storage.save(batch);
          savedCount += batch.length;
        } catch (error) {
          logger.warn(`批量保存失败，尝试逐个保存`, error);
          // 如果批量保存失败，尝试逐个保存
          for (const newsItem of batch) {
            try {
              await this.storage.save([newsItem]); // 包装成数组
              savedCount++;
            } catch (error) {
              logger.warn(`保存新闻失败: ${newsItem.id}`, error);
            }
          }
        }

        // 进度显示
        console.log(`📊 进度: ${Math.min(i + batchSize, newsItems.length)}/${newsItems.length}`);
        
        // 批次间延迟
        if (i + batchSize < newsItems.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      const message = `✅ 批量获取完成: ${savedCount}/${newsItems.length} 条新闻已保存`;
      console.log(message);
      logger.info(message);

      return {
        success: true,
        period: `${daysNum} 天`,
        fetched: newsItems.length,
        saved: savedCount,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };

    } catch (error) {
      const errorMsg = `❌ 批量获取失败: ${error.message}`;
      console.error(errorMsg);
      logger.error('批量获取失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 列出本地存储的新闻
   */
  async listStoredNews(limit = 10) {
    try {
      const limitNum = parseInt(limit) || 10;
      const allNews = await this.storage.getAll();
      const newsItems = allNews.slice(0, limitNum);

      if (newsItems.length === 0) {
        console.log('📰 本地没有存储的新闻');
        return { success: true, count: 0 };
      }

      console.log(`📰 最新 ${newsItems.length} 条新闻:`);
      console.log(''.padEnd(80, '='));

      newsItems.forEach((item, index) => {
        console.log(`${index + 1}. ${item.title}`);
        console.log(`   ID: ${item.id}`);
        console.log(`   时间: ${moment(item.time * 1000).format('YYYY-MM-DD HH:mm:ss')}`);
        console.log(`   来源: ${item.source || '未知'}`);
        console.log('');
      });

      return { success: true, count: newsItems.length };

    } catch (error) {
      console.error(`❌ 获取列表失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取新闻数量统计
   */
  async getNewsCount() {
    try {
      const allNews = await this.storage.getAll();
      const totalCount = allNews.length;

      if (totalCount === 0) {
        console.log('📊 本地没有存储的新闻');
        return { success: true, total: 0 };
      }

      // 按时间统计
      const now = moment();
      const today = allNews.filter(item => 
        moment(item.time * 1000).isSame(now, 'day')
      ).length;
      
      const thisWeek = allNews.filter(item => 
        moment(item.time * 1000).isSame(now, 'week')
      ).length;

      const thisMonth = allNews.filter(item => 
        moment(item.time * 1000).isSame(now, 'month')
      ).length;

      console.log('📊 新闻数量统计:');
      console.log(`   总计: ${totalCount} 条`);
      console.log(`   今日: ${today} 条`);
      console.log(`   本周: ${thisWeek} 条`);
      console.log(`   本月: ${thisMonth} 条`);

      // 最新新闻时间
      if (allNews.length > 0) {
        const latest = allNews[0];
        console.log(`   最新: ${moment(latest.time * 1000).format('YYYY-MM-DD HH:mm:ss')}`);
      }

      return {
        success: true,
        total: totalCount,
        today,
        thisWeek,
        thisMonth,
        latest: allNews[0] ? moment(allNews[0].time * 1000).format('YYYY-MM-DD HH:mm:ss') : null
      };

    } catch (error) {
      console.error(`❌ 获取统计失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 清理旧新闻
   */
  async cleanOldNews(days = 30) {
    try {
      const daysNum = parseInt(days) || 30;
      logger.info(`🧹 开始清理 ${daysNum} 天前的新闻...`);

      const cutoffTime = moment().subtract(daysNum, 'days');
      const allNews = await this.storage.getAll();
      
      const oldNews = allNews.filter(item => 
        moment(item.time * 1000).isBefore(cutoffTime)
      );

      if (oldNews.length === 0) {
        console.log(`📰 没有 ${daysNum} 天前的新闻需要清理`);
        return { success: true, cleaned: 0 };
      }

      console.log(`⚠️  将删除 ${oldNews.length} 条 ${daysNum} 天前的新闻`);
      console.log('确认删除请在5秒内按Ctrl+C取消...');
      await new Promise(resolve => setTimeout(resolve, 5000));

      // 执行清理
      let cleanedCount = 0;
      for (const newsItem of oldNews) {
        try {
          await this.storage.delete(newsItem.id);
          cleanedCount++;
        } catch (error) {
          logger.warn(`删除新闻失败: ${newsItem.id}`, error);
        }
      }

      const message = `✅ 清理完成: 删除了 ${cleanedCount}/${oldNews.length} 条旧新闻`;
      console.log(message);
      logger.info(message);

      return {
        success: true,
        cleaned: cleanedCount,
        period: `${daysNum} 天前`,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };

    } catch (error) {
      console.error(`❌ 清理失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取获取模块状态
   */
  async getStatus() {
    try {
      const allNews = await this.storage.getAll();
      const apiStatus = await this.newsApi.healthCheck();

      console.log('📊 新闻获取模块状态:');
      console.log(`   API状态: ${apiStatus.status === 'healthy' ? '✅ 正常' : '❌ 异常'}`);
      console.log(`   本地新闻: ${allNews.length} 条`);
      
      if (allNews.length > 0) {
        const latest = allNews[0];
        console.log(`   最新时间: ${moment(latest.time * 1000).format('YYYY-MM-DD HH:mm:ss')}`);
      }

      console.log(`   检查时间: ${moment().format('YYYY-MM-DD HH:mm:ss')}`);

      return {
        success: true,
        api_status: apiStatus,
        local_news_count: allNews.length,
        latest_news: allNews[0] ? moment(allNews[0].time * 1000).format('YYYY-MM-DD HH:mm:ss') : null,
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
📰 新闻获取脚本使用说明

可用命令:
  fetch           - 获取最新新闻
  fetch-batch <天数> - 批量获取历史新闻 (默认1天)
  list <数量>      - 列出本地存储的新闻 (默认10条)
  count          - 获取新闻数量统计
  clean <天数>     - 清理旧新闻 (默认30天前)
  status         - 获取模块状态
  help           - 显示帮助信息

使用示例:
  npm run news fetch                    # 获取最新新闻
  npm run news fetch-batch 3            # 获取最近3天新闻
  npm run news list 20                  # 列出最新20条新闻
  npm run news count                    # 查看新闻统计
  npm run news clean 7                  # 清理7天前的新闻
  npm run news status                   # 查看模块状态
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

  const acquisition = new NewsAcquisition();
  const result = await acquisition.execute(command, ...args);

  if (result.success) {
    logger.info(`新闻获取命令执行成功: ${command}`);
    process.exit(0);
  } else {
    logger.error(`新闻获取命令执行失败: ${command}`, result.error);
    process.exit(1);
  }
}

main().catch(error => {
  logger.error('新闻获取脚本执行失败:', error);
  process.exit(1);
}); 
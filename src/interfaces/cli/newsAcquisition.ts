// @ts-nocheck
import logger from '../../shared/utils/logger';
import moment from 'moment-timezone';
import newsAcquisitionService from '../../application/services/system/NewsAcquisitionService';

// 设置默认时区为北京时间
moment.tz.setDefault('Asia/Shanghai');

/**
 * 新闻获取脚本 - 命令行入口
 * 所有业务逻辑已移到 NewsAcquisitionService 中
 */
class NewsAcquisitionScript {
  constructor() {
    this.acquisitionService = newsAcquisitionService;
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
    console.log('🔄 开始获取最新新闻...\n');
    
    const result = await this.acquisitionService.fetchLatestNews();
    
    if (result.success) {
      console.log(`✅ ${result.message}`);
      console.log(`📊 获取: ${result.fetched} 条，保存: ${result.saved} 条`);
      console.log(`🕒 时间: ${result.timestamp}`);
    } else {
      console.error(`❌ 获取新闻失败: ${result.error}`);
    }
    
    return result;
  }

  /**
   * 批量获取历史新闻
   */
  async fetchBatchNews(days = 1) {
    const daysNum = parseInt(days) || 1;
    console.log(`🔄 开始批量获取最近 ${daysNum} 天的新闻...\n`);
    
    const result = await this.acquisitionService.fetchBatchNews(daysNum);
    
    if (result.success) {
      console.log(`✅ ${result.message}`);
      console.log(`📊 时间段: ${result.period}`);
      console.log(`📊 获取: ${result.fetched} 条，保存: ${result.saved} 条`);
      console.log(`🕒 时间: ${result.timestamp}`);
    } else {
      console.error(`❌ 批量获取失败: ${result.error}`);
    }
    
    return result;
  }

  /**
   * 列出本地存储的新闻
   */
  async listStoredNews(limit = 10) {
    const limitNum = parseInt(limit) || 10;
    console.log(`📰 列出最新 ${limitNum} 条新闻...\n`);
    
    const result = await this.acquisitionService.getStoredNewsList(limitNum);
    
    if (result.success) {
      if (result.count === 0) {
        console.log('📰 本地没有存储的新闻');
      } else {
        console.log(`📰 最新 ${result.count} 条新闻 (总计: ${result.total} 条):`);
        console.log(''.padEnd(80, '='));

        result.news.forEach((item, index) => {
          console.log(`${index + 1}. ${item.title}`);
          console.log(`   ID: ${item.id}`);
          console.log(`   时间: ${item.time}`);
          console.log(`   来源: ${item.source}`);
          console.log('');
        });
      }
    } else {
      console.error(`❌ 获取列表失败: ${result.error}`);
    }
    
    return result;
  }

  /**
   * 获取新闻数量统计
   */
  async getNewsCount() {
    console.log('📊 统计新闻数量...\n');
    
    const result = await this.acquisitionService.getNewsCount();
    
    if (result.success) {
      if (result.total === 0) {
        console.log('📊 本地没有存储的新闻');
      } else {
        console.log('📊 新闻统计:');
        console.log(''.padEnd(40, '='));
        console.log(`📰 总计: ${result.statistics.total} 条`);
        console.log(`📅 今日: ${result.statistics.today} 条`);
        console.log(`📈 本周: ${result.statistics.this_week} 条`);
        console.log(`📊 本月: ${result.statistics.this_month} 条`);
        console.log(`🕒 统计时间: ${result.timestamp}`);
      }
    } else {
      console.error(`❌ 统计失败: ${result.error}`);
    }
    
    return result;
  }

  /**
   * 清理旧新闻
   */
  async cleanOldNews(days = 30) {
    const daysNum = parseInt(days) || 30;
    console.log(`🧹 开始清理超过 ${daysNum} 天的旧新闻...\n`);
    
    const result = await this.acquisitionService.cleanOldNews(daysNum);
    
    if (result.success) {
      console.log(`✅ ${result.message}`);
      console.log(`🗑️  清理: ${result.cleaned} 条`);
      console.log(`📰 保留: ${result.remaining} 条`);
      if (result.cutoff_date) {
        console.log(`📅 截止日期: ${result.cutoff_date}`);
      }
      console.log(`🕒 时间: ${result.timestamp}`);
    } else {
      console.error(`❌ 清理失败: ${result.error}`);
    }
    
    return result;
  }

  /**
   * 获取服务状态
   */
  async getStatus() {
    console.log('📊 检查新闻获取服务状态...\n');
    
    const result = await this.acquisitionService.getStatus();
    
    if (result.success) {
      console.log('📊 服务状态:');
      console.log(''.padEnd(40, '='));
      console.log(`🌐 API连接: ${this.getStatusIcon(result.status.api_connection)} ${result.status.api_connection}`);
      console.log(`📰 总新闻数: ${result.status.total_news} 条`);
      console.log(`🕒 最新新闻: ${result.status.latest_news_time || '无'}`);
      console.log(`💾 存储状态: ${this.getStatusIcon(result.status.storage_healthy ? 'healthy' : 'error')} ${result.status.storage_healthy ? '正常' : '异常'}`);
      console.log(`🕒 检查时间: ${result.timestamp}`);
    } else {
      console.error(`❌ 状态检查失败: ${result.error}`);
    }
    
    return result;
  }

  /**
   * 显示帮助信息
   */
  showHelp() {
    console.log(`
📰 新闻获取工具

用法:
  npm run news <command> [options]

命令:
  fetch              获取最新新闻
  fetch-batch [天数]  批量获取历史新闻 (默认1天)
  list [数量]        列出存储的新闻 (默认10条)
  count              显示新闻数量统计
  clean [天数]       清理旧新闻 (默认30天)
  status             检查服务状态
  help               显示帮助信息

示例:
  npm run news fetch              # 获取最新新闻
  npm run news fetch-batch 3      # 获取最近3天的新闻
  npm run news list 20            # 列出最新20条新闻
  npm run news count              # 显示统计信息
  npm run news clean 60           # 清理60天前的新闻
  npm run news status             # 检查服务状态
`);
  }

  /**
   * 获取状态图标
   */
  getStatusIcon(status) {
    const icons = {
      'healthy': '✅',
      'error': '❌',
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
  const script = new NewsAcquisitionScript();
  const command = process.argv[2] || 'help';
  const args = process.argv.slice(3);

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

export default NewsAcquisitionScript; 
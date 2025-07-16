import { logger } from '../utils/logger';
import { fetchLatestNews } from '../apis/news/fetch';
import { getNewsList, getNewsByTimeRange } from '../apis/news/list';
import { getNewsCount } from '../apis/news/count';
import { cleanOldNews } from '../apis/news/clean';
import { getSystemStatus } from '../apis/system/status';
import { daysAgo, parseTime } from '../utils/time';

/**
 * CLI命令处理器
 */
export class CliHandler {
  /**
   * 执行CLI命令
   */
  async execute(command: string, ...args: string[]): Promise<void> {
    try {
      let result: any;

      switch (command) {
        case 'help':
          this.showHelp();
          break;
        
        case 'fetch':
          logger.info('🔄 开始获取最新新闻...');
          result = await fetchLatestNews();
          console.log(JSON.stringify(result, null, 2));
          break;
        
        case 'batch':
          const days = args[0] ? parseInt(args[0]) : 1;
          logger.info(`🔄 开始批量获取新闻 (${days}天)...`);
          const startTime = daysAgo(days);
          const endTime = parseTime(Date.now());
          result = await getNewsByTimeRange(startTime, endTime);
          console.log(JSON.stringify(result, null, 2));
          break;
        
        case 'list':
          const limit = args[0] ? parseInt(args[0]) : 10;
          logger.info(`📋 获取新闻列表 (${limit}条)...`);
          result = await getNewsList(limit);
          console.log(JSON.stringify(result, null, 2));
          break;
        
        case 'count':
          logger.info('📊 统计新闻数量...');
          result = await getNewsCount();
          console.log(JSON.stringify(result, null, 2));
          break;
        
        case 'clean':
          const cleanDays = args[0] ? parseInt(args[0]) : 7;
          logger.info(`🧹 开始清理 ${cleanDays} 天前的旧新闻...`);
          result = await cleanOldNews(cleanDays);
          console.log(JSON.stringify(result, null, 2));
          break;
        
        case 'status':
          logger.info('🔍 获取服务状态...');
          result = await getSystemStatus();
          console.log(JSON.stringify(result, null, 2));
          break;
        
        default:
          logger.error(`❌ 未知命令: ${command}`);
          this.showHelp();
          process.exit(1);
      }
    } catch (error: any) {
      logger.error('CLI命令执行失败:', error);
      process.exit(1);
    }
  }

  /**
   * 显示帮助信息
   */
  private showHelp(): void {
    console.log(`
📰 ingest-worker CLI 工具 (futu_live数据源)

用法: npm run cli <command> [options]

命令:
  help             显示此帮助信息
  fetch            获取最新新闻
  batch [days]     批量获取历史新闻 (默认1天)
  list [limit]     列出存储的新闻 (默认10条)
  count            显示新闻统计
  clean [days]     清理旧新闻 (默认7天)
  status           显示服务状态

示例:
  npm run cli help
  npm run cli fetch
  npm run cli batch 3
  npm run cli list 5
  npm run cli count
  npm run cli clean 7
  npm run cli status

 注意: 
   - 定时任务功能通过主服务启动 (npm start，每1分钟执行一次)
   - HTTP API 在端口 39110 提供服务
   - 数据存储在 ../../data/news/ 目录
    `);
  }
}

export default new CliHandler(); 
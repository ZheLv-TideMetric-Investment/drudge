import * as cron from 'node-cron';
import { logger } from '../utils/logger';
import { fetchLatestNews } from '../apis/news/fetch';

/**
 * 定时任务调度器
 * 负责定时获取新闻
 */
export class Scheduler {
  private tasks: Map<string, any> = new Map();

  /**
   * 启动所有定时任务
   */
  start(): void {
    this.startNewsTask();
    logger.info('📅 定时任务调度器已启动');
  }

  /**
   * 停止所有定时任务
   */
  stop(): void {
    this.tasks.forEach((task, name) => {
      task.stop();
      logger.info(`⏹️ 停止定时任务: ${name}`);
    });
    this.tasks.clear();
    logger.info('📅 定时任务调度器已停止');
  }

  /**
   * 启动新闻获取定时任务
   * 每1分钟执行一次
   */
  private startNewsTask(): void {
    const newsTask = cron.schedule('* * * * *', async () => {
      logger.info('⏰ 定时任务：开始获取新闻数据');
      const startTime = Date.now();
      
      try {
        const result = await fetchLatestNews();
        
        const duration = Date.now() - startTime;
        
        if (result.success) {
          logger.info(`✅ 定时任务：新闻获取完成，获取${result.count}条，耗时${duration}ms`);
        } else {
          logger.error(`❌ 定时任务：新闻获取失败 - ${result.error}`);
        }
      } catch (error: any) {
        const duration = Date.now() - startTime;
        logger.error(`❌ 定时任务：新闻获取异常，耗时${duration}ms`, error);
      }
    }, {
      timezone: 'Asia/Shanghai'
    });

    this.tasks.set('news-fetch', newsTask);
    newsTask.start();
    
    logger.info('🔄 启动新闻获取定时任务 (每1分钟执行一次)');
  }


}

export default new Scheduler(); 
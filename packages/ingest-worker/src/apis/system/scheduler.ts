import { logger } from '../../utils/logger';
import { fetchLatestNews } from '../news/fetch';

/**
 * 获取调度器状态
 */
export async function getSchedulerStatus(): Promise<any> {
  try {
    // 这里可以添加更多的调度器状态检查逻辑
    // 现在先返回基本状态
    return {
      success: true,
      status: 'running',
      tasks: {
        'news-fetch': {
          running: true,
          name: 'news-fetch',
          schedule: '* * * * *', // 每1分钟
          description: '获取富途新闻数据'
        }
      },
      totalTasks: 1,
      timestamp: new Date().toISOString()
    };
  } catch (error: any) {
    logger.error('获取调度器状态失败:', error);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

/**
 * 手动触发新闻获取任务
 */
export async function triggerNewsTask(): Promise<any> {
  try {
    logger.info('🔧 手动触发新闻获取任务');
    const result = await fetchLatestNews();
    
    return {
      success: true,
      message: '手动触发新闻获取任务完成',
      result: result,
      timestamp: new Date().toISOString()
    };
  } catch (error: any) {
    logger.error('手动触发新闻获取任务失败:', error);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
} 
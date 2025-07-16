import { logger } from '../../utils/logger';
import { formatReadable } from '../../utils/time';
import futuLiveService from '../../services/FutuLiveService';

/**
 * 获取最新新闻
 */
export async function fetchLatestNews(): Promise<any> {
  try {
    logger.info('🔄 开始获取最新新闻...');
    
    const newsItems = await futuLiveService.fetchNews();
    
    if (newsItems.length === 0) {
      return {
        success: true,
        count: 0,
        message: '没有获取到新的新闻',
        timestamp: formatReadable()
      };
    }

    return {
      success: true,
      count: newsItems.length,
      message: `成功获取 ${newsItems.length} 条新闻`,
      timestamp: formatReadable(),
      news: newsItems.slice(0, 5) // 返回前5条作为预览
    };
  } catch (error: any) {
    logger.error('获取新闻失败:', error);
    return {
      success: false,
      count: 0,
      error: error.message,
      timestamp: formatReadable()
    };
  }
} 
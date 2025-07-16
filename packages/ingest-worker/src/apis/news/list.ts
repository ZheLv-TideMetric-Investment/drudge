import { logger } from '../../utils/logger';
import { formatReadable, parseTime } from '../../utils/time';
import fileStorage from '../../storage/FileStorage';

/**
 * 获取新闻列表
 */
export async function getNewsList(limit: number = 10): Promise<any> {
  try {
    const newsItems = await fileStorage.getNewsByLimit(limit);

    const formattedNews = newsItems.map(item => ({
      id: item.id,
      title: item.title,
      time: formatReadable(parseTime(item.time * 1000)),
      source: item.source || 'futu_live'
    }));

    return {
      success: true,
      count: formattedNews.length,
      news: formattedNews,
      timestamp: formatReadable()
    };
  } catch (error: any) {
    logger.error('获取新闻列表失败:', error);
    return {
      success: false,
      count: 0,
      error: error.message,
      timestamp: formatReadable()
    };
  }
}

/**
 * 按时间范围获取新闻
 */
export async function getNewsByTimeRange(startTime: any, endTime: any): Promise<any> {
  try {
    const newsItems = await fileStorage.getNewsByTimeRange(startTime, endTime);

    const formattedNews = newsItems.map(item => ({
      id: item.id,
      title: item.title,
      time: formatReadable(parseTime(item.time * 1000)),
      source: item.source || 'futu_live'
    }));

    return {
      success: true,
      count: formattedNews.length,
      news: formattedNews,
      timestamp: formatReadable()
    };
  } catch (error: any) {
    logger.error('按时间范围获取新闻失败:', error);
    return {
      success: false,
      count: 0,
      error: error.message,
      timestamp: formatReadable()
    };
  }
} 
import { logger } from '../../utils/logger';
import { formatReadable } from '../../utils/time';
import futuLiveService from '../../services/FutuLiveService';
import awtmtLiveService from '../../services/AwtmtLiveService';
import { logErrorWithDetails } from '../../utils/error';

/**
 * 获取最新新闻
 */
export async function fetchLatestNews(): Promise<any> {
  try {
    logger.info('🔄 开始获取最新新闻...');

    // 并行获取两个数据源的新闻
    const [futuNewsItems, awtmtNewsItems] = await Promise.all([
      futuLiveService.fetchNews(),
      awtmtLiveService.fetchNews(),
    ]);

    const totalCount = futuNewsItems.length + awtmtNewsItems.length;

    if (totalCount === 0) {
      return {
        success: true,
        count: 0,
        message: '没有获取到新的新闻',
        timestamp: formatReadable(),
      };
    }

    // 合并新闻并按时间排序
    const allNews = [...futuNewsItems, ...awtmtNewsItems].sort((a, b) => b.time - a.time);

    return {
      success: true,
      count: totalCount,
      sources: {
        futu: futuNewsItems.length,
        awtmt: awtmtNewsItems.length,
      },
      message: `成功获取 ${totalCount} 条新闻 (富途: ${futuNewsItems.length}, AWTMT: ${awtmtNewsItems.length})`,
      timestamp: formatReadable(),
      news: allNews.slice(0, 5), // 返回前5条作为预览
    };
  } catch (error: any) {
    const errorDetails = logErrorWithDetails('获取新闻失败:', error);
    return {
      success: false,
      count: 0,
      error: errorDetails.message,
      details: errorDetails,
      timestamp: formatReadable(),
    };
  }
}

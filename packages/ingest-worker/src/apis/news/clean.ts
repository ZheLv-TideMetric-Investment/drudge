import { logger } from '../../utils/logger';
import { formatReadable } from '../../utils/time';
import fileStorage from '../../storage/FileStorage';

/**
 * 清理旧新闻
 */
export async function cleanOldNews(days: number = 7): Promise<any> {
  try {
    logger.info(`🧹 开始清理 ${days} 天前的旧新闻...`);
    
    const result = await fileStorage.cleanOldFiles(days);

    return {
      success: true,
      deletedCount: result.deletedCount,
      remainingCount: result.remainingCount,
      message: result.message,
      timestamp: formatReadable()
    };
  } catch (error: any) {
    logger.error('❌ 清理旧新闻失败:', error);
    return {
      success: false,
      error: error.message,
      timestamp: formatReadable()
    };
  }
} 
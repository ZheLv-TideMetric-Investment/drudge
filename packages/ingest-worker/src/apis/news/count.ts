import { logger } from '../../utils/logger';
import { formatReadable } from '../../utils/time';
import fileStorage from '../../storage/FileStorage';

/**
 * 获取新闻统计信息
 */
export async function getNewsCount(): Promise<any> {
  try {
    const stats = await fileStorage.getNewsStats();

    return {
      success: true,
      stats,
      timestamp: formatReadable()
    };
  } catch (error: any) {
    logger.error('获取新闻统计失败:', error);
    return {
      success: false,
      error: error.message,
      timestamp: formatReadable()
    };
  }
} 
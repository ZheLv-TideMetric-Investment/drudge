import { formatReadable } from '../../utils/time';
import fileStorage from '../../storage/FileStorage';
import { logErrorWithDetails } from '../../utils/error';

/**
 * 获取新闻统计信息
 */
export async function getNewsCount(): Promise<any> {
  try {
    const stats = await fileStorage.getNewsStats();

    return {
      success: true,
      stats,
      timestamp: formatReadable(),
    };
  } catch (error: any) {
    const errorDetails = logErrorWithDetails('获取新闻统计失败:', error);
    return {
      success: false,
      error: errorDetails.message,
      details: errorDetails,
      timestamp: formatReadable(),
    };
  }
}

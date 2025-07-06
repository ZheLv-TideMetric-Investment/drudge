import { logger } from '../../utils/logger';
import { formatReadable } from '../../utils/time';
import futuLiveService from '../../services/FutuLiveService';
import fileStorage from '../../storage/FileStorage';

/**
 * 获取系统状态
 */
export async function getSystemStatus(): Promise<any> {
  try {
    // 获取新闻统计
    const stats = await fileStorage.getNewsStats();
    
    // 检查富途API状态
    const apiHealthy = await futuLiveService.healthCheck();
    
    // 获取服务状态
    const serviceStatus = futuLiveService.getStatus();

    return {
      success: true,
      service: 'ingest-worker',
      source: 'futu_live',
      stats,
      connections: {
        futuLiveApi: apiHealthy ? '✅ 正常' : '❌ 异常'
      },
      serviceStatus,
      timestamp: formatReadable()
    };
  } catch (error: any) {
    logger.error('获取系统状态失败:', error);
    return {
      success: false,
      error: error.message,
      timestamp: formatReadable()
    };
  }
}

/**
 * 健康检查
 */
export async function healthCheck(): Promise<any> {
  return {
    status: 'ok',
    service: 'ingest-worker',
    source: 'futu_live',
    timestamp: new Date().toISOString(),
    port: process.env.PORT || 39110
  };
} 
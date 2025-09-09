import { logger } from '../../utils/logger';
import { formatReadable } from '../../utils/time';
import futuLiveService from '../../services/FutuLiveService';
import awtmtLiveService from '../../services/AwtmtLiveService';
import fileStorage from '../../storage/FileStorage';

/**
 * 获取系统状态
 */
export async function getSystemStatus(): Promise<any> {
  try {
    // 获取新闻统计
    const stats = await fileStorage.getNewsStats();
    
    // 并行检查两个API状态
    const [futuApiHealthy, awtmtApiHealthy] = await Promise.all([
      futuLiveService.healthCheck(),
      awtmtLiveService.healthCheck()
    ]);
    
    // 获取服务状态
    const futuServiceStatus = futuLiveService.getStatus();
    const awtmtServiceStatus = awtmtLiveService.getStatus();

    return {
      success: true,
      service: 'ingest-worker',
      sources: ['futu_live', 'awtmt_live'],
      stats,
      connections: {
        futuLiveApi: futuApiHealthy ? '✅ 正常' : '❌ 异常',
        awtmtLiveApi: awtmtApiHealthy ? '✅ 正常' : '❌ 异常'
      },
      serviceStatus: {
        futu: futuServiceStatus,
        awtmt: awtmtServiceStatus
      },
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
    sources: ['futu_live', 'awtmt_live'],
    timestamp: new Date().toISOString(),
    port: process.env.PORT || 39110
  };
} 
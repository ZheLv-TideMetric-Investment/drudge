import { logger } from '../../utils/logger';
import knowledgeGraphService from '../../services/KnowledgeGraphService';
import schedulerService from '../../scheduler/index';

/**
 * 获取系统状态
 */
export async function getSystemStatus(): Promise<any> {
  try {
    logger.info('📊 获取系统状态信息');

    // 获取各服务状态
    const knowledgeGraphHealth = await knowledgeGraphService['entityService']['neo4j'].healthCheck();
    const schedulerHealth = await schedulerService.healthCheck();

    const systemStatus = {
      service: 'graph-worker',
      version: '2.0',
      timestamp: new Date().toISOString(),
      status: 'healthy',
      services: {
        knowledgeGraph: knowledgeGraphHealth,
        scheduler: schedulerHealth
      },
      memory: {
        used: process.memoryUsage().heapUsed,
        total: process.memoryUsage().heapTotal,
        external: process.memoryUsage().external
      },
      uptime: process.uptime(),
      pid: process.pid
    };

    return {
      success: true,
      data: systemStatus,
      timestamp: new Date().toISOString()
    };

  } catch (error: any) {
    logger.error('获取系统状态失败:', error);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
} 
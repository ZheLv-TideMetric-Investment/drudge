import { logger } from './utils/logger';
import scheduler from './scheduler/index';
import { startHttpServer } from './http/index';
import aiService from './services/AiService';
import knowledgeGraphService from './services/KnowledgeGraphService';
import config from './config/config';
import { memoryMonitor } from './utils/memoryMonitor';

/**
 * 初始化所有服务
 */
async function initialize(): Promise<void> {
  try {
    logger.info('🚀 正在初始化graph-worker服务...');
    
    // 启动内存监控
    logger.info('🔍 启动内存监控器...');
    memoryMonitor.startMonitoring(); // 使用配置文件中的默认间隔
    
    // 显示初始内存状态
    logger.info(memoryMonitor.getMemoryReport());
    
    // 初始化各个服务
    await aiService.initialize();
    await knowledgeGraphService.initialize();
    
    logger.info('✅ graph-worker服务初始化完成');
  } catch (error: any) {
    logger.error('❌ 服务初始化失败:', error);
    throw error;
  }
}

/**
 * 启动主服务 (scheduler + http)
 */
async function startMainService(): Promise<void> {
  try {
    await initialize();
    
    // 初始化并启动调度器
    await scheduler.initialize();
    scheduler.start();
    
    // 启动HTTP服务器
    await startHttpServer();
    
    logger.info('🎉 graph-worker服务启动完成');
    logger.info('📅 定时任务: 每1分钟扫描新闻文件进行图谱化');
    logger.info(`🌐 HTTP API: 端口 ${config.server.port}`);
    logger.info('🔍 内存监控: 每30秒检查一次，自动垃圾回收');
    
  } catch (error: any) {
    logger.error('❌ 启动主服务失败:', error);
    process.exit(1);
  }
}

/**
 * 优雅关闭
 */
function setupGracefulShutdown(): void {
  const shutdown = (signal: string) => {
    logger.info(`收到${signal}信号，正在优雅关闭服务...`);
    
    // 停止内存监控
    logger.info('🔍 停止内存监控器...');
    memoryMonitor.stopMonitoring();
    
    // 显示最终内存状态
    logger.info('📊 最终内存状态:');
    logger.info(memoryMonitor.getMemoryReport());
    
    // 停止和关闭调度器
    scheduler.stop();
    scheduler.close().catch((error: any) => {
      logger.error('关闭调度器失败:', error);
    });
    
    // 关闭知识图谱服务连接
    knowledgeGraphService.close().then(() => {
      logger.info('graph-worker服务已关闭');
      process.exit(0);
    }).catch(() => {
      process.exit(1);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  
  // 添加内存不足处理
  process.on('uncaughtException', (error) => {
    if (error.message.includes('heap out of memory') || error.message.includes('allocation failed')) {
      logger.error('🚨 内存不足，强制垃圾回收...');
      memoryMonitor.forceGarbageCollection();
      logger.error('❌ 严重内存错误，服务即将退出:', error.message);
      process.exit(1);
    } else {
      logger.error('❌ 未捕获的异常:', error);
      process.exit(1);
    }
  });
}

/**
 * 主启动逻辑
 */
async function main(): Promise<void> {
  // 启动服务模式
  setupGracefulShutdown();
  await startMainService();
}

// 启动应用
main().catch((error) => {
  logger.error('应用启动失败:', error);
  process.exit(1);
}); 
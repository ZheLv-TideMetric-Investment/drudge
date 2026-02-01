import { logger } from './utils/logger';
import scheduler from './scheduler';
import { startHttpServer } from './http';
import { logErrorWithDetails } from './utils/error';

/**
 * 初始化服务
 */
async function initialize(): Promise<void> {
  try {
    logger.info('🚀 正在初始化ingest-worker服务...');
    logger.info('📊 数据源: futu_live');
    logger.info('✅ ingest-worker服务初始化完成');
  } catch (error: any) {
    logErrorWithDetails('❌ 服务初始化失败:', error);
    process.exit(1);
  }
}

/**
 * 启动主服务 (scheduler + http)
 */
async function startMainService(): Promise<void> {
  try {
    await initialize();

    // 启动定时任务调度器
    scheduler.start();

    // 启动HTTP服务器
    await startHttpServer();

    logger.info('🎉 ingest-worker服务启动完成');
    logger.info('📅 定时任务: 每1分钟获取一次新闻');
    logger.info('🌐 HTTP API: 端口 39110');
  } catch (error: any) {
    logErrorWithDetails('❌ 启动主服务失败:', error);
    process.exit(1);
  }
}

/**
 * 优雅关闭
 */
function setupGracefulShutdown(): void {
  const shutdown = (signal: string) => {
    logger.info(`收到${signal}信号，正在优雅关闭服务...`);

    scheduler.stop();

    setTimeout(() => {
      logger.info('ingest-worker服务已关闭');
      process.exit(0);
    }, 1000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
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
main().catch(error => {
  logErrorWithDetails('应用启动失败:', error);
  process.exit(1);
});

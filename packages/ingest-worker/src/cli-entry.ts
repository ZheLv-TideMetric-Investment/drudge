import { logger } from './utils/logger';
import cliHandler from './cli';
import { logErrorWithDetails } from './utils/error';

/**
 * 初始化CLI环境
 */
async function initializeCli(): Promise<void> {
  try {
    logger.info('🚀 正在初始化ingest-worker服务...');
    logger.info('📊 数据源: futu_live, awtmt_live');
    logger.info('✅ ingest-worker服务初始化完成');
  } catch (error: any) {
    logErrorWithDetails('❌ 服务初始化失败:', error);
    process.exit(1);
  }
}

/**
 * CLI主启动逻辑
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  const cmdArgs = args.slice(1);
  
  await initializeCli();
  await cliHandler.execute(command, ...cmdArgs);
  process.exit(0);
}

// 启动CLI
main().catch((error) => {
  logErrorWithDetails('CLI启动失败:', error);
  process.exit(1);
});

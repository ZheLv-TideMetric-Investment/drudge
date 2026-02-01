import { logger } from './utils/logger';
import { runCLI } from './cli/index';

async function main() {
  try {
    logger.info('🚀 正在初始化graph-worker CLI...');
    logger.info('📊 数据源: 本地新闻文件 (futu_live, awtmt_live)');
    logger.info('✅ graph-worker CLI初始化完成');

    await runCLI();

    process.exit(0);
  } catch (error: any) {
    logger.error('CLI执行失败:', error);
    process.exit(1);
  }
}

main();

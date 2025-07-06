import dotenv from 'dotenv';
import { SchedulerService } from './services/SchedulerService.js';
import { logger } from './utils/logger.js';

// 加载环境变量
dotenv.config();

// 健康检查端点
const PORT = process.env.PORT || 3002;

async function startScheduler() {
  try {
    logger.info('🚀 启动调度服务...');
    
    // 初始化调度服务
    const scheduler = new SchedulerService();
    await scheduler.initialize();
    
    // 启动所有定时任务
    scheduler.startAllJobs();
    
    // 启动健康检查服务器
    const express = await import('express');
    const app = express.default();
    
    app.use(express.json());
    
    app.get('/health', (req, res) => {
      res.json({ 
        status: 'ok', 
        service: 'scheduler',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      });
    });
    
    app.get('/jobs', (req, res) => {
      res.json(scheduler.getJobStatus());
    });
    
    app.listen(PORT, () => {
      logger.info(`📡 调度服务健康检查端口: ${PORT}`);
    });
    
    logger.info('✅ 调度服务启动成功');
    
  } catch (error) {
    logger.error('❌ 调度服务启动失败:', error);
    process.exit(1);
  }
}

// 优雅关闭处理
process.on('SIGINT', async () => {
  logger.info('🛑 正在关闭调度服务...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('🛑 正在关闭调度服务...');
  process.exit(0);
});

// 启动服务
startScheduler().catch((error) => {
  logger.error('💥 启动失败:', error);
  process.exit(1);
}); 
import dotenv from 'dotenv';
import express from 'express';
import { logger } from './utils/logger.js';
import { KnowledgeGraphService } from './services/KnowledgeGraphService.js';
import { EntityExtractionService } from './services/EntityExtractionService.js';
import { SummaryService } from './services/SummaryService.js';
import { triggerRoutes } from './routes/trigger.js';

// 加载环境变量
dotenv.config();

const PORT = process.env.PORT || 3004;

async function startGraphWorker() {
  try {
    logger.info('🚀 启动图谱处理工作器...');
    
    // 初始化服务
    const knowledgeGraphService = new KnowledgeGraphService();
    const entityExtractionService = new EntityExtractionService();
    const summaryService = new SummaryService();
    
    await knowledgeGraphService.initialize();
    await entityExtractionService.initialize();
    await summaryService.initialize();
    
    // 创建Express应用
    const app = express();
    app.use(express.json());
    
    // 健康检查端点
    app.get('/health', (req, res) => {
      res.json({ 
        status: 'ok', 
        service: 'graph-worker',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      });
    });
    
    // 图谱统计端点
    app.get('/stats', async (req, res) => {
      try {
        const stats = await knowledgeGraphService.getGraphStats();
        res.json(stats);
      } catch (error) {
        logger.error('❌ 获取图谱统计失败:', error);
        res.status(500).json({ error: '获取统计失败' });
      }
    });
    
    // 触发器路由
    app.use('/api/trigger', triggerRoutes);
    
    // 启动服务器
    app.listen(PORT, () => {
      logger.info(`📡 图谱处理工作器启动在端口: ${PORT}`);
    });
    
    logger.info('✅ 图谱处理工作器启动成功');
    
  } catch (error) {
    logger.error('❌ 图谱处理工作器启动失败:', error);
    process.exit(1);
  }
}

// 优雅关闭处理
process.on('SIGINT', async () => {
  logger.info('🛑 正在关闭图谱处理工作器...');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('🛑 正在关闭图谱处理工作器...');
  process.exit(0);
});

// 启动服务
startGraphWorker().catch((error) => {
  logger.error('💥 启动失败:', error);
  process.exit(1);
}); 
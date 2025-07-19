import express, { Request, Response, Application } from 'express';
import { logger } from '../utils/logger';
import config from '../config/config';
import { getCurrentTime } from '../utils/timeUtils';

// 导入API业务逻辑函数
import * as newsApi from '../apis/news/process';
import * as graphApi from '../apis/graph/query';
import * as systemApi from '../apis/system/status';

// 初始化服务
import knowledgeGraphService from '../services/KnowledgeGraphService';
import schedulerService from '../scheduler/index';

/**
 * 创建HTTP服务
 */
export function createHttpServer(): Application {
  const app: Application = express();

  // 中间件
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // 根路径
  app.get('/', (req: Request, res: Response) => {
    res.json({
      service: 'graph-worker',
      version: '2.0',
      status: 'running',
      timestamp: getCurrentTime()
    });
  });

  // 健康检查
  app.get('/health', async (req: Request, res: Response) => {
    try {
      res.json({
        service: 'graph-worker',
        version: '2.0',
        status: 'healthy',
        port: config.server.port,
        timestamp: getCurrentTime()
      });
    } catch (error: any) {
      res.status(500).json({
        service: 'graph-worker',
        status: 'unhealthy',
        error: error.message,
        timestamp: getCurrentTime()
      });
    }
  });

  // === API 路由 ===

  // 新闻处理API
  app.post('/api/news/process', async (req: Request, res: Response) => {
    try {
      const result = await newsApi.processNews(req.body);
      const statusCode = result.success ? 200 : 400;
      res.status(statusCode).json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: getCurrentTime()
      });
    }
  });

  app.post('/api/news/batch', async (req: Request, res: Response) => {
    try {
      const { newsItems } = req.body;
      const result = await newsApi.batchProcessNews(newsItems);
      const statusCode = result.success ? 200 : 400;
      res.status(statusCode).json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: getCurrentTime()
      });
    }
  });

  app.post('/api/news/status', async (req: Request, res: Response) => {
    try {
      const { newsIds } = req.body;
      const result = await newsApi.checkNewsStatus(newsIds);
      const statusCode = result.success ? 200 : 400;
      res.status(statusCode).json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: getCurrentTime()
      });
    }
  });

  // 图谱查询API
  app.get('/api/stats', async (req: Request, res: Response) => {
    try {
      const result = await graphApi.getGraphStats();
      const statusCode = result.success ? 200 : 500;
      res.status(statusCode).json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: getCurrentTime()
      });
    }
  });

  app.get('/api/entities/search', async (req: Request, res: Response): Promise<void> => {
    try {
      const { q: query, limit = 10 } = req.query;
      if (!query) {
        res.status(400).json({
          success: false,
          error: '缺少查询参数 q',
          timestamp: getCurrentTime()
        });
        return;
      }
      const result = await graphApi.searchEntities(String(query), Number(limit));
      const statusCode = result.success ? 200 : 500;
      res.status(statusCode).json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: getCurrentTime()
      });
    }
  });

  app.get('/api/entities/:name/relations', async (req: Request, res: Response): Promise<void> => {
    try {
      const { name } = req.params;
      const { depth = 2 } = req.query;
      if (!name) {
        res.status(400).json({
          success: false,
          error: '缺少实体名称参数',
          timestamp: getCurrentTime()
        });
        return;
      }
      const result = await graphApi.getEntityRelations(decodeURIComponent(name), Number(depth));
      const statusCode = result.success ? 200 : 500;
      res.status(statusCode).json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: getCurrentTime()
      });
    }
  });

  app.get('/api/news', async (req: Request, res: Response) => {
    try {
      const { limit = 10, level } = req.query;
      const result = await graphApi.getNewsList(Number(limit), level ? String(level) : undefined);
      const statusCode = result.success ? 200 : 500;
      res.status(statusCode).json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: getCurrentTime()
      });
    }
  });

  app.get('/api/news/:id', async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      if (!id) {
        res.status(400).json({
          success: false,
          error: '缺少新闻ID参数',
          timestamp: getCurrentTime()
        });
        return;
      }
      const result = await graphApi.getNewsDetail(decodeURIComponent(id));
      const statusCode = result.success ? 200 : 404;
      res.status(statusCode).json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: getCurrentTime()
      });
    }
  });

  app.get('/api/entities/popular', async (req: Request, res: Response) => {
    try {
      const { limit = 10 } = req.query;
      const result = await graphApi.getPopularEntities(Number(limit));
      const statusCode = result.success ? 200 : 500;
      res.status(statusCode).json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: getCurrentTime()
      });
    }
  });

  app.get('/api/entities/:name/news', async (req: Request, res: Response): Promise<void> => {
    try {
      const { name } = req.params;
      const { limit = 10 } = req.query;
      if (!name) {
        res.status(400).json({
          success: false,
          error: '缺少实体名称参数',
          timestamp: getCurrentTime()
        });
        return;
      }
      const result = await graphApi.getEntityNews(decodeURIComponent(name), Number(limit));
      const statusCode = result.success ? 200 : 500;
      res.status(statusCode).json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: getCurrentTime()
      });
    }
  });

  app.get('/api/news/level/distribution', async (req: Request, res: Response) => {
    try {
      const result = await graphApi.getNewsLevelDistribution();
      const statusCode = result.success ? 200 : 500;
      res.status(statusCode).json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: getCurrentTime()
      });
    }
  });

  // 系统状态API
  app.get('/api/system/status', async (req: Request, res: Response) => {
    try {
      const result = await systemApi.getSystemStatus();
      const statusCode = result.success ? 200 : 500;
      res.status(statusCode).json(result);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message,
        timestamp: getCurrentTime()
      });
    }
  });

  return app;
}

/**
 * 启动HTTP服务器
 */
export async function startHttpServer() {
  try {
    // 初始化知识图谱服务
    await knowledgeGraphService.initialize();
    
    // 初始化调度器（但不启动定时任务）
    await schedulerService.initialize();

    const app = createHttpServer();
    const port = config.server.port;

    app.listen(port, () => {
      logger.info(`🚀 Graph Worker HTTP服务已启动`);
      logger.info(`📍 服务地址: http://localhost:${port}`);
      logger.info(`🏥 健康检查: http://localhost:${port}/health`);
      logger.info(`📊 API状态: http://localhost:${port}/api/system/status`);
      logger.info(`📈 图谱统计: http://localhost:${port}/api/stats`);
      logger.info(`📁 处理模式: 本地文件扫描`);
    });

  } catch (error) {
    logger.error('❌ 启动HTTP服务器失败:', error);
    throw error;
  }
} 
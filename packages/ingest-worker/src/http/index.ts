import express, { Request, Response } from 'express';
import { logger } from '../utils/logger';
import config from '../config/config';

// APIs
import { fetchLatestNews } from '../apis/news/fetch';
import { getNewsList, getNewsByTimeRange } from '../apis/news/list';
import { getNewsCount } from '../apis/news/count';
import { cleanOldNews } from '../apis/news/clean';
import { getSystemStatus, healthCheck } from '../apis/system/status';
import { getSchedulerStatus, triggerNewsTask } from '../apis/system/scheduler';
import { daysAgo, parseTime } from '../utils/time';

const app = express();

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 健康检查
app.get('/health', async (req: Request, res: Response) => {
  try {
    const result = await healthCheck();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 触发器路由
app.post('/trigger/fetch-news', async (req: Request, res: Response) => {
  try {
    logger.info('收到新闻获取触发请求');
    const result = await fetchLatestNews();
    res.json(result);
  } catch (error: any) {
    logger.error('新闻获取触发失败:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.post('/trigger/fetch-batch', async (req: Request, res: Response) => {
  try {
    const { days = 1 } = req.body;
    logger.info(`收到批量新闻获取触发请求: ${days}天`);
    
    const startTime = daysAgo(days);
    const endTime = parseTime(Date.now());
    const result = await getNewsByTimeRange(startTime, endTime);
    
    res.json(result);
  } catch (error: any) {
    logger.error('批量新闻获取触发失败:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// API路由
app.get('/api/news/list', async (req: Request, res: Response) => {
  try {
    const { limit = 10 } = req.query;
    const result = await getNewsList(parseInt(limit as string));
    res.json(result);
  } catch (error: any) {
    logger.error('获取新闻列表失败:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.get('/api/news/count', async (req: Request, res: Response) => {
  try {
    const result = await getNewsCount();
    res.json(result);
  } catch (error: any) {
    logger.error('获取新闻统计失败:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.get('/api/news/status', async (req: Request, res: Response) => {
  try {
    const result = await getSystemStatus();
    res.json(result);
  } catch (error: any) {
    logger.error('获取服务状态失败:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.post('/api/news/clean', async (req: Request, res: Response) => {
  try {
    const { days = 7 } = req.body;
    const result = await cleanOldNews(days);
    res.json(result);
  } catch (error: any) {
    logger.error('清理旧新闻失败:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// 调度器管理路由
app.get('/api/scheduler/status', async (req: Request, res: Response) => {
  try {
    const result = await getSchedulerStatus();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

app.post('/api/scheduler/trigger', async (req: Request, res: Response) => {
  try {
    const result = await triggerNewsTask();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

/**
 * 启动HTTP服务器
 */
export function startHttpServer(): Promise<any> {
  const port = process.env.PORT || 39110;
  
  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      logger.info(`🌐 HTTP服务已启动，端口: ${port}`);
      logger.info(`🔗 健康检查: http://localhost:${port}/health`);
      logger.info(`📊 功能: 富途新闻获取和管理API`);
      resolve(server);
    });

    server.on('error', reject);

    // 优雅关闭
    process.on('SIGTERM', () => {
      logger.info('收到SIGTERM信号，正在关闭HTTP服务...');
      server.close(() => {
        logger.info('HTTP服务已关闭');
      });
    });

    process.on('SIGINT', () => {
      logger.info('收到SIGINT信号，正在关闭HTTP服务...');
      server.close(() => {
        logger.info('HTTP服务已关闭');
      });
    });
  });
}

export { app }; 
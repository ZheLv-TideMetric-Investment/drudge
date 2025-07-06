import dotenv from 'dotenv';
import path from 'path';

// 加载环境变量
dotenv.config();

export default {
  // 服务端口
  port: parseInt(process.env.PORT || '39110'),
  
  // 存储配置
  storage: {
    path: process.env.STORAGE_PATH || '../../data'
  },
  
  // 新闻API配置
  newsApi: {
    url: process.env.NEWS_API_URL || 'https://news.futunn.com/news-site-api/main/get-flash-list',
    pageSize: parseInt(process.env.NEWS_API_PAGE_SIZE || '50'),
    requestInterval: parseInt(process.env.NEWS_API_REQUEST_INTERVAL || '1000')
  },
  
  // 日志配置
  log: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/ingest-worker.log'
  }
}; 
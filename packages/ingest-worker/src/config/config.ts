import dotenv from 'dotenv';
import path from 'path';

// 加载环境变量
dotenv.config();

const defaultStoragePath = path.resolve(__dirname, '../../../../data');
const storagePath = process.env.STORAGE_PATH
  ? path.resolve(process.env.STORAGE_PATH)
  : defaultStoragePath;

export default {
  // 服务端口
  port: parseInt(process.env.PORT || '39110'),

  // 存储配置
  storage: {
    path: storagePath,
  },

  // 新闻API配置
  newsApi: {
    url: process.env.NEWS_API_URL || 'https://news.futunn.com/news-site-api/main/get-flash-list',
    pageSize: parseInt(process.env.NEWS_API_PAGE_SIZE || '50'),
    requestInterval: parseInt(process.env.NEWS_API_REQUEST_INTERVAL || '1000'),
  },

  // 通知配置
  notification: {
    enableWebhookNotification: process.env.ENABLE_WEBHOOK_NOTIFICATION === 'true' || false,
    webhookUrl: process.env.WEBHOOK_URL || '',
  },

  // 日志配置
  log: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/ingest-worker.log',
  },
};

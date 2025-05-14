require('dotenv').config();

module.exports = {
  newsApi: {
    url: 'https://news.futunn.com/news-site-api/main/get-flash-list',
    pageSize: 30,
    interval: 60 * 1000, // 1分钟
  },
  summary: {
    interval: 60 * 60 * 1000, // 1小时
  },
  webhook: {
    url: process.env.WEBHOOK_URL || '',
  },
  storage: {
    path: process.env.STORAGE_PATH || './data',
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || './logs/app.log',
  },
  ai: {
    baseURL: process.env.AI_BASE_URL || 'https://api.deepseek.com',
    apiKey: process.env.AI_API_KEY || '',
    model: process.env.AI_MODEL || 'deepseek-chat',
  }
};

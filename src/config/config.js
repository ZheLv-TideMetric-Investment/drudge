import 'dotenv/config';

export default {
  newsApi: {
    url: 'https://news.futunn.com/news-site-api/main/get-flash-list',
    pageSize: parseInt(process.env.NEWS_API_PAGE_SIZE || '50', 10),
    interval: parseInt(process.env.NEWS_API_INTERVAL || '60000', 10),
    requestInterval: parseInt(process.env.NEWS_API_REQUEST_INTERVAL || '1000', 10),
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
    model: process.env.AI_MODEL || 'deepseek-reasoner',
  },
  neo4j: {
    uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
    username: process.env.NEO4J_USERNAME || 'neo4j',
    password: process.env.NEO4J_PASSWORD || '',
    database: process.env.NEO4J_DATABASE || 'neo4j',
  },
};

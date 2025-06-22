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
  // 批量处理配置
  batch: {
    enabled: process.env.BATCH_ENABLED !== 'false', // 默认启用批量处理
    minBatchSize: parseInt(process.env.BATCH_MIN_SIZE || '3', 10), // 最小批量大小
    maxBatchSize: parseInt(process.env.BATCH_MAX_SIZE || '5', 10), // 最大批量大小
    aiRetryAttempts: parseInt(process.env.BATCH_AI_RETRY || '3', 10), // AI调用重试次数
    dbBatchSize: parseInt(process.env.BATCH_DB_SIZE || '20', 10), // 数据库批量大小
    delayBetweenBatches: parseInt(process.env.BATCH_DELAY || '500', 10), // 批次间延迟(ms)
  },

  // 工作线程配置
  workers: {
    enabled: process.env.WORKERS_ENABLED !== 'false', // 默认启用工作线程
    maxWorkers: parseInt(process.env.MAX_WORKERS || '2', 10), // 最大工作线程数
    timeout: parseInt(process.env.WORKER_TIMEOUT || '300000', 10), // 工作线程任务超时时间(ms)
    healthCheckInterval: parseInt(process.env.WORKER_HEALTH_CHECK_INTERVAL || '60000', 10), // 健康检查间隔(ms)
  },
};

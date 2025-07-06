import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

const config = {
  // 服务配置
  port: parseInt(process.env.PORT || '39111', 10),
  server: {
    port: parseInt(process.env.PORT || '39111', 10)
  },
  
  // Neo4j 配置
  neo4j: {
    uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
    user: process.env.NEO4J_USER || 'changting',
    password: process.env.NEO4J_PASSWORD || 'niuniuniu',
    database: process.env.NEO4J_DATABASE || 'neo4j'
  },
  
  // AI 配置
  ai: {
    provider: process.env.AI_PROVIDER || 'deepseek',
    deepseek: {
      apiKey: process.env.DEEPSEEK_API_KEY || '',
      model: process.env.DEEPSEEK_MODEL || 'deepseek-reasoner'
    },
    google: {
      apiKey: process.env.GOOGLE_API_KEY || '',
      model: process.env.GOOGLE_MODEL || 'gemini-1.5-flash'
    }
  },
  
  // 数据源配置
  dataSource: {
    newsDirectory: process.env.NEWS_DIRECTORY || '../../data/news',
    // 支持的新闻文件前缀
    supportedPrefixes: ['futu_live']
  },
  
  // 处理配置
  processing: {
    batchSize: parseInt(process.env.BATCH_SIZE || '10', 10),
    retryAttempts: parseInt(process.env.RETRY_ATTEMPTS || '3', 10),
    retryDelay: parseInt(process.env.RETRY_DELAY || '1000', 10)
  },
  
  // 通知配置
  notification: {
    enableWebhookNotification: process.env.ENABLE_WEBHOOK_NOTIFICATION === 'true' || false,
    webhookUrl: process.env.WEBHOOK_URL || ''
  },
  
  // 日志配置
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'combined'
  }
};

export default config; 
import dotenv from 'dotenv';

// 加载环境变量
if (typeof window === 'undefined') {
  dotenv.config();
}

export const config = {
  // Neo4j 数据库配置
  neo4j: {
    uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
    user: process.env.NEO4J_USER || 'neo4j',
    password: process.env.NEO4J_PASSWORD || 'password',
    database: process.env.NEO4J_DATABASE || 'neo4j'
  },
  
  // AI配置
  ai: {
    provider: process.env.AI_PROVIDER || 'deepseek',
    simpleProvider: process.env.SIMPLE_AI_PROVIDER || 'qwen',
    deepseek: {
      model: process.env.DEEPSEEK_MODEL || 'deepseek-reasoner',
      apiKey: process.env.DEEPSEEK_API_KEY || ''
    },
    google: {
      model: process.env.GOOGLE_MODEL || 'gemini-1.5-flash',
      apiKey: process.env.GOOGLE_API_KEY || ''
    },
    qwen: {
      model: process.env.QWEN_MODEL || 'qwen-max',
      apiKey: process.env.QWEN_API_KEY || ''
    },
    xai: {
      model: process.env.XAI_MODEL || 'grok-4',
      apiKey: process.env.XAI_API_KEY || ''
    }
  },
  
  // 通知配置
  notification: {
    enableWebhookNotification: process.env.ENABLE_WEBHOOK_NOTIFICATION === 'true',
    webhookUrls: process.env.WEBHOOK_URLS ? process.env.WEBHOOK_URLS.split(',').map(url => url.trim()).filter(url => url) : []
  },
  
  // 定时任务配置
  cron: {
    highLevelScan: process.env.CRON_HIGH_LEVEL_SCAN || '0 */5 * * * *',
    hourlySummary: process.env.CRON_HOURLY_SUMMARY || '0 0 11-22 * * *',
    dailySummary: process.env.CRON_DAILY_SUMMARY || '0 0 10 * * *'
  },
  
  // 日志配置
  log: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'logs/app.log'
  }
}; 
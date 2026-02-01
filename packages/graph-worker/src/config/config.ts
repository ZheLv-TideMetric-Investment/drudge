import dotenv from 'dotenv';
import path from 'path';

// 加载环境变量
if (process.env.DOTENV_CONFIG_PATH) {
  dotenv.config({ path: process.env.DOTENV_CONFIG_PATH });
} else {
  dotenv.config();
}

const defaultNewsDirectory = path.resolve(__dirname, '../../../../data/news');
const newsDirectory = process.env.NEWS_DIRECTORY
  ? path.resolve(process.env.NEWS_DIRECTORY)
  : defaultNewsDirectory;
const failedNewsDirectory = process.env.FAILED_NEWS_DIRECTORY
  ? path.resolve(process.env.FAILED_NEWS_DIRECTORY)
  : path.join(newsDirectory, 'failed');

const config = {
  // 服务配置
  port: parseInt(process.env.PORT || '39111', 10),
  server: {
    port: parseInt(process.env.PORT || '39111', 10),
  },

  // Neo4j 配置
  neo4j: {
    uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
    user: process.env.NEO4J_USER || 'neo4j',
    password: process.env.NEO4J_PASSWORD || 'niuniuniu',
    database: process.env.NEO4J_DATABASE || 'neo4j',
  },

  // AI 配置
  ai: {
    provider: process.env.AI_PROVIDER || 'qwen',
    fallbackProvider: process.env.AI_FALLBACK_PROVIDER || 'xai',
    deepseek: {
      apiKey: process.env.DEEPSEEK_API_KEY || '',
      model: process.env.DEEPSEEK_MODEL || 'deepseek-reasoner',
    },
    google: {
      apiKey: process.env.GOOGLE_API_KEY || '',
      model: process.env.GOOGLE_MODEL || 'gemini-1.5-flash',
    },
    qwen: {
      apiKey: process.env.QWEN_API_KEY || '',
      model: process.env.QWEN_MODEL || 'qwen-turbo',
    },
    xai: {
      apiKey: process.env.XAI_API_KEY || '',
      model: process.env.XAI_MODEL || 'grok-3-mini',
      proxyUrl: process.env.XAI_PROXY_URL || '',
    },
  },

  // 数据源配置
  dataSource: {
    newsDirectory,
    failedNewsDirectory,
    // 支持的新闻文件前缀
    supportedPrefixes: ['futu_live', 'awtmt_live'],
  },

  // 处理配置 - 优化内存使用
  processing: {
    // 基础批次配置
    batchSize: parseInt(process.env.BATCH_SIZE || '10', 10),
    retryAttempts: parseInt(process.env.RETRY_ATTEMPTS || '3', 10),
    retryDelay: parseInt(process.env.RETRY_DELAY || '1000', 10),

    // 内存优化配置
    memory: {
      // 实体提取分块大小 (每次处理多少条新闻)
      extractionChunkSize: parseInt(process.env.EXTRACTION_CHUNK_SIZE || '20', 10),
      // 新闻处理分块大小 (总体批量处理分块)
      processingChunkSize: parseInt(process.env.PROCESSING_CHUNK_SIZE || '50', 10),
      // AI调用批次大小
      aiBatchSize: parseInt(process.env.AI_BATCH_SIZE || '3', 10),
      // 内存警告阈值 (百分比)
      warningThreshold: parseFloat(process.env.MEMORY_WARNING_THRESHOLD || '0.7'),
      // 内存危险阈值 (百分比)
      dangerThreshold: parseFloat(process.env.MEMORY_DANGER_THRESHOLD || '0.85'),
      // 最大堆内存大小 (MB)
      maxHeapSizeMB: parseInt(process.env.MAX_HEAP_SIZE_MB || '2048', 10),
      // 内存监控间隔 (毫秒)
      monitoringIntervalMs: parseInt(process.env.MEMORY_MONITORING_INTERVAL_MS || '30000', 10),
      // 分块间延迟 (毫秒)
      chunkDelayMs: parseInt(process.env.CHUNK_DELAY_MS || '1000', 10),
      // 自动垃圾回收
      enableAutoGC: process.env.ENABLE_AUTO_GC !== 'false', // 默认启用
    },
  },

  // 通知配置
  notification: {
    enableWebhookNotification: process.env.ENABLE_WEBHOOK_NOTIFICATION === 'true' || false,
    webhookUrl: process.env.WEBHOOK_URL || '',
  },

  // 日志配置
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'combined',
  },
};

export default config;

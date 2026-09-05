const path = require('path');
const dotenv = require('dotenv');

const loadedDotenvKeys = new Set();
const DEFAULT_DOTENV_PATH = path.resolve(__dirname, '../../../.env');

const isEmpty = value =>
  value === undefined || value === null || (typeof value === 'string' && value.trim() === '');

const loadDotenv = (options = {}) => {
  const { env = process.env, dotenvPath, enabled = true, force = false } = options;

  if (!enabled) {
    return false;
  }

  const envDotenvPath = isEmpty(env.DOTENV_CONFIG_PATH) ? '' : String(env.DOTENV_CONFIG_PATH);

  const candidatePaths = (() => {
    if (envDotenvPath || dotenvPath) {
      return [path.resolve(envDotenvPath || dotenvPath)];
    }

    const cwd = process.cwd();
    return Array.from(
      new Set([
        path.resolve(cwd, '.env'),
        path.resolve(cwd, '../.env'),
        path.resolve(cwd, '../../.env'),
        path.resolve(cwd, '../../../.env'),
        path.resolve(cwd, '../../../../.env'),
        DEFAULT_DOTENV_PATH,
      ])
    );
  })();

  for (const candidatePath of candidatePaths) {
    if (!force && loadedDotenvKeys.has(candidatePath)) {
      return false;
    }

    const result = dotenv.config({ path: candidatePath });
    if (!result.error) {
      loadedDotenvKeys.add(candidatePath);
      return true;
    }
  }

  return false;
};

const readString = (env, key, fallback = '') => {
  const value = env[key];
  if (isEmpty(value)) {
    return fallback;
  }
  return String(value);
};

const readInt = (env, key, fallback) => {
  const value = readString(env, key, '');
  if (!value) return fallback;

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const readFloat = (env, key, fallback) => {
  const value = readString(env, key, '');
  if (!value) return fallback;

  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const readBoolean = (env, key, fallback = false) => {
  const value = readString(env, key, '');
  if (!value) return fallback;

  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'off'].includes(normalized)) return false;

  return fallback;
};

const readCsv = (env, key) => {
  const value = readString(env, key, '');
  if (!value) return [];

  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
};

const readPath = (env, key, fallbackPath) => {
  const value = readString(env, key, '');
  if (value) {
    return path.resolve(value);
  }
  return path.resolve(fallbackPath);
};

const getNodeEnv = (env = process.env) => readString(env, 'NODE_ENV', 'development');

const isProduction = (env = process.env) => getNodeEnv(env) === 'production';

const redactSecret = value => {
  if (isEmpty(value)) return '';
  const stringValue = String(value);
  if (stringValue.length <= 4) return '****';
  return `${stringValue.slice(0, 2)}***${stringValue.slice(-2)}`;
};

const buildIngestConfig = (options = {}) => {
  const { env = process.env, baseDir = process.cwd(), loadEnv = true } = options;

  if (loadEnv) {
    loadDotenv({ env });
  }

  const defaultStoragePath = path.resolve(baseDir, '../../../../data');

  return {
    nodeEnv: getNodeEnv(env),
    port: readInt(env, 'INGEST_WORKER_PORT', readInt(env, 'PORT', 39110)),
    storage: {
      path: readPath(env, 'STORAGE_PATH', defaultStoragePath),
    },
    newsApi: {
      url: readString(
        env,
        'NEWS_API_URL',
        'https://news.futunn.com/news-site-api/main/get-flash-list'
      ),
      pageSize: readInt(env, 'NEWS_API_PAGE_SIZE', 50),
      requestInterval: readInt(env, 'NEWS_API_REQUEST_INTERVAL', 1000),
    },
    notification: {
      enableWebhookNotification: readBoolean(env, 'ENABLE_WEBHOOK_NOTIFICATION', false),
      webhookUrl: readString(
        env,
        'INGEST_WORKER_ALERT_WEBHOOK_URL',
        readString(env, 'ALERT_WEBHOOK_URL', '')
      ),
    },
    log: {
      level: readString(env, 'INGEST_WORKER_LOG_LEVEL', readString(env, 'LOG_LEVEL', 'info')),
      file: readString(
        env,
        'INGEST_WORKER_LOG_FILE',
        readString(env, 'LOG_FILE', 'logs/ingest-worker.log')
      ),
    },
  };
};

const buildGraphConfig = (options = {}) => {
  const { env = process.env, baseDir = process.cwd(), loadEnv = true } = options;

  if (loadEnv) {
    loadDotenv({ env });
  }

  const defaultNewsDirectory = path.resolve(baseDir, '../../../../data/news');
  const newsDirectory = readPath(env, 'NEWS_DIRECTORY', defaultNewsDirectory);

  return {
    nodeEnv: getNodeEnv(env),
    port: readInt(env, 'GRAPH_WORKER_PORT', readInt(env, 'PORT', 39111)),
    server: {
      port: readInt(env, 'GRAPH_WORKER_PORT', readInt(env, 'PORT', 39111)),
    },
    neo4j: {
      uri: readString(env, 'NEO4J_URI', 'bolt://localhost:7687'),
      user: readString(env, 'NEO4J_USER', 'neo4j'),
      password: readString(env, 'NEO4J_PASSWORD', ''),
      database: readString(env, 'NEO4J_DATABASE', 'neo4j'),
    },
    ai: {
      provider: readString(env, 'GRAPH_AI_PROVIDER', readString(env, 'AI_PROVIDER', 'qwen')),
      fallbackProvider: readString(
        env,
        'GRAPH_AI_FALLBACK_PROVIDER',
        readString(env, 'AI_FALLBACK_PROVIDER', 'xai')
      ),
      deepseek: {
        apiKey: readString(env, 'GRAPH_DEEPSEEK_API_KEY', readString(env, 'DEEPSEEK_API_KEY', '')),
        model: readString(
          env,
          'GRAPH_DEEPSEEK_MODEL',
          readString(env, 'DEEPSEEK_MODEL', 'deepseek-v4-flash')
        ),
      },
      google: {
        apiKey: readString(env, 'GRAPH_GOOGLE_API_KEY', readString(env, 'GOOGLE_API_KEY', '')),
        model: readString(
          env,
          'GRAPH_GOOGLE_MODEL',
          readString(env, 'GOOGLE_MODEL', 'gemini-2.5-flash-lite')
        ),
      },
      qwen: {
        apiKey: readString(env, 'GRAPH_QWEN_API_KEY', readString(env, 'QWEN_API_KEY', '')),
        model: readString(env, 'GRAPH_QWEN_MODEL', readString(env, 'QWEN_MODEL', 'qwen3.7-flash')),
      },
      xai: {
        apiKey: readString(env, 'GRAPH_XAI_API_KEY', readString(env, 'XAI_API_KEY', '')),
        model: readString(env, 'GRAPH_XAI_MODEL', readString(env, 'XAI_MODEL', 'grok-4.3')),
        proxyUrl: readString(env, 'GRAPH_XAI_PROXY_URL', readString(env, 'XAI_PROXY_URL', '')),
      },
    },
    dataSource: {
      newsDirectory,
      failedNewsDirectory: readPath(
        env,
        'FAILED_NEWS_DIRECTORY',
        path.join(newsDirectory, 'failed')
      ),
      supportedPrefixes: ['futu_live', 'awtmt_live'],
    },
    processing: {
      batchSize: readInt(env, 'BATCH_SIZE', 10),
      maxFilesPerScan: Math.max(
        1,
        readInt(env, 'GRAPH_MAX_FILES_PER_SCAN', readInt(env, 'MAX_FILES_PER_SCAN', 200))
      ),
      retryAttempts: readInt(env, 'RETRY_ATTEMPTS', 3),
      retryDelay: readInt(env, 'RETRY_DELAY', 1000),
      memory: {
        extractionChunkSize: readInt(env, 'EXTRACTION_CHUNK_SIZE', 20),
        processingChunkSize: readInt(env, 'PROCESSING_CHUNK_SIZE', 50),
        aiBatchSize: readInt(env, 'AI_BATCH_SIZE', 3),
        warningThreshold: readFloat(env, 'MEMORY_WARNING_THRESHOLD', 0.7),
        dangerThreshold: readFloat(env, 'MEMORY_DANGER_THRESHOLD', 0.85),
        maxHeapSizeMB: readInt(env, 'MAX_HEAP_SIZE_MB', 2048),
        monitoringIntervalMs: readInt(env, 'MEMORY_MONITORING_INTERVAL_MS', 30000),
        chunkDelayMs: readInt(env, 'CHUNK_DELAY_MS', 1000),
        enableAutoGC: readBoolean(env, 'ENABLE_AUTO_GC', true),
      },
    },
    notification: {
      enableWebhookNotification: readBoolean(env, 'ENABLE_WEBHOOK_NOTIFICATION', false),
      webhookUrl: readString(
        env,
        'GRAPH_ALERT_WEBHOOK_URL',
        readString(env, 'ALERT_WEBHOOK_URL', '')
      ),
    },
    logging: {
      level: readString(env, 'GRAPH_LOG_LEVEL', readString(env, 'LOG_LEVEL', 'info')),
      format: readString(env, 'GRAPH_LOG_FORMAT', readString(env, 'LOG_FORMAT', 'combined')),
    },
  };
};

const buildWebConfig = (options = {}) => {
  const { env = process.env, loadEnv = true } = options;

  if (loadEnv) {
    loadDotenv({ env });
  }

  return {
    nodeEnv: getNodeEnv(env),
    port: readInt(env, 'WEB_APP_PORT', readInt(env, 'PORT', 39112)),
    workers: {
      ingestPort: readInt(env, 'INGEST_WORKER_PORT', 39110),
      graphPort: readInt(env, 'GRAPH_WORKER_PORT', 39111),
    },
    neo4j: {
      uri: readString(env, 'WEB_NEO4J_URI', readString(env, 'NEO4J_URI', 'bolt://localhost:7687')),
      user: readString(env, 'WEB_NEO4J_USER', readString(env, 'NEO4J_USER', 'neo4j')),
      password: readString(env, 'WEB_NEO4J_PASSWORD', readString(env, 'NEO4J_PASSWORD', '')),
      database: readString(env, 'WEB_NEO4J_DATABASE', readString(env, 'NEO4J_DATABASE', 'neo4j')),
    },
    ai: {
      provider: readString(env, 'WEB_AI_PROVIDER', readString(env, 'AI_PROVIDER', 'deepseek')),
      simpleProvider: readString(
        env,
        'WEB_SIMPLE_AI_PROVIDER',
        readString(env, 'SIMPLE_AI_PROVIDER', 'qwen')
      ),
      deepseek: {
        model: readString(
          env,
          'WEB_DEEPSEEK_MODEL',
          readString(env, 'DEEPSEEK_MODEL', 'deepseek-v4-flash')
        ),
        apiKey: readString(env, 'WEB_DEEPSEEK_API_KEY', readString(env, 'DEEPSEEK_API_KEY', '')),
      },
      google: {
        model: readString(
          env,
          'WEB_GOOGLE_MODEL',
          readString(env, 'GOOGLE_MODEL', 'gemini-2.5-flash-lite')
        ),
        apiKey: readString(env, 'WEB_GOOGLE_API_KEY', readString(env, 'GOOGLE_API_KEY', '')),
      },
      qwen: {
        model: readString(env, 'WEB_QWEN_MODEL', readString(env, 'QWEN_MODEL', 'qwen3.7-flash')),
        apiKey: readString(env, 'WEB_QWEN_API_KEY', readString(env, 'QWEN_API_KEY', '')),
      },
      xai: {
        model: readString(env, 'WEB_XAI_MODEL', readString(env, 'XAI_MODEL', 'grok-4.3')),
        apiKey: readString(env, 'WEB_XAI_API_KEY', readString(env, 'XAI_API_KEY', '')),
        proxyUrl: readString(env, 'WEB_XAI_PROXY_URL', readString(env, 'XAI_PROXY_URL', '')),
      },
      jina: {
        apiKey: readString(env, 'WEB_JINA_API_KEY', readString(env, 'JINA_API_KEY', '')),
      },
    },
    notification: {
      enabled: readBoolean(
        env,
        'WEB_ENABLE_DINGTALK_NOTIFICATION',
        readBoolean(env, 'ENABLE_DINGTALK_NOTIFICATION', false)
      ),
      dingtalk: {
        clientId: readString(env, 'DINGTALK_APP_CLIENT_ID', ''),
        clientSecret: readString(env, 'DINGTALK_APP_CLIENT_SECRET', ''),
        targetUserId: readString(env, 'DINGTALK_TARGET_USER_ID', ''),
      },
      briefing: {
        publicBaseUrl: readString(env, 'BRIEFING_PUBLIC_BASE_URL', ''),
        storagePath: readString(env, 'BRIEFING_STORAGE_PATH', ''),
      },
    },
    cron: {
      highLevelScan: readString(env, 'CRON_HIGH_LEVEL_SCAN', '0 */5 * * * *'),
      hourlySummary: readString(env, 'CRON_HOURLY_SUMMARY', '0 0 11-22 * * *'),
      dailySummary: readString(env, 'CRON_DAILY_SUMMARY', '0 0 10 * * *'),
    },
    log: {
      level: readString(env, 'WEB_LOG_LEVEL', readString(env, 'LOG_LEVEL', 'info')),
      file: readString(env, 'WEB_LOG_FILE', readString(env, 'LOG_FILE', 'logs/app.log')),
    },
  };
};

module.exports = {
  loadDotenv,
  readString,
  readInt,
  readFloat,
  readBoolean,
  readCsv,
  readPath,
  getNodeEnv,
  isProduction,
  redactSecret,
  buildIngestConfig,
  buildGraphConfig,
  buildWebConfig,
};

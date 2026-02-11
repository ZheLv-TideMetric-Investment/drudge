import fs from 'fs';
import os from 'os';
import path from 'path';
import { setEnv } from '../helpers/env';

const emptyEnvPath = path.join(os.tmpdir(), `drudge-empty-env-${process.pid}`);

const loadConfig = async (vars: Record<string, string | undefined>) => {
  const restore = setEnv({
    DOTENV_CONFIG_PATH: emptyEnvPath,
    ...vars
  });
  jest.resetModules();
  const config = (await import('../../src/config/config')).default;
  restore();
  return config;
};

describe('graph-worker config', () => {
  beforeAll(() => {
    fs.writeFileSync(emptyEnvPath, '');
  });

  afterAll(() => {
    try {
      fs.unlinkSync(emptyEnvPath);
    } catch {
      // ignore
    }
  });

  it('uses environment overrides when provided', async () => {
    const newsDir = path.join(os.tmpdir(), 'drudge-news');
    const failedDir = path.join(os.tmpdir(), 'drudge-failed');

    const config = await loadConfig({
      GRAPH_WORKER_PORT: '4000',
      PORT: '9999',
      NEWS_DIRECTORY: newsDir,
      FAILED_NEWS_DIRECTORY: failedDir,
      NEO4J_URI: 'bolt://example:7687',
      NEO4J_USER: 'neo4j-user',
      NEO4J_PASSWORD: 'secret',
      NEO4J_DATABASE: 'test',
      AI_PROVIDER: 'deepseek',
      AI_FALLBACK_PROVIDER: 'google',
      DEEPSEEK_API_KEY: 'deep',
      DEEPSEEK_MODEL: 'deepseek-test',
      GOOGLE_API_KEY: 'google',
      GOOGLE_MODEL: 'gemini-test',
      QWEN_API_KEY: 'qwen',
      QWEN_MODEL: 'qwen-test',
      XAI_API_KEY: 'xai',
      XAI_MODEL: 'grok-test',
      XAI_PROXY_URL: 'http://proxy',
      BATCH_SIZE: '12',
      RETRY_ATTEMPTS: '4',
      RETRY_DELAY: '1500',
      EXTRACTION_CHUNK_SIZE: '9',
      PROCESSING_CHUNK_SIZE: '11',
      AI_BATCH_SIZE: '2',
      MEMORY_WARNING_THRESHOLD: '0.5',
      MEMORY_DANGER_THRESHOLD: '0.9',
      MAX_HEAP_SIZE_MB: '512',
      MEMORY_MONITORING_INTERVAL_MS: '10000',
      CHUNK_DELAY_MS: '2500',
      ENABLE_AUTO_GC: 'false',
      ENABLE_WEBHOOK_NOTIFICATION: 'true',
      WEBHOOK_URL: 'https://example.com',
      LOG_LEVEL: 'debug',
      LOG_FORMAT: 'json'
    });

    expect(config.port).toBe(4000);
    expect(config.dataSource.newsDirectory).toBe(path.resolve(newsDir));
    expect(config.dataSource.failedNewsDirectory).toBe(path.resolve(failedDir));
    expect(config.neo4j.uri).toBe('bolt://example:7687');
    expect(config.ai.provider).toBe('deepseek');
    expect(config.processing.batchSize).toBe(12);
    expect(config.processing.memory.enableAutoGC).toBe(false);
    expect(config.notification.enableWebhookNotification).toBe(true);
    expect(config.logging.format).toBe('json');
  });

  it('falls back to defaults when env is missing', async () => {
    const config = await loadConfig({
      GRAPH_WORKER_PORT: undefined,
      PORT: undefined,
      NEWS_DIRECTORY: undefined,
      FAILED_NEWS_DIRECTORY: undefined,
      NEO4J_URI: undefined,
      NEO4J_USER: undefined,
      NEO4J_PASSWORD: undefined,
      NEO4J_DATABASE: undefined,
      AI_PROVIDER: undefined,
      AI_FALLBACK_PROVIDER: undefined,
      DEEPSEEK_API_KEY: undefined,
      DEEPSEEK_MODEL: undefined,
      GOOGLE_API_KEY: undefined,
      GOOGLE_MODEL: undefined,
      QWEN_API_KEY: undefined,
      QWEN_MODEL: undefined,
      XAI_API_KEY: undefined,
      XAI_MODEL: undefined,
      XAI_PROXY_URL: undefined,
      BATCH_SIZE: undefined,
      RETRY_ATTEMPTS: undefined,
      RETRY_DELAY: undefined,
      EXTRACTION_CHUNK_SIZE: undefined,
      PROCESSING_CHUNK_SIZE: undefined,
      AI_BATCH_SIZE: undefined,
      MEMORY_WARNING_THRESHOLD: undefined,
      MEMORY_DANGER_THRESHOLD: undefined,
      MAX_HEAP_SIZE_MB: undefined,
      MEMORY_MONITORING_INTERVAL_MS: undefined,
      CHUNK_DELAY_MS: undefined,
      ENABLE_AUTO_GC: undefined,
      ENABLE_WEBHOOK_NOTIFICATION: undefined,
      WEBHOOK_URL: undefined,
      LOG_LEVEL: undefined,
      LOG_FORMAT: undefined
    });

    expect(config.port).toBe(39111);
    expect(config.neo4j.uri).toBe('bolt://localhost:7687');
    expect(config.processing.batchSize).toBe(10);
    expect(config.processing.memory.enableAutoGC).toBe(true);
    expect(config.notification.enableWebhookNotification).toBe(false);
  });
});

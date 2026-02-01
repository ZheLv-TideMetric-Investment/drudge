import { setEnv } from '../helpers/env';

describe('config', () => {
  it('uses defaults when env vars are missing', async () => {
    const restoreEnv = setEnv({
      NEO4J_URI: undefined,
      NEO4J_USER: undefined,
      NEO4J_PASSWORD: undefined,
      NEO4J_DATABASE: undefined,
      AI_PROVIDER: undefined,
      SIMPLE_AI_PROVIDER: undefined,
      DEEPSEEK_MODEL: undefined,
      DEEPSEEK_API_KEY: undefined,
      GOOGLE_MODEL: undefined,
      GOOGLE_API_KEY: undefined,
      QWEN_MODEL: undefined,
      QWEN_API_KEY: undefined,
      XAI_MODEL: undefined,
      XAI_API_KEY: undefined,
      XAI_PROXY_URL: undefined,
      ENABLE_WEBHOOK_NOTIFICATION: undefined,
      WEBHOOK_URLS: undefined,
      CRON_HIGH_LEVEL_SCAN: undefined,
      CRON_HOURLY_SUMMARY: undefined,
      CRON_DAILY_SUMMARY: undefined,
      LOG_LEVEL: undefined,
      LOG_FILE: undefined
    });

    const originalWindow = (global as any).window;
    (global as any).window = {};

    try {
      jest.resetModules();
      const { config } = await import('../../src/lib/config');

      expect(config.neo4j.uri).toBe('bolt://localhost:7687');
      expect(config.ai.provider).toBe('deepseek');
      expect(config.notification.enableWebhookNotification).toBe(false);
      expect(config.notification.webhookUrls).toEqual([]);
      expect(config.cron.highLevelScan).toBe('0 */5 * * * *');
      expect(config.log.level).toBe('info');
    } finally {
      if (originalWindow === undefined) {
        delete (global as any).window;
      } else {
        (global as any).window = originalWindow;
      }
      restoreEnv();
    }
  });

  it('uses environment overrides', async () => {
    const restoreEnv = setEnv({
      NEO4J_URI: 'bolt://example:7687',
      NEO4J_USER: 'user',
      NEO4J_PASSWORD: 'pass',
      NEO4J_DATABASE: 'db',
      AI_PROVIDER: 'google',
      SIMPLE_AI_PROVIDER: 'xai',
      DEEPSEEK_MODEL: 'ds-model',
      DEEPSEEK_API_KEY: 'ds-key',
      GOOGLE_MODEL: 'g-model',
      GOOGLE_API_KEY: 'g-key',
      QWEN_MODEL: 'q-model',
      QWEN_API_KEY: 'q-key',
      XAI_MODEL: 'x-model',
      XAI_API_KEY: 'x-key',
      XAI_PROXY_URL: 'http://proxy',
      ENABLE_WEBHOOK_NOTIFICATION: 'true',
      WEBHOOK_URLS: 'http://a, , http://b',
      CRON_HIGH_LEVEL_SCAN: '*/1 * * * *',
      CRON_HOURLY_SUMMARY: '0 1 * * *',
      CRON_DAILY_SUMMARY: '0 2 * * *',
      LOG_LEVEL: 'debug',
      LOG_FILE: 'logs/test.log'
    });

    try {
      jest.resetModules();
      const { config } = await import('../../src/lib/config');

      expect(config.neo4j.uri).toBe('bolt://example:7687');
      expect(config.ai.provider).toBe('google');
      expect(config.ai.simpleProvider).toBe('xai');
      expect(config.ai.xai.proxyUrl).toBe('http://proxy');
      expect(config.notification.enableWebhookNotification).toBe(true);
      expect(config.notification.webhookUrls).toEqual(['http://a', 'http://b']);
      expect(config.cron.hourlySummary).toBe('0 1 * * *');
      expect(config.log.file).toBe('logs/test.log');
    } finally {
      restoreEnv();
    }
  });

  it('uses defaults when running in browser context', async () => {
    const restoreEnv = setEnv({
      NEO4J_URI: undefined,
      NEO4J_USER: undefined,
      NEO4J_PASSWORD: undefined,
      NEO4J_DATABASE: undefined,
      AI_PROVIDER: undefined,
      SIMPLE_AI_PROVIDER: undefined,
      DEEPSEEK_MODEL: undefined,
      DEEPSEEK_API_KEY: undefined,
      GOOGLE_MODEL: undefined,
      GOOGLE_API_KEY: undefined,
      QWEN_MODEL: undefined,
      QWEN_API_KEY: undefined,
      XAI_MODEL: undefined,
      XAI_API_KEY: undefined,
      XAI_PROXY_URL: undefined,
      ENABLE_WEBHOOK_NOTIFICATION: undefined,
      WEBHOOK_URLS: undefined,
      CRON_HIGH_LEVEL_SCAN: undefined,
      CRON_HOURLY_SUMMARY: undefined,
      CRON_DAILY_SUMMARY: undefined,
      LOG_LEVEL: undefined,
      LOG_FILE: undefined
    });

    const originalWindow = (global as any).window;
    (global as any).window = {};

    try {
      jest.resetModules();
      const { config } = await import('../../src/lib/config');

      expect(config.neo4j.uri).toBe('bolt://localhost:7687');
      expect(config.ai.provider).toBe('deepseek');
      expect(config.notification.webhookUrls).toEqual([]);
    } finally {
      if (originalWindow === undefined) {
        delete (global as any).window;
      } else {
        (global as any).window = originalWindow;
      }
      restoreEnv();
    }
  });
});

import fs from 'fs';
import os from 'os';
import path from 'path';
import { setEnv } from '../helpers/env';
import { buildWebConfig } from '@drudge/common';

const emptyEnvPath = path.join(os.tmpdir(), `drudge-web-empty-env-${process.pid}`);

describe('config', () => {
  it('uses worker ports independently from the web process PORT', () => {
    expect(buildWebConfig({ loadEnv: false, env: { PORT: '39112' } }).workers).toEqual({
      ingestPort: 39110, graphPort: 39111,
    });
    expect(buildWebConfig({ loadEnv: false, env: { PORT: '39112', INGEST_WORKER_PORT: '40110', GRAPH_WORKER_PORT: '40111' } }).workers).toEqual({
      ingestPort: 40110, graphPort: 40111,
    });
  });
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

  it('uses defaults when env vars are missing', async () => {
    const restoreEnv = setEnv({
      DOTENV_CONFIG_PATH: emptyEnvPath,
      WEB_APP_PORT: undefined,
      PORT: undefined,
      NEO4J_URI: undefined,
      NEO4J_USER: undefined,
      NEO4J_PASSWORD: undefined,
      NEO4J_DATABASE: undefined,
      AI_PROVIDER: undefined,
      SIMPLE_AI_PROVIDER: undefined,
      WEB_DEEPSEEK_MODEL: undefined,
      DEEPSEEK_MODEL: undefined,
      DEEPSEEK_API_KEY: undefined,
      WEB_GOOGLE_MODEL: undefined,
      GOOGLE_MODEL: undefined,
      GOOGLE_API_KEY: undefined,
      WEB_QWEN_MODEL: undefined,
      QWEN_MODEL: undefined,
      QWEN_API_KEY: undefined,
      WEB_XAI_MODEL: undefined,
      XAI_MODEL: undefined,
      XAI_API_KEY: undefined,
      XAI_PROXY_URL: undefined,
      ENABLE_DINGTALK_NOTIFICATION: undefined,
      DINGTALK_APP_CLIENT_ID: undefined,
      DINGTALK_APP_CLIENT_SECRET: undefined,
      DINGTALK_TARGET_USER_ID: undefined,
      BRIEFING_PUBLIC_BASE_URL: undefined,
      BRIEFING_STORAGE_PATH: undefined,
      CRON_HIGH_LEVEL_SCAN: undefined,
      CRON_HOURLY_SUMMARY: undefined,
      CRON_DAILY_SUMMARY: undefined,
      LOG_LEVEL: undefined,
      LOG_FILE: undefined,
    });

    const originalWindow = (global as any).window;
    (global as any).window = {};

    try {
      jest.resetModules();
      const { config } = await import('../../src/lib/config');

      expect(config.neo4j.uri).toBe('bolt://localhost:7687');
      expect(config.ai.provider).toBe('deepseek');
      expect(config.ai.deepseek.model).toBe('deepseek-v4-flash');
      expect(config.ai.google.model).toBe('gemini-2.5-flash-lite');
      expect(config.ai.qwen.model).toBe('qwen3.7-flash');
      expect(config.ai.xai.model).toBe('grok-4.3');
      expect(config.notification.enabled).toBe(false);
      expect(config.notification.dingtalk).toEqual({
        clientId: '',
        clientSecret: '',
        targetUserId: '',
      });
      expect(config.notification.briefing).toEqual({
        publicBaseUrl: '',
        storagePath: '',
      });
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
      DOTENV_CONFIG_PATH: emptyEnvPath,
      WEB_APP_PORT: '5678',
      PORT: '9999',
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
      ENABLE_DINGTALK_NOTIFICATION: 'true',
      DINGTALK_APP_CLIENT_ID: 'client-id',
      DINGTALK_APP_CLIENT_SECRET: 'client-secret',
      DINGTALK_TARGET_USER_ID: 'designated-user-id',
      BRIEFING_PUBLIC_BASE_URL: 'https://news.example.com',
      BRIEFING_STORAGE_PATH: '/srv/drudge/data/briefings',
      CRON_HIGH_LEVEL_SCAN: '*/1 * * * *',
      CRON_HOURLY_SUMMARY: '0 1 * * *',
      CRON_DAILY_SUMMARY: '0 2 * * *',
      LOG_LEVEL: 'debug',
      LOG_FILE: 'logs/test.log',
    });

    try {
      jest.resetModules();
      const { config } = await import('../../src/lib/config');

      expect(config.port).toBe(5678);
      expect(config.neo4j.uri).toBe('bolt://example:7687');
      expect(config.ai.provider).toBe('google');
      expect(config.ai.simpleProvider).toBe('xai');
      expect(config.ai.deepseek.model).toBe('ds-model');
      expect(config.ai.google.model).toBe('g-model');
      expect(config.ai.qwen.model).toBe('q-model');
      expect(config.ai.xai.model).toBe('x-model');
      expect(config.ai.xai.proxyUrl).toBe('http://proxy');
      expect(config.notification.enabled).toBe(true);
      expect(config.notification.dingtalk).toEqual({
        clientId: 'client-id',
        clientSecret: 'client-secret',
        targetUserId: 'designated-user-id',
      });
      expect(config.notification.briefing).toEqual({
        publicBaseUrl: 'https://news.example.com',
        storagePath: '/srv/drudge/data/briefings',
      });
      expect(config.cron.hourlySummary).toBe('0 1 * * *');
      expect(config.log.file).toBe('logs/test.log');
    } finally {
      restoreEnv();
    }
  });

  it('uses defaults when running in browser context', async () => {
    const restoreEnv = setEnv({
      DOTENV_CONFIG_PATH: emptyEnvPath,
      WEB_APP_PORT: undefined,
      PORT: undefined,
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
      ENABLE_DINGTALK_NOTIFICATION: undefined,
      DINGTALK_APP_CLIENT_ID: undefined,
      DINGTALK_APP_CLIENT_SECRET: undefined,
      DINGTALK_TARGET_USER_ID: undefined,
      BRIEFING_PUBLIC_BASE_URL: undefined,
      BRIEFING_STORAGE_PATH: undefined,
      CRON_HIGH_LEVEL_SCAN: undefined,
      CRON_HOURLY_SUMMARY: undefined,
      CRON_DAILY_SUMMARY: undefined,
      LOG_LEVEL: undefined,
      LOG_FILE: undefined,
    });

    const originalWindow = (global as any).window;
    (global as any).window = {};

    try {
      jest.resetModules();
      const { config } = await import('../../src/lib/config');

      expect(config.neo4j.uri).toBe('bolt://localhost:7687');
      expect(config.ai.provider).toBe('deepseek');
      expect(config.notification.enabled).toBe(false);
      expect(config.notification.dingtalk.targetUserId).toBe('');
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

import fs from 'fs';
import os from 'os';
import path from 'path';
import { setEnv } from '../helpers/env';

const emptyEnvPath = path.join(os.tmpdir(), `drudge-ingest-empty-env-${process.pid}`);

describe('config', () => {
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

  it('uses defaults when env missing', async () => {
    const restore = setEnv({
      DOTENV_CONFIG_PATH: emptyEnvPath,
      INGEST_WORKER_PORT: '',
      STORAGE_PATH: '',
      PORT: '',
      NEWS_API_URL: '',
      NEWS_API_PAGE_SIZE: '',
      NEWS_API_REQUEST_INTERVAL: '',
      ENABLE_WEBHOOK_NOTIFICATION: 'false',
      ALERT_WEBHOOK_URL: '',
      LOG_LEVEL: '',
      LOG_FILE: ''
    });

    jest.resetModules();
    const config = (await import('../../src/config/config')).default;

    expect(config.port).toBe(39110);
    expect(config.storage.path.endsWith(`${path.sep}data`)).toBe(true);
    expect(config.newsApi.url).toContain('futunn.com');
    expect(config.newsApi.pageSize).toBe(50);
    expect(config.newsApi.requestInterval).toBe(1000);
    expect(config.notification.enableWebhookNotification).toBe(false);
    expect(config.notification.webhookUrl).toBe('');
    expect(config.log.level).toBe('info');
    expect(config.log.file).toBe('logs/ingest-worker.log');

    restore();
  });

  it('uses env overrides when provided', async () => {
    const storagePath = path.join(process.cwd(), 'tmp-storage');
    const restore = setEnv({
      DOTENV_CONFIG_PATH: emptyEnvPath,
      STORAGE_PATH: storagePath,
      INGEST_WORKER_PORT: '4567',
      PORT: '9999',
      NEWS_API_URL: 'https://example.com/news',
      NEWS_API_PAGE_SIZE: '99',
      NEWS_API_REQUEST_INTERVAL: '1234',
      ENABLE_WEBHOOK_NOTIFICATION: 'true',
      ALERT_WEBHOOK_URL: 'https://example.com/webhook',
      LOG_LEVEL: 'debug',
      LOG_FILE: 'custom.log'
    });

    jest.resetModules();
    const config = (await import('../../src/config/config')).default;

    expect(config.port).toBe(4567);
    expect(config.storage.path).toBe(path.resolve(storagePath));
    expect(config.newsApi.url).toBe('https://example.com/news');
    expect(config.newsApi.pageSize).toBe(99);
    expect(config.newsApi.requestInterval).toBe(1234);
    expect(config.notification.enableWebhookNotification).toBe(true);
    expect(config.notification.webhookUrl).toBe('https://example.com/webhook');
    expect(config.log.level).toBe('debug');
    expect(config.log.file).toBe('custom.log');

    restore();
  });
});

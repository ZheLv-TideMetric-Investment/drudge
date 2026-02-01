import path from 'path';
import { setEnv } from '../helpers/env';

describe('config', () => {
  it('uses defaults when env missing', async () => {
    const restore = setEnv({
      STORAGE_PATH: '',
      PORT: '',
      NEWS_API_URL: '',
      NEWS_API_PAGE_SIZE: '',
      NEWS_API_REQUEST_INTERVAL: '',
      ENABLE_WEBHOOK_NOTIFICATION: 'false',
      WEBHOOK_URL: '',
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
      STORAGE_PATH: storagePath,
      PORT: '4567',
      NEWS_API_URL: 'https://example.com/news',
      NEWS_API_PAGE_SIZE: '99',
      NEWS_API_REQUEST_INTERVAL: '1234',
      ENABLE_WEBHOOK_NOTIFICATION: 'true',
      WEBHOOK_URL: 'https://example.com/webhook',
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

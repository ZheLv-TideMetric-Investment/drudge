import axios from 'axios';
import { setEnv } from '../helpers/env';
import type { NotificationPayload } from '@drudge/common';

const createService = async (env: Record<string, string | undefined>) => {
  const restore = setEnv(env);
  jest.resetModules();
  const { NotificationService } = await import('../../src/services/NotificationService');
  return { service: new NotificationService(), restore };
};

describe('NotificationService', () => {
  const mockedAxios = axios as jest.Mocked<typeof axios>;

  beforeEach(() => {
    mockedAxios.post.mockReset();
  });

  it('sends file save failure webhook with expected content', async () => {
    const { service, restore } = await createService({
      ENABLE_WEBHOOK_NOTIFICATION: 'true',
      WEBHOOK_URL: 'https://example.com/webhook'
    });

    mockedAxios.post.mockResolvedValue({ status: 200, data: {} } as any);

    await service.sendFileSaveFailureNotification('file.json', 2, 'disk full');

    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    const [url, payload] = mockedAxios.post.mock.calls[0] as [string, NotificationPayload];
    expect(url).toBe('https://example.com/webhook');
    expect(payload.markdown.title).toContain('文件保存失败');
    expect(payload.markdown.text).toContain('file.json');
    expect(payload.markdown.text).toContain('2');
    expect(payload.markdown.text).toContain('disk full');

    restore();
  });

  it('skips sending when webhook disabled', async () => {
    const { service, restore } = await createService({
      ENABLE_WEBHOOK_NOTIFICATION: 'false',
      WEBHOOK_URL: 'https://example.com/webhook'
    });

    await service.sendNewsApiFailureNotification('boom');

    expect(mockedAxios.post).not.toHaveBeenCalled();
    restore();
  });

  it('skips sending when webhook url missing', async () => {
    const { service, restore } = await createService({
      ENABLE_WEBHOOK_NOTIFICATION: 'true',
      WEBHOOK_URL: ''
    });

    await service.sendNewsApiFailureNotification('boom');
    await service.sendFileSaveFailureNotification('file.json', 1, 'disk full');
    await service.sendServiceErrorNotification('TestService', 'boom');
    await service.sendHealthCheckFailureNotification('Database', 'down');
    await service.sendRecoveryNotification('FetchService');

    expect(mockedAxios.post).not.toHaveBeenCalled();
    restore();
  });

  it('omits retry count when not provided', async () => {
    const { service, restore } = await createService({
      ENABLE_WEBHOOK_NOTIFICATION: 'true',
      WEBHOOK_URL: 'https://example.com/webhook'
    });

    mockedAxios.post.mockResolvedValue({ status: 200, data: {} } as any);

    await service.sendNewsApiFailureNotification('timeout');

    const [, payload] = mockedAxios.post.mock.calls[0] as [string, NotificationPayload];
    expect(payload.markdown.text).not.toContain('重试次数');
    restore();
  });

  it('includes retry count in API failure notification', async () => {
    const { service, restore } = await createService({
      ENABLE_WEBHOOK_NOTIFICATION: 'true',
      WEBHOOK_URL: 'https://example.com/webhook'
    });

    mockedAxios.post.mockResolvedValue({ status: 200, data: {} } as any);

    await service.sendNewsApiFailureNotification('timeout', 2);

    const [, payload] = mockedAxios.post.mock.calls[0] as [string, NotificationPayload];
    expect(payload.markdown.text).toContain('重试次数');
    expect(payload.markdown.text).toContain('2');
    restore();
  });

  it('omits context when none provided', async () => {
    const { service, restore } = await createService({
      ENABLE_WEBHOOK_NOTIFICATION: 'true',
      WEBHOOK_URL: 'https://example.com/webhook'
    });

    mockedAxios.post.mockResolvedValue({ status: 200, data: {} } as any);

    await service.sendServiceErrorNotification('TestService', 'boom');

    const [, payload] = mockedAxios.post.mock.calls[0] as [string, NotificationPayload];
    expect(payload.markdown.text).toContain('TestService');
    expect(payload.markdown.text).not.toContain('上下文');
    restore();
  });

  it('includes context in service error notification', async () => {
    const { service, restore } = await createService({
      ENABLE_WEBHOOK_NOTIFICATION: 'true',
      WEBHOOK_URL: 'https://example.com/webhook'
    });

    mockedAxios.post.mockResolvedValue({ status: 200, data: {} } as any);

    await service.sendServiceErrorNotification('TestService', 'boom', { foo: 'bar' });

    const [, payload] = mockedAxios.post.mock.calls[0] as [string, NotificationPayload];
    expect(payload.markdown.text).toContain('TestService');
    expect(payload.markdown.text).toContain('boom');
    expect(payload.markdown.text).toContain('foo');
    restore();
  });

  it('sends health check failure notification', async () => {
    const { service, restore } = await createService({
      ENABLE_WEBHOOK_NOTIFICATION: 'true',
      WEBHOOK_URL: 'https://example.com/webhook'
    });

    mockedAxios.post.mockResolvedValue({ status: 200, data: {} } as any);

    await service.sendHealthCheckFailureNotification('Database', 'down');

    const [, payload] = mockedAxios.post.mock.calls[0] as [string, NotificationPayload];
    expect(payload.markdown.text).toContain('Database');
    expect(payload.markdown.text).toContain('down');
    restore();
  });

  it('handles non-2xx webhook responses', async () => {
    const { service, restore } = await createService({
      ENABLE_WEBHOOK_NOTIFICATION: 'true',
      WEBHOOK_URL: 'https://example.com/webhook'
    });

    mockedAxios.post.mockResolvedValue({ status: 500, data: { ok: false } } as any);

    await service.sendHealthCheckFailureNotification('Database', 'down');

    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    restore();
  });

  it('sends recovery notification with details', async () => {
    const { service, restore } = await createService({
      ENABLE_WEBHOOK_NOTIFICATION: 'true',
      WEBHOOK_URL: 'https://example.com/webhook'
    });

    mockedAxios.post.mockResolvedValue({ status: 200, data: {} } as any);

    await service.sendRecoveryNotification('FetchService', 'OK');

    const [, payload] = mockedAxios.post.mock.calls[0] as [string, NotificationPayload];
    expect(payload.markdown.text).toContain('FetchService');
    expect(payload.markdown.text).toContain('OK');
    restore();
  });

  it('sends recovery notification without details', async () => {
    const { service, restore } = await createService({
      ENABLE_WEBHOOK_NOTIFICATION: 'true',
      WEBHOOK_URL: 'https://example.com/webhook'
    });

    mockedAxios.post.mockResolvedValue({ status: 200, data: {} } as any);

    await service.sendRecoveryNotification('FetchService');

    const [, payload] = mockedAxios.post.mock.calls[0] as [string, NotificationPayload];
    expect(payload.markdown.text).toContain('FetchService');
    expect(payload.markdown.text).not.toContain('详情');
    restore();
  });

  it('swallows webhook request errors', async () => {
    const { service, restore } = await createService({
      ENABLE_WEBHOOK_NOTIFICATION: 'true',
      WEBHOOK_URL: 'https://example.com/webhook'
    });

    mockedAxios.post.mockRejectedValueOnce(new Error('boom'));

    await service.sendHealthCheckFailureNotification('Database', 'down');

    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    restore();
  });

  it('validateConfig returns false when enabled without url', async () => {
    const { service, restore } = await createService({
      ENABLE_WEBHOOK_NOTIFICATION: 'true',
      WEBHOOK_URL: ''
    });

    expect(service.validateConfig()).toBe(false);
    restore();
  });

  it('validateConfig returns true when webhook disabled', async () => {
    const { service, restore } = await createService({
      ENABLE_WEBHOOK_NOTIFICATION: 'false',
      WEBHOOK_URL: ''
    });

    expect(service.validateConfig()).toBe(true);
    restore();
  });
});

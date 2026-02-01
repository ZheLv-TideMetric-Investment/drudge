import axios from 'axios';
import { setEnv } from '../helpers/env';
import type { NotificationPayload } from '@drudge/common';

const logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
};

jest.mock('../../src/utils/logger', () => ({
  logger
}));

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
    logger.info.mockReset();
    logger.warn.mockReset();
    logger.error.mockReset();
    logger.debug.mockReset();
  });

  it('skips sending when webhook disabled', async () => {
    const { service, restore } = await createService({
      ENABLE_WEBHOOK_NOTIFICATION: 'false',
      WEBHOOK_URL: 'https://example.com/webhook'
    });

    await service.sendAiServiceFailureNotification('deepseek', 'model', 'boom');

    expect(mockedAxios.post).not.toHaveBeenCalled();
    restore();
  });

  it('returns early for all notifications when disabled', async () => {
    const { service, restore } = await createService({
      ENABLE_WEBHOOK_NOTIFICATION: 'false',
      WEBHOOK_URL: ''
    });

    await service.sendEntityExtractionFailureNotification('news-1', 'boom', 1);
    await service.sendGraphWriteFailureNotification('news-2', 'Company', 'fail');
    await service.sendNeo4jConnectionFailureNotification('down');
    await service.sendNewsProcessingFailureNotification('file.json', 10, 5, 'bad');
    await service.sendServiceErrorNotification('Service', 'boom');
    await service.sendRecoveryNotification('Service');

    expect(mockedAxios.post).not.toHaveBeenCalled();
    restore();
  });

  it('sends notifications with expected payloads', async () => {
    const { service, restore } = await createService({
      ENABLE_WEBHOOK_NOTIFICATION: 'true',
      WEBHOOK_URL: 'https://example.com/webhook'
    });

    mockedAxios.post.mockResolvedValue({ status: 200, data: {} } as any);

    await service.sendEntityExtractionFailureNotification('news-1', 'boom', 2);
    await service.sendEntityExtractionFailureNotification('news-2', 'oops');
    await service.sendGraphWriteFailureNotification('news-3', 'Company', 'fail');
    await service.sendNeo4jConnectionFailureNotification('down');
    await service.sendAiServiceFailureNotification('deepseek', 'model', 'timeout');
    await service.sendNewsProcessingFailureNotification('file.json', 10, 2, 'bad data');
    await service.sendNewsProcessingFailureNotification('file.json', 10, 9, 'bad data');
    await service.sendServiceErrorNotification('TestService', 'boom', { foo: 'bar' });
    await service.sendRecoveryNotification('TestService', 'ok');

    expect(mockedAxios.post).toHaveBeenCalledTimes(9);

    const [url, payload] = mockedAxios.post.mock.calls[0] as [string, NotificationPayload];
    expect(url).toBe('https://example.com/webhook');
    expect(payload.markdown.title).toContain('实体提取失败');
    expect(payload.markdown.text).toContain('news-1');
    expect(payload.markdown.text).toContain('重试次数');

    const [, errorPayload] = mockedAxios.post.mock.calls[5] as [string, NotificationPayload];
    expect(errorPayload.markdown.text).toContain('file.json');

    restore();
  });

  it('handles non-2xx responses and axios failures', async () => {
    const { service, restore } = await createService({
      ENABLE_WEBHOOK_NOTIFICATION: 'true',
      WEBHOOK_URL: 'https://example.com/webhook'
    });

    mockedAxios.post
      .mockResolvedValueOnce({ status: 500, data: { error: 'bad' } } as any)
      .mockRejectedValueOnce(new Error('boom'));

    await service.sendGraphWriteFailureNotification('news-4', 'Event', 'fail');
    await service.sendAiServiceFailureNotification('deepseek', 'model', 'timeout');

    expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();

    restore();
  });

  it('validateConfig returns false when enabled without url', async () => {
    const { service, restore } = await createService({
      ENABLE_WEBHOOK_NOTIFICATION: 'true',
      WEBHOOK_URL: ''
    });

    expect(service.validateConfig()).toBe(false);
    expect(logger.error).toHaveBeenCalled();

    restore();
  });

  it('validateConfig returns true when disabled', async () => {
    const { service, restore } = await createService({
      ENABLE_WEBHOOK_NOTIFICATION: 'false',
      WEBHOOK_URL: ''
    });

    expect(service.validateConfig()).toBe(true);

    restore();
  });
});

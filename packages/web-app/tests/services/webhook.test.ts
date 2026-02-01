import axios from 'axios';
import { mockAxiosResponse } from '../helpers/mock-axios';
import { setEnv } from '../helpers/env';

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('webhookService', () => {
  beforeEach(() => {
    mockedAxios.post.mockReset();
  });

  it('skips sending when webhook is disabled', async () => {
    const restoreEnv = setEnv({
      ENABLE_WEBHOOK_NOTIFICATION: 'false',
      WEBHOOK_URLS: 'https://example.com/webhook'
    });

    try {
      jest.resetModules();
      const { webhookService } = await import('../../src/lib/services/webhook');

      const result = await webhookService.sendMessage('hello');

      expect(result).toBe(false);
      expect(mockedAxios.post).not.toHaveBeenCalled();
    } finally {
      restoreEnv();
    }
  });

  it('sends markdown message to configured webhooks', async () => {
    const restoreEnv = setEnv({
      ENABLE_WEBHOOK_NOTIFICATION: 'true',
      WEBHOOK_URLS: 'https://example.com/webhook1,https://example.com/webhook2'
    });

    try {
      jest.resetModules();
      mockAxiosResponse({ ok: true }, 200);

      const { webhookService } = await import('../../src/lib/services/webhook');

      const result = await webhookService.sendMessage('hello', 'title');

      expect(result).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
      const payload = mockedAxios.post.mock.calls[0]?.[1] as any;
      expect(payload.markdown.title).toContain('title');
    } finally {
      restoreEnv();
    }
  });

  it('returns false when webhook urls are missing', async () => {
    const restoreEnv = setEnv({
      ENABLE_WEBHOOK_NOTIFICATION: 'true',
      WEBHOOK_URLS: ''
    });

    try {
      jest.resetModules();
      const { webhookService } = await import('../../src/lib/services/webhook');

      const result = await webhookService.sendMessage('hello');

      expect(result).toBe(false);
      expect(mockedAxios.post).not.toHaveBeenCalled();
    } finally {
      restoreEnv();
    }
  });

  it('returns false when webhook responses are not ok', async () => {
    const restoreEnv = setEnv({
      ENABLE_WEBHOOK_NOTIFICATION: 'true',
      WEBHOOK_URLS: 'https://example.com/webhook1'
    });

    try {
      jest.resetModules();
      mockedAxios.post.mockResolvedValue({
        status: 500,
        statusText: 'Error',
        data: { ok: false },
        headers: {},
        config: {}
      } as any);

      const { webhookService } = await import('../../src/lib/services/webhook');

      const result = await webhookService.sendMessage('hello');

      expect(result).toBe(false);
    } finally {
      restoreEnv();
    }
  });

  it('returns false when webhook post throws', async () => {
    const restoreEnv = setEnv({
      ENABLE_WEBHOOK_NOTIFICATION: 'true',
      WEBHOOK_URLS: 'https://example.com/webhook1'
    });

    try {
      jest.resetModules();
      mockedAxios.post.mockRejectedValue(new Error('boom'));

      const { webhookService } = await import('../../src/lib/services/webhook');

      const result = await webhookService.sendMessage('hello');

      expect(result).toBe(false);
    } finally {
      restoreEnv();
    }
  });

  it('sends system status notifications with at-all on errors', async () => {
    const restoreEnv = setEnv({
      ENABLE_WEBHOOK_NOTIFICATION: 'true',
      WEBHOOK_URLS: 'https://example.com/webhook1'
    });

    try {
      jest.resetModules();
      mockAxiosResponse({ ok: true }, 200);

      const { webhookService } = await import('../../src/lib/services/webhook');

      const result = await webhookService.sendSystemStatusNotification('error', 'boom', 'details');

      expect(result).toBe(true);
      const payload = mockedAxios.post.mock.calls[0]?.[1] as any;
      expect(payload.at?.isAtAll).toBe(true);
      expect(payload.markdown.text).toContain('详情');
    } finally {
      restoreEnv();
    }
  });

  it('returns false when system status notification is disabled', async () => {
    const restoreEnv = setEnv({
      ENABLE_WEBHOOK_NOTIFICATION: 'false',
      WEBHOOK_URLS: 'https://example.com/webhook1'
    });

    try {
      jest.resetModules();
      const { webhookService } = await import('../../src/lib/services/webhook');

      const result = await webhookService.sendSystemStatusNotification('success', 'ok');

      expect(result).toBe(false);
    } finally {
      restoreEnv();
    }
  });

  it('handles system status notification failures', async () => {
    const restoreEnv = setEnv({
      ENABLE_WEBHOOK_NOTIFICATION: 'true',
      WEBHOOK_URLS: 'https://example.com/webhook1'
    });

    try {
      jest.resetModules();
      mockedAxios.post.mockRejectedValue(new Error('boom'));

      const { webhookService } = await import('../../src/lib/services/webhook');

      const result = await webhookService.sendSystemStatusNotification('warning', 'warn');

      expect(result).toBe(false);
    } finally {
      restoreEnv();
    }
  });

  it('tests connection via sendMessage', async () => {
    const restoreEnv = setEnv({
      ENABLE_WEBHOOK_NOTIFICATION: 'true',
      WEBHOOK_URLS: 'https://example.com/webhook1'
    });

    try {
      jest.resetModules();
      mockAxiosResponse({ ok: true }, 200);

      const { webhookService } = await import('../../src/lib/services/webhook');

      const result = await webhookService.testConnection();

      expect(result).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    } finally {
      restoreEnv();
    }
  });

  it('returns false when test connection is disabled', async () => {
    const restoreEnv = setEnv({
      ENABLE_WEBHOOK_NOTIFICATION: 'false',
      WEBHOOK_URLS: 'https://example.com/webhook1'
    });

    try {
      jest.resetModules();
      const { webhookService } = await import('../../src/lib/services/webhook');

      const result = await webhookService.testConnection();

      expect(result).toBe(false);
    } finally {
      restoreEnv();
    }
  });

  it('returns false when test connection fails', async () => {
    const restoreEnv = setEnv({
      ENABLE_WEBHOOK_NOTIFICATION: 'true',
      WEBHOOK_URLS: 'https://example.com/webhook1'
    });

    try {
      jest.resetModules();
      mockedAxios.post.mockRejectedValue(new Error('boom'));

      const { webhookService } = await import('../../src/lib/services/webhook');

      const result = await webhookService.testConnection();

      expect(result).toBe(false);
    } finally {
      restoreEnv();
    }
  });

  it('handles errors thrown by sendMessage during testConnection', async () => {
    const restoreEnv = setEnv({
      ENABLE_WEBHOOK_NOTIFICATION: 'true',
      WEBHOOK_URLS: 'https://example.com/webhook1'
    });

    try {
      jest.resetModules();
      const { webhookService } = await import('../../src/lib/services/webhook');
      const sendSpy = jest.spyOn(webhookService, 'sendMessage').mockRejectedValue(new Error('boom'));

      const result = await webhookService.testConnection();

      expect(result).toBe(false);

      sendSpy.mockRestore();
    } finally {
      restoreEnv();
    }
  });

  it('returns status summary', async () => {
    const restoreEnv = setEnv({
      ENABLE_WEBHOOK_NOTIFICATION: 'true',
      WEBHOOK_URLS: 'https://example.com/webhook1'
    });

    try {
      jest.resetModules();
      const { webhookService } = await import('../../src/lib/services/webhook');

      const status = webhookService.getStatus();

      expect(status.enabled).toBe(true);
      expect(status.urlCount).toBe(1);
    } finally {
      restoreEnv();
    }
  });

  it('returns status with no configured urls', async () => {
    const restoreEnv = setEnv({
      ENABLE_WEBHOOK_NOTIFICATION: 'true',
      WEBHOOK_URLS: ''
    });

    try {
      jest.resetModules();
      const { webhookService } = await import('../../src/lib/services/webhook');

      const status = webhookService.getStatus();

      expect(status.urlCount).toBe(0);
      expect(status.webhookUrls).toBe('未配置');
    } finally {
      restoreEnv();
    }
  });
});

import fs from 'fs';
import os from 'os';
import path from 'path';
import { z } from 'zod';
import { setEnv } from '../helpers/env';

const generateObject = jest.fn();
const deepseekMock = jest.fn();
const googleMock = jest.fn();
const createOpenAIMock = jest.fn(() => jest.fn());
const notificationService = {
  sendAiServiceFailureNotification: jest.fn().mockResolvedValue(undefined)
};

const emptyEnvPath = path.join(os.tmpdir(), `drudge-ai-empty-env-${process.pid}`);

jest.mock('ai', () => ({
  __esModule: true,
  generateObject
}));

jest.mock('@ai-sdk/deepseek', () => ({
  __esModule: true,
  deepseek: (...args: any[]) => deepseekMock(...args)
}));

jest.mock('@ai-sdk/google', () => ({
  __esModule: true,
  google: (...args: any[]) => googleMock(...args)
}));

jest.mock('@ai-sdk/openai', () => ({
  __esModule: true,
  createOpenAI: createOpenAIMock
}));

jest.mock('../../src/services/NotificationService', () => ({
  __esModule: true,
  default: notificationService
}));

const loadService = async (vars: Record<string, string | undefined>) => {
  const restore = setEnv({
    DOTENV_CONFIG_PATH: emptyEnvPath,
    ...vars
  });
  jest.resetModules();
  const aiService = (await import('../../src/services/AiService')).default;
  return { aiService, restore };
};

describe('AiService', () => {
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

  beforeEach(() => {
    generateObject.mockReset();
    deepseekMock.mockReset();
    googleMock.mockReset();
    createOpenAIMock.mockReset();
    createOpenAIMock.mockImplementation(() => jest.fn());
    notificationService.sendAiServiceFailureNotification.mockClear();
  });

  it('falls back to secondary provider when primary fails', async () => {
    deepseekMock.mockReturnValue({ provider: 'primary' });
    googleMock.mockReturnValue({ provider: 'fallback' });

    generateObject.mockImplementation(async ({ model }: { model: any }) => {
      if (model.provider === 'primary') {
        throw new Error('primary down');
      }
      return {
        object: { ok: true },
        usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 }
      };
    });

    const { aiService, restore } = await loadService({
      AI_PROVIDER: 'deepseek',
      AI_FALLBACK_PROVIDER: 'google',
      DEEPSEEK_MODEL: 'deepseek-test',
      GOOGLE_MODEL: 'gemini-test'
    });

    const result = await aiService.callLLMWithJsonResponse([{ role: 'user', content: 'hello' }]);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ ok: true });

    aiService.reset();
    restore();
  });

  it('returns failure when no fallback available', async () => {
    deepseekMock.mockReturnValue({ provider: 'primary' });

    generateObject.mockImplementation(async () => {
      throw new Error('primary down');
    });

    const { aiService, restore } = await loadService({
      AI_PROVIDER: 'deepseek',
      AI_FALLBACK_PROVIDER: '',
      DEEPSEEK_MODEL: 'deepseek-test'
    });

    const result = await aiService.callLLMWithJsonResponse([{ role: 'user', content: 'hello' }]);

    expect(result.success).toBe(false);
    expect(result.error).toContain('primary down');

    aiService.reset();
    restore();
  });

  it('returns default error when primary error has no message', async () => {
    deepseekMock.mockReturnValue({ provider: 'primary' });

    generateObject.mockImplementation(async () => {
      throw new Error('');
    });

    const { aiService, restore } = await loadService({
      AI_PROVIDER: 'deepseek',
      AI_FALLBACK_PROVIDER: '',
      DEEPSEEK_MODEL: 'deepseek-test'
    });

    const result = await aiService.callLLMWithJsonResponse([{ role: 'user', content: 'hello' }]);

    expect(result.success).toBe(false);
    expect(result.error).toBe('LLM JSON调用失败');

    aiService.reset();
    restore();
  });

  it('notifies when initialization fails', async () => {
    const { aiService, restore } = await loadService({
      AI_PROVIDER: 'qwen',
      AI_FALLBACK_PROVIDER: '',
      QWEN_API_KEY: ''
    });

    await expect(aiService.initialize()).rejects.toThrow('千问模型配置不存在');
    expect(notificationService.sendAiServiceFailureNotification).toHaveBeenCalled();

    aiService.reset();
    restore();
  });

  it('logs when notification fails during initialization', async () => {
    notificationService.sendAiServiceFailureNotification.mockRejectedValueOnce(
      new Error('notify fail')
    );

    const { aiService, restore } = await loadService({
      AI_PROVIDER: 'qwen',
      AI_FALLBACK_PROVIDER: '',
      QWEN_API_KEY: ''
    });

    await expect(aiService.initialize()).rejects.toThrow('千问模型配置不存在');
    expect(notificationService.sendAiServiceFailureNotification).toHaveBeenCalled();

    aiService.reset();
    restore();
  });

  it('uses fallback error message when initialization error lacks message', async () => {
    const { aiService, restore } = await loadService({
      AI_PROVIDER: 'deepseek',
      AI_FALLBACK_PROVIDER: '',
      DEEPSEEK_MODEL: 'deepseek-test'
    });

    (aiService as any).createModel = jest.fn(() => {
      throw { message: '' };
    });

    await expect(aiService.initialize()).rejects.toBeTruthy();

    expect(notificationService.sendAiServiceFailureNotification).toHaveBeenCalledWith(
      'deepseek',
      'deepseek-test',
      'AI服务初始化失败'
    );

    aiService.reset();
    restore();
  });

  it('returns early when already initialized', async () => {
    deepseekMock.mockReturnValue({ provider: 'primary' });

    const { aiService, restore } = await loadService({
      AI_PROVIDER: 'deepseek',
      AI_FALLBACK_PROVIDER: '',
      DEEPSEEK_MODEL: 'deepseek-test'
    });

    await aiService.initialize();
    await aiService.initialize();

    expect(deepseekMock).toHaveBeenCalledTimes(1);

    aiService.reset();
    restore();
  });

  it('throws when provider missing', async () => {
    const restore = setEnv({
      DOTENV_CONFIG_PATH: emptyEnvPath
    });
    jest.resetModules();
    jest.doMock('../../src/config/config', () => ({
      __esModule: true,
      default: {
        ai: {},
        logging: {
          level: 'info',
          format: 'combined'
        }
      }
    }));

    const aiService = (await import('../../src/services/AiService')).default;

    await expect(aiService.initialize()).rejects.toThrow('AI配置不存在或provider未设置');

    aiService.reset();
    jest.dontMock('../../src/config/config');
    restore();
  });

  it('throws when deepseek model missing', async () => {
    const restore = setEnv({
      DOTENV_CONFIG_PATH: emptyEnvPath
    });
    jest.resetModules();
    jest.doMock('../../src/config/config', () => ({
      __esModule: true,
      default: {
        ai: {
          provider: 'deepseek',
          fallbackProvider: '',
          deepseek: { model: '' }
        },
        logging: {
          level: 'info',
          format: 'combined'
        }
      }
    }));

    const aiService = (await import('../../src/services/AiService')).default;

    await expect(aiService.initialize()).rejects.toThrow('DeepSeek模型配置不存在');

    aiService.reset();
    jest.dontMock('../../src/config/config');
    restore();
  });

  it('throws when google model missing', async () => {
    const restore = setEnv({
      DOTENV_CONFIG_PATH: emptyEnvPath
    });
    jest.resetModules();
    jest.doMock('../../src/config/config', () => ({
      __esModule: true,
      default: {
        ai: {
          provider: 'google',
          fallbackProvider: '',
          google: { model: '' }
        },
        logging: {
          level: 'info',
          format: 'combined'
        }
      }
    }));

    const aiService = (await import('../../src/services/AiService')).default;

    await expect(aiService.initialize()).rejects.toThrow('Google模型配置不存在');

    aiService.reset();
    jest.dontMock('../../src/config/config');
    restore();
  });

  it('initializes qwen provider', async () => {
    const modelFn = jest.fn(() => ({ provider: 'qwen' }));
    createOpenAIMock.mockImplementation(() => modelFn);

    const { aiService, restore } = await loadService({
      AI_PROVIDER: 'qwen',
      AI_FALLBACK_PROVIDER: '',
      QWEN_API_KEY: 'qwen-key',
      QWEN_MODEL: 'qwen-test'
    });

    await aiService.initialize();

    expect(createOpenAIMock).toHaveBeenCalledWith({
      apiKey: 'qwen-key',
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
    });
    expect(modelFn).toHaveBeenCalledWith('qwen-test');

    aiService.reset();
    restore();
  });

  it('throws for unsupported providers', async () => {
    const restore = setEnv({
      DOTENV_CONFIG_PATH: emptyEnvPath
    });
    jest.resetModules();
    jest.doMock('../../src/config/config', () => ({
      __esModule: true,
      default: {
        ai: {
          provider: 'unknown',
          fallbackProvider: ''
        },
        logging: {
          level: 'info',
          format: 'combined'
        }
      }
    }));

    const aiService = (await import('../../src/services/AiService')).default;

    await expect(aiService.initialize()).rejects.toThrow('不支持的AI提供商');

    aiService.reset();
    jest.dontMock('../../src/config/config');
    restore();
  });

  it('ignores failed fallback initialization', async () => {
    deepseekMock.mockReturnValue({ provider: 'primary' });
    googleMock.mockImplementation(() => {
      throw new Error('google fail');
    });

    const { aiService, restore } = await loadService({
      AI_PROVIDER: 'deepseek',
      AI_FALLBACK_PROVIDER: 'google',
      DEEPSEEK_MODEL: 'deepseek-test',
      GOOGLE_MODEL: 'gemini-test'
    });

    await aiService.initialize();

    const info = aiService.getProviderInfo();
    expect(info.current).toBe('deepseek');
    expect(info.hasFallback).toBe(false);

    aiService.reset();
    restore();
  });

  it('returns combined error when fallback also fails', async () => {
    deepseekMock.mockReturnValue({ provider: 'primary' });
    googleMock.mockReturnValue({ provider: 'fallback' });

    generateObject.mockImplementation(async ({ model }: { model: any }) => {
      if (model.provider === 'primary') {
        throw new Error('primary down');
      }
      throw new Error('fallback down');
    });

    const { aiService, restore } = await loadService({
      AI_PROVIDER: 'deepseek',
      AI_FALLBACK_PROVIDER: 'google',
      DEEPSEEK_MODEL: 'deepseek-test',
      GOOGLE_MODEL: 'gemini-test'
    });

    const result = await aiService.callLLMWithJsonResponse([{ role: 'user', content: 'hello' }]);
    expect(result.success).toBe(false);
    expect(result.error).toContain('primary down');
    expect(result.error).toContain('fallback down');

    aiService.reset();
    restore();
  });

  it('parses string JSON response', async () => {
    deepseekMock.mockReturnValue({ provider: 'primary' });
    generateObject.mockResolvedValue({
      object: '{"ok":true}',
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 }
    });

    const { aiService, restore } = await loadService({
      AI_PROVIDER: 'deepseek',
      AI_FALLBACK_PROVIDER: '',
      DEEPSEEK_MODEL: 'deepseek-test'
    });

    const result = await aiService.callLLMWithJsonResponse([{ role: 'user', content: 'hello' }]);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ ok: true });

    aiService.reset();
    restore();
  });

  it('parses JSON from error text', async () => {
    deepseekMock.mockReturnValue({ provider: 'primary' });
    generateObject.mockImplementation(async () => {
      const error: any = new Error('bad');
      error.text = '{"value":42}';
      throw error;
    });

    const { aiService, restore } = await loadService({
      AI_PROVIDER: 'deepseek',
      AI_FALLBACK_PROVIDER: '',
      DEEPSEEK_MODEL: 'deepseek-test'
    });

    const result = await aiService.callLLMWithJsonResponse([{ role: 'user', content: 'hello' }]);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ value: 42 });

    aiService.reset();
    restore();
  });

  it('returns error when error text is invalid JSON', async () => {
    deepseekMock.mockReturnValue({ provider: 'primary' });
    generateObject.mockImplementation(async () => {
      const error: any = new Error('bad');
      error.text = '{bad json';
      throw error;
    });

    const { aiService, restore } = await loadService({
      AI_PROVIDER: 'deepseek',
      AI_FALLBACK_PROVIDER: '',
      DEEPSEEK_MODEL: 'deepseek-test'
    });

    const result = await aiService.callLLMWithJsonResponse([{ role: 'user', content: 'hello' }]);
    expect(result.success).toBe(false);
    expect(result.error).toContain('bad');

    aiService.reset();
    restore();
  });

  it('returns raw string when JSON parsing fails', async () => {
    deepseekMock.mockReturnValue({ provider: 'primary' });
    generateObject.mockResolvedValue({
      object: '{bad json}',
      usage: undefined
    });

    const { aiService, restore } = await loadService({
      AI_PROVIDER: 'deepseek',
      AI_FALLBACK_PROVIDER: '',
      DEEPSEEK_MODEL: 'deepseek-test'
    });

    const result = await aiService.callLLMWithJsonResponse([{ role: 'user', content: 'hello' }]);
    expect(result.success).toBe(true);
    expect(result.data).toBe('{bad json}');

    aiService.reset();
    restore();
  });

  it('throws when model is missing', async () => {
    const { aiService, restore } = await loadService({
      AI_PROVIDER: 'deepseek',
      AI_FALLBACK_PROVIDER: '',
      DEEPSEEK_MODEL: 'deepseek-test'
    });

    await expect(
      (aiService as any).callWithProvider(null, 'deepseek', [{ role: 'user', content: 'hi' }], {})
    ).rejects.toThrow('deepseek 模型未正确初始化');

    aiService.reset();
    restore();
  });

  it('callWithProvider uses default options when omitted', async () => {
    deepseekMock.mockReturnValue({ provider: 'primary' });
    generateObject.mockResolvedValue({
      object: { ok: true },
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 }
    });

    const { aiService, restore } = await loadService({
      AI_PROVIDER: 'deepseek',
      AI_FALLBACK_PROVIDER: '',
      DEEPSEEK_MODEL: 'deepseek-test'
    });

    const result = await (aiService as any).callWithProvider(
      { provider: 'primary' },
      'deepseek',
      [{ role: 'user', content: 'hello' }]
    );

    expect(result.success).toBe(true);
    expect(generateObject).toHaveBeenCalled();

    aiService.reset();
    restore();
  });

  it('callWithProvider falls back to provider name when model config is missing', async () => {
    deepseekMock.mockReturnValue({ provider: 'primary' });
    generateObject.mockResolvedValue({
      object: { ok: true },
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 }
    });

    const { aiService, restore } = await loadService({
      AI_PROVIDER: 'deepseek',
      AI_FALLBACK_PROVIDER: '',
      DEEPSEEK_MODEL: 'deepseek-test'
    });

    const result = await (aiService as any).callWithProvider(
      { provider: 'custom' },
      'custom',
      [{ role: 'user', content: 'hello' }]
    );

    expect(result.success).toBe(true);
    expect(generateObject).toHaveBeenCalled();

    aiService.reset();
    restore();
  });

  it('callWithProvider uses provided schema', async () => {
    deepseekMock.mockReturnValue({ provider: 'primary' });
    generateObject.mockResolvedValue({
      object: { ok: true },
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 }
    });

    const { aiService, restore } = await loadService({
      AI_PROVIDER: 'deepseek',
      AI_FALLBACK_PROVIDER: '',
      DEEPSEEK_MODEL: 'deepseek-test'
    });

    const result = await (aiService as any).callWithProvider(
      { provider: 'primary' },
      'deepseek',
      [{ role: 'user', content: 'hello' }],
      { schema: z.object({ ok: z.boolean() }) }
    );

    expect(result.success).toBe(true);
    expect(generateObject).toHaveBeenCalled();

    aiService.reset();
    restore();
  });

  it('handles xai proxy responses', async () => {
    createOpenAIMock.mockImplementation(() => jest.fn(() => ({ provider: 'xai' })));
    const fetchMock = jest.fn();
    const originalFetch = global.fetch;
    global.fetch = fetchMock as any;

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"foo":1}' } }],
        usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 }
      })
    });

    const { aiService, restore } = await loadService({
      AI_PROVIDER: 'xai',
      AI_FALLBACK_PROVIDER: '',
      XAI_API_KEY: 'xai',
      XAI_MODEL: 'grok-test',
      XAI_PROXY_URL: 'http://proxy'
    });

    const result = await aiService.callLLMWithJsonResponse([{ role: 'user', content: 'hello' }]);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ foo: 1 });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'not-json' } }]
      })
    });

    const fallback = await aiService.callLLMWithJsonResponse([{ role: 'user', content: 'hello' }]);
    expect(fallback.success).toBe(true);
    expect(fallback.data).toEqual({ message: 'not-json' });

    aiService.reset();
    restore();
    global.fetch = originalFetch as any;
  });

  it('callXAIProxy uses default options and zero usage tokens', async () => {
    createOpenAIMock.mockImplementation(() => jest.fn(() => ({ provider: 'xai' })));
    const fetchMock = jest.fn();
    const originalFetch = global.fetch;
    global.fetch = fetchMock as any;

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"ok":true}' } }],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
      })
    });

    const { aiService, restore } = await loadService({
      AI_PROVIDER: 'xai',
      AI_FALLBACK_PROVIDER: '',
      XAI_API_KEY: 'xai',
      XAI_MODEL: 'grok-test',
      XAI_PROXY_URL: 'http://proxy'
    });

    const result = await (aiService as any).callXAIProxy([{ role: 'user', content: 'hello' }]);

    expect(result.success).toBe(true);
    expect(result.usage).toEqual({
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0
    });

    aiService.reset();
    restore();
    global.fetch = originalFetch as any;
  });

  it('returns error for xai proxy failures', async () => {
    createOpenAIMock.mockImplementation(() => jest.fn(() => ({ provider: 'xai' })));
    const fetchMock = jest.fn();
    const originalFetch = global.fetch;
    global.fetch = fetchMock as any;

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'oops',
      text: async () => 'bad'
    });

    const { aiService, restore } = await loadService({
      AI_PROVIDER: 'xai',
      AI_FALLBACK_PROVIDER: '',
      XAI_API_KEY: 'xai',
      XAI_MODEL: 'grok-test',
      XAI_PROXY_URL: 'http://proxy'
    });

    const result = await aiService.callLLMWithJsonResponse([{ role: 'user', content: 'hello' }]);
    expect(result.success).toBe(false);
    expect(result.error).toContain('xAI代理返回错误');

    fetchMock.mockRejectedValueOnce(new Error('boom'));
    const errorResult = await aiService.callLLMWithJsonResponse([{ role: 'user', content: 'hello' }]);
    expect(errorResult.success).toBe(false);
    expect(errorResult.error).toContain('boom');

    aiService.reset();
    restore();
    global.fetch = originalFetch as any;
  });

  it('returns fallback error when xai proxy rejection lacks message', async () => {
    createOpenAIMock.mockImplementation(() => jest.fn(() => ({ provider: 'xai' })));
    const fetchMock = jest.fn();
    const originalFetch = global.fetch;
    global.fetch = fetchMock as any;

    fetchMock.mockRejectedValueOnce({});

    const { aiService, restore } = await loadService({
      AI_PROVIDER: 'xai',
      AI_FALLBACK_PROVIDER: '',
      XAI_API_KEY: 'xai',
      XAI_MODEL: 'grok-test',
      XAI_PROXY_URL: 'http://proxy'
    });

    const result = await aiService.callLLMWithJsonResponse([{ role: 'user', content: 'hello' }]);
    expect(result.success).toBe(false);
    expect(result.error).toBe('xAI代理调用失败');

    aiService.reset();
    restore();
    global.fetch = originalFetch as any;
  });

  it('handles xai proxy timeout and missing content', async () => {
    jest.useFakeTimers();
    createOpenAIMock.mockImplementation(() => jest.fn(() => ({ provider: 'xai' })));
    const fetchMock = jest.fn();
    const originalFetch = global.fetch;
    global.fetch = fetchMock as any;

    fetchMock.mockImplementation((_url: string, options: any) => {
      return new Promise((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () => {
          reject({ name: 'AbortError' });
        });
      });
    });

    const { aiService, restore } = await loadService({
      AI_PROVIDER: 'xai',
      AI_FALLBACK_PROVIDER: '',
      XAI_API_KEY: 'xai',
      XAI_MODEL: 'grok-test',
      XAI_PROXY_URL: 'http://proxy'
    });

    const timeoutPromise = aiService.callLLMWithJsonResponse(
      [{ role: 'user', content: 'hello' }],
      { timeout: 5 }
    );
    await jest.advanceTimersByTimeAsync(5);
    const timeoutResult = await timeoutPromise;

    expect(timeoutResult.success).toBe(false);
    expect(timeoutResult.error).toContain('超时');

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: {} }]
      })
    });

    const missingContent = await aiService.callLLMWithJsonResponse([
      { role: 'user', content: 'hello' }
    ]);
    expect(missingContent.success).toBe(false);
    expect(missingContent.error).toContain('没有找到消息内容');

    aiService.reset();
    restore();
    global.fetch = originalFetch as any;
    jest.useRealTimers();
  });

  it('handles non-string xai content', async () => {
    createOpenAIMock.mockImplementation(() => jest.fn(() => ({ provider: 'xai' })));
    const fetchMock = jest.fn();
    const originalFetch = global.fetch;
    global.fetch = fetchMock as any;

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: { foo: 'bar' } } }]
      })
    });

    const { aiService, restore } = await loadService({
      AI_PROVIDER: 'xai',
      AI_FALLBACK_PROVIDER: '',
      XAI_API_KEY: 'xai',
      XAI_MODEL: 'grok-test',
      XAI_PROXY_URL: 'http://proxy'
    });

    const result = await aiService.callLLMWithJsonResponse([{ role: 'user', content: 'hello' }]);
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ foo: 'bar' });

    aiService.reset();
    restore();
    global.fetch = originalFetch as any;
  });

  it('reports initialized status', async () => {
    deepseekMock.mockReturnValue({ provider: 'primary' });
    const { aiService, restore } = await loadService({
      AI_PROVIDER: 'deepseek',
      AI_FALLBACK_PROVIDER: '',
      DEEPSEEK_MODEL: 'deepseek-test'
    });

    expect(aiService.isInitialized()).toBe(false);
    await aiService.initialize();
    expect(aiService.isInitialized()).toBe(true);

    aiService.reset();
    restore();
  });

  it('getProviderInfo reports no fallback when not configured', async () => {
    deepseekMock.mockReturnValue({ provider: 'primary' });
    const { aiService, restore } = await loadService({
      AI_PROVIDER: 'deepseek',
      AI_FALLBACK_PROVIDER: '',
      DEEPSEEK_MODEL: 'deepseek-test'
    });

    await aiService.initialize();

    const info = aiService.getProviderInfo();
    expect(info.hasFallback).toBe(false);

    aiService.reset();
    restore();
  });

  it('getProviderInfo reports fallback when configured', async () => {
    deepseekMock.mockReturnValue({ provider: 'primary' });
    googleMock.mockReturnValue({ provider: 'fallback' });

    const { aiService, restore } = await loadService({
      AI_PROVIDER: 'deepseek',
      AI_FALLBACK_PROVIDER: 'google',
      DEEPSEEK_MODEL: 'deepseek-test',
      GOOGLE_MODEL: 'gemini-test'
    });

    await aiService.initialize();

    const info = aiService.getProviderInfo();
    expect(info.hasFallback).toBe(true);

    aiService.reset();
    restore();
  });

  it('createTimeoutPromise rejects after timeout', async () => {
    jest.useFakeTimers();
    const { aiService, restore } = await loadService({
      AI_PROVIDER: 'deepseek',
      AI_FALLBACK_PROVIDER: '',
      DEEPSEEK_MODEL: 'deepseek-test'
    });

    const { promise } = (aiService as any).createTimeoutPromise(10);
    const rejection = promise.catch((error: Error) => error.message);

    await jest.advanceTimersByTimeAsync(10);

    await expect(rejection).resolves.toContain('LLM调用超时');

    aiService.reset();
    restore();
    jest.useRealTimers();
  });
});

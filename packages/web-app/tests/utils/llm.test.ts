const generateText = jest.fn();
const generateObject = jest.fn();
const deepseek = jest.fn((model: string) => ({ provider: 'deepseek', model }));
const google = jest.fn((model: string) => ({ provider: 'google', model }));
const createOpenAI = jest.fn(() => jest.fn((model: string) => ({ provider: 'openai', model })));

jest.mock('ai', () => ({
  generateText: (...args: any[]) => generateText(...args),
  generateObject: (...args: any[]) => generateObject(...args)
}));

jest.mock('@ai-sdk/deepseek', () => ({ deepseek }));
jest.mock('@ai-sdk/google', () => ({ google }));
jest.mock('@ai-sdk/openai', () => ({ createOpenAI }));

const notificationService = {
  sendSystemAlert: jest.fn().mockResolvedValue(true)
};

jest.mock('../../src/lib/services/notification', () => ({
  __esModule: true,
  notificationService
}));

import { ModelWrapper, aiService, callSimpleAI, callSimpleAIText, callSimpleAIWithJson } from '../../src/lib/utils/llm';
import { config } from '../../src/lib/config';

const restoreConfig = (snapshot: typeof config.ai) => {
  config.ai.provider = snapshot.provider;
  config.ai.simpleProvider = snapshot.simpleProvider;
  config.ai.deepseek = { ...snapshot.deepseek };
  config.ai.google = { ...snapshot.google };
  config.ai.qwen = { ...snapshot.qwen };
  config.ai.xai = { ...snapshot.xai };
};

describe('llm utils', () => {
  const originalConfig = JSON.parse(JSON.stringify(config.ai));

  beforeEach(() => {
    generateText.mockReset();
    generateObject.mockReset();
    deepseek.mockClear();
    google.mockClear();
    createOpenAI.mockClear();
    createOpenAI.mockImplementation(() => jest.fn((model: string) => ({ provider: 'openai', model })));
    notificationService.sendSystemAlert.mockClear();
    aiService.reset();
    restoreConfig(originalConfig);
    delete (global as any).fetch;
  });

  afterAll(() => {
    restoreConfig(originalConfig);
  });

  it('returns mock responses in mock mode', async () => {
    const wrapper = new ModelWrapper({ provider: 'mock' }, 'mock', true);

    const textResult = await wrapper.call([{ role: 'user', content: 'hi' }]);
    const jsonResult = await wrapper.callWithJson([{ role: 'user', content: 'hi' }]);

    expect(textResult.success).toBe(true);
    expect(textResult.data).toContain('模拟响应');
    expect(jsonResult.success).toBe(true);
    expect(jsonResult.data).toHaveProperty('message');
    expect(wrapper.getProviderName()).toBe('mock');
    expect(wrapper.isMockMode()).toBe(true);
    expect(wrapper.getRawModel()).toEqual({ provider: 'mock' });
  });

  it('uses generateText and generateObject in normal mode', async () => {
    generateText.mockResolvedValue({
      text: 'ok',
      usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 }
    });
    generateObject.mockResolvedValue({
      object: { foo: 'bar' },
      usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 }
    });

    const wrapper = new ModelWrapper({ provider: 'deepseek' }, 'deepseek');

    const textResult = await wrapper.call([{ role: 'user', content: 'hi' }]);
    const jsonResult = await wrapper.callWithJson([{ role: 'user', content: 'hi' }]);

    expect(textResult).toMatchObject({ success: true, data: 'ok' });
    expect(jsonResult).toMatchObject({ success: true, data: { foo: 'bar' } });
  });

  it('uses default temperature and omits usage when missing', async () => {
    generateText.mockResolvedValue({ text: 'ok' });
    generateObject.mockResolvedValue({ object: { foo: 'bar' } });

    const wrapper = new ModelWrapper({ provider: 'deepseek' }, 'deepseek');

    const textResult = await wrapper.call([{ role: 'user', content: 'hi' }]);
    const jsonResult = await wrapper.callWithJson([{ role: 'user', content: 'hi' }]);

    expect(textResult.usage).toBeUndefined();
    expect(jsonResult.usage).toBeUndefined();
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({ temperature: 0.7 })
    );
  });

  it('honors custom temperature in call', async () => {
    generateText.mockResolvedValue({ text: 'ok' });

    const wrapper = new ModelWrapper({ provider: 'deepseek' }, 'deepseek');
    await wrapper.call([{ role: 'user', content: 'hi' }], { temperature: 0.2 });

    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({ temperature: 0.2 })
    );
  });

  it('returns errors when generateObject fails', async () => {
    generateObject.mockRejectedValue(new Error('json-fail'));

    const wrapper = new ModelWrapper({ provider: 'deepseek' }, 'deepseek');
    const result = await wrapper.callWithJson([{ role: 'user', content: 'hi' }]);

    expect(result.success).toBe(false);
    expect(result.error).toContain('json-fail');
  });

  it('returns errors when generateText fails', async () => {
    generateText.mockRejectedValue(new Error('boom'));

    const wrapper = new ModelWrapper({ provider: 'deepseek' }, 'deepseek');
    const result = await wrapper.call([{ role: 'user', content: 'hi' }]);

    expect(result.success).toBe(false);
    expect(result.error).toContain('boom');
  });

  it('returns fallback error messages when error has no message', async () => {
    generateText.mockRejectedValue({});
    generateObject.mockRejectedValue({});

    const wrapper = new ModelWrapper({ provider: 'deepseek' }, 'deepseek');

    const textResult = await wrapper.call([{ role: 'user', content: 'hi' }]);
    const jsonResult = await wrapper.callWithJson([{ role: 'user', content: 'hi' }]);

    expect(textResult.error).toContain('deepseek');
    expect(jsonResult.error).toContain('deepseek');
  });

  it('calls xai proxy for text responses', async () => {
    config.ai.xai.proxyUrl = 'http://proxy';
    config.ai.xai.apiKey = 'key';
    config.ai.xai.model = 'grok';

    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'proxy-text' } }],
        usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 }
      })
    });

    const wrapper = new ModelWrapper({ provider: 'xai' }, 'xai');
    const result = await wrapper.call([{ role: 'user', content: 'hi' }]);

    expect(result.success).toBe(true);
    expect(result.data).toBe('proxy-text');
    expect(result.usage).toEqual({ promptTokens: 1, completionTokens: 2, totalTokens: 3 });
  });

  it('uses custom temperature for xai proxy text', async () => {
    config.ai.xai.proxyUrl = 'http://proxy';
    config.ai.xai.apiKey = 'key';
    config.ai.xai.model = 'grok';

    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'proxy-text' } }],
        usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 }
      })
    });

    const wrapper = new ModelWrapper({ provider: 'xai' }, 'xai');
    await wrapper.call([{ role: 'user', content: 'hi' }], { temperature: 0.2 });

    const body = JSON.parse((global as any).fetch.mock.calls[0][1].body);
    expect(body.temperature).toBe(0.2);
  });

  it('handles xai proxy error and JSON parsing', async () => {
    config.ai.xai.proxyUrl = 'http://proxy';
    config.ai.xai.apiKey = 'key';
    config.ai.xai.model = 'grok';

    (global as any).fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Bad',
        text: async () => 'fail'
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'not-json' } }]
        })
      });

    const wrapper = new ModelWrapper({ provider: 'xai' }, 'xai');
    const errorResult = await wrapper.call([{ role: 'user', content: 'hi' }]);
    const jsonResult = await wrapper.callWithJson([{ role: 'user', content: 'hi' }]);

    expect(errorResult.success).toBe(false);
    expect(jsonResult.success).toBe(true);
    expect(jsonResult.data).toEqual({ message: 'not-json' });
  });

  it('handles abort errors from xai proxy', async () => {
    config.ai.xai.proxyUrl = 'http://proxy';
    config.ai.xai.apiKey = 'key';
    config.ai.xai.model = 'grok';

    (global as any).fetch = jest.fn().mockRejectedValue({ name: 'AbortError' });

    const wrapper = new ModelWrapper({ provider: 'xai' }, 'xai');
    const result = await wrapper.call([{ role: 'user', content: 'hi' }], { timeout: 1 });

    expect(result.success).toBe(false);
    expect(result.error).toContain('超时');
  });

  it('handles generic xai proxy errors', async () => {
    config.ai.xai.proxyUrl = 'http://proxy';
    config.ai.xai.apiKey = 'key';
    config.ai.xai.model = 'grok';

    (global as any).fetch = jest.fn().mockRejectedValue(new Error('boom'));

    const wrapper = new ModelWrapper({ provider: 'xai' }, 'xai');
    const result = await wrapper.call([{ role: 'user', content: 'hi' }]);

    expect(result.success).toBe(false);
    expect(result.error).toContain('boom');
  });

  it('aborts xai proxy text calls via timeout', async () => {
    jest.useFakeTimers();
    config.ai.xai.proxyUrl = 'http://proxy';
    config.ai.xai.apiKey = 'key';
    config.ai.xai.model = 'grok';

    (global as any).fetch = jest.fn().mockImplementation((_url, options) => {
      return new Promise((_, reject) => {
        options.signal.addEventListener('abort', () => reject({ name: 'AbortError' }));
      });
    });

    const wrapper = new ModelWrapper({ provider: 'xai' }, 'xai');
    const promise = wrapper.call([{ role: 'user', content: 'hi' }], { timeout: 5 });

    jest.advanceTimersByTime(5);

    const result = await promise;

    expect(result.success).toBe(false);
    expect(result.error).toContain('超时');

    jest.useRealTimers();
  });

  it('handles xai proxy text missing content', async () => {
    config.ai.xai.proxyUrl = 'http://proxy';
    config.ai.xai.apiKey = 'key';
    config.ai.xai.model = 'grok';

    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{}] })
    });

    const wrapper = new ModelWrapper({ provider: 'xai' }, 'xai');
    const result = await wrapper.call([{ role: 'user', content: 'hi' }]);

    expect(result.success).toBe(false);
    expect(result.error).toContain('没有找到消息内容');
  });

  it('handles xai proxy text with empty choices', async () => {
    config.ai.xai.proxyUrl = 'http://proxy';
    config.ai.xai.apiKey = 'key';
    config.ai.xai.model = 'grok';

    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [] })
    });

    const wrapper = new ModelWrapper({ provider: 'xai' }, 'xai');
    const result = await wrapper.call([{ role: 'user', content: 'hi' }]);

    expect(result.success).toBe(false);
    expect(result.error).toContain('没有找到消息内容');
  });

  it('handles xai proxy text errors without message', async () => {
    config.ai.xai.proxyUrl = 'http://proxy';
    config.ai.xai.apiKey = 'key';
    config.ai.xai.model = 'grok';

    (global as any).fetch = jest.fn().mockRejectedValue({});

    const wrapper = new ModelWrapper({ provider: 'xai' }, 'xai');
    const result = await wrapper.call([{ role: 'user', content: 'hi' }]);

    expect(result.success).toBe(false);
    expect(result.error).toContain('xAI代理调用失败');
  });

  it('callXAIProxyText uses defaults and handles missing choices', async () => {
    config.ai.xai.proxyUrl = 'http://proxy';
    config.ai.xai.apiKey = 'key';
    config.ai.xai.model = 'grok';

    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({})
    });

    const wrapper = new ModelWrapper({ provider: 'xai' }, 'xai');
    const result = await (wrapper as any).callXAIProxyText([{ role: 'user', content: 'hi' }]);

    expect(result.success).toBe(false);
    expect(result.error).toContain('没有找到消息内容');
  });

  it('callXAIProxyText maps usage when present', async () => {
    config.ai.xai.proxyUrl = 'http://proxy';
    config.ai.xai.apiKey = 'key';
    config.ai.xai.model = 'grok';

    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'ok' } }],
        usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 }
      })
    });

    const wrapper = new ModelWrapper({ provider: 'xai' }, 'xai');
    const result = await (wrapper as any).callXAIProxyText(
      [{ role: 'user', content: 'hi' }],
      { temperature: 0.5 }
    );

    expect(result.success).toBe(true);
    expect(result.usage).toEqual({ promptTokens: 2, completionTokens: 3, totalTokens: 5 });
  });

  it('callXAIProxyText maps zero usage tokens', async () => {
    config.ai.xai.proxyUrl = 'http://proxy';
    config.ai.xai.apiKey = 'key';
    config.ai.xai.model = 'grok';

    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'ok' } }],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
      })
    });

    const wrapper = new ModelWrapper({ provider: 'xai' }, 'xai');
    const result = await (wrapper as any).callXAIProxyText([{ role: 'user', content: 'hi' }]);

    expect(result.success).toBe(true);
    expect(result.usage).toEqual({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });
  });

  it('handles xai proxy json errors and aborts', async () => {
    config.ai.xai.proxyUrl = 'http://proxy';
    config.ai.xai.apiKey = 'key';
    config.ai.xai.model = 'grok';

    (global as any).fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad',
        text: async () => 'error'
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: {} }] })
      })
      .mockRejectedValueOnce({ name: 'AbortError' });

    const wrapper = new ModelWrapper({ provider: 'xai' }, 'xai');
    const errorResult = await wrapper.callWithJson([{ role: 'user', content: 'hi' }]);
    const missingContent = await wrapper.callWithJson([{ role: 'user', content: 'hi' }]);
    const abortResult = await wrapper.callWithJson([{ role: 'user', content: 'hi' }], { timeout: 1 });

    expect(errorResult.success).toBe(false);
    expect(errorResult.error).toContain('xAI代理返回错误');
    expect(missingContent.error).toContain('没有找到消息内容');
    expect(abortResult.error).toContain('超时');
  });

  it('aborts xai proxy json calls via timeout', async () => {
    jest.useFakeTimers();
    config.ai.xai.proxyUrl = 'http://proxy';
    config.ai.xai.apiKey = 'key';
    config.ai.xai.model = 'grok';

    (global as any).fetch = jest.fn().mockImplementation((_url, options) => {
      return new Promise((_, reject) => {
        options.signal.addEventListener('abort', () => reject({ name: 'AbortError' }));
      });
    });

    const wrapper = new ModelWrapper({ provider: 'xai' }, 'xai');
    const promise = wrapper.callWithJson([{ role: 'user', content: 'hi' }], { timeout: 5 });

    jest.advanceTimersByTime(5);

    const result = await promise;

    expect(result.success).toBe(false);
    expect(result.error).toContain('超时');

    jest.useRealTimers();
  });

  it('handles xai proxy json errors without message', async () => {
    config.ai.xai.proxyUrl = 'http://proxy';
    config.ai.xai.apiKey = 'key';
    config.ai.xai.model = 'grok';

    (global as any).fetch = jest.fn().mockRejectedValue({});

    const wrapper = new ModelWrapper({ provider: 'xai' }, 'xai');
    const result = await wrapper.callWithJson([{ role: 'user', content: 'hi' }]);

    expect(result.success).toBe(false);
    expect(result.error).toContain('xAI代理调用失败');
  });

  it('handles xai proxy json responses with object content', async () => {
    config.ai.xai.proxyUrl = 'http://proxy';
    config.ai.xai.apiKey = 'key';
    config.ai.xai.model = 'grok';

    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: { foo: 'bar' } } }],
        usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 }
      })
    });

    const wrapper = new ModelWrapper({ provider: 'xai' }, 'xai');
    const result = await wrapper.callWithJson([{ role: 'user', content: 'hi' }]);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ foo: 'bar' });
    expect(result.usage).toEqual({ promptTokens: 1, completionTokens: 2, totalTokens: 3 });
  });

  it('handles xai proxy json with empty choices', async () => {
    config.ai.xai.proxyUrl = 'http://proxy';
    config.ai.xai.apiKey = 'key';
    config.ai.xai.model = 'grok';

    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [] })
    });

    const wrapper = new ModelWrapper({ provider: 'xai' }, 'xai');
    const result = await wrapper.callWithJson([{ role: 'user', content: 'hi' }]);

    expect(result.success).toBe(false);
    expect(result.error).toContain('没有找到消息内容');
  });

  it('callXAIProxyJson uses defaults and handles missing choices', async () => {
    config.ai.xai.proxyUrl = 'http://proxy';
    config.ai.xai.apiKey = 'key';
    config.ai.xai.model = 'grok';

    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({})
    });

    const wrapper = new ModelWrapper({ provider: 'xai' }, 'xai');
    const result = await (wrapper as any).callXAIProxyJson([{ role: 'user', content: 'hi' }]);

    expect(result.success).toBe(false);
    expect(result.error).toContain('没有找到消息内容');
  });

  it('callXAIProxyJson maps usage and falls back on parse errors', async () => {
    config.ai.xai.proxyUrl = 'http://proxy';
    config.ai.xai.apiKey = 'key';
    config.ai.xai.model = 'grok';

    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'not-json' } }],
        usage: { prompt_tokens: 4, completion_tokens: 6, total_tokens: 10 }
      })
    });

    const wrapper = new ModelWrapper({ provider: 'xai' }, 'xai');
    const result = await (wrapper as any).callXAIProxyJson([{ role: 'user', content: 'hi' }]);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ message: 'not-json' });
    expect(result.usage).toEqual({ promptTokens: 4, completionTokens: 6, totalTokens: 10 });
  });

  it('callXAIProxyJson maps zero usage tokens', async () => {
    config.ai.xai.proxyUrl = 'http://proxy';
    config.ai.xai.apiKey = 'key';
    config.ai.xai.model = 'grok';

    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"ok":true}' } }],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
      })
    });

    const wrapper = new ModelWrapper({ provider: 'xai' }, 'xai');
    const result = await (wrapper as any).callXAIProxyJson([{ role: 'user', content: 'hi' }]);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ ok: true });
    expect(result.usage).toEqual({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });
  });

  it('parses xai proxy json string content', async () => {
    config.ai.xai.proxyUrl = 'http://proxy';
    config.ai.xai.apiKey = 'key';
    config.ai.xai.model = 'grok';

    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"foo":"bar"}' } }]
      })
    });

    const wrapper = new ModelWrapper({ provider: 'xai' }, 'xai');
    const result = await wrapper.callWithJson([{ role: 'user', content: 'hi' }]);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ foo: 'bar' });
  });

  it('handles xai proxy without usage', async () => {
    config.ai.xai.proxyUrl = 'http://proxy';
    config.ai.xai.apiKey = 'key';
    config.ai.xai.model = 'grok';

    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'proxy-text' } }]
      })
    });

    const wrapper = new ModelWrapper({ provider: 'xai' }, 'xai');
    const result = await wrapper.call([{ role: 'user', content: 'hi' }]);

    expect(result.success).toBe(true);
    expect(result.usage).toBeUndefined();
  });

  it('uses generateText when xai proxy is not configured', async () => {
    config.ai.xai.proxyUrl = '';
    generateText.mockResolvedValue({ text: 'ok' });

    const wrapper = new ModelWrapper({ provider: 'xai' }, 'xai');
    const result = await wrapper.call([{ role: 'user', content: 'hi' }]);

    expect(result.success).toBe(true);
    expect(generateText).toHaveBeenCalled();
  });

  it('falls back when xai config is missing', async () => {
    const previousXai = config.ai.xai;
    (config.ai as any).xai = undefined;
    generateText.mockResolvedValue({ text: 'ok' });
    generateObject.mockResolvedValue({ object: { ok: true } });

    try {
      const wrapper = new ModelWrapper({ provider: 'xai' }, 'xai');
      const textResult = await wrapper.call([{ role: 'user', content: 'hi' }]);
      const jsonResult = await wrapper.callWithJson([{ role: 'user', content: 'hi' }]);

      expect(textResult.success).toBe(true);
      expect(jsonResult.success).toBe(true);
      expect(generateText).toHaveBeenCalled();
      expect(generateObject).toHaveBeenCalled();
    } finally {
      (config.ai as any).xai = previousXai;
    }
  });

  it('initializes aiService in mock mode when keys missing', async () => {
    config.ai.provider = 'deepseek';
    config.ai.simpleProvider = 'qwen';
    config.ai.deepseek.apiKey = '';
    config.ai.qwen.apiKey = '';

    await aiService.initialize();

    expect(aiService.isInitialized()).toBe(true);
    expect(aiService.isMockMode()).toBe(true);
  });

  it('initializes aiService with real models', async () => {
    const createModelSpy = jest
      .spyOn(aiService as any, 'createModel')
      .mockResolvedValueOnce(new ModelWrapper({ provider: 'deepseek' }, 'deepseek', false))
      .mockResolvedValueOnce(new ModelWrapper({ provider: 'deepseek' }, 'deepseek', false));

    await aiService.initialize();

    expect(aiService.isInitialized()).toBe(true);
    expect(aiService.isMockMode()).toBe(false);

    createModelSpy.mockRestore();
  });

  it('skips initialization when already initialized', async () => {
    (aiService as any).initialized = true;
    const createModelSpy = jest.spyOn(aiService as any, 'createModel');

    await aiService.initialize();

    expect(createModelSpy).not.toHaveBeenCalled();

    createModelSpy.mockRestore();
  });

  it('initializes aiService in error mode when createModel fails', async () => {
    const createModelSpy = jest
      .spyOn(aiService as any, 'createModel')
      .mockRejectedValue(new Error('init-fail'));
    notificationService.sendSystemAlert.mockRejectedValue(new Error('notify fail'));

    await aiService.initialize();

    expect(aiService.isMockMode()).toBe(true);
    expect(notificationService.sendSystemAlert).toHaveBeenCalled();

    createModelSpy.mockRestore();
  });

  it('uses fallback error message when initialize fails without message', async () => {
    const createModelSpy = jest.spyOn(aiService as any, 'createModel').mockRejectedValue({});

    await aiService.initialize();

    expect(notificationService.sendSystemAlert).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('AI服务初始化失败')
    );

    createModelSpy.mockRestore();
  });

  it('falls back to main model when simple model initialization fails', async () => {
    const modelWrapper = new ModelWrapper({ provider: 'deepseek' }, 'deepseek');
    const createModelSpy = jest
      .spyOn(aiService as any, 'createModel')
      .mockImplementationOnce(async () => modelWrapper)
      .mockImplementationOnce(async () => {
        throw new Error('simple fail');
      });

    await aiService.initialize();

    expect((aiService as any).simpleModel).toBe((aiService as any).model);

    createModelSpy.mockRestore();
  });

  it('creates raw models for all providers', async () => {
    config.ai.deepseek.apiKey = 'key';
    config.ai.deepseek.model = 'deepseek-model';
    config.ai.google.apiKey = 'key';
    config.ai.google.model = 'google-model';
    config.ai.qwen.apiKey = 'key';
    config.ai.qwen.model = 'qwen-model';
    config.ai.xai.apiKey = 'key';
    config.ai.xai.model = 'xai-model';
    config.ai.xai.proxyUrl = 'http://proxy';

    const deepseekModel = await (aiService as any).createRawModel('deepseek');
    const googleModel = await (aiService as any).createRawModel('google');
    const qwenModel = await (aiService as any).createRawModel('qwen');
    const xaiModel = await (aiService as any).createRawModel('xai');

    expect(deepseek).toHaveBeenCalledWith('deepseek-model');
    expect(google).toHaveBeenCalledWith('google-model');
    expect(createOpenAI).toHaveBeenCalled();
    expect(qwenModel).toEqual({ provider: 'openai', model: 'qwen-model' });
    expect(xaiModel).toEqual({ provider: 'openai', model: 'xai-model' });
  });

  it('throws for missing api keys and unsupported providers', async () => {
    config.ai.google.apiKey = '';
    await expect((aiService as any).createRawModel('google')).rejects.toThrow('Google API Key 未配置');

    config.ai.xai.apiKey = '';
    await expect((aiService as any).createRawModel('xai')).rejects.toThrow('xAI API Key 未配置');

    await expect((aiService as any).createRawModel('unknown')).rejects.toThrow('不支持的AI提供商');
  });

  it('creates mock wrapper for unsupported providers', async () => {
    const model = await (aiService as any).createModel('unknown');
    expect(model.isMockMode()).toBe(true);
  });

  it('creates model wrapper when raw model is available', async () => {
    const rawModel = { provider: 'deepseek' };
    const createRawModelSpy = jest
      .spyOn(aiService as any, 'createRawModel')
      .mockResolvedValue(rawModel);

    const model = await aiService.createModel('deepseek');

    expect(model.getRawModel()).toEqual(rawModel);
    expect(model.getProviderName()).toBe('deepseek');

    createRawModelSpy.mockRestore();
  });

  it('sends alerts when callLLM fails', async () => {
    (aiService as any).initialized = true;
    (aiService as any).model = {
      call: jest.fn().mockRejectedValue(new Error('boom')),
      isMockMode: () => false
    };

    const result = await aiService.callLLM([{ role: 'user', content: 'hi' }]);

    expect(result.success).toBe(false);
    expect(notificationService.sendSystemAlert).toHaveBeenCalled();
  });

  it('handles notification failures during callLLM errors', async () => {
    (aiService as any).initialized = true;
    (aiService as any).model = {
      call: jest.fn().mockRejectedValue(new Error('boom')),
      isMockMode: () => false
    };
    notificationService.sendSystemAlert.mockRejectedValue(new Error('notify fail'));

    const result = await aiService.callLLM([{ role: 'user', content: 'hi' }]);

    expect(result.success).toBe(false);
    expect(notificationService.sendSystemAlert).toHaveBeenCalled();
  });

  it('returns fallback error when callLLM error has no message', async () => {
    (aiService as any).initialized = true;
    (aiService as any).model = {
      call: jest.fn().mockRejectedValue({}),
      isMockMode: () => false
    };

    const result = await aiService.callLLM([{ role: 'user', content: 'hi' }]);

    expect(result.success).toBe(false);
    expect(result.error).toBe('LLM调用失败');
  });

  it('returns errors when model is missing', async () => {
    (aiService as any).initialized = true;
    (aiService as any).model = null;

    const result = await aiService.callLLM([{ role: 'user', content: 'hi' }]);

    expect(result.success).toBe(false);
    expect(result.error).toContain('主模型未初始化');
  });

  it('initializes before calling llm', async () => {
    const initSpy = jest.spyOn(aiService as any, 'initialize').mockImplementation(async () => {
      (aiService as any).initialized = true;
      (aiService as any).model = {
        call: jest.fn().mockResolvedValue({ success: true, data: 'ok' }),
        isMockMode: () => false
      };
    });

    const result = await aiService.callLLM([{ role: 'user', content: 'hi' }]);

    expect(initSpy).toHaveBeenCalled();
    expect(result.data).toBe('ok');

    initSpy.mockRestore();
  });

  it('handles callLLMWithJsonResponse success and failure', async () => {
    (aiService as any).initialized = true;
    (aiService as any).model = {
      callWithJson: jest.fn().mockResolvedValue({ success: true, data: { ok: true } }),
      call: jest.fn(),
      isMockMode: () => false
    };

    const success = await aiService.callLLMWithJsonResponse([{ role: 'user', content: 'hi' }]);
    expect(success.data).toEqual({ ok: true });

    (aiService as any).model = {
      callWithJson: jest.fn().mockRejectedValue(new Error('json-fail')),
      call: jest.fn(),
      isMockMode: () => false
    };

    const failure = await aiService.callLLMWithJsonResponse([{ role: 'user', content: 'hi' }]);
    expect(failure.success).toBe(false);
    expect(notificationService.sendSystemAlert).toHaveBeenCalled();
  });

  it('handles notification failures during callLLMWithJsonResponse errors', async () => {
    (aiService as any).initialized = true;
    (aiService as any).model = {
      callWithJson: jest.fn().mockRejectedValue(new Error('json-fail')),
      call: jest.fn(),
      isMockMode: () => false
    };
    notificationService.sendSystemAlert.mockRejectedValue(new Error('notify fail'));

    const result = await aiService.callLLMWithJsonResponse([{ role: 'user', content: 'hi' }]);

    expect(result.success).toBe(false);
    expect(notificationService.sendSystemAlert).toHaveBeenCalled();
  });

  it('returns fallback error when callLLMWithJsonResponse error has no message', async () => {
    (aiService as any).initialized = true;
    (aiService as any).model = {
      callWithJson: jest.fn().mockRejectedValue({}),
      call: jest.fn(),
      isMockMode: () => false
    };

    const result = await aiService.callLLMWithJsonResponse([{ role: 'user', content: 'hi' }]);

    expect(result.success).toBe(false);
    expect(result.error).toBe('LLM JSON调用失败');
  });

  it('returns errors when json model is missing', async () => {
    (aiService as any).initialized = true;
    (aiService as any).model = null;

    const result = await aiService.callLLMWithJsonResponse([{ role: 'user', content: 'hi' }]);

    expect(result.success).toBe(false);
    expect(result.error).toContain('主模型未初始化');
  });

  it('initializes before calling llm json', async () => {
    const initSpy = jest.spyOn(aiService as any, 'initialize').mockImplementation(async () => {
      (aiService as any).initialized = true;
      (aiService as any).model = {
        callWithJson: jest.fn().mockResolvedValue({ success: true, data: { ok: true } }),
        isMockMode: () => false
      };
    });

    const result = await aiService.callLLMWithJsonResponse([{ role: 'user', content: 'hi' }]);

    expect(initSpy).toHaveBeenCalled();
    expect(result.data).toEqual({ ok: true });

    initSpy.mockRestore();
  });

  it('falls back to main model when simple AI fails', async () => {
    (aiService as any).initialized = true;
    (aiService as any).simpleModel = {
      call: jest.fn().mockRejectedValue(new Error('simple fail')),
      callWithJson: jest.fn(),
      isMockMode: () => false
    };
    (aiService as any).model = {
      call: jest.fn().mockResolvedValue({ success: true, data: 'main' }),
      callWithJson: jest.fn(),
      isMockMode: () => false
    };

    const result = await aiService.callSimpleAI([{ role: 'user', content: 'hi' }]);

    expect(result.success).toBe(true);
    expect(result.data).toBe('main');
  });

  it('initializes before calling simple AI and uses provided temperature', async () => {
    const initSpy = jest.spyOn(aiService as any, 'initialize').mockImplementation(async () => {
      (aiService as any).initialized = true;
      (aiService as any).simpleModel = {
        call: jest.fn().mockResolvedValue({ success: true, data: 'simple' }),
        callWithJson: jest.fn(),
        isMockMode: () => false
      };
    });

    const result = await aiService.callSimpleAI(
      [{ role: 'user', content: 'hi' }],
      { temperature: 0.2 }
    );

    expect(initSpy).toHaveBeenCalled();
    expect(result.data).toBe('simple');

    initSpy.mockRestore();
  });

  it('uses simple model json path and handles alert failures', async () => {
    (aiService as any).initialized = true;
    (aiService as any).simpleModel = {
      callWithJson: jest.fn().mockResolvedValue({ success: true, data: { ok: true } }),
      call: jest.fn(),
      isMockMode: () => false
    };

    const jsonResult = await aiService.callSimpleAI(
      [{ role: 'user', content: 'hi' }],
      { schema: {} as any }
    );

    expect(jsonResult.data).toEqual({ ok: true });

    (aiService as any).simpleModel = {
      callWithJson: jest.fn().mockRejectedValue(new Error('fail')),
      call: jest.fn(),
      isMockMode: () => false
    };
    (aiService as any).model = {
      callWithJson: jest.fn().mockResolvedValue({ success: true, data: { fallback: true } }),
      call: jest.fn(),
      isMockMode: () => false
    };

    const fallbackResult = await aiService.callSimpleAI(
      [{ role: 'user', content: 'hi' }],
      { schema: {} as any }
    );

    expect(fallbackResult.data).toEqual({ fallback: true });

    notificationService.sendSystemAlert.mockRejectedValue(new Error('alert fail'));
    (aiService as any).simpleModel = {
      callWithJson: jest.fn().mockRejectedValue(new Error('fail')),
      call: jest.fn(),
      isMockMode: () => false
    };
    (aiService as any).model = null;

    const failedResult = await aiService.callSimpleAI(
      [{ role: 'user', content: 'hi' }],
      { schema: {} as any }
    );

    expect(failedResult.success).toBe(false);
  });

  it('returns error when simple model is missing', async () => {
    (aiService as any).initialized = true;
    (aiService as any).simpleModel = null;
    (aiService as any).model = null;

    const result = await aiService.callSimpleAI([{ role: 'user', content: 'hi' }]);
    expect(result.success).toBe(false);
  });

  it('returns fallback error when simple AI fails without message and no main model', async () => {
    (aiService as any).initialized = true;
    (aiService as any).simpleModel = {
      call: jest.fn().mockRejectedValue({}),
      callWithJson: jest.fn(),
      isMockMode: () => false
    };
    (aiService as any).model = null;

    const result = await aiService.callSimpleAI([{ role: 'user', content: 'hi' }]);

    expect(result.success).toBe(false);
    expect(result.error).toBe('简单AI调用失败');
  });

  it('exposes simple call helpers', async () => {
    (aiService as any).initialized = true;
    (aiService as any).simpleModel = {
      call: jest.fn().mockResolvedValue({ success: true, data: 'text' }),
      callWithJson: jest.fn().mockResolvedValue({ success: true, data: { ok: true } }),
      isMockMode: () => false
    };

    const textResult = await callSimpleAIText('sys', 'user');
    const jsonResult = await callSimpleAIWithJson('sys', 'user', {} as any);

    expect(textResult.data).toBe('text');
    expect(jsonResult.data).toEqual({ ok: true });
  });

  it('exposes callSimpleAI wrapper', async () => {
    (aiService as any).initialized = true;
    (aiService as any).simpleModel = {
      call: jest.fn().mockResolvedValue({ success: true, data: 'text' }),
      callWithJson: jest.fn(),
      isMockMode: () => false
    };

    const result = await callSimpleAI([{ role: 'user', content: 'hi' }]);

    expect(result.data).toBe('text');
  });

  it('returns provider info', () => {
    (aiService as any).initialized = true;
    (aiService as any).model = { isMockMode: () => true };
    (aiService as any).simpleModel = { isMockMode: () => true };
    config.ai.provider = 'unknown';
    config.ai.simpleProvider = 'unknown';
    const info = aiService.getProviderInfo();
    expect(info).toHaveProperty('provider');
    expect(info).toHaveProperty('simpleProvider');
    expect(info.model).toBe('mock');
    expect(info.simpleModel).toBe('mock');
  });

  it('returns model names for each provider', () => {
    (aiService as any).model = { isMockMode: () => false };
    (aiService as any).simpleModel = { isMockMode: () => false };

    const providers = ['deepseek', 'google', 'qwen', 'xai', 'unknown'] as const;
    for (const provider of providers) {
      config.ai.provider = provider as any;
      const info = aiService.getProviderInfo();
      expect(info.model).toBe(
        provider === 'deepseek'
          ? config.ai.deepseek.model
          : provider === 'google'
            ? config.ai.google.model
            : provider === 'qwen'
              ? config.ai.qwen.model
              : provider === 'xai'
                ? config.ai.xai.model
                : 'unknown'
      );
    }

    const simpleProviders = ['deepseek', 'google', 'qwen', 'xai', 'unknown'] as const;
    for (const provider of simpleProviders) {
      config.ai.simpleProvider = provider as any;
      const info = aiService.getProviderInfo();
      expect(info.simpleModel).toBe(
        provider === 'deepseek'
          ? config.ai.deepseek.model
          : provider === 'google'
            ? config.ai.google.model
            : provider === 'qwen'
              ? config.ai.qwen.model
              : provider === 'xai'
                ? config.ai.xai.model
                : 'unknown'
      );
    }
  });
});

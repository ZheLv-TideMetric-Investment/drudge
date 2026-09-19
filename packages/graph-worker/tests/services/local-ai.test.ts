import { LocalAiClient, buildGraphConfig, buildWebConfig } from '@drudge/common';

const settings = { baseUrl: 'http://local.invalid:11434', model: 'qwen3.5:9b', contextLength: 16384, timeoutMs: 5000 };
const messages = [{ role: 'user' as const, content: '合成测试，不含私人数据' }];
const response = (value: unknown) => ({ ok: true, json: async () => value });
const tags = () => response({ models: [{ name: settings.model }] });
const completed = (content = '测试完成') => response({ done: true, done_reason: 'stop', message: { content }, prompt_eval_count: 12, eval_count: 4 });

describe('local-first AI transport', () => {
  let fetchMock: jest.Mock;
  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock;
  });
  afterEach(() => { jest.useRealTimers(); });

  it('keeps cloud-only configuration inert and supports scoped local settings', async () => {
    const cloud = buildGraphConfig({ env: {}, loadEnv: false });
    expect(await new LocalAiClient(cloud.ai.local).call(messages)).toMatchObject({ reason: 'disabled' });
    expect(fetchMock).not.toHaveBeenCalled();
    const env = { LOCAL_AI_BASE_URL: settings.baseUrl, GRAPH_LOCAL_AI_MODEL: 'graph-test', WEB_LOCAL_AI_MODEL: 'web-test' };
    expect(buildGraphConfig({ env, loadEnv: false }).ai.local.model).toBe('graph-test');
    expect(buildWebConfig({ env, loadEnv: false }).ai.local).toMatchObject({ baseUrl: settings.baseUrl, model: 'web-test', contextLength: 16384 });
  });

  it('uses the running model once without starting a service or overriding idle unload', async () => {
    fetchMock.mockResolvedValueOnce(tags()).mockResolvedValueOnce(completed());
    expect(await new LocalAiClient(settings).call(messages)).toMatchObject({ success: true, data: '测试完成', usage: { totalTokens: 16 } });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([settings.baseUrl + '/api/tags', settings.baseUrl + '/api/chat']);
    const body = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(body).toMatchObject({ think: false, options: { num_ctx: 16384, num_predict: 2048 } });
    expect(body).not.toHaveProperty('keep_alive');
  });

  it('does not send inference when manually stopped, and resumes after an explicit restart', async () => {
    jest.useFakeTimers();
    const client = new LocalAiClient(settings);
    fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    expect(await client.call(messages)).toMatchObject({ reason: 'unavailable' });
    expect(await client.call(messages)).toMatchObject({ reason: 'unavailable' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(5001);
    fetchMock.mockResolvedValueOnce(tags()).mockResolvedValueOnce(completed());
    expect(await client.call(messages)).toMatchObject({ success: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('falls through once if stop occurs between the availability check and inference', async () => {
    fetchMock.mockResolvedValueOnce(tags()).mockRejectedValueOnce(new Error('ECONNRESET'));
    expect(await new LocalAiClient(settings).call(messages)).toMatchObject({ reason: 'request_failed' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('leaves oversized prompts intact for cloud processing without local truncation', async () => {
    const long = [{ role: 'user' as const, content: '完整内容'.repeat(4000) }];
    const original = JSON.stringify(long);
    expect(await new LocalAiClient(settings).call(long)).toMatchObject({ reason: 'context_limit' });
    expect(JSON.stringify(long)).toBe(original);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['length', '部分内容'],
    ['stop', ''],
  ])('rejects incomplete responses (%s)', async (reason, content) => {
    fetchMock.mockResolvedValueOnce(tags()).mockResolvedValueOnce(response({ done: true, done_reason: reason, message: { content } }));
    expect(await new LocalAiClient(settings).call(messages)).toMatchObject({ success: false, reason: 'incomplete' });
  });

  it('rejects invalid structured output and preserves failure usage', async () => {
    fetchMock.mockResolvedValueOnce(tags()).mockResolvedValueOnce(completed('{"count":"wrong"}'));
    const result = await new LocalAiClient(settings).call(messages, { schema: { type: 'object' }, validate: data => typeof (data as any).count === 'number' });
    expect(result).toMatchObject({ success: false, reason: 'invalid_json', usage: { totalTokens: 16 } });
  });

  it('aborts a hung inference without retrying', async () => {
    jest.useFakeTimers();
    let signal: AbortSignal | undefined;
    fetchMock.mockResolvedValueOnce(tags()).mockImplementationOnce((_url, init) => {
      signal = init.signal;
      return new Promise((_resolve, reject) => signal!.addEventListener('abort', () => reject(new Error('aborted'))));
    });
    const task = new LocalAiClient(settings).call(messages);
    await jest.advanceTimersByTimeAsync(5001);
    expect(await task).toMatchObject({ success: false });
    expect(signal?.aborted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('serializes GPU requests and checks availability again before the next request', async () => {
    let release!: (value: unknown) => void;
    fetchMock.mockResolvedValueOnce(tags()).mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const client = new LocalAiClient(settings);
    const first = client.call(messages);
    const second = client.call(messages);
    while (!release) await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fetchMock.mockRejectedValueOnce(new Error('manually stopped'));
    release(completed());
    expect(await first).toMatchObject({ success: true });
    expect(await second).toMatchObject({ reason: 'unavailable' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

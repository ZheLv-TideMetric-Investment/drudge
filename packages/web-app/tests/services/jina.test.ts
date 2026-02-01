import axios from 'axios';
import { mockAxiosResponse } from '../helpers/mock-axios';
import {
  callJinaDeepSearch,
  callJinaCustom,
  callJinaQuickSearch,
  callJinaEconomicAnalysis,
  isHealthCheck
} from '../../src/lib/services/jina';

describe('jina service', () => {
  beforeEach(() => {
    const mocked = axios as jest.Mocked<typeof axios>;
    mocked.post.mockReset();
    mocked.get.mockReset();
  });

  it('uses defaults and trims message', async () => {
    mockAxiosResponse({
      choices: [{ message: { content: 'answer' } }],
      usage: { total_tokens: 0, prompt_tokens: 0, completion_tokens: 0 }
    });

    const result = await callJinaDeepSearch('  hello  ');

    expect(result.content).toBe('answer');
    expect(result.cost).toBe(0.01);
    const payload = (axios.post as jest.Mock).mock.calls[0][1];
    expect(payload.model).toBe('jina-deepsearch-v2');
    expect(payload.messages[0].content).toBe('hello');
  });

  it('applies default options when custom options are missing', async () => {
    mockAxiosResponse({
      choices: [{ message: { content: 'answer' } }],
      usage: { total_tokens: 1, prompt_tokens: 1, completion_tokens: 0 }
    });

    await callJinaCustom('hello', undefined as any);

    const payload = (axios.post as jest.Mock).mock.calls[0][1];
    expect(payload.model).toBe('jina-deepsearch-v2');
    expect(payload.reasoning_effort).toBe('high');
    expect(payload.max_attempts).toBe(3);
    expect(payload.no_direct_answer).toBe(false);
  });

  it('uses custom prompt and falls back when content missing', async () => {
    mockAxiosResponse({
      choices: [{ message: {} }],
      usage: { total_tokens: 10, prompt_tokens: 5, completion_tokens: 5 }
    });

    const result = await callJinaCustom('ignored', {
      customPrompt: 'custom prompt',
      max_attempts: 2
    });

    expect(result.content).toContain('抱歉');
    const payload = (axios.post as jest.Mock).mock.calls[0][1];
    expect(payload.messages[0].content).toBe('custom prompt');
  });

  it('handles missing message content and empty choices', async () => {
    mockAxiosResponse({
      choices: [],
      usage: { total_tokens: 10, prompt_tokens: 5, completion_tokens: 5 }
    });

    const result = await callJinaCustom(undefined as any, undefined as any);

    expect(result.content).toContain('抱歉');
    const payload = (axios.post as jest.Mock).mock.calls[0][1];
    expect(payload.messages[0].content).toBeUndefined();
  });

  it('wraps axios errors with descriptive message', async () => {
    (axios.post as jest.Mock).mockRejectedValue({
      isAxiosError: true,
      message: 'fail'
    });

    await expect(callJinaQuickSearch('hello')).rejects.toThrow('Jina API 请求失败');
  });

  it('rethrows non-axios errors', async () => {
    (axios.post as jest.Mock).mockRejectedValue(new Error('boom'));

    await expect(callJinaQuickSearch('hello')).rejects.toThrow('boom');
  });

  it('calls economic analysis with custom prompt', async () => {
    mockAxiosResponse({
      choices: [{ message: { content: 'analysis' } }],
      usage: { total_tokens: 10, prompt_tokens: 5, completion_tokens: 5 }
    });

    const result = await callJinaEconomicAnalysis('question');

    expect(result.content).toBe('analysis');
    const payload = (axios.post as jest.Mock).mock.calls[0][1];
    expect(payload.model).toBe('jina-deepsearch-v1');
    expect(payload.messages[0].content).toContain('question');
  });

  it('handles health check detection', () => {
    expect(isHealthCheck(undefined as any)).toBe(false);
    expect(isHealthCheck('status check')).toBe(true);
  });
});

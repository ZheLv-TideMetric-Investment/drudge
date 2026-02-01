import axios from 'axios';
import { mockAxiosResponse } from '../helpers/mock-axios';

const jinaModule = jest.requireActual('../../src/lib/services/jina');

const callJinaDeepSearch = jest.fn();
const callJinaEconomicAnalysis = jest.fn();
const callJinaQuickSearch = jest.fn();
const callJinaCustom = jest.fn();

const aiService = {
  createModel: jest.fn()
};
const createMessages = jest.fn((system: string, user: string) => [
  { role: 'system', content: system },
  { role: 'user', content: user }
]);

jest.mock('../../src/lib/services/jina', () => ({
  __esModule: true,
  ...jinaModule,
  callJinaDeepSearch,
  callJinaEconomicAnalysis,
  callJinaQuickSearch,
  callJinaCustom
}));

jest.mock('../../src/lib/utils/llm', () => ({
  __esModule: true,
  aiService,
  createMessages
}));

describe('robot service', () => {
  beforeEach(() => {
    callJinaDeepSearch.mockReset();
    callJinaEconomicAnalysis.mockReset();
    callJinaQuickSearch.mockReset();
    callJinaCustom.mockReset();
    aiService.createModel.mockReset();
    mockAxiosResponse({ ok: true });
  });

  it('responds to health check', async () => {
    const { processTingziMessage } = await import('../../src/lib/services/robot');

    const result = await processTingziMessage({
      text: { content: 'status check' },
      sessionWebhook: 'https://example.com/webhook',
      senderNick: 'tester'
    } as any);

    expect(result.aiResponse).toBe('ok');
  });

  it('uses jina provider when /jina command provided', async () => {
    const { processTingziMessage } = await import('../../src/lib/services/robot');

    callJinaDeepSearch.mockResolvedValue({ content: 'answer', cost: 0.05 });

    const result = await processTingziMessage({
      text: { content: '/jina hello' },
      sessionWebhook: 'https://example.com/webhook',
      senderNick: 'tester'
    } as any);

    expect(result.aiProvider).toBe('jina');
    expect(result.aiResponse).toContain('answer');
    expect(result.aiResponse).toContain('费用');
  });

  it('uses xai deep search by default', async () => {
    const { processTingziMessage } = await import('../../src/lib/services/robot');

    aiService.createModel.mockResolvedValue({
      call: jest.fn().mockResolvedValue({ success: true, data: 'default answer', usage: { totalTokens: 2 } })
    });

    const result = await processTingziMessage({
      text: { content: 'hello' },
      sessionWebhook: 'https://example.com/webhook',
      senderNick: 'tester'
    } as any);

    expect(result.aiProvider).toBe('xai');
    expect(result.aiResponse).toContain('default answer');
  });

  it('routes economic analysis to jina', async () => {
    const { processTingziMessage } = await import('../../src/lib/services/robot');

    callJinaEconomicAnalysis.mockResolvedValue({ content: 'analysis', cost: 0.02 });

    const result = await processTingziMessage({
      text: { content: '/jina /economic hello' },
      sessionWebhook: 'https://example.com/webhook',
      senderNick: 'tester'
    } as any);

    expect(result.serviceType).toBe('economic');
    expect(result.aiProvider).toBe('jina');
  });

  it('routes quick search to xai', async () => {
    const { processTingziMessage } = await import('../../src/lib/services/robot');

    aiService.createModel.mockResolvedValue({
      call: jest.fn().mockResolvedValue({ success: true, data: 'xai answer', usage: { totalTokens: 10 } })
    });

    const result = await processTingziMessage({
      text: { content: '/quick hello' },
      sessionWebhook: 'https://example.com/webhook',
      senderNick: 'tester'
    } as any);

    expect(result.aiProvider).toBe('xai');
    expect(result.aiResponse).toContain('xai answer');
  });

  it('routes quick search to jina with cleaned message', async () => {
    const { processTingziMessage } = await import('../../src/lib/services/robot');

    callJinaQuickSearch.mockResolvedValue({ content: 'answer', cost: 0.01 });

    const result = await processTingziMessage({
      text: { content: '/吉娜 /quick hello' },
      sessionWebhook: 'https://example.com/webhook',
      senderNick: 'tester'
    } as any);

    expect(result.aiProvider).toBe('jina');
    expect(callJinaQuickSearch).toHaveBeenCalledWith('hello');
  });

  it('handles custom xai service with cleaned prompts', async () => {
    const { processTingziMessage } = await import('../../src/lib/services/robot');

    aiService.createModel.mockResolvedValue({
      call: jest.fn().mockResolvedValue({ success: true, data: 'xai answer', usage: { totalTokens: 1 } })
    });

    await processTingziMessage({
      text: { content: '/custom hello' },
      sessionWebhook: 'https://example.com/webhook',
      senderNick: 'tester'
    } as any);

    expect(createMessages).toHaveBeenCalledWith(
      expect.stringContaining('全能的AI助手'),
      'hello'
    );
  });

  it('handles economic analysis prompt for xai', async () => {
    const { processTingziMessage } = await import('../../src/lib/services/robot');

    aiService.createModel.mockResolvedValue({
      call: jest.fn().mockResolvedValue({ success: true, data: 'xai answer', usage: { totalTokens: 1 } })
    });

    await processTingziMessage({
      text: { content: '/经济 hello' },
      sessionWebhook: 'https://example.com/webhook',
      senderNick: 'tester'
    } as any);

    expect(createMessages).toHaveBeenCalledWith(
      expect.stringContaining('经济与投资分析师'),
      'hello'
    );
  });

  it('handles quick search prompt in Chinese', async () => {
    const { processTingziMessage } = await import('../../src/lib/services/robot');

    aiService.createModel.mockResolvedValue({
      call: jest.fn().mockResolvedValue({ success: true, data: 'xai answer', usage: { totalTokens: 1 } })
    });

    await processTingziMessage({
      text: { content: '/快速 hello' },
      sessionWebhook: 'https://example.com/webhook',
      senderNick: 'tester'
    } as any);

    expect(createMessages).toHaveBeenCalledWith(
      expect.stringContaining('高效的AI助手'),
      'hello'
    );
  });

  it('returns error response when xai call fails', async () => {
    const { processTingziMessage } = await import('../../src/lib/services/robot');

    aiService.createModel.mockResolvedValue({
      call: jest.fn().mockResolvedValue({ success: false, error: 'xai fail' })
    });

    const result = await processTingziMessage({
      text: { content: '/quick hello' },
      sessionWebhook: 'https://example.com/webhook',
      senderNick: 'tester'
    } as any);

    expect(result.aiResponse).toContain('xai fail');
  });

  it('uses fallback error when xai error message missing', async () => {
    const { processTingziMessage } = await import('../../src/lib/services/robot');

    aiService.createModel.mockResolvedValue({
      call: jest.fn().mockResolvedValue({ success: false })
    });

    const result = await processTingziMessage({
      text: { content: '/quick hello' },
      sessionWebhook: 'https://example.com/webhook',
      senderNick: 'tester'
    } as any);

    expect(result.aiResponse).toContain('xAI 调用失败');
  });

  it('handles custom service errors', async () => {
    const { processTingziMessage } = await import('../../src/lib/services/robot');

    callJinaCustom.mockRejectedValue(new Error('custom fail'));

    const result = await processTingziMessage({
      text: { content: '/jina /custom hello' },
      sessionWebhook: 'https://example.com/webhook',
      senderNick: 'tester'
    } as any);

    expect(result.aiResponse).toContain('custom fail');
  });

  it('handles custom jina service success', async () => {
    const { processTingziMessage } = await import('../../src/lib/services/robot');

    callJinaCustom.mockResolvedValue({ content: 'custom answer', cost: 0.03 });

    const result = await processTingziMessage({
      text: { content: '/吉娜 /自定义 hello' },
      sessionWebhook: 'https://example.com/webhook',
      senderNick: 'tester'
    } as any);

    expect(result.aiProvider).toBe('jina');
    expect(callJinaCustom).toHaveBeenCalledWith(
      'hello',
      expect.objectContaining({ model: 'jina-deepsearch-v1' })
    );
  });

  it('handles missing text content and empty webhook list', async () => {
    const { processTingziMessage } = await import('../../src/lib/services/robot');

    aiService.createModel.mockResolvedValue({
      call: jest.fn().mockResolvedValue({ success: true })
    });

    const result = await processTingziMessage({
      text: undefined,
      sessionWebhook: '',
      senderNick: 'tester'
    } as any);

    expect(result.aiResponse).toContain('本次回答由 xAI 提供');
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('handles non-error rejections', async () => {
    const { processTingziMessage } = await import('../../src/lib/services/robot');

    callJinaDeepSearch.mockRejectedValue('fail');

    const result = await processTingziMessage({
      text: { content: '/jina hello' },
      sessionWebhook: 'https://example.com/webhook',
      senderNick: 'tester'
    } as any);

    expect(result.aiResponse).toContain('调用 Jina AI 时发生错误');
  });

  it('logs webhook failures without throwing', async () => {
    const { processTingziMessage } = await import('../../src/lib/services/robot');

    (axios.post as jest.Mock).mockRejectedValue(new Error('fail'));
    callJinaDeepSearch.mockResolvedValue({ content: 'answer', cost: 0.05 });

    const result = await processTingziMessage({
      text: { content: '/jina hello' },
      sessionWebhook: 'https://example.com/webhook',
      senderNick: 'tester'
    } as any);

    expect(result.aiResponse).toContain('answer');
  });

  it('exposes service descriptions', async () => {
    const { getServiceTypeDescription, getAvailableServices, getAiProviderInstructions } =
      await import('../../src/lib/services/robot');

    expect(getServiceTypeDescription('deepsearch' as any)).toContain('深度搜索');
    expect(getServiceTypeDescription('economic' as any)).toContain('经济投资分析');
    expect(getServiceTypeDescription('custom' as any)).toContain('自定义服务');
    expect(getServiceTypeDescription('quick' as any)).toContain('快速搜索');
    expect(getAvailableServices()).toHaveLength(4);
    expect(getAiProviderInstructions()).toContain('xAI');
    expect(getServiceTypeDescription('unknown' as any)).toContain('未知');
  });
});

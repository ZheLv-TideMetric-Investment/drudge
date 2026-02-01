import { freezeTime } from '../helpers/fake-time';

const knowledgeGraphService = {
  processNews: jest.fn(),
  batchProcessNews: jest.fn(),
  entityService: {
    getUnprocessedNewsIds: jest.fn()
  }
};

jest.mock('../../src/services/KnowledgeGraphService', () => ({
  __esModule: true,
  default: knowledgeGraphService
}));

describe('news process api', () => {
  let restoreTime: (() => void) | undefined;

  beforeEach(() => {
    restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    knowledgeGraphService.processNews.mockReset();
    knowledgeGraphService.batchProcessNews.mockReset();
    knowledgeGraphService.entityService.getUnprocessedNewsIds.mockReset();
  });

  afterEach(() => {
    restoreTime?.();
  });

  it('rejects invalid news item', async () => {
    jest.resetModules();
    const api = await import('../../src/apis/news/process');

    const result = await api.processNews({ id: '', title: '', content: '' } as any);
    expect(result.success).toBe(false);
    expect(result.error).toContain('缺少必要的新闻数据字段');
    expect(result).toMatchSnapshot();
  });

  it('processes single news item', async () => {
    jest.resetModules();
    const api = await import('../../src/apis/news/process');

    knowledgeGraphService.processNews.mockResolvedValue({ success: true, newsId: 'news_1' });

    const result = await api.processNews({
      id: 'news_1',
      title: 'Title',
      content: 'Content'
    } as any);

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ success: true, newsId: 'news_1' });
    expect(result).toMatchSnapshot();
  });

  it('processNews returns error when graph processing throws', async () => {
    jest.resetModules();
    const api = await import('../../src/apis/news/process');

    knowledgeGraphService.processNews.mockRejectedValue(new Error('boom'));

    const result = await api.processNews({
      id: 'news_1',
      title: 'Title',
      content: 'Content'
    } as any);

    expect(result.success).toBe(false);
    expect(result.error).toBe('boom');
    expect(result).toMatchSnapshot();
  });

  it('batchProcessNews rejects empty list', async () => {
    jest.resetModules();
    const api = await import('../../src/apis/news/process');

    const result = await api.batchProcessNews([]);
    expect(result.success).toBe(false);
    expect(result.error).toContain('newsItems 必须是非空数组');
    expect(result).toMatchSnapshot();
  });

  it('batchProcessNews returns summary counts', async () => {
    jest.resetModules();
    const api = await import('../../src/apis/news/process');

    knowledgeGraphService.batchProcessNews.mockResolvedValue([
      { success: true },
      { success: false }
    ]);

    const result = await api.batchProcessNews([
      { id: '1', title: 'A', content: 'A' }
    ] as any);

    expect(result.success).toBe(true);
    expect(result.summary).toEqual({ total: 2, success: 1, failed: 1 });
    expect(result).toMatchSnapshot();
  });

  it('batchProcessNews returns error when processing throws', async () => {
    jest.resetModules();
    const api = await import('../../src/apis/news/process');

    knowledgeGraphService.batchProcessNews.mockRejectedValue(new Error('boom'));

    const result = await api.batchProcessNews([
      { id: '1', title: 'A', content: 'A' }
    ] as any);

    expect(result.success).toBe(false);
    expect(result.error).toBe('boom');
    expect(result).toMatchSnapshot();
  });

  it('checkNewsStatus validates input and returns status', async () => {
    jest.resetModules();
    const api = await import('../../src/apis/news/process');

    let result = await api.checkNewsStatus('bad' as any);
    expect(result.success).toBe(false);
    expect(result).toMatchSnapshot();

    knowledgeGraphService.entityService.getUnprocessedNewsIds.mockResolvedValue(['2']);

    result = await api.checkNewsStatus(['1', '2', '3']);
    expect(result.success).toBe(true);
    expect(result.data.processedIds).toEqual(['1', '3']);
    expect(result.data.unprocessedIds).toEqual(['2']);
    expect(result).toMatchSnapshot();
  });

  it('checkNewsStatus returns error when query fails', async () => {
    jest.resetModules();
    const api = await import('../../src/apis/news/process');

    knowledgeGraphService.entityService.getUnprocessedNewsIds.mockRejectedValue(new Error('boom'));

    const result = await api.checkNewsStatus(['1']);
    expect(result.success).toBe(false);
    expect(result.error).toBe('boom');
    expect(result).toMatchSnapshot();
  });
});

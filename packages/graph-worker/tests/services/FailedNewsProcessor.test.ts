import fs from 'fs';
import path from 'path';
import { createTempDir } from '../helpers/tmp-dir';
import { setEnv } from '../helpers/env';

const knowledgeGraphService = {
  initialized: true,
  initialize: jest.fn().mockResolvedValue(undefined),
  processNews: jest.fn()
};

jest.mock('../../src/services/KnowledgeGraphService', () => ({
  __esModule: true,
  default: knowledgeGraphService
}));

const setupProcessor = async () => {
  const temp = await createTempDir('drudge-failed-news-');
  const failedDir = path.join(temp.path, 'failed');
  await fs.promises.mkdir(failedDir, { recursive: true });

  const restoreEnv = setEnv({
    FAILED_NEWS_DIRECTORY: failedDir
  });

  jest.resetModules();
  const processor = (await import('../../src/services/FailedNewsProcessor')).default as any;

  return {
    processor,
    failedDir,
    cleanup: temp.cleanup,
    restoreEnv
  };
};

const withProcessor = async (
  fn: (ctx: Awaited<ReturnType<typeof setupProcessor>>) => Promise<void>
) => {
  const ctx = await setupProcessor();
  try {
    await fn(ctx);
  } finally {
    ctx.restoreEnv();
    await ctx.cleanup();
  }
};

const createFailedData = (id: string) => ({
  newsItem: {
    id,
    title: `Title ${id}`,
    content: 'Content',
    source: 'futu_live',
    timestamp: '2024-01-01T00:00:00.000Z'
  },
  error: {
    message: 'boom',
    stack: 'stack',
    timestamp: '2024-01-01T00:00:00.000Z',
    service: 'graph-worker'
  },
  metadata: {
    failedAt: '2024-01-01T00:00:00.000Z',
    originalId: id,
    source: 'futu_live',
    title: `Title ${id}`
  }
});

describe('FailedNewsProcessor', () => {
  beforeEach(() => {
    knowledgeGraphService.processNews.mockReset();
    knowledgeGraphService.initialize.mockClear();
    knowledgeGraphService.initialized = true;
  });

  it('parseFailedFile returns null for invalid data', async () => {
    await withProcessor(async ({ processor, failedDir }) => {
      const filePath = path.join(failedDir, 'failed_bad_2024.json');
      await fs.promises.writeFile(filePath, '{');

      const result = await processor.parseFailedFile(filePath);
      expect(result).toBeNull();
    });
  });

  it('scanFailedFiles returns empty when directory missing', async () => {
    await withProcessor(async ({ processor, failedDir }) => {
      await fs.promises.rm(failedDir, { recursive: true, force: true });
      const files = await processor.scanFailedFiles();
      expect(files).toEqual([]);
    });
  });

  it('scanFailedFiles returns empty on read errors', async () => {
    await withProcessor(async ({ processor, failedDir }) => {
      const readSpy = jest.spyOn(fs, 'readdirSync').mockImplementation(() => {
        throw new Error('boom');
      });

      const files = await processor.scanFailedFiles();
      expect(files).toEqual([]);

      readSpy.mockRestore();
    });
  });

  it('retryFailedNews reprocesses and deletes files', async () => {
    await withProcessor(async ({ processor, failedDir }) => {
      const filePath = path.join(failedDir, 'failed_news_1_2024.json');
      const failedData = createFailedData('news_1');
      await fs.promises.writeFile(filePath, JSON.stringify(failedData));

      knowledgeGraphService.processNews.mockResolvedValue({ success: true });

      const stats = await processor.retryFailedNews();

      expect(stats.total).toBe(1);
      expect(stats.successful).toBe(1);
      expect(stats.failed).toBe(0);
      expect(fs.existsSync(filePath)).toBe(false);
    });
  });

  it('retryFailedNews counts failures when reprocess fails', async () => {
    await withProcessor(async ({ processor, failedDir }) => {
      const filePath = path.join(failedDir, 'failed_news_fail_2024.json');
      const failedData = createFailedData('news_fail');
      await fs.promises.writeFile(filePath, JSON.stringify(failedData));

      knowledgeGraphService.processNews.mockResolvedValue({ success: false, error: 'fail' });

      const stats = await processor.retryFailedNews();

      expect(stats.total).toBe(1);
      expect(stats.failed).toBe(1);
      expect(stats.results[0]?.success).toBe(false);
    });
  });

  it('retryFailedNews reports empty when no files', async () => {
    await withProcessor(async ({ processor }) => {
      const stats = await processor.retryFailedNews();
      expect(stats.total).toBe(0);
      expect(stats.failed).toBe(0);
    });
  });

  it('retryFailedNews respects limit', async () => {
    await withProcessor(async ({ processor, failedDir }) => {
      const fileA = path.join(failedDir, 'failed_news_limit_a_2024.json');
      const fileB = path.join(failedDir, 'failed_news_limit_b_2024.json');
      await fs.promises.writeFile(fileA, JSON.stringify(createFailedData('news_limit_a')));
      await fs.promises.writeFile(fileB, JSON.stringify(createFailedData('news_limit_b')));

      knowledgeGraphService.processNews.mockResolvedValue({ success: true });

      const stats = await processor.retryFailedNews(1);

      expect(stats.total).toBe(1);
    });
  });

  it('retryFailedNews handles parse failures', async () => {
    await withProcessor(async ({ processor, failedDir }) => {
      const filePath = path.join(failedDir, 'failed_bad_2024.json');
      await fs.promises.writeFile(filePath, JSON.stringify({ bad: true }));

      const stats = await processor.retryFailedNews();
      expect(stats.total).toBe(1);
      expect(stats.failed).toBe(1);
      expect(stats.results[0]?.error).toBe('文件解析失败');
    });
  });

  it('reprocessSingleNews initializes graph service and handles failure', async () => {
    await withProcessor(async ({ processor, failedDir }) => {
      const filePath = path.join(failedDir, 'failed_news_2_2024.json');
      const failedData = createFailedData('news_2');
      await fs.promises.writeFile(filePath, JSON.stringify(failedData));

      knowledgeGraphService.initialized = false;
      knowledgeGraphService.processNews.mockResolvedValue({ success: false, error: 'fail' });

      const result = await processor.reprocessSingleNews(failedData, filePath);

      expect(knowledgeGraphService.initialize).toHaveBeenCalled();
      expect(result.success).toBe(false);
      expect(result.error).toBe('fail');
    });
  });

  it('reprocessSingleNews returns fallback error message', async () => {
    await withProcessor(async ({ processor, failedDir }) => {
      const filePath = path.join(failedDir, 'failed_news_2b_2024.json');
      const failedData = createFailedData('news_2b');
      await fs.promises.writeFile(filePath, JSON.stringify(failedData));

      knowledgeGraphService.processNews.mockResolvedValue({ success: false });

      const result = await processor.reprocessSingleNews(failedData, filePath);

      expect(result.success).toBe(false);
      expect(result.error).toBe('重新处理失败');
    });
  });

  it('reprocessSingleNews returns error when processing throws', async () => {
    await withProcessor(async ({ processor, failedDir }) => {
      const filePath = path.join(failedDir, 'failed_news_throw_2024.json');
      const failedData = createFailedData('news_throw');
      await fs.promises.writeFile(filePath, JSON.stringify(failedData));

      knowledgeGraphService.processNews.mockRejectedValueOnce(new Error('boom'));

      const result = await processor.reprocessSingleNews(failedData, filePath);
      expect(result.success).toBe(false);
      expect(result.error).toBe('boom');
    });
  });

  it('reprocessSingleNews handles errors without message', async () => {
    await withProcessor(async ({ processor, failedDir }) => {
      const filePath = path.join(failedDir, 'failed_news_nomsg_2024.json');
      const failedData = createFailedData('news_nomsg');
      await fs.promises.writeFile(filePath, JSON.stringify(failedData));

      knowledgeGraphService.processNews.mockRejectedValueOnce({});

      const result = await processor.reprocessSingleNews(failedData, filePath);
      expect(result.success).toBe(false);
      expect(result.error).toBe('重新处理异常');
    });
  });

  it('retryFailedNewsByIds reports missing files', async () => {
    await withProcessor(async ({ processor, failedDir }) => {
      const filePath = path.join(failedDir, 'failed_news_3_2024.json');
      const failedData = createFailedData('news_3');
      await fs.promises.writeFile(filePath, JSON.stringify(failedData));

      knowledgeGraphService.processNews.mockResolvedValue({ success: true });

      const stats = await processor.retryFailedNewsByIds(['news_3', 'missing']);

      expect(stats.total).toBe(2);
      expect(stats.successful).toBe(1);
      expect(stats.failed).toBe(1);
      expect(stats.results.some((result: { newsId: string }) => result.newsId === 'missing')).toBe(true);
    });
  });

  it('retryFailedNewsByIds counts failures when reprocess fails', async () => {
    await withProcessor(async ({ processor, failedDir }) => {
      const filePath = path.join(failedDir, 'failed_news_fail_id_2024.json');
      const failedData = createFailedData('news_fail_id');
      await fs.promises.writeFile(filePath, JSON.stringify(failedData));

      knowledgeGraphService.processNews.mockResolvedValue({ success: false, error: 'fail' });

      const stats = await processor.retryFailedNewsByIds(['news_fail_id']);

      expect(stats.failed).toBe(1);
      expect(stats.results[0]?.success).toBe(false);
    });
  });

  it('retryFailedNewsByIds handles parse failures', async () => {
    await withProcessor(async ({ processor, failedDir }) => {
      const filePath = path.join(failedDir, 'failed_news_bad_2024.json');
      await fs.promises.writeFile(filePath, JSON.stringify({ bad: true }));

      const stats = await processor.retryFailedNewsByIds(['news_bad']);
      expect(stats.failed).toBe(1);
      expect(stats.results[0]?.error).toBe('文件解析失败');
    });
  });

  it('lists failed news sorted by mtime', async () => {
    await withProcessor(async ({ processor, failedDir }) => {
      const fileA = path.join(failedDir, 'failed_news_a_2024.json');
      const fileB = path.join(failedDir, 'failed_news_b_2024.json');
      await fs.promises.writeFile(fileA, JSON.stringify(createFailedData('news_a')));
      await fs.promises.writeFile(fileB, JSON.stringify(createFailedData('news_b')));

      const oldTime = new Date(Date.now() - 1000 * 60 * 60 * 24 * 2);
      fs.utimesSync(fileA, oldTime, oldTime);

      const list = await processor.listFailedNews(2);
      expect(list).toHaveLength(2);
      expect(list[0]?.metadata.originalId).toBe('news_b');
    });
  });

  it('cleans old failed files', async () => {
    await withProcessor(async ({ processor, failedDir }) => {
      const oldFile = path.join(failedDir, 'failed_old_2024.json');
      const newFile = path.join(failedDir, 'failed_new_2024.json');
      await fs.promises.writeFile(oldFile, JSON.stringify(createFailedData('news_old')));
      await fs.promises.writeFile(newFile, JSON.stringify(createFailedData('news_new')));

      const oldTime = new Date(Date.now() - 1000 * 60 * 60 * 24 * 10);
      fs.utimesSync(oldFile, oldTime, oldTime);

      const deleted = await processor.cleanOldFailedFiles(5);
      expect(deleted).toBe(1);
      expect(fs.existsSync(oldFile)).toBe(false);
      expect(fs.existsSync(newFile)).toBe(true);
    });
  });

  it('cleans old failed files with default days', async () => {
    await withProcessor(async ({ processor, failedDir }) => {
      const oldFile = path.join(failedDir, 'failed_old_default_2024.json');
      await fs.promises.writeFile(oldFile, JSON.stringify(createFailedData('news_old_default')));

      const oldTime = new Date(Date.now() - 1000 * 60 * 60 * 24 * 31);
      fs.utimesSync(oldFile, oldTime, oldTime);

      const deleted = await processor.cleanOldFailedFiles();
      expect(deleted).toBe(1);
      expect(fs.existsSync(oldFile)).toBe(false);
    });
  });

  it('listFailedNews returns empty when no files', async () => {
    await withProcessor(async ({ processor }) => {
      const list = await processor.listFailedNews();
      expect(list).toEqual([]);
    });
  });

  it('listFailedNews handles scan errors', async () => {
    await withProcessor(async ({ processor }) => {
      const scanSpy = jest.spyOn(processor, 'scanFailedFiles').mockRejectedValueOnce(new Error('boom'));
      const list = await processor.listFailedNews();
      expect(list).toEqual([]);
      scanSpy.mockRestore();
    });
  });

  it('deleteFailedFile handles errors', async () => {
    await withProcessor(async ({ processor, failedDir }) => {
      const filePath = path.join(failedDir, 'failed_delete_2024.json');
      await fs.promises.writeFile(filePath, JSON.stringify(createFailedData('news_del')));

      knowledgeGraphService.processNews.mockResolvedValueOnce({ success: true });
      const unlinkSpy = jest.spyOn(fs, 'unlinkSync').mockImplementation(() => {
        throw new Error('unlink fail');
      });

      await processor.reprocessSingleNews(createFailedData('news_del'), filePath);

      unlinkSpy.mockRestore();
    });
  });

  it('cleans old failed files', async () => {
    await withProcessor(async ({ processor, failedDir }) => {
      const oldFile = path.join(failedDir, 'failed_old_2024.json');
      const newFile = path.join(failedDir, 'failed_new_2024.json');
      await fs.promises.writeFile(oldFile, JSON.stringify(createFailedData('news_old')));
      await fs.promises.writeFile(newFile, JSON.stringify(createFailedData('news_new')));

      const oldTime = new Date(Date.now() - 1000 * 60 * 60 * 24 * 10);
      fs.utimesSync(oldFile, oldTime, oldTime);

      const deleted = await processor.cleanOldFailedFiles(1);

      expect(deleted).toBe(1);
      expect(fs.existsSync(oldFile)).toBe(false);
      expect(fs.existsSync(newFile)).toBe(true);
    });
  });

  it('cleanOldFailedFiles handles errors', async () => {
    await withProcessor(async ({ processor }) => {
      const scanSpy = jest.spyOn(processor, 'scanFailedFiles').mockRejectedValueOnce(new Error('boom'));
      const deleted = await processor.cleanOldFailedFiles(1);
      expect(deleted).toBe(0);
      scanSpy.mockRestore();
    });
  });

  it('retryFailedNews propagates scan errors', async () => {
    await withProcessor(async ({ processor }) => {
      const scanSpy = jest.spyOn(processor, 'scanFailedFiles').mockImplementationOnce(() => {
        throw new Error('boom');
      });

      await expect(processor.retryFailedNews()).rejects.toThrow('boom');
      scanSpy.mockRestore();
    });
  });

  it('retryFailedNewsByIds propagates scan errors', async () => {
    await withProcessor(async ({ processor }) => {
      const scanSpy = jest.spyOn(processor, 'scanFailedFiles').mockImplementationOnce(() => {
        throw new Error('boom');
      });

      await expect(processor.retryFailedNewsByIds(['news_1'])).rejects.toThrow('boom');
      scanSpy.mockRestore();
    });
  });
});

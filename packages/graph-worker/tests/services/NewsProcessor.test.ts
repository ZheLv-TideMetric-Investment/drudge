import fs from 'fs';
import path from 'path';
import { createTempDir } from '../helpers/tmp-dir';
import { setEnv } from '../helpers/env';

const knowledgeGraphService = {
  initialized: false,
  initialize: jest.fn(async () => {
    knowledgeGraphService.initialized = true;
  }),
  batchProcessNews: jest.fn()
};

const notificationService = {
  sendNewsProcessingFailureNotification: jest.fn().mockResolvedValue(undefined)
};

jest.mock('../../src/services/KnowledgeGraphService', () => ({
  __esModule: true,
  default: knowledgeGraphService
}));

jest.mock('../../src/services/NotificationService', () => ({
  __esModule: true,
  default: notificationService
}));

const setupProcessor = async (envOverrides: Record<string, string> = {}) => {
  const temp = await createTempDir('drudge-graph-processor-');
  const newsDir = path.join(temp.path, 'news');
  await fs.promises.mkdir(newsDir, { recursive: true });

  const restoreEnv = setEnv({
    NEWS_DIRECTORY: newsDir,
    ...envOverrides
  });

  jest.resetModules();
  knowledgeGraphService.initialized = false;
  knowledgeGraphService.batchProcessNews.mockReset();
  notificationService.sendNewsProcessingFailureNotification.mockClear();

  const newsProcessor = await import('../../src/services/NewsProcessor');
  const fileScanner = await import('../../src/services/FileScanner');
  const markSpy = jest.spyOn(fileScanner, 'markFileAsProcessed').mockResolvedValue();

  return {
    newsDir,
    markSpy,
    restoreEnv,
    cleanup: temp.cleanup,
    ...newsProcessor
  };
};

const withProcessor = async (
  fn: (ctx: Awaited<ReturnType<typeof setupProcessor>>) => Promise<void>,
  envOverrides: Record<string, string> = {}
) => {
  const ctx = await setupProcessor(envOverrides);
  try {
    await fn(ctx);
  } finally {
    ctx.markSpy.mockRestore();
    ctx.restoreEnv();
    await ctx.cleanup();
  }
};

describe('NewsProcessor', () => {
  it('processNewsFilesInParallel converts and processes news items', async () => {
    await withProcessor(async ({ processNewsFilesInParallel, newsDir, markSpy }) => {
      const filePath = path.join(newsDir, 'futu_live_2024_01_01_00_00_00_000.json');
      const fileData = [
        { title: 'Title', content: 'Content', time: 1704067200000, source: 'futu_live' }
      ];
      await fs.promises.writeFile(filePath, JSON.stringify(fileData));
      const stats = await fs.promises.stat(filePath);

      knowledgeGraphService.batchProcessNews.mockResolvedValue([
        { success: true, newsId: 'news-1', processed_at: '2024-01-01T00:00:00.000Z' }
      ]);

      const results = await processNewsFilesInParallel([
        {
          filePath: newsDir,
          fileName: path.basename(filePath),
          fullPath: filePath,
          size: stats.size,
          modifiedTime: stats.mtime,
          isProcessed: false
        }
      ]);

      expect(results).toHaveLength(1);
      expect(results[0]?.success).toBe(true);
      expect(knowledgeGraphService.initialize).toHaveBeenCalled();
      expect(knowledgeGraphService.batchProcessNews).toHaveBeenCalledTimes(1);
      expect(markSpy).toHaveBeenCalledWith(filePath);

      const [newsItems] = knowledgeGraphService.batchProcessNews.mock.calls[0] ?? [];
      expect(newsItems).toHaveLength(1);
      expect(newsItems[0]).toMatchObject({
        title: 'Title',
        content: 'Content',
        source: 'futu_live'
      });
      expect(newsItems[0]?.timestamp).toMatch(/T.*Z/);
    });
  });

  it('supports data/list/news file formats', async () => {
    await withProcessor(async ({ processNewsFilesInParallel, newsDir, markSpy }) => {
      const fileData = path.join(newsDir, 'futu_live_2024_01_01_00_10_00_000.json');
      const fileList = path.join(newsDir, 'futu_live_2024_01_01_00_11_00_000.json');
      const fileNews = path.join(newsDir, 'futu_live_2024_01_01_00_12_00_000.json');

      await fs.promises.writeFile(
        fileData,
        JSON.stringify({ data: [{ title: 'A', content: 'A', time: 1 }] })
      );
      await fs.promises.writeFile(
        fileList,
        JSON.stringify({ list: [{ title: 'B', content: 'B', time: 2 }] })
      );
      await fs.promises.writeFile(
        fileNews,
        JSON.stringify({ news: [{ title: 'C', content: 'C', time: 3 }] })
      );

      const statsData = await fs.promises.stat(fileData);
      const statsList = await fs.promises.stat(fileList);
      const statsNews = await fs.promises.stat(fileNews);

      knowledgeGraphService.batchProcessNews.mockResolvedValue([
        { success: true, newsId: 'news-1', processed_at: '2024-01-01T00:00:00.000Z' }
      ]);

      const results = await processNewsFilesInParallel([
        {
          filePath: newsDir,
          fileName: path.basename(fileData),
          fullPath: fileData,
          size: statsData.size,
          modifiedTime: statsData.mtime,
          isProcessed: false
        },
        {
          filePath: newsDir,
          fileName: path.basename(fileList),
          fullPath: fileList,
          size: statsList.size,
          modifiedTime: statsList.mtime,
          isProcessed: false
        },
        {
          filePath: newsDir,
          fileName: path.basename(fileNews),
          fullPath: fileNews,
          size: statsNews.size,
          modifiedTime: statsNews.mtime,
          isProcessed: false
        }
      ]);

      expect(results).toHaveLength(3);
      expect(knowledgeGraphService.batchProcessNews).toHaveBeenCalledTimes(3);
      expect(markSpy).toHaveBeenCalledTimes(3);
    });
  });

  it('returns failure result on invalid json and notifies', async () => {
    await withProcessor(async ({ processNewsFilesInParallel, newsDir, markSpy }) => {
      const filePath = path.join(newsDir, 'futu_live_2024_01_01_00_00_01_000.json');
      await fs.promises.writeFile(filePath, '{');
      const stats = await fs.promises.stat(filePath);

      const results = await processNewsFilesInParallel([
        {
          filePath: newsDir,
          fileName: path.basename(filePath),
          fullPath: filePath,
          size: stats.size,
          modifiedTime: stats.mtime,
          isProcessed: false
        }
      ]);

      expect(results[0]?.success).toBe(false);
      expect(notificationService.sendNewsProcessingFailureNotification).toHaveBeenCalled();
      expect(markSpy).not.toHaveBeenCalled();
    });
  });

  it('uses fallback notification message when error lacks message', async () => {
    await withProcessor(async ({ processNewsFilesInParallel, newsDir }) => {
      const filePath = path.join(newsDir, 'futu_live_2024_01_01_00_00_01_100.json');
      await fs.promises.writeFile(filePath, '[]');
      const stats = await fs.promises.stat(filePath);

      const readSpy = jest.spyOn(fs, 'readFileSync').mockImplementation(() => {
        throw {};
      });

      const results = await processNewsFilesInParallel([
        {
          filePath: newsDir,
          fileName: path.basename(filePath),
          fullPath: filePath,
          size: stats.size,
          modifiedTime: stats.mtime,
          isProcessed: false
        }
      ]);

      expect(results[0]?.success).toBe(false);
      expect(notificationService.sendNewsProcessingFailureNotification).toHaveBeenCalledWith(
        path.basename(filePath),
        0,
        0,
        '文件处理失败'
      );

      readSpy.mockRestore();
    });
  });

  it('skips files without valid news items', async () => {
    await withProcessor(async ({ processNewsFilesInParallel, newsDir, markSpy }) => {
      const filePath = path.join(newsDir, 'futu_live_2024_01_01_00_00_02_000.json');
      const fileData = [
        { title: 'Missing content', time: 1704067200000, source: 'futu_live' }
      ];
      await fs.promises.writeFile(filePath, JSON.stringify(fileData));
      const stats = await fs.promises.stat(filePath);

      const results = await processNewsFilesInParallel([
        {
          filePath: newsDir,
          fileName: path.basename(filePath),
          fullPath: filePath,
          size: stats.size,
          modifiedTime: stats.mtime,
          isProcessed: false
        }
      ]);

      expect(results[0]?.success).toBe(true);
      expect(results[0]?.newsCount).toBe(0);
      expect(knowledgeGraphService.batchProcessNews).not.toHaveBeenCalled();
      expect(markSpy).not.toHaveBeenCalled();
    });
  });

  it('skips items missing title/headline/subject', async () => {
    await withProcessor(async ({ processNewsFilesInParallel, newsDir, markSpy }) => {
      const filePath = path.join(newsDir, 'futu_live_2024_01_01_00_00_02_500.json');
      const fileData = [
        { content: 'Only content', time: 1704067200000, source: 'futu_live' }
      ];
      await fs.promises.writeFile(filePath, JSON.stringify(fileData));
      const stats = await fs.promises.stat(filePath);

      const results = await processNewsFilesInParallel([
        {
          filePath: newsDir,
          fileName: path.basename(filePath),
          fullPath: filePath,
          size: stats.size,
          modifiedTime: stats.mtime,
          isProcessed: false
        }
      ]);

      expect(results[0]?.newsCount).toBe(0);
      expect(knowledgeGraphService.batchProcessNews).not.toHaveBeenCalled();
      expect(markSpy).not.toHaveBeenCalled();
    });
  });

  it('processNewsFilesInParallel handles rejected batch results', async () => {
    await withProcessor(async ({ processNewsFilesInParallel, newsDir }) => {
      const filePath = path.join(newsDir, 'futu_live_2024_01_01_00_00_03_000.json');
      await fs.promises.writeFile(filePath, '[]');
      const stats = await fs.promises.stat(filePath);

      const allSettledSpy = jest.spyOn(Promise, 'allSettled').mockResolvedValueOnce([
        { status: 'rejected', reason: new Error('boom') }
      ] as any);

      const results = await processNewsFilesInParallel([
        {
          filePath: newsDir,
          fileName: path.basename(filePath),
          fullPath: filePath,
          size: stats.size,
          modifiedTime: stats.mtime,
          isProcessed: false
        }
      ]);

      expect(results[0]?.success).toBe(false);
      expect(results[0]?.error).toBe('boom');
      allSettledSpy.mockRestore();
    });
  });

  it('processNewsFilesInParallel uses fallback error for unknown rejection', async () => {
    await withProcessor(async ({ processNewsFilesInParallel, newsDir }) => {
      const filePath = path.join(newsDir, 'futu_live_2024_01_01_00_00_03_100.json');
      await fs.promises.writeFile(filePath, '[]');
      const stats = await fs.promises.stat(filePath);

      const allSettledSpy = jest.spyOn(Promise, 'allSettled').mockResolvedValueOnce([
        { status: 'rejected', reason: {} }
      ] as any);

      const results = await processNewsFilesInParallel([
        {
          filePath: newsDir,
          fileName: path.basename(filePath),
          fullPath: filePath,
          size: stats.size,
          modifiedTime: stats.mtime,
          isProcessed: false
        }
      ]);

      expect(results[0]?.error).toBe('未知错误');
      allSettledSpy.mockRestore();
    });
  });

  it('processNewsFilesInParallel skips undefined file info entries', async () => {
    await withProcessor(async ({ processNewsFilesInParallel }) => {
      const results = await processNewsFilesInParallel([undefined as any]);
      expect(results).toEqual([]);
    });
  });

  it('processNewsFilesInParallel ignores extra settled results', async () => {
    await withProcessor(async ({ processNewsFilesInParallel, newsDir }) => {
      const filePath = path.join(newsDir, 'futu_live_2024_01_01_00_00_03_200.json');
      await fs.promises.writeFile(filePath, '[]');
      const stats = await fs.promises.stat(filePath);

      const allSettledSpy = jest.spyOn(Promise, 'allSettled').mockResolvedValueOnce([
        { status: 'fulfilled', value: { success: true, filePath, fileName: path.basename(filePath), newsCount: 0, processedCount: 0, processingTime: 0 } },
        { status: 'fulfilled', value: { success: true, filePath, fileName: 'extra', newsCount: 0, processedCount: 0, processingTime: 0 } }
      ] as any);

      const results = await processNewsFilesInParallel([
        {
          filePath: newsDir,
          fileName: path.basename(filePath),
          fullPath: filePath,
          size: stats.size,
          modifiedTime: stats.mtime,
          isProcessed: false
        }
      ]);

      expect(results).toHaveLength(1);
      allSettledSpy.mockRestore();
    });
  });

  it('processNewsFilesInParallel waits between batches', async () => {
    await withProcessor(async ({ processNewsFilesInParallel, newsDir }) => {
      jest.useFakeTimers();

      const fileA = path.join(newsDir, 'futu_live_2024_01_01_00_00_04_000.json');
      const fileB = path.join(newsDir, 'awtmt_live_2024_01_01_00_00_05_000.json');
      await fs.promises.writeFile(fileA, JSON.stringify([{ title: 'A', content: 'A', time: 1 }]));
      await fs.promises.writeFile(fileB, JSON.stringify([{ title: 'B', content: 'B', time: 2 }]));
      const statsA = await fs.promises.stat(fileA);
      const statsB = await fs.promises.stat(fileB);

      knowledgeGraphService.batchProcessNews.mockResolvedValue([
        { success: true, newsId: 'news-1', processed_at: '2024-01-01T00:00:00.000Z' }
      ]);

      const promise = processNewsFilesInParallel([
        {
          filePath: newsDir,
          fileName: path.basename(fileA),
          fullPath: fileA,
          size: statsA.size,
          modifiedTime: statsA.mtime,
          isProcessed: false
        },
        {
          filePath: newsDir,
          fileName: path.basename(fileB),
          fullPath: fileB,
          size: statsB.size,
          modifiedTime: statsB.mtime,
          isProcessed: false
        }
      ]);

      await jest.advanceTimersByTimeAsync(2);
      const results = await promise;

      expect(results).toHaveLength(2);

      jest.useRealTimers();
    }, { BATCH_SIZE: '1', RETRY_DELAY: '1' });
  });

  it('converts multiple timestamp formats and skips invalid items', async () => {
    await withProcessor(async ({ processNewsFilesInParallel, newsDir }) => {
      const filePath = path.join(newsDir, 'futu_live_2024_01_01_00_00_06_000.json');

      const fileData = [
        { title: 'A', content: 'A', timestamp: 1704067200000 },
        { title: 'B', content: 'B', time: 1704067200000 },
        { title: 'C', content: 'C', publishTime: 1704067200000 },
        { title: 'D', content: 'D' },
        null
      ];

      await fs.promises.writeFile(filePath, JSON.stringify(fileData));
      const stats = await fs.promises.stat(filePath);

      knowledgeGraphService.batchProcessNews.mockResolvedValue([
        { success: true, newsId: 'news-1', processed_at: '2024-01-01T00:00:00.000Z' }
      ]);

      const results = await processNewsFilesInParallel([
        {
          filePath: newsDir,
          fileName: path.basename(filePath),
          fullPath: filePath,
          size: stats.size,
          modifiedTime: stats.mtime,
          isProcessed: false
        }
      ]);

      expect(results[0]?.newsCount).toBe(3);
      const [newsItems] = knowledgeGraphService.batchProcessNews.mock.calls[0] ?? [];
      expect(newsItems[0]?.raw_time).toBe(1704067200000);
      expect(newsItems).toHaveLength(3);
    });
  });

  it('generates ids from headline and publish_time', async () => {
    await withProcessor(async ({ processNewsFilesInParallel, newsDir }) => {
      const filePath = path.join(newsDir, 'futu_live_2024_01_01_00_00_06_500.json');

      const fileData = [
        {
          headline: 'Headline',
          description: 'Desc',
          publish_time: 1704067200000,
          source: 'futu_live'
        }
      ];

      await fs.promises.writeFile(filePath, JSON.stringify(fileData));
      const stats = await fs.promises.stat(filePath);

      knowledgeGraphService.batchProcessNews.mockResolvedValue([
        { success: true, newsId: 'news-1', processed_at: '2024-01-01T00:00:00.000Z' }
      ]);

      await processNewsFilesInParallel([
        {
          filePath: newsDir,
          fileName: path.basename(filePath),
          fullPath: filePath,
          size: stats.size,
          modifiedTime: stats.mtime,
          isProcessed: false
        }
      ]);

      const [newsItems] = knowledgeGraphService.batchProcessNews.mock.calls[0] ?? [];
      expect(newsItems).toHaveLength(1);
      expect(newsItems[0]?.title).toBe('Headline');
      expect(newsItems[0]?.raw_time).toBe(1704067200000);
      expect(newsItems[0]?.id).toContain('futu_live_2024_01_01_00_00_06_500');
    });
  });

  it('uses subject when title and headline are missing', async () => {
    await withProcessor(async ({ processNewsFilesInParallel, newsDir }) => {
      const filePath = path.join(newsDir, 'futu_live_2024_01_01_00_00_06_700.json');

      const fileData = [
        {
          subject: 'Subject',
          description: 'Desc',
          time: 1704067200000,
          source: 'futu_live'
        }
      ];

      await fs.promises.writeFile(filePath, JSON.stringify(fileData));
      const stats = await fs.promises.stat(filePath);

      knowledgeGraphService.batchProcessNews.mockResolvedValue([
        { success: true, newsId: 'news-1', processed_at: '2024-01-01T00:00:00.000Z' }
      ]);

      await processNewsFilesInParallel([
        {
          filePath: newsDir,
          fileName: path.basename(filePath),
          fullPath: filePath,
          size: stats.size,
          modifiedTime: stats.mtime,
          isProcessed: false
        }
      ]);

      const [newsItems] = knowledgeGraphService.batchProcessNews.mock.calls[0] ?? [];
      expect(newsItems[0]?.title).toBe('Subject');
      expect(newsItems[0]?.id).toContain('futu_live_2024_01_01_00_00_06_700');
    });
  });

  it('returns empty for unsupported file formats', async () => {
    await withProcessor(async ({ processNewsFilesInParallel, newsDir }) => {
      const filePath = path.join(newsDir, 'futu_live_2024_01_01_00_00_07_000.json');
      await fs.promises.writeFile(filePath, JSON.stringify({ unknown: [] }));
      const stats = await fs.promises.stat(filePath);

      const results = await processNewsFilesInParallel([
        {
          filePath: newsDir,
          fileName: path.basename(filePath),
          fullPath: filePath,
          size: stats.size,
          modifiedTime: stats.mtime,
          isProcessed: false
        }
      ]);

      expect(results[0]?.newsCount).toBe(0);
    });
  });

  it('logs partial failures when some news items fail', async () => {
    await withProcessor(async ({ processNewsFilesInParallel, newsDir, markSpy }) => {
      const filePath = path.join(newsDir, 'futu_live_2024_01_01_00_00_07_500.json');
      const fileData = [
        { title: 'A', content: 'A', time: 1704067200000 },
        { title: 'B', content: 'B', time: 1704067200000 }
      ];
      await fs.promises.writeFile(filePath, JSON.stringify(fileData));
      const stats = await fs.promises.stat(filePath);

      knowledgeGraphService.batchProcessNews.mockResolvedValueOnce([
        { success: true, newsId: 'news-1' },
        { success: false, newsId: 'news-2' }
      ]);

      const results = await processNewsFilesInParallel([
        {
          filePath: newsDir,
          fileName: path.basename(filePath),
          fullPath: filePath,
          size: stats.size,
          modifiedTime: stats.mtime,
          isProcessed: false
        }
      ]);

      expect(results[0]?.processedCount).toBe(1);
      expect(markSpy).not.toHaveBeenCalled();
    });
  });

  it('handles conversion errors inside convertFileDataToNewsItems', async () => {
    await withProcessor(async ({ processNewsFilesInParallel, newsDir }) => {
      const filePath = path.join(newsDir, 'futu_live_2024_01_01_00_00_08_000.json');
      await fs.promises.writeFile(filePath, JSON.stringify([{ title: 'A', content: 'A' }]));
      const stats = await fs.promises.stat(filePath);

      const parseSpy = jest.spyOn(JSON, 'parse').mockReturnValue({
        get data() {
          throw new Error('boom');
        }
      } as any);

      const results = await processNewsFilesInParallel([
        {
          filePath: newsDir,
          fileName: path.basename(filePath),
          fullPath: filePath,
          size: stats.size,
          modifiedTime: stats.mtime,
          isProcessed: false
        }
      ]);

      expect(results[0]?.newsCount).toBe(0);
      parseSpy.mockRestore();
    });
  });

  it('handles conversion errors when logger throws', async () => {
    await withProcessor(async ({ processNewsFilesInParallel, newsDir }) => {
      const filePath = path.join(newsDir, 'futu_live_2024_01_01_00_00_08_500.json');
      await fs.promises.writeFile(filePath, '[]');
      const stats = await fs.promises.stat(filePath);

      const { logger } = await import('../../src/utils/logger');
      let debugCalls = 0;
      const debugSpy = jest.spyOn(logger, 'debug').mockImplementation(() => {
        debugCalls += 1;
        if (debugCalls === 2) {
          throw new Error('debug fail');
        }
        return logger as any;
      });

      const item: any = {};
      Object.defineProperty(item, 'title', {
        get() {
          throw new Error('boom');
        }
      });

      const parseSpy = jest.spyOn(JSON, 'parse').mockReturnValue([item] as any);

      const results = await processNewsFilesInParallel([
        {
          filePath: newsDir,
          fileName: path.basename(filePath),
          fullPath: filePath,
          size: stats.size,
          modifiedTime: stats.mtime,
          isProcessed: false
        }
      ]);

      expect(results[0]?.newsCount).toBe(0);
      parseSpy.mockRestore();
      debugSpy.mockRestore();
    });
  });

  it('returns stats snapshot from getProcessorStats', async () => {
    await withProcessor(async ({ getProcessorStats }) => {
      const stats = await getProcessorStats();
      expect(stats.service).toBe('NewsProcessor');
      expect(stats.features).toContain('并行文件处理');
    });
  });

  it('getProcessorStats propagates errors', async () => {
    const restoreEnv = setEnv({ NEWS_DIRECTORY: '/tmp' });
    jest.resetModules();
    jest.doMock('../../src/utils/timeUtils', () => ({
      __esModule: true,
      parseTime: jest.fn(),
      getCurrentTime: () => {
        throw new Error('boom');
      }
    }));

    const { getProcessorStats } = await import('../../src/services/NewsProcessor');
    await expect(getProcessorStats()).rejects.toThrow('boom');

    jest.dontMock('../../src/utils/timeUtils');
    restoreEnv();
  });

  it('handles notification failures on processing errors', async () => {
    await withProcessor(async ({ processNewsFilesInParallel, newsDir }) => {
      const filePath = path.join(newsDir, 'futu_live_2024_01_01_00_00_09_000.json');
      await fs.promises.writeFile(filePath, '{');
      const stats = await fs.promises.stat(filePath);

      notificationService.sendNewsProcessingFailureNotification.mockRejectedValueOnce(
        new Error('notify')
      );

      const results = await processNewsFilesInParallel([
        {
          filePath: newsDir,
          fileName: path.basename(filePath),
          fullPath: filePath,
          size: stats.size,
          modifiedTime: stats.mtime,
          isProcessed: false
        }
      ]);

      expect(results[0]?.success).toBe(false);
    });
  });
});

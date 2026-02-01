import fs from 'fs';
import path from 'path';
import { createTempDir } from '../helpers/tmp-dir';
import { setEnv } from '../helpers/env';
import { freezeTime } from '../helpers/fake-time';

const setupStorage = async () => {
  const temp = await createTempDir('drudge-news-');
  const restoreEnv = setEnv({
    STORAGE_PATH: temp.path,
    LOG_FILE: path.join(temp.path, 'ingest-worker.log')
  });

  jest.resetModules();
  const { FileStorage } = await import('../../src/storage/FileStorage');
  const { logger } = await import('../../src/utils/logger');
  const storage = new FileStorage();
  const dataPath = path.join(temp.path, 'news');
  await fs.promises.mkdir(dataPath, { recursive: true });

  return {
    storage,
    dataPath,
    logger,
    cleanup: temp.cleanup,
    restoreEnv
  };
};

const withStorage = async (fn: (ctx: Awaited<ReturnType<typeof setupStorage>>) => Promise<void>) => {
  const ctx = await setupStorage();
  try {
    await fn(ctx);
  } finally {
    ctx.restoreEnv();
    await ctx.cleanup();
  }
};

describe('FileStorage', () => {
  it('saveNews groups by source and writes files', async () => {
    await withStorage(async ({ storage, dataPath }) => {
      const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
      try {
        const news = [
          { id: '1', title: 'A', content: 'A', source: 'futu_live', time: 1704067200000 },
          { id: '2', title: 'B', content: 'B', source: 'awtmt_live', time: 1704067201000 },
          { id: '3', title: 'C', content: 'C', source: 'futu_live', time: 1704067202000 }
        ];

        const result = await storage.saveNews(news);
        const files = await fs.promises.readdir(dataPath);

        expect(result.split(',').map((name) => name.trim())).toHaveLength(2);
        expect(files).toHaveLength(2);
        expect(files.join(' ')).toMatch(/futu_live_\d{4}_\d{2}_\d{2}_\d{2}_\d{2}_\d{2}_\d{3}\.json/);
        expect(files.join(' ')).toMatch(/awtmt_live_\d{4}_\d{2}_\d{2}_\d{2}_\d{2}_\d{2}_\d{3}\.json/);

        const futuFile = files.find((file) => file.startsWith('futu_live_'))!;
        const awtmtFile = files.find((file) => file.startsWith('awtmt_live_'))!;

        const futuContent = JSON.parse(
          await fs.promises.readFile(path.join(dataPath, futuFile), 'utf-8')
        );
        const awtmtContent = JSON.parse(
          await fs.promises.readFile(path.join(dataPath, awtmtFile), 'utf-8')
        );

        expect(futuContent).toHaveLength(2);
        expect(awtmtContent).toHaveLength(1);
      } finally {
        restoreTime();
      }
    });
  });

  it('saveNews falls back to default source when missing', async () => {
    await withStorage(async ({ storage, dataPath }) => {
      const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
      try {
        const result = await storage.saveNews([
          { id: '1', title: 'A', content: 'A', time: 1704067200000 } as any
        ]);
        const files = await fs.promises.readdir(dataPath);

        expect(result).toContain('mixed_');
        expect(files).toHaveLength(1);
        expect(files[0]).toMatch(/^mixed_/);
      } finally {
        restoreTime();
      }
    });
  });

  it('ensureDataPath logs when mkdir fails', async () => {
    const temp = await createTempDir('drudge-news-');
    const restoreEnv = setEnv({
      STORAGE_PATH: temp.path,
      LOG_FILE: path.join(temp.path, 'ingest-worker.log')
    });

    const mkdirSpy = jest.spyOn(fs, 'mkdirSync').mockImplementationOnce(() => {
      throw new Error('mkdir failed');
    });

    jest.resetModules();
    const errorModule = await import('../../src/utils/error');
    const logSpy = jest.spyOn(errorModule, 'logErrorWithDetails');
    const { FileStorage } = await import('../../src/storage/FileStorage');

    new FileStorage();

    expect(logSpy).toHaveBeenCalled();

    mkdirSpy.mockRestore();
    restoreEnv();
    await temp.cleanup();
  });

  it('getLatestNewsId returns latest file id or null', async () => {
    await withStorage(async ({ storage, dataPath }) => {
      const fileOld = path.join(dataPath, 'futu_live_2024_01_01_00_00_00_000.json');
      const fileNew = path.join(dataPath, 'futu_live_2024_01_02_00_00_00_000.json');

      await fs.promises.writeFile(fileOld, JSON.stringify([{ id: 'old', title: 'Old', source: 'futu_live', time: 1 }]));
      await fs.promises.writeFile(fileNew, JSON.stringify([{ id: 'new', title: 'New', source: 'futu_live', time: 2 }]));

      const latestId = await storage.getLatestNewsId('futu_live');
      expect(latestId).toBe('new');

      const emptyFile = path.join(dataPath, 'futu_live_2024_01_03_00_00_00_000.json');
      await fs.promises.writeFile(emptyFile, JSON.stringify([]));

      const latestAfterEmpty = await storage.getLatestNewsId('futu_live');
      expect(latestAfterEmpty).toBeNull();
    });
  });

  it('getLatestNewsId returns null on invalid file', async () => {
    await withStorage(async ({ storage, dataPath, logger }) => {
      const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => logger);
      const fileBad = path.join(dataPath, 'futu_live_2024_01_03_00_00_00_000.json');

      await fs.promises.writeFile(fileBad, '{');

      const latestId = await storage.getLatestNewsId('futu_live');
      expect(latestId).toBeNull();
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  it('getLatestNewsId returns null when no files', async () => {
    await withStorage(async ({ storage }) => {
      const latestId = await storage.getLatestNewsId('futu_live');
      expect(latestId).toBeNull();
    });
  });

  it('getAllNews aggregates and sorts by time', async () => {
    await withStorage(async ({ storage, dataPath, logger }) => {
      const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => logger);

      const fileA = path.join(dataPath, 'futu_live_2024_01_01_00_00_00_000.json');
      const fileB = path.join(dataPath, 'awtmt_live_2024_01_02_00_00_00_000.json');
      const fileBad = path.join(dataPath, 'bad_2024_01_03_00_00_00_000.json');

      await fs.promises.writeFile(fileA, JSON.stringify([{ id: '1', title: 'A', source: 'futu_live', time: 10 }]));
      await fs.promises.writeFile(fileB, JSON.stringify([{ id: '2', title: 'B', source: 'awtmt_live', time: 20 }]));
      await fs.promises.writeFile(fileBad, '{');

      const allNews = await storage.getAllNews();
      expect(allNews.map((item) => item.id)).toEqual(['2', '1']);
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  it('getAllNews returns empty when listing fails', async () => {
    await withStorage(async ({ storage }) => {
      const readdirSpy = jest.spyOn(fs.promises, 'readdir').mockRejectedValueOnce(new Error('boom'));

      const allNews = await storage.getAllNews();
      expect(allNews).toEqual([]);

      readdirSpy.mockRestore();
    });
  });

  it('getNewsByLimit respects boundaries', async () => {
    await withStorage(async ({ storage, dataPath }) => {
      const file = path.join(dataPath, 'futu_live_2024_01_01_00_00_00_000.json');
      const items = [
        { id: '1', title: 'A', source: 'futu_live', time: 10 },
        { id: '2', title: 'B', source: 'futu_live', time: 9 }
      ];
      await fs.promises.writeFile(file, JSON.stringify(items));

      expect(await storage.getNewsByLimit(0)).toHaveLength(0);
      expect(await storage.getNewsByLimit(1)).toHaveLength(1);
      expect(await storage.getNewsByLimit(10)).toHaveLength(2);
    });
  });

  it('getNewsByTimeRange filters by time range', async () => {
    await withStorage(async ({ storage, dataPath }) => {
      const file = path.join(dataPath, 'futu_live_2024_01_01_00_00_00_000.json');
      const start = new Date('2024-01-01T00:00:00.000Z');
      const end = new Date('2024-01-02T00:00:00.000Z');

      const items = [
        { id: 'before', title: 'Before', source: 'futu_live', time: start.getTime() },
        { id: 'inside', title: 'Inside', source: 'futu_live', time: start.getTime() + 3600 * 1000 },
        { id: 'inside2', title: 'Inside2', source: 'futu_live', time: start.getTime() + 7200 * 1000 },
        { id: 'after', title: 'After', source: 'futu_live', time: end.getTime() }
      ];

      await fs.promises.writeFile(file, JSON.stringify(items));

      const results = await storage.getNewsByTimeRange(start, end);
      expect(results.map((item) => item.id)).toEqual(['inside2', 'inside']);
    });
  });

  it('getNewsByTimeRange skips invalid files', async () => {
    await withStorage(async ({ storage, dataPath, logger }) => {
      const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => logger);
      const fileGood = path.join(dataPath, 'futu_live_2024_01_01_00_00_00_000.json');
      const fileBad = path.join(dataPath, 'bad_2024_01_01_00_00_00_000.json');
      const start = new Date('2024-01-01T00:00:00.000Z');
      const end = new Date('2024-01-02T00:00:00.000Z');

      await fs.promises.writeFile(fileGood, JSON.stringify([
        { id: 'inside', title: 'Inside', source: 'futu_live', time: start.getTime() + 3600 * 1000 }
      ]));
      await fs.promises.writeFile(fileBad, '{');

      const results = await storage.getNewsByTimeRange(start, end);

      expect(results.map((item) => item.id)).toEqual(['inside']);
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  it('getNewsByTimeRange returns empty when listing fails', async () => {
    await withStorage(async ({ storage, logger }) => {
      const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => logger);
      jest.spyOn(storage as any, 'getNewsFiles').mockRejectedValueOnce(new Error('boom'));

      const results = await storage.getNewsByTimeRange(new Date(), new Date());
      expect(results).toEqual([]);
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  it('getNewsStats returns totals by day and source', async () => {
    await withStorage(async ({ storage, dataPath }) => {
      const restoreTime = freezeTime('2024-01-04T12:00:00.000Z');
      try {
        const fileA = path.join(dataPath, 'futu_live_2024_01_04_00_00_00_000.json');
        const fileB = path.join(dataPath, 'awtmt_live_2024_01_01_00_00_00_000.json');

        const today = new Date('2024-01-04T01:00:00.000Z').getTime();
        const recent = new Date('2024-01-02T01:00:00.000Z').getTime();
        const old = new Date('2023-12-31T01:00:00.000Z').getTime();

        await fs.promises.writeFile(
          fileA,
          JSON.stringify([
            { id: '1', title: 'Today', source: 'futu_live', time: today },
            { id: '2', title: 'Recent', source: 'futu_live', time: recent }
          ])
        );
        await fs.promises.writeFile(
          fileB,
          JSON.stringify([{ id: '3', title: 'Old', source: 'awtmt_live', time: old }])
        );

        const stats = await storage.getNewsStats();
        expect(stats.totalCount).toBe(3);
        expect(stats.todayCount).toBe(1);
        expect(stats.recentCount).toBe(2);
        expect(stats.sourceStats).toEqual({ futu_live: 2, awtmt_live: 1 });
        expect(stats.sources.sort()).toEqual(['awtmt_live', 'futu_live']);
      } finally {
        restoreTime();
      }
    });
  });

  it('getNewsStats uses unknown source when missing', async () => {
    await withStorage(async ({ storage, dataPath }) => {
      const restoreTime = freezeTime('2024-01-04T12:00:00.000Z');
      try {
        const file = path.join(dataPath, 'futu_live_2024_01_04_00_00_00_000.json');
        await fs.promises.writeFile(
          file,
          JSON.stringify([{ id: '1', title: 'Today', time: Date.now() }])
        );

        const stats = await storage.getNewsStats();
        expect(stats.totalCount).toBe(1);
        expect(stats.sourceStats).toEqual({ unknown: 1 });
      } finally {
        restoreTime();
      }
    });
  });

  it('getNewsStats skips invalid files', async () => {
    await withStorage(async ({ storage, dataPath, logger }) => {
      const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => logger);
      const fileGood = path.join(dataPath, 'futu_live_2024_01_04_00_00_00_000.json');
      const fileBad = path.join(dataPath, 'bad_2024_01_05_00_00_00_000.json');

      await fs.promises.writeFile(fileGood, JSON.stringify([
        { id: '1', title: 'Today', source: 'futu_live', time: Date.now() }
      ]));
      await fs.promises.writeFile(fileBad, '{');

      const stats = await storage.getNewsStats();

      expect(stats.totalCount).toBe(1);
      expect(warnSpy).toHaveBeenCalled();
    });
  });

  it('getNewsStats returns empty stats when listing fails', async () => {
    await withStorage(async ({ storage, logger }) => {
      const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => logger);
      jest.spyOn(storage as any, 'getNewsFiles').mockRejectedValueOnce(new Error('boom'));

      const stats = await storage.getNewsStats();

      expect(stats).toEqual({
        totalCount: 0,
        todayCount: 0,
        recentCount: 0,
        fileCount: 0,
        sourceStats: {},
        sources: []
      });
      expect(errorSpy).toHaveBeenCalled();
    });
  });

  it('getNewsFiles filters by source and extension', async () => {
    await withStorage(async ({ storage, dataPath }) => {
      const files = [
        'futu_live_2024_01_02_00_00_00_000.json',
        'futu_live_2024_01_01_00_00_00_000.json',
        'awtmt_live_2024_01_01_00_00_00_000.json',
        'notes.txt'
      ];

      for (const file of files) {
        const fullPath = path.join(dataPath, file);
        await fs.promises.writeFile(fullPath, JSON.stringify([{ id: file, title: file, source: 'futu_live', time: 1 }]));
      }

      const allFiles = await (storage as any).getNewsFiles();
      const futuFiles = await (storage as any).getNewsFiles('futu_live');

      expect(allFiles).toEqual([...allFiles].sort((a: string, b: string) => b.localeCompare(a)));
      expect(allFiles).toHaveLength(3);
      expect(futuFiles).toEqual([...futuFiles].sort((a: string, b: string) => b.localeCompare(a)));
      expect(futuFiles).toHaveLength(2);
      expect(futuFiles.every((file: string) => file.startsWith('futu_live_'))).toBe(true);
    });
  });

  it('cleanOldFiles removes files older than threshold', async () => {
    await withStorage(async ({ storage, dataPath }) => {
      const restoreTime = freezeTime('2024-01-10T00:00:00.000Z');
      try {
        const oldFile = path.join(dataPath, 'futu_live_2024_01_01_00_00_00_000.json');
        const newFile = path.join(dataPath, 'futu_live_2024_01_09_00_00_00_000.json');

        await fs.promises.writeFile(oldFile, JSON.stringify([{ id: 'old', title: 'Old', source: 'futu_live', time: 1 }]));
        await fs.promises.writeFile(newFile, JSON.stringify([{ id: 'new', title: 'New', source: 'futu_live', time: 1 }]));

        const oldTime = new Date('2024-01-01T00:00:00.000Z');
        const newTime = new Date('2024-01-09T00:00:00.000Z');
        await fs.promises.utimes(oldFile, oldTime, oldTime);
        await fs.promises.utimes(newFile, newTime, newTime);

        const result = await storage.cleanOldFiles(3);
        const remaining = await fs.promises.readdir(dataPath);

        expect(result.deletedCount).toBe(1);
        expect(result.remainingCount).toBe(1);
        expect(remaining).toEqual([path.basename(newFile)]);
      } finally {
        restoreTime();
      }
    });
  });

  it('cleanOldFiles skips files that fail to read', async () => {
    await withStorage(async ({ storage, dataPath, logger }) => {
      const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => logger);
      const file = path.join(dataPath, 'futu_live_2024_01_01_00_00_00_000.json');
      await fs.promises.writeFile(file, JSON.stringify([{ id: 'old', title: 'Old', source: 'futu_live', time: 1 }]));

      const statSpy = jest.spyOn(fs.promises, 'stat').mockRejectedValueOnce(new Error('boom'));

      const result = await storage.cleanOldFiles(7);

      expect(result.deletedCount).toBe(0);
      expect(result.remainingCount).toBe(0);
      expect(warnSpy).toHaveBeenCalled();

      statSpy.mockRestore();
    });
  });

  it('cleanOldFiles throws when listing fails', async () => {
    await withStorage(async ({ storage }) => {
      jest.spyOn(storage as any, 'getNewsFiles').mockRejectedValueOnce(new Error('boom'));

      await expect(storage.cleanOldFiles()).rejects.toThrow('boom');
    });
  });

  it('saveNews notifies and throws on write failure', async () => {
    await withStorage(async ({ storage }) => {
      const { default: notificationService } = await import('../../src/services/NotificationService');
      const notifySpy = jest.spyOn(notificationService, 'sendFileSaveFailureNotification').mockResolvedValue();

      const writeMock = fs.promises.writeFile as unknown as jest.Mock;
      writeMock.mockRejectedValueOnce(new Error('disk full'));

      await expect(
        storage.saveNews([{ id: '1', title: 'A', source: 'futu_live', time: 1 }])
      ).rejects.toThrow('disk full');
      expect(notifySpy).toHaveBeenCalled();
    });
  });

  it('saveNews uses fallback message when error has no detail', async () => {
    await withStorage(async ({ storage }) => {
      const { default: notificationService } = await import('../../src/services/NotificationService');
      const notifySpy = jest.spyOn(notificationService, 'sendFileSaveFailureNotification').mockResolvedValue();

      const writeSpy = jest.spyOn(fs.promises, 'writeFile').mockRejectedValueOnce(new Error(''));

      await expect(
        storage.saveNews([{ id: '1', title: 'A', source: 'futu_live', time: 1 }])
      ).rejects.toThrow();

      const [, , message] = notifySpy.mock.calls[0];
      expect(message).toBe('文件写入失败');

      writeSpy.mockRestore();
      notifySpy.mockRestore();
    });
  });

  it('saveNews logs when notification fails', async () => {
    await withStorage(async ({ storage, logger }) => {
      const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => logger);
      const { default: notificationService } = await import('../../src/services/NotificationService');
      jest.spyOn(notificationService, 'sendFileSaveFailureNotification').mockRejectedValueOnce(
        new Error('notify failed')
      );

      const writeMock = fs.promises.writeFile as unknown as jest.Mock;
      writeMock.mockRejectedValueOnce(new Error('disk full'));

      await expect(
        storage.saveNews([{ id: '1', title: 'A', source: 'futu_live', time: 1 }])
      ).rejects.toThrow('disk full');
      expect(errorSpy).toHaveBeenCalled();
    });
  });
});

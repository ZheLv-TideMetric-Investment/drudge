import fs from 'fs';
import path from 'path';
import { createTempDir } from '../helpers/tmp-dir';
import { setEnv } from '../helpers/env';
import { freezeTime } from '../helpers/fake-time';

const setupScanner = async () => {
  const temp = await createTempDir('drudge-graph-news-');
  const newsDir = path.join(temp.path, 'news');
  await fs.promises.mkdir(newsDir, { recursive: true });

  const restoreEnv = setEnv({
    NEWS_DIRECTORY: newsDir
  });

  jest.resetModules();
  const scanner = await import('../../src/services/FileScanner');

  return {
    ...scanner,
    newsDir,
    cleanup: temp.cleanup,
    restoreEnv
  };
};

const withScanner = async (fn: (ctx: Awaited<ReturnType<typeof setupScanner>>) => Promise<void>) => {
  const ctx = await setupScanner();
  try {
    await fn(ctx);
  } finally {
    ctx.restoreEnv();
    await ctx.cleanup();
  }
};

describe('FileScanner', () => {
  it('scanUnprocessedFiles filters unsupported and processed files', async () => {
    await withScanner(async ({ scanUnprocessedFiles, newsDir }) => {
      const fileA = path.join(newsDir, 'futu_live_2024_01_01_00_00_00_000.json');
      const fileB = path.join(newsDir, 'awtmt_live_2024_01_01_00_00_01_000.json');
      const fileC = path.join(newsDir, 'futu_live_2024_01_01_00_00_02_000.json');
      const ignored = path.join(newsDir, 'notes.txt');
      const unsupported = path.join(newsDir, 'other_2024_01_01.json');

      await fs.promises.writeFile(fileA, '[]');
      await fs.promises.writeFile(fileB, '[]');
      await fs.promises.writeFile(fileC, '[]');
      await fs.promises.writeFile(ignored, '');
      await fs.promises.writeFile(unsupported, '[]');

      const processedDir = path.join(newsDir, '.processed');
      await fs.promises.mkdir(processedDir, { recursive: true });
      const recordFile = path.join(processedDir, `${path.basename(fileA)}.processed`);
      await fs.promises.writeFile(recordFile, JSON.stringify({ fileName: path.basename(fileA) }));

      const fileTime = new Date('2024-01-01T00:00:00.000Z');
      const fileBTime = new Date('2024-01-01T00:00:01.000Z');
      const fileCTime = new Date('2024-01-01T00:00:02.000Z');
      const recordTime = new Date('2024-01-01T00:10:00.000Z');
      fs.utimesSync(fileA, fileTime, fileTime);
      fs.utimesSync(fileB, fileBTime, fileBTime);
      fs.utimesSync(fileC, fileCTime, fileCTime);
      fs.utimesSync(recordFile, recordTime, recordTime);

      const results = await scanUnprocessedFiles();

      expect(results.map((item) => item.fileName)).toEqual([
        path.basename(fileC),
        path.basename(fileB)
      ]);
    });
  });

  it('scanUnprocessedFiles returns empty when directory missing', async () => {
    await withScanner(async ({ scanUnprocessedFiles, newsDir }) => {
      await fs.promises.rm(newsDir, { recursive: true, force: true });
      const results = await scanUnprocessedFiles();
      expect(results).toEqual([]);
    });
  });

  it('scanUnprocessedFiles skips non-file entries and handles errors', async () => {
    await withScanner(async ({ scanUnprocessedFiles, newsDir }) => {
      const dirEntry = path.join(newsDir, 'futu_live_dir.json');
      await fs.promises.mkdir(dirEntry, { recursive: true });

      const results = await scanUnprocessedFiles();
      expect(results).toEqual([]);

      const readSpy = jest.spyOn(fs, 'readdirSync').mockImplementation(() => {
        throw new Error('boom');
      });

      await expect(scanUnprocessedFiles()).rejects.toThrow('boom');
      readSpy.mockRestore();
    });
  });

  it('scanUnprocessedFiles treats file as unprocessed when processed check fails', async () => {
    await withScanner(async ({ scanUnprocessedFiles, newsDir }) => {
      const filePath = path.join(newsDir, 'futu_live_2024_01_01_00_00_00_000.json');
      await fs.promises.writeFile(filePath, '[]');

      const processedDir = path.join(newsDir, '.processed');
      await fs.promises.mkdir(processedDir, { recursive: true });
      const recordFile = path.join(processedDir, `${path.basename(filePath)}.processed`);
      await fs.promises.writeFile(recordFile, JSON.stringify({ fileName: path.basename(filePath) }));

      const originalStat = fs.statSync;
      const statSpy = jest.spyOn(fs, 'statSync').mockImplementation((target: any) => {
        if (String(target).includes('.processed')) {
          throw new Error('stat fail');
        }
        return originalStat(target as any);
      });

      const results = await scanUnprocessedFiles();
      expect(results.map(item => item.fileName)).toContain(path.basename(filePath));

      statSpy.mockRestore();
    });
  });

  it('markFileAsProcessed writes processed record', async () => {
    await withScanner(async ({ markFileAsProcessed, newsDir }) => {
      const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
      const filePath = path.join(newsDir, 'futu_live_2024_01_01_00_00_00_000.json');

      try {
        await fs.promises.writeFile(filePath, '[]');
        await markFileAsProcessed(filePath);

        const recordPath = path.join(newsDir, '.processed', `${path.basename(filePath)}.processed`);
        const record = JSON.parse(await fs.promises.readFile(recordPath, 'utf-8'));

        expect(record.fileName).toBe(path.basename(filePath));
        expect(record.processedBy).toBe('graph-worker');
        expect(record.processedAt).toBe('2024-01-01T00:00:00.000Z');
      } finally {
        restoreTime();
      }
    });
  });

  it('markFileAsProcessed surfaces errors', async () => {
    await withScanner(async ({ markFileAsProcessed, newsDir }) => {
      const filePath = path.join(newsDir, 'futu_live_2024_01_01_00_00_02_000.json');
      await fs.promises.writeFile(filePath, '[]');

      const writeSpy = jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {
        throw new Error('write fail');
      });

      await expect(markFileAsProcessed(filePath)).rejects.toThrow('write fail');
      writeSpy.mockRestore();
    });
  });

  it('getFileProcessingStats returns totals', async () => {
    await withScanner(async ({ getFileProcessingStats, newsDir }) => {
      const fileA = path.join(newsDir, 'futu_live_2024_01_01_00_00_00_000.json');
      const fileB = path.join(newsDir, 'awtmt_live_2024_01_01_00_00_01_000.json');

      await fs.promises.writeFile(fileA, '[]');
      await fs.promises.writeFile(fileB, '[]');

      const processedDir = path.join(newsDir, '.processed');
      await fs.promises.mkdir(processedDir, { recursive: true });
      const recordFile = path.join(processedDir, `${path.basename(fileA)}.processed`);
      await fs.promises.writeFile(recordFile, JSON.stringify({ fileName: path.basename(fileA) }));

      const fileTime = new Date('2024-01-01T00:00:00.000Z');
      const recordTime = new Date('2024-01-01T00:10:00.000Z');
      fs.utimesSync(fileA, fileTime, fileTime);
      fs.utimesSync(recordFile, recordTime, recordTime);

      const stats = await getFileProcessingStats();

      expect(stats.totalFiles).toBe(2);
      expect(stats.processedFiles).toBe(1);
      expect(stats.unprocessedFiles).toBe(1);
      expect(stats.lastScanTime).toBeDefined();
    });
  });

  it('getFileProcessingStats returns empty when directory missing', async () => {
    await withScanner(async ({ getFileProcessingStats, newsDir }) => {
      await fs.promises.rm(newsDir, { recursive: true, force: true });
      const stats = await getFileProcessingStats();
      expect(stats.totalFiles).toBe(0);
    });
  });

  it('getFileProcessingStats surfaces errors', async () => {
    await withScanner(async ({ getFileProcessingStats }) => {
      const readSpy = jest.spyOn(fs, 'readdirSync').mockImplementation(() => {
        throw new Error('boom');
      });

      await expect(getFileProcessingStats()).rejects.toThrow('boom');
      readSpy.mockRestore();
    });
  });
});

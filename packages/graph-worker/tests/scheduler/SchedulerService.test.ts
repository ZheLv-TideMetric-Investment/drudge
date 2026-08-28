const scanUnprocessedFiles = jest.fn();
const processNewsFilesInParallel = jest.fn();
const graphConfig = {
  processing: {
    maxFilesPerScan: 200,
  },
  logging: {
    level: 'silent',
    format: 'combined',
  },
};

jest.mock('../../src/config/config', () => ({
  __esModule: true,
  default: graphConfig,
}));

jest.mock('../../src/services/FileScanner', () => ({
  scanUnprocessedFiles,
}));

jest.mock('../../src/services/NewsProcessor', () => ({
  processNewsFilesInParallel,
}));

import { SchedulerService } from '../../src/scheduler';

describe('SchedulerService', () => {
  beforeEach(() => {
    scanUnprocessedFiles.mockReset();
    processNewsFilesInParallel.mockReset();
    graphConfig.processing.maxFilesPerScan = 200;
  });

  it('limits each scan and reports the remaining backlog', async () => {
    const service = new SchedulerService();
    const files = [
      { fileName: 'newest.json' },
      { fileName: 'newer.json' },
      { fileName: 'older.json' },
    ];
    graphConfig.processing.maxFilesPerScan = 2;
    scanUnprocessedFiles.mockResolvedValue(files);
    processNewsFilesInParallel.mockResolvedValue([{ success: true }, { success: false }]);

    const result = await service.triggerManualScan();

    expect(processNewsFilesInParallel).toHaveBeenCalledWith(files.slice(0, 2));
    expect(result).toMatchObject({
      success: true,
      processed: 1,
      failed: 1,
      total: 2,
      remaining: 1,
    });
  });

  it('skips a scan while another scan is still running', async () => {
    const service = new SchedulerService();
    (service as any).isProcessing = true;

    const result = await service.triggerManualScan();

    expect(result).toMatchObject({
      success: true,
      processed: 0,
      skipped: true,
    });
    expect(scanUnprocessedFiles).not.toHaveBeenCalled();
  });

  it('releases the processing lock after a scan error', async () => {
    const service = new SchedulerService();
    scanUnprocessedFiles.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce([]);

    await expect(service.triggerManualScan()).resolves.toMatchObject({
      success: false,
      error: 'boom',
    });
    await expect(service.triggerManualScan()).resolves.toMatchObject({
      success: true,
      processed: 0,
    });
  });
});

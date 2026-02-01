const createUsage = (heapUsedMB: number, heapTotalMB = heapUsedMB + 10) => ({
  heapUsed: heapUsedMB * 1024 * 1024,
  heapTotal: heapTotalMB * 1024 * 1024,
  external: 5 * 1024 * 1024,
  rss: 50 * 1024 * 1024,
  arrayBuffers: 0
});

const setupMonitor = async (overrides: Record<string, unknown> = {}) => {
  jest.resetModules();

  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  };

  const config = {
    processing: {
      memory: {
        warningThreshold: 0.5,
        dangerThreshold: 0.8,
        maxHeapSizeMB: 100,
        monitoringIntervalMs: 1000,
        enableAutoGC: true,
        ...overrides
      }
    }
  };

  jest.doMock('../../src/utils/logger', () => ({ logger }));
  jest.doMock('../../src/config/config', () => ({
    __esModule: true,
    default: config
  }));

  const { MemoryMonitor } = await import('../../src/utils/memoryMonitor');
  return { monitor: new MemoryMonitor(), logger };
};

describe('MemoryMonitor', () => {
  const originalGc = global.gc;

  afterEach(() => {
    global.gc = originalGc;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('starts and stops monitoring with normal usage', async () => {
    jest.useFakeTimers();
    const memorySpy = jest.spyOn(process, 'memoryUsage').mockReturnValue(createUsage(10, 20));
    const { monitor, logger } = await setupMonitor({ enableAutoGC: false });

    monitor.startMonitoring(500);
    monitor.startMonitoring(500);
    await jest.runOnlyPendingTimersAsync();
    monitor.stopMonitoring();

    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('开始内存监控'));
    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('内存使用正常'));
    expect(logger.info).toHaveBeenCalledWith('⏹️ 内存监控已停止');

    memorySpy.mockRestore();
  });

  it('uses default interval when none provided', async () => {
    jest.useFakeTimers();
    const memorySpy = jest.spyOn(process, 'memoryUsage').mockReturnValue(createUsage(10, 20));
    const { monitor, logger } = await setupMonitor({ enableAutoGC: false });

    monitor.startMonitoring();
    await jest.runOnlyPendingTimersAsync();
    monitor.stopMonitoring();

    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('间隔: 1000ms'));

    memorySpy.mockRestore();
  });

  it('logs warning when usage exceeds warning threshold', async () => {
    jest.useFakeTimers();
    const memorySpy = jest.spyOn(process, 'memoryUsage').mockReturnValue(createUsage(60, 80));
    const { monitor, logger } = await setupMonitor({ enableAutoGC: false });

    monitor.startMonitoring(500);
    monitor.stopMonitoring();

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('内存使用较高'));

    memorySpy.mockRestore();
  });

  it('triggers gc on warning when auto gc enabled', async () => {
    jest.useFakeTimers();
    const memorySpy = jest.spyOn(process, 'memoryUsage').mockReturnValue(createUsage(60, 80));
    const { monitor } = await setupMonitor({ enableAutoGC: true });

    global.gc = jest.fn();

    monitor.startMonitoring(500);
    await jest.runOnlyPendingTimersAsync();
    monitor.stopMonitoring();

    expect(global.gc).toHaveBeenCalled();

    memorySpy.mockRestore();
  });

  it('logs danger and triggers gc and alert when usage high', async () => {
    jest.useFakeTimers();
    const memorySpy = jest
      .spyOn(process, 'memoryUsage')
      .mockReturnValueOnce(createUsage(90, 110))
      .mockReturnValueOnce(createUsage(90, 110))
      .mockReturnValueOnce(createUsage(70, 110))
      .mockReturnValue(createUsage(70, 110));

    const { monitor, logger } = await setupMonitor({ enableAutoGC: true });

    global.gc = jest.fn();

    monitor.startMonitoring(500);
    monitor.stopMonitoring();

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('内存使用达到危险水平'));
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('内存告警通知'));
    expect(global.gc).toHaveBeenCalled();

    memorySpy.mockRestore();
  });

  it('forceGarbageCollection warns when gc unavailable', async () => {
    const { monitor, logger } = await setupMonitor({ enableAutoGC: true });

    global.gc = undefined;

    monitor.forceGarbageCollection();

    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('垃圾回收功能未启用'));
  });

  it('forceGarbageCollection logs when auto gc disabled', async () => {
    const { monitor, logger } = await setupMonitor({ enableAutoGC: false });

    global.gc = jest.fn();

    monitor.forceGarbageCollection();

    expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('自动垃圾回收已禁用'));
  });

  it('builds memory report', async () => {
    const memorySpy = jest.spyOn(process, 'memoryUsage').mockReturnValue(createUsage(40, 80));
    const { monitor } = await setupMonitor({ enableAutoGC: true });

    const report = monitor.getMemoryReport();

    expect(report).toContain('内存使用报告');
    expect(report).toContain('状态');
    expect(report).toContain('自动垃圾回收');

    memorySpy.mockRestore();
  });

  it('builds warning and danger memory reports', async () => {
    const warningSpy = jest.spyOn(process, 'memoryUsage').mockReturnValue(createUsage(60, 80));
    const { monitor } = await setupMonitor({ enableAutoGC: true });

    const warningReport = monitor.getMemoryReport();
    expect(warningReport).toContain('⚠️ 警告');

    warningSpy.mockRestore();

    const dangerSpy = jest.spyOn(process, 'memoryUsage').mockReturnValue(createUsage(90, 100));
    const dangerReport = monitor.getMemoryReport();
    expect(dangerReport).toContain('🚨 危险');

    dangerSpy.mockRestore();
  });

  it('builds memory report when auto gc disabled', async () => {
    const memorySpy = jest.spyOn(process, 'memoryUsage').mockReturnValue(createUsage(40, 80));
    const { monitor } = await setupMonitor({ enableAutoGC: false });

    const report = monitor.getMemoryReport();
    expect(report).toContain('❌ 禁用');

    memorySpy.mockRestore();
  });

  it('handles errors when sending memory alerts', async () => {
    const { monitor, logger } = await setupMonitor({ enableAutoGC: true });

    const stats: any = {
      heapUsed: 1,
      heapTotal: 1,
      external: 0,
      rss: 0,
      usagePercentage: 1,
      timestamp: { toISOString: () => { throw new Error('boom'); } }
    };

    await (monitor as any).sendMemoryAlert('danger', stats);
    expect(logger.error).toHaveBeenCalledWith('发送内存告警失败:', expect.any(Error));
  });

  it('sends warning memory alert messages', async () => {
    const { monitor, logger } = await setupMonitor({ enableAutoGC: true });

    const stats: any = {
      heapUsed: 50 * 1024 * 1024,
      heapTotal: 100 * 1024 * 1024,
      external: 0,
      rss: 0,
      usagePercentage: 0.5,
      timestamp: new Date('2024-01-01T00:00:00.000Z')
    };

    await (monitor as any).sendMemoryAlert('warning', stats);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('内存使用警告'));
  });
});

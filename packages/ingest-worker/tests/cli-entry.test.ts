const execute = jest.fn();
const logErrorWithDetails = jest.fn();
const logger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};

jest.mock('../src/cli', () => ({
  __esModule: true,
  default: { execute }
}));

jest.mock('../src/utils/error', () => ({
  logErrorWithDetails
}));

jest.mock('../src/utils/logger', () => ({
  logger
}));

const flushPromises = () => new Promise<void>((resolve) => {
  process.nextTick(resolve);
});

describe('cli-entry', () => {
  const originalArgv = process.argv;

  beforeEach(() => {
    execute.mockReset();
    logErrorWithDetails.mockReset();
    logger.info.mockReset();
    logger.error.mockReset();
    logger.warn.mockReset();
    logger.debug.mockReset();
    process.argv = [...originalArgv];
  });

  afterEach(() => {
    process.argv = originalArgv;
    jest.restoreAllMocks();
  });

  it('executes command and exits 0', async () => {
    process.argv = ['node', 'cli-entry', 'status', '--verbose'];
    execute.mockResolvedValue(undefined);

    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

    jest.resetModules();
    require('../src/cli-entry');
    await flushPromises();

    expect(execute).toHaveBeenCalledWith('status', '--verbose');
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('defaults to help command when no args', async () => {
    process.argv = ['node', 'cli-entry'];
    execute.mockResolvedValue(undefined);

    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

    jest.resetModules();
    require('../src/cli-entry');
    await flushPromises();

    expect(execute).toHaveBeenCalledWith('help');
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('logs error and exits 1 when command fails', async () => {
    process.argv = ['node', 'cli-entry', 'fetch'];
    execute.mockRejectedValue(new Error('boom'));

    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

    jest.resetModules();
    require('../src/cli-entry');
    await flushPromises();

    expect(logErrorWithDetails).toHaveBeenCalledWith('CLI启动失败:', expect.any(Error));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('logs error and exits 1 when initialization fails', async () => {
    process.argv = ['node', 'cli-entry', 'status'];
    execute.mockResolvedValue(undefined);
    logger.info.mockImplementationOnce(() => {
      throw new Error('init failed');
    });

    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

    jest.resetModules();
    require('../src/cli-entry');
    await flushPromises();

    expect(logErrorWithDetails).toHaveBeenCalledWith('❌ 服务初始化失败:', expect.any(Error));
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});

const runCLI = jest.fn();
const logger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
};

jest.mock('../src/cli/index', () => ({
  __esModule: true,
  runCLI
}));

jest.mock('../src/utils/logger', () => ({
  logger
}));

const flushPromises = () => new Promise<void>((resolve) => {
  process.nextTick(resolve);
});

describe('cli-entry', () => {
  beforeEach(() => {
    runCLI.mockReset();
    logger.info.mockReset();
    logger.error.mockReset();
    logger.warn.mockReset();
    logger.debug.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('runs CLI and exits 0', async () => {
    runCLI.mockResolvedValue(undefined);

    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

    jest.resetModules();
    require('../src/cli-entry');
    await flushPromises();

    expect(runCLI).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('logs error and exits 1 when CLI fails', async () => {
    runCLI.mockRejectedValue(new Error('boom'));

    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as never);

    jest.resetModules();
    require('../src/cli-entry');
    await flushPromises();

    expect(logger.error).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});

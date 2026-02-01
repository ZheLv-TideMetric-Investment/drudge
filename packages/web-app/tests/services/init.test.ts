const neo4jConnection = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  isConnected: jest.fn()
};

const notificationService = {
  initialize: jest.fn()
};

jest.mock('../../src/lib/neo4j', () => ({
  __esModule: true,
  neo4jConnection
}));

jest.mock('../../src/lib/services/notification', () => ({
  __esModule: true,
  notificationService
}));

describe('initializeServices', () => {
  beforeEach(() => {
    neo4jConnection.connect.mockReset();
    neo4jConnection.disconnect.mockReset();
    neo4jConnection.isConnected.mockReset();
    notificationService.initialize.mockReset();
  });

  it('initializes services once', async () => {
    jest.resetModules();
    const { initializeServices, areServicesInitialized } = await import('../../src/lib/services/init');

    neo4jConnection.connect.mockResolvedValue(undefined);
    notificationService.initialize.mockResolvedValue(undefined);

    await initializeServices();
    await initializeServices();

    expect(neo4jConnection.connect).toHaveBeenCalledTimes(1);
    expect(notificationService.initialize).toHaveBeenCalledTimes(1);
    expect(areServicesInitialized()).toBe(true);
  });

  it('shares initialization promise across callers', async () => {
    jest.resetModules();
    const { initializeServices } = await import('../../src/lib/services/init');

    let resolveConnect: () => void = () => undefined;
    neo4jConnection.connect.mockImplementation(
      () => new Promise<void>(resolve => {
        resolveConnect = resolve;
      })
    );
    notificationService.initialize.mockResolvedValue(undefined);

    const first = initializeServices();
    const second = initializeServices();

    resolveConnect();
    await Promise.all([first, second]);

    expect(neo4jConnection.connect).toHaveBeenCalledTimes(1);
  });

  it('shuts down services and resets flags', async () => {
    jest.resetModules();
    const { initializeServices, shutdownServices, areServicesInitialized } = await import(
      '../../src/lib/services/init'
    );

    neo4jConnection.connect.mockResolvedValue(undefined);
    notificationService.initialize.mockResolvedValue(undefined);
    neo4jConnection.disconnect.mockResolvedValue(undefined);

    await initializeServices();
    await shutdownServices();

    expect(neo4jConnection.disconnect).toHaveBeenCalled();
    expect(areServicesInitialized()).toBe(false);
  });

  it('reports health check status', async () => {
    jest.resetModules();
    const { healthCheckServices } = await import('../../src/lib/services/init');

    neo4jConnection.isConnected.mockReturnValue(true);

    const status = await healthCheckServices();

    expect(status).toEqual({
      neo4j: true,
      notification: true,
      overall: true
    });
  });

  it('handles initialization failures and allows retry', async () => {
    jest.resetModules();
    const { initializeServices, areServicesInitialized } = await import('../../src/lib/services/init');

    neo4jConnection.connect.mockRejectedValueOnce(new Error('boom'));

    await expect(initializeServices()).rejects.toThrow('boom');
    expect(areServicesInitialized()).toBe(false);

    neo4jConnection.connect.mockResolvedValue(undefined);
    notificationService.initialize.mockResolvedValue(undefined);

    await initializeServices();
    expect(areServicesInitialized()).toBe(true);
  });

  it('throws on shutdown failures', async () => {
    jest.resetModules();
    const { shutdownServices } = await import('../../src/lib/services/init');

    neo4jConnection.disconnect.mockRejectedValue(new Error('boom'));

    await expect(shutdownServices()).rejects.toThrow('boom');
  });

  it('returns unhealthy when health check throws', async () => {
    jest.resetModules();
    const { healthCheckServices } = await import('../../src/lib/services/init');

    neo4jConnection.isConnected.mockImplementation(() => {
      throw new Error('boom');
    });

    const status = await healthCheckServices();

    expect(status).toEqual({
      neo4j: false,
      notification: false,
      overall: false
    });
  });
});

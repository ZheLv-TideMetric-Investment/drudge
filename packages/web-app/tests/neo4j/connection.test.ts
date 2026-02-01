const mockSession = {
  run: jest.fn(),
  close: jest.fn(),
  executeWrite: jest.fn()
};

const mockDriver = {
  verifyConnectivity: jest.fn(),
  session: jest.fn(() => mockSession),
  close: jest.fn()
};

const neo4jDriverMock = {
  driver: jest.fn(() => mockDriver),
  auth: { basic: jest.fn(() => 'basic') },
  int: jest.fn((value: number) => ({ toNumber: () => value, value }))
};

jest.mock('neo4j-driver', () => ({
  __esModule: true,
  default: neo4jDriverMock,
  driver: neo4jDriverMock.driver,
  auth: neo4jDriverMock.auth,
  int: neo4jDriverMock.int
}));

describe('neo4j/connection', () => {
  beforeEach(() => {
    jest.resetModules();
    mockSession.run.mockReset();
    mockSession.close.mockReset();
    mockSession.executeWrite.mockReset();
    mockDriver.verifyConnectivity.mockReset();
    mockDriver.session.mockReset();
    mockDriver.close.mockReset();
    neo4jDriverMock.driver.mockClear();
    neo4jDriverMock.auth.basic.mockClear();
    neo4jDriverMock.int.mockClear();
    neo4jDriverMock.driver.mockImplementation(() => mockDriver);
    neo4jDriverMock.auth.basic.mockImplementation(() => 'basic');
    neo4jDriverMock.int.mockImplementation((value: number) => ({ toNumber: () => value, value }));
    mockDriver.session.mockReturnValue(mockSession);
  });

  it('connects and reports status', async () => {
    const { neo4jConnection } = await import('../../src/lib/neo4j/connection');

    await neo4jConnection.connect();

    expect(mockDriver.verifyConnectivity).toHaveBeenCalled();
    expect(neo4jConnection.isConnected()).toBe(true);
  });

  it('throws on connect failure', async () => {
    const { neo4jConnection } = await import('../../src/lib/neo4j/connection');

    mockDriver.verifyConnectivity.mockRejectedValue(new Error('boom'));

    await expect(neo4jConnection.connect()).rejects.toThrow('boom');
    expect(neo4jConnection.isConnected()).toBe(false);
  });

  it('disconnects driver', async () => {
    const { neo4jConnection } = await import('../../src/lib/neo4j/connection');

    await neo4jConnection.connect();
    expect(neo4jConnection.getDriver()).toBeDefined();
    await neo4jConnection.disconnect();

    expect(mockDriver.close).toHaveBeenCalled();
    expect(neo4jConnection.isConnected()).toBe(false);
  });

  it('throws when getting session without driver', async () => {
    const { neo4jConnection } = await import('../../src/lib/neo4j/connection');

    expect(() => neo4jConnection.getSession()).toThrow('Neo4j 驱动未初始化');
  });

  it('converts numbers to neo4j ints', async () => {
    const { neo4jConnection } = await import('../../src/lib/neo4j/connection');

    const result = neo4jConnection.convertNumbersToNeo4jInts({
      value: 1,
      list: [2, 'text'],
      nested: { count: 3 }
    });

    expect(neo4jConnection.convertNumbersToNeo4jInts(null)).toBeNull();
    expect(neo4jConnection.convertNumbersToNeo4jInts(undefined)).toBeUndefined();
    expect(neo4jDriverMock.int).toHaveBeenCalledWith(1);
    expect(result.value).toHaveProperty('toNumber');
    expect(result.list[0]).toHaveProperty('toNumber');
    expect(result.list[1]).toBe('text');
  });

  it('executes queries and closes session', async () => {
    const { neo4jConnection } = await import('../../src/lib/neo4j/connection');

    mockSession.run.mockResolvedValue({ records: [] });

    const result = await neo4jConnection.executeQuery('MATCH (n) RETURN n', { count: 1 });

    expect(mockSession.run).toHaveBeenCalled();
    expect(mockSession.close).toHaveBeenCalled();
    expect(result).toEqual({ records: [] });
  });

  it('handles query errors', async () => {
    const { neo4jConnection } = await import('../../src/lib/neo4j/connection');

    mockSession.run.mockRejectedValue(new Error('boom'));

    await expect(neo4jConnection.executeQuery('MATCH (n) RETURN n')).rejects.toThrow('boom');
    expect(mockSession.close).toHaveBeenCalled();
  });

  it('executes transactions', async () => {
    const { neo4jConnection } = await import('../../src/lib/neo4j/connection');

    mockSession.executeWrite.mockResolvedValue('ok');

    const result = await neo4jConnection.executeTransaction(async () => 'ok');

    expect(result).toBe('ok');
    expect(mockSession.close).toHaveBeenCalled();
  });

  it('handles transaction errors', async () => {
    const { neo4jConnection } = await import('../../src/lib/neo4j/connection');

    mockSession.executeWrite.mockRejectedValue(new Error('boom'));

    await expect(neo4jConnection.executeTransaction(async () => 'ok')).rejects.toThrow('boom');
    expect(mockSession.close).toHaveBeenCalled();
  });
});

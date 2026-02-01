const session = {
  run: jest.fn(),
  close: jest.fn().mockResolvedValue(undefined),
  writeTransaction: jest.fn()
};

const driver = {
  session: jest.fn(() => session),
  close: jest.fn().mockResolvedValue(undefined)
};

const neo4jMock = {
  driver: jest.fn(() => driver),
  auth: {
    basic: jest.fn(() => ({ user: 'neo4j' }))
  },
  int: (value: number) => value
};

const notificationService = {
  sendNeo4jConnectionFailureNotification: jest.fn().mockResolvedValue(undefined)
};

jest.mock('neo4j-driver', () => ({
  __esModule: true,
  default: neo4jMock,
  driver: neo4jMock.driver,
  auth: neo4jMock.auth,
  int: neo4jMock.int
}));

jest.mock('../../src/services/NotificationService', () => ({
  __esModule: true,
  default: notificationService
}));

const buildRecord = (data: Record<string, any>) => ({
  get: (key: string) => data[key]
});

const connectService = async () => {
  const { Neo4jService } = await import('../../src/services/Neo4jService');
  const service = new Neo4jService() as any;
  service.driver = driver;
  service.isConnected = true;
  return service as InstanceType<typeof Neo4jService>;
};

describe('Neo4jService', () => {
  beforeEach(() => {
    session.run.mockReset();
    session.close.mockClear();
    session.writeTransaction.mockReset();
    driver.session.mockClear();
    driver.session.mockImplementation(() => session);
    driver.close.mockClear();
    neo4jMock.driver.mockClear();
    neo4jMock.driver.mockReturnValue(driver);
    notificationService.sendNeo4jConnectionFailureNotification.mockClear();
  });

  it('initializes and tests connection', async () => {
    jest.resetModules();
    const { Neo4jService } = await import('../../src/services/Neo4jService');
    const service = new Neo4jService();

    session.run.mockResolvedValueOnce({});
    const createSpy = jest.spyOn(service, 'createUniqueConstraints').mockResolvedValue();

    await service.initialize();

    expect(neo4jMock.driver).toHaveBeenCalled();
    expect(session.run).toHaveBeenCalledWith('RETURN 1');
    expect(createSpy).toHaveBeenCalled();
  });

  it('notifies when initialization fails', async () => {
    jest.resetModules();
    const { Neo4jService } = await import('../../src/services/Neo4jService');
    const service = new Neo4jService();

    session.run.mockRejectedValueOnce(new Error('boom'));

    await expect(service.initialize()).rejects.toThrow('boom');
    expect(notificationService.sendNeo4jConnectionFailureNotification).toHaveBeenCalled();
  });

  it('uses fallback message when initialization error lacks message', async () => {
    jest.resetModules();
    const { Neo4jService } = await import('../../src/services/Neo4jService');
    const service = new Neo4jService();

    session.run.mockRejectedValueOnce({ message: '' });

    await expect(service.initialize()).rejects.toBeTruthy();
    expect(notificationService.sendNeo4jConnectionFailureNotification).toHaveBeenCalledWith(
      'Neo4j数据库连接失败'
    );
  });

  it('logs when notification fails during initialization', async () => {
    jest.resetModules();
    const { Neo4jService } = await import('../../src/services/Neo4jService');
    const service = new Neo4jService();

    session.run.mockRejectedValueOnce(new Error('boom'));
    notificationService.sendNeo4jConnectionFailureNotification.mockRejectedValueOnce(
      new Error('notify fail')
    );

    await expect(service.initialize()).rejects.toThrow('boom');
    expect(notificationService.sendNeo4jConnectionFailureNotification).toHaveBeenCalled();
  });

  it('throws when getSession called without connection', async () => {
    jest.resetModules();
    const { Neo4jService } = await import('../../src/services/Neo4jService');
    const service = new Neo4jService();

    expect(() => service.getSession()).toThrow('Neo4j数据库未连接');
  });

  it('executes queries and closes sessions', async () => {
    jest.resetModules();
    const { Neo4jService } = await import('../../src/services/Neo4jService');
    const service = new Neo4jService();

    session.run.mockResolvedValueOnce({});
    jest.spyOn(service, 'createUniqueConstraints').mockResolvedValue();
    await service.initialize();

    const result = { records: [] };
    session.run.mockResolvedValueOnce(result);

    const response = await service.executeQuery('MATCH (n) RETURN n', { limit: 1 });

    expect(response).toBe(result);
    expect(session.run).toHaveBeenCalledWith('MATCH (n) RETURN n', { limit: 1 });
    expect(session.close).toHaveBeenCalled();
  });

  it('executeQuery uses default params when omitted', async () => {
    jest.resetModules();
    const service = await connectService();

    session.run.mockResolvedValueOnce({ records: [] });

    await service.executeQuery('MATCH (n) RETURN n');

    expect(session.run).toHaveBeenCalledWith('MATCH (n) RETURN n', {});
  });

  it('executes transactions with multiple queries', async () => {
    jest.resetModules();
    const service = await connectService();

    const tx = { run: jest.fn().mockResolvedValue({}) };
    session.writeTransaction.mockImplementation(async (fn) => fn(tx));

    const results = await service.executeTransaction([
      { query: 'MATCH (n) RETURN n' },
      { query: 'MATCH (p) RETURN p', params: { limit: 1 } }
    ]);

    expect(results).toHaveLength(2);
    expect(tx.run).toHaveBeenCalledWith('MATCH (n) RETURN n', {});
    expect(tx.run).toHaveBeenCalledWith('MATCH (p) RETURN p', { limit: 1 });
    expect(session.close).toHaveBeenCalled();
  });

  it('creates indexes and constraints', async () => {
    jest.resetModules();
    const service = await connectService();

    await service.createIndexes();
    expect(session.run).toHaveBeenCalledWith(
      'CREATE INDEX news_id_index IF NOT EXISTS FOR (n:News) ON (n.id)'
    );

    session.run.mockReset();
    await service.createUniqueConstraints();

    const calls = session.run.mock.calls.map((call) => call[0]);
    expect(calls.some((query: string) => query.includes('CREATE CONSTRAINT'))).toBe(true);
    expect(calls.some((query: string) => query.includes('DROP INDEX'))).toBe(true);
  });

  it('createIndexes propagates errors', async () => {
    jest.resetModules();
    const service = await connectService();
    session.run.mockRejectedValueOnce(new Error('boom'));

    await expect(service.createIndexes()).rejects.toThrow('boom');
  });

  it('returns database stats', async () => {
    jest.resetModules();
    const service = await connectService();

    session.run
      .mockResolvedValueOnce({
        records: [buildRecord({ labels: ['News'], count: { toNumber: () => 3 } })]
      })
      .mockResolvedValueOnce({
        records: [buildRecord({ type: 'INVOLVES', count: { toNumber: () => 5 } })]
      })
      .mockResolvedValueOnce({
        records: [buildRecord({ total: { toNumber: () => 3 } })]
      })
      .mockResolvedValueOnce({
        records: [buildRecord({ total: { toNumber: () => 5 } })]
      });

    const stats = await service.getDbStats();

    expect(stats.nodes.total).toBe(3);
    expect(stats.relationships.total).toBe(5);
    expect(stats.nodes.byLabel[0]).toMatchObject({ labels: ['News'], count: 3 });
  });

  it('getDbStats falls back to zero totals', async () => {
    jest.resetModules();
    const service = await connectService();

    session.run
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] })
      .mockResolvedValueOnce({ records: [] });

    const stats = await service.getDbStats();

    expect(stats.nodes.total).toBe(0);
    expect(stats.relationships.total).toBe(0);
  });

  it('getDbStats propagates errors', async () => {
    jest.resetModules();
    const service = await connectService();
    session.run.mockRejectedValueOnce(new Error('boom'));

    await expect(service.getDbStats()).rejects.toThrow('boom');
  });

  it('clears database and handles health check', async () => {
    jest.resetModules();
    const service = await connectService();

    await service.clearDatabase();
    expect(session.run).toHaveBeenCalledWith('MATCH ()-[r]->() DELETE r');
    expect(session.run).toHaveBeenCalledWith('MATCH (n) DELETE n');

    session.run.mockResolvedValueOnce({});
    const healthy = await service.healthCheck();
    expect(healthy).toBe(true);

    session.run.mockRejectedValueOnce(new Error('boom'));
    const unhealthy = await service.healthCheck();
    expect(unhealthy).toBe(false);
  });

  it('clearDatabase propagates errors', async () => {
    jest.resetModules();
    const service = await connectService();
    session.run.mockRejectedValueOnce(new Error('boom'));

    await expect(service.clearDatabase()).rejects.toThrow('boom');
  });

  it('createUniqueConstraints propagates errors and dropConflictingIndexes handles failures', async () => {
    jest.resetModules();
    const service = await connectService();

    const dropSpy = jest
      .spyOn(service as any, 'dropConflictingIndexes')
      .mockResolvedValue(undefined);
    session.run.mockRejectedValueOnce(new Error('boom'));
    await expect(service.createUniqueConstraints()).rejects.toThrow('boom');
    dropSpy.mockRestore();

    const { logger } = await import('../../src/utils/logger');
    const infoSpy = jest.spyOn(logger, 'info').mockImplementation(() => {
      throw new Error('info fail');
    });

    await (service as any).dropConflictingIndexes(session);
    infoSpy.mockRestore();
  });

  it('dropConflictingIndexes ignores per-index errors', async () => {
    jest.resetModules();
    const service = await connectService();

    session.run.mockRejectedValueOnce(new Error('boom'));
    await (service as any).dropConflictingIndexes(session);
  });

  it('batch merges entities by type and rejects unknown types', async () => {
    jest.resetModules();
    const service = await connectService();

    await service.batchMergeEntities('Company', [{ company_name: 'Company A' }]);
    await service.batchMergeEntities('Person', [{ person_name: 'Person A' }]);
    await service.batchMergeEntities('Organization', [{ organization_name: 'Org A' }]);
    await service.batchMergeEntities('Location', [{ location_name: 'Location A', coordinates: null }]);
    await service.batchMergeEntities('Event', [{ event_id: 'event_1' }]);
    await service.batchMergeEntities('News', [{ id: 'news_1' }]);

    expect(session.run).toHaveBeenCalledTimes(6);

    await expect(service.batchMergeEntities('Unknown', [{}])).rejects.toThrow('不支持的实体类型');
  });

  it('batchMergeEntities returns early for empty entities', async () => {
    jest.resetModules();
    const service = await connectService();

    await service.batchMergeEntities('Company', []);
    expect(session.run).not.toHaveBeenCalled();
  });

  it('batch merges relationships', async () => {
    jest.resetModules();
    const service = await connectService();

    await service.batchMergeRelationships([
      {
        fromType: 'News',
        fromKey: 'id',
        fromValue: 'news_1',
        toType: 'Company',
        toKey: 'company_name',
        toValue: 'Company A',
        relType: 'INVOLVES',
        properties: { confidence: 0.8 }
      },
      {
        fromType: 'News',
        fromKey: 'id',
        fromValue: 'news_2',
        toType: 'Person',
        toKey: 'person_name',
        toValue: 'Person A',
        relType: 'MENTIONS',
        properties: {}
      }
    ]);

    expect(session.run).toHaveBeenCalledTimes(2);

    session.run.mockClear();
    await service.batchMergeRelationships([]);
    expect(session.run).not.toHaveBeenCalled();
  });

  it('batchMergeRelationships uses empty properties fallback', async () => {
    jest.resetModules();
    const service = await connectService();

    await service.batchMergeRelationships([
      {
        fromType: 'News',
        fromKey: 'id',
        fromValue: 'news_1',
        toType: 'Company',
        toKey: 'company_name',
        toValue: 'Company A',
        relType: 'INVOLVES'
      }
    ] as any);

    const params = session.run.mock.calls[0]?.[1] as any;
    expect(params.properties).toEqual({});
  });

  it('batchMergeRelationships propagates errors', async () => {
    jest.resetModules();
    const service = await connectService();

    session.run.mockRejectedValueOnce(new Error('boom'));

    await expect(
      service.batchMergeRelationships([
        {
          fromType: 'News',
          fromKey: 'id',
          fromValue: 'news_1',
          toType: 'Company',
          toKey: 'company_name',
          toValue: 'Company A',
          relType: 'INVOLVES',
          properties: {}
        }
      ])
    ).rejects.toThrow('boom');
  });

  it('closes driver connection', async () => {
    jest.resetModules();
    const service = await connectService();

    await service.close();
    expect(driver.close).toHaveBeenCalled();
  });
});

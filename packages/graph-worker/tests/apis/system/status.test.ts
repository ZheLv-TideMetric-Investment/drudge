import { freezeTime } from '../../helpers/fake-time';

const knowledgeGraphService = {
  entityService: {
    neo4j: {
      healthCheck: jest.fn()
    }
  }
};

const schedulerService = {
  healthCheck: jest.fn()
};

jest.mock('../../../src/services/KnowledgeGraphService', () => ({
  __esModule: true,
  default: knowledgeGraphService
}));

jest.mock('../../../src/scheduler/index', () => ({
  __esModule: true,
  default: schedulerService
}));

describe('api/system/status', () => {
  const baseSnapshot = (result: any) => ({
    ...result,
    data: result.data
      ? {
          ...result.data,
          memory: { used: 0, total: 0, external: 0 },
          uptime: 0,
          pid: 0
        }
      : result.data
  });

  let restoreTime: (() => void) | undefined;

  beforeEach(() => {
    restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    knowledgeGraphService.entityService.neo4j.healthCheck.mockReset();
    schedulerService.healthCheck.mockReset();
  });

  afterEach(() => {
    restoreTime?.();
  });

  it('returns system status payload', async () => {
    jest.resetModules();
    knowledgeGraphService.entityService.neo4j.healthCheck.mockResolvedValue({ status: 'ok' });
    schedulerService.healthCheck.mockResolvedValue({ status: 'ok' });

    const { getSystemStatus } = await import('../../../src/apis/system/status');
    const result = await getSystemStatus();

    expect(result.success).toBe(true);
    expect(result.data.service).toBe('graph-worker');
    expect(result.data.status).toBe('healthy');
    expect(result.data.services).toEqual({
      knowledgeGraph: { status: 'ok' },
      scheduler: { status: 'ok' }
    });
    expect(baseSnapshot(result)).toMatchSnapshot();
  });

  it('returns error on failure', async () => {
    jest.resetModules();
    knowledgeGraphService.entityService.neo4j.healthCheck.mockRejectedValue(new Error('boom'));

    const { getSystemStatus } = await import('../../../src/apis/system/status');
    const result = await getSystemStatus();

    expect(result.success).toBe(false);
    expect(result.error).toBe('boom');
    expect(result).toMatchSnapshot();
  });
});

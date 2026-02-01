import { createNextRequest } from '../helpers/next-request';
import { freezeTime } from '../helpers/fake-time';

const neo4jGraphService = {
  getEntityNeighborhood: jest.fn()
};

jest.mock('../../src/lib/neo4j', () => ({
  __esModule: true,
  neo4jGraphService
}));

describe('api/graph/entities/[entityId]/neighborhood', () => {
  beforeEach(() => {
    neo4jGraphService.getEntityNeighborhood.mockReset();
  });

  it('returns neighborhood data', async () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    jest.resetModules();
    const { GET } = await import('../../src/app/api/graph/entities/[entityId]/neighborhood/route');

    neo4jGraphService.getEntityNeighborhood.mockResolvedValue({ nodes: [] });

    const request = createNextRequest('/api/graph/entities/123/neighborhood', {
      query: { depth: 2, limit: 5 }
    });

    try {
      const response = await GET(request as Request, { params: Promise.resolve({ entityId: '123' }) });
      const body = await response.json();

      expect(body.success).toBe(true);
      expect(body.data).toEqual({ nodes: [] });
      expect(neo4jGraphService.getEntityNeighborhood).toHaveBeenCalledWith('123', 2, 5);
      expect(body).toMatchSnapshot();
    } finally {
      restoreTime();
    }
  });

  it('returns 400 when entityId is missing', async () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    jest.resetModules();
    const { GET } = await import('../../src/app/api/graph/entities/[entityId]/neighborhood/route');

    const request = createNextRequest('/api/graph/entities//neighborhood');

    try {
      const response = await GET(request as Request, { params: Promise.resolve({ entityId: '' }) });
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.success).toBe(false);
      expect(body.error).toContain('缺少实体ID');
    } finally {
      restoreTime();
    }
  });

  it('returns 500 on service error', async () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    jest.resetModules();
    const { GET } = await import('../../src/app/api/graph/entities/[entityId]/neighborhood/route');

    neo4jGraphService.getEntityNeighborhood.mockRejectedValue(new Error('boom'));

    const request = createNextRequest('/api/graph/entities/123/neighborhood');

    try {
      const response = await GET(request as Request, { params: Promise.resolve({ entityId: '123' }) });
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.success).toBe(false);
      expect(body.error).toContain('boom');
    } finally {
      restoreTime();
    }
  });

  it('returns 500 on non-error failure', async () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    jest.resetModules();
    const { GET } = await import('../../src/app/api/graph/entities/[entityId]/neighborhood/route');

    neo4jGraphService.getEntityNeighborhood.mockRejectedValue('fail');

    const request = createNextRequest('/api/graph/entities/123/neighborhood');

    try {
      const response = await GET(request as Request, { params: Promise.resolve({ entityId: '123' }) });
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe('fail');
    } finally {
      restoreTime();
    }
  });
});

import { createNextRequest } from '../helpers/next-request';
import { freezeTime } from '../helpers/fake-time';

const neo4jEntitiesService = {
  searchEntities: jest.fn()
};

jest.mock('../../src/lib/neo4j', () => ({
  __esModule: true,
  neo4jEntitiesService
}));

describe('api/graph/entities/search', () => {
  beforeEach(() => {
    neo4jEntitiesService.searchEntities.mockReset();
  });

  it('returns search results', async () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    jest.resetModules();
    const { GET } = await import('../../src/app/api/graph/entities/search/route');

    neo4jEntitiesService.searchEntities.mockResolvedValue([{ name: 'Entity' }]);

    const request = createNextRequest('/api/graph/entities/search', {
      query: { searchTerm: 'Entity', limit: 5 }
    });

    try {
      const response = await GET(request as Request);
      const body = await response.json();

      expect(body.success).toBe(true);
      expect(body.count).toBe(1);
      expect(neo4jEntitiesService.searchEntities).toHaveBeenCalledWith('Entity', undefined, 5);
      expect(body).toMatchSnapshot();
    } finally {
      restoreTime();
    }
  });

  it('returns results with nodeType and empty search term', async () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    jest.resetModules();
    const { GET } = await import('../../src/app/api/graph/entities/search/route');

    neo4jEntitiesService.searchEntities.mockResolvedValue([{ name: 'Entity' }]);

    const request = createNextRequest('/api/graph/entities/search', {
      query: { nodeType: 'Company', limit: 2 }
    });

    try {
      const response = await GET(request as Request);
      const body = await response.json();

      expect(body.success).toBe(true);
      expect(neo4jEntitiesService.searchEntities).toHaveBeenCalledWith('', 'Company', 2);
    } finally {
      restoreTime();
    }
  });

  it('returns 500 when search fails', async () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    jest.resetModules();
    const { GET } = await import('../../src/app/api/graph/entities/search/route');

    neo4jEntitiesService.searchEntities.mockRejectedValue(new Error('boom'));

    const request = createNextRequest('/api/graph/entities/search', {
      query: { searchTerm: 'Entity' }
    });

    try {
      const response = await GET(request as Request);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.success).toBe(false);
      expect(body.error).toContain('boom');
    } finally {
      restoreTime();
    }
  });

  it('returns 500 when search fails with non-error', async () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    jest.resetModules();
    const { GET } = await import('../../src/app/api/graph/entities/search/route');

    neo4jEntitiesService.searchEntities.mockRejectedValue('fail');

    const request = createNextRequest('/api/graph/entities/search', {
      query: { searchTerm: 'Entity' }
    });

    try {
      const response = await GET(request as Request);
      const body = await response.json();

      expect(response.status).toBe(500);
      expect(body.error).toBe('fail');
    } finally {
      restoreTime();
    }
  });
});

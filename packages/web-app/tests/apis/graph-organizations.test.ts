import { createNextRequest } from '../helpers/next-request';
import { freezeTime } from '../helpers/fake-time';

const neo4jEntitiesService = {
  searchEntities: jest.fn()
};

jest.mock('../../src/lib/neo4j', () => ({
  __esModule: true,
  neo4jEntitiesService
}));

describe('api/graph/organizations', () => {
  beforeEach(() => {
    neo4jEntitiesService.searchEntities.mockReset();
  });

  it('returns organizations by search term', async () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    jest.resetModules();
    const { GET } = await import('../../src/app/api/graph/organizations/route');

    neo4jEntitiesService.searchEntities.mockResolvedValue([{ name: 'Org A' }]);

    const request = createNextRequest('/api/graph/organizations', {
      query: { searchTerm: 'Org', limit: 5 }
    });

    try {
      const response = await GET(request as Request);
      const body = await response.json();

      expect(body.success).toBe(true);
      expect(neo4jEntitiesService.searchEntities).toHaveBeenCalledWith('Org', 'organization', 5);
      expect(body).toMatchSnapshot();
    } finally {
      restoreTime();
    }
  });

  it('returns organizations without search term', async () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    jest.resetModules();
    const { GET } = await import('../../src/app/api/graph/organizations/route');

    neo4jEntitiesService.searchEntities.mockResolvedValue([{ name: 'Org A' }]);

    const request = createNextRequest('/api/graph/organizations');

    try {
      const response = await GET(request as Request);
      const body = await response.json();

      expect(body.success).toBe(true);
      expect(neo4jEntitiesService.searchEntities).toHaveBeenCalledWith('', 'organization', 20);
    } finally {
      restoreTime();
    }
  });

  it('returns 500 on service error', async () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    jest.resetModules();
    const { GET } = await import('../../src/app/api/graph/organizations/route');

    neo4jEntitiesService.searchEntities.mockRejectedValue(new Error('boom'));

    const request = createNextRequest('/api/graph/organizations');

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

  it('returns 500 on non-error failure', async () => {
    const restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    jest.resetModules();
    const { GET } = await import('../../src/app/api/graph/organizations/route');

    neo4jEntitiesService.searchEntities.mockRejectedValue('fail');

    const request = createNextRequest('/api/graph/organizations');

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

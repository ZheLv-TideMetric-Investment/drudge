import { createNextRequest } from '../helpers/next-request';

const neo4jGraphService = {
  searchGraph: jest.fn(),
  getGraphByNodeType: jest.fn(),
  getGraphOverview: jest.fn()
};

jest.mock('../../src/lib/neo4j', () => ({
  __esModule: true,
  neo4jGraphService
}));

describe('api/graph/data', () => {
  beforeEach(() => {
    neo4jGraphService.searchGraph.mockReset();
    neo4jGraphService.getGraphByNodeType.mockReset();
    neo4jGraphService.getGraphOverview.mockReset();
  });

  it('returns search results when query is provided', async () => {
    jest.resetModules();
    const { GET } = await import('../../src/app/api/graph/data/route');

    neo4jGraphService.searchGraph.mockResolvedValue({ nodes: [], relationships: [] });

    const request = createNextRequest('/api/graph/data', {
      query: { query: 'market', limit: 10 }
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(neo4jGraphService.searchGraph).toHaveBeenCalledWith('market', 10);
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ nodes: [], relationships: [] });
  });

  it('returns node type results when nodeType is provided', async () => {
    jest.resetModules();
    const { GET } = await import('../../src/app/api/graph/data/route');

    neo4jGraphService.getGraphByNodeType.mockResolvedValue({ nodes: ['n1'], relationships: [] });

    const request = createNextRequest('/api/graph/data', {
      query: { nodeType: 'Company', limit: 5 }
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(neo4jGraphService.getGraphByNodeType).toHaveBeenCalledWith('Company', 5);
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ nodes: ['n1'], relationships: [] });
  });

  it('returns overview results when no query params provided', async () => {
    jest.resetModules();
    const { GET } = await import('../../src/app/api/graph/data/route');

    neo4jGraphService.getGraphOverview.mockResolvedValue({ nodes: ['n2'], relationships: ['r1'] });

    const request = createNextRequest('/api/graph/data');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(neo4jGraphService.getGraphOverview).toHaveBeenCalledWith(50);
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ nodes: ['n2'], relationships: ['r1'] });
  });

  it('returns error response when service fails', async () => {
    jest.resetModules();
    const { GET } = await import('../../src/app/api/graph/data/route');

    neo4jGraphService.getGraphOverview.mockRejectedValue(new Error('boom'));

    const request = createNextRequest('/api/graph/data');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error).toContain('boom');
  });

  it('returns error response for non-error failures', async () => {
    jest.resetModules();
    const { GET } = await import('../../src/app/api/graph/data/route');

    neo4jGraphService.getGraphOverview.mockRejectedValue('fail');

    const request = createNextRequest('/api/graph/data');

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('fail');
  });
});

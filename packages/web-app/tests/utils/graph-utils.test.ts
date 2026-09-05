import { convertToSimpleGraph, loadMultiEntityGraph, searchEntities } from '../../src/lib/graph-utils';

describe('graph-utils', () => {
  beforeEach(() => {
    (global as any).fetch = jest.fn();
  });

  afterEach(() => {
    delete (global as any).fetch;
  });

  it('loads multi-entity graph with dedupe and limits', async () => {
    const entities = [
      { id: '1', name: 'A', type: 'Company', properties: {} },
      { id: '2', name: 'B', type: 'Person', properties: {} },
      { id: '3', name: 'C', type: 'Organization', properties: {} },
      { id: '4', name: 'D', type: 'Location', properties: {} }
    ];

    (global as any).fetch
      .mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: {
            nodes: [
              { id: '1', name: 'A', type: 'Company' },
              { id: '5', name: 'E', type: 'Event' }
            ],
            edges: [
              { source: '1', target: '5', type: 'REL' },
              { source: '1', target: 'missing', type: 'REL' }
            ]
          }
        })
      })
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: {
            nodes: [{ id: '2', name: 'B', type: 'Person' }],
            edges: [{ source: '2', target: '1', type: 'REL' }]
          }
        })
      });

    const result = await loadMultiEntityGraph(entities, 3);

    expect((global as any).fetch).toHaveBeenCalledTimes(3);
    expect(result.nodes.length).toBe(4);
    expect(result.edges).toHaveLength(1);
    expect(result.incomplete).toBe(true);
  });

  it('uses default maxNodes and edge type fallback', async () => {
    const entities = [
      { id: '1', name: 'A', type: 'Company', properties: {} }
    ];

    (global as any).fetch.mockResolvedValue({
      json: async () => ({
        success: true,
        data: {
          nodes: [{ id: '2', name: 'B', type: 'Person' }],
          edges: [{ source: '1', target: '2' }]
        }
      })
    });

    const result = await loadMultiEntityGraph(entities);

    expect(result.edges[0]).toEqual({ source: '1', target: '2', type: 'RELATED' });
  });

  it('adds new nodes when under limit and skips unsuccessful responses', async () => {
    const entities = [
      { id: '1', name: 'A', type: 'Company', properties: {} }
    ];

    (global as any).fetch.mockResolvedValue({
      json: async () => ({ success: false, data: null })
    });

    await expect(loadMultiEntityGraph(entities, 10)).rejects.toThrow('实体关联查询失败');

    (global as any).fetch.mockResolvedValue({
      json: async () => ({
        success: true,
        data: {
          nodes: [{ id: '2', name: 'B', type: 'Person' }],
          edges: [{ source: '1', target: '2', type: 'REL' }]
        }
      })
    });

    const resultWithNodes = await loadMultiEntityGraph(entities, 10);
    expect(resultWithNodes.nodes).toHaveLength(2);
    expect(resultWithNodes.edges).toHaveLength(1);
  });

  it('returns empty results for blank search', async () => {
    const result = await searchEntities('   ');
    expect(result).toEqual([]);
  });

  it('maps search results', async () => {
    (global as any).fetch.mockResolvedValue({
      json: async () => ({
        success: true,
        data: [
          { entity: { id: '1', name: 'A' } },
          { id: '2', name: 'B' }
        ]
      })
    });

    const result = await searchEntities('abc', 2);

    expect((global as any).fetch).toHaveBeenCalledWith('/api/graph/entities/search?q=abc&limit=2');
    expect(result).toEqual([{ id: '1', name: 'A' }, { id: '2', name: 'B' }]);
  });

  it('reports unsuccessful search instead of treating it as no matches', async () => {
    (global as any).fetch.mockResolvedValue({
      json: async () => ({ success: false })
    });

    await expect(searchEntities('abc')).rejects.toThrow('实体搜索失败');
  });

  it('handles search errors', async () => {
    (global as any).fetch.mockRejectedValue(new Error('boom'));

    await expect(searchEntities('abc')).rejects.toThrow('boom');
  });

  it('preserves a successful search with no matches', async () => {
    (global as any).fetch.mockResolvedValue({ json: async () => ({ success: true, data: [] }) });
    await expect(searchEntities('no-match')).resolves.toEqual([]);
  });

  it('converts complex graph structures', () => {
    const result = convertToSimpleGraph({
      nodes: [{ id: '1', name: 'A', type: 'Company' }],
      edges: [{ source: { id: '1' }, target: { id: '2' }, type: 'REL' }]
    });

    expect(result.edges[0]).toEqual({ source: '1', target: '2', type: 'REL' });
  });

  it('handles empty graph data and string edge endpoints', () => {
    const result = convertToSimpleGraph({
      edges: [{ source: '1', target: '2', type: 'REL' }]
    });

    expect(result.nodes).toEqual([]);
    expect(result.edges[0]).toEqual({ source: '1', target: '2', type: 'REL' });
  });

  it('defaults to empty edges when missing', () => {
    const result = convertToSimpleGraph({
      nodes: [{ id: '1', name: 'A', type: 'Company' }]
    });

    expect(result.edges).toEqual([]);
  });
});

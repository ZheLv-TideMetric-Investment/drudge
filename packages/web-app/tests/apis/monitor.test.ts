import axios from 'axios';

jest.mock('axios');
jest.mock('../../src/lib/config', () => ({
  config: {
    workers: { ingestPort: 40110, graphPort: 40111 },
    notification: { enabled: false },
  },
}));
jest.mock('../../src/lib/services/high-level-scanner', () => ({
  highLevelNewsScanner: {
    getStatus: () => ({ lastScanTime: null, processedNewsCount: 0, isRunning: false }),
  },
}));

const get = axios.get as jest.Mock;

describe('api/monitor', () => {
  beforeEach(() => {
    get.mockReset();
    get.mockImplementation(async (url: string) => ({
      status: 200,
      data: url.endsWith('/api/system/status')
        ? { success: true, data: { services: { knowledgeGraph: true } } }
        : {
            service: url.includes(':40110/') ? 'ingest-worker' : 'graph-worker',
            status: 'healthy',
          },
    }));
  });

  it('checks the existing worker endpoints and reports scan state without sending messages', async () => {
    const { GET } = await import('../../src/app/api/monitor/route');
    const response = await GET();
    const body = await response.json();
    expect(body.services).toHaveLength(4);
    expect(body.services.every((service: any) => service.available)).toBe(true);
    expect(body.scanner).toEqual({ lastScanTime: null, processedNewsCount: 0, isRunning: false });
    expect(body.notificationEnabled).toBe(false);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(get.mock.calls.map(([url]) => url)).toEqual([
      'http://127.0.0.1:40110/health',
      'http://127.0.0.1:40111/health',
      'http://127.0.0.1:40111/api/system/status',
    ]);
    expect(
      get.mock.calls.every(([, options]) => options.timeout === 5000 && options.maxRedirects === 0)
    ).toBe(true);
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('keeps available services visible when a worker fails and does not expose errors', async () => {
    get.mockRejectedValueOnce(new Error('sensitive connection detail'));
    const { GET } = await import('../../src/app/api/monitor/route');
    const body = await (await GET()).json();
    expect(body.services.find((service: any) => service.id === 'ingest-worker').available).toBe(
      false
    );
    expect(body.services.find((service: any) => service.id === 'graph-worker').available).toBe(
      true
    );
    expect(JSON.stringify(body)).not.toContain('sensitive connection detail');
  });

  it('does not treat a different app responding on a worker port as healthy', async () => {
    get.mockResolvedValueOnce({ status: 200, data: { service: 'wrong-app', status: 'healthy' } });
    const { GET } = await import('../../src/app/api/monitor/route');
    const body = await (await GET()).json();
    expect(body.services.find((service: any) => service.id === 'ingest-worker').available).toBe(
      false
    );
  });

  it.each([false, null])(
    'distinguishes database failure from an unavailable health result: %s',
    async connected => {
      get.mockImplementation(async (url: string) => {
        if (url.endsWith('/api/system/status')) {
          if (connected === null) throw new Error('timeout');
          return {
            status: 200,
            data: { success: true, data: { services: { knowledgeGraph: connected } } },
          };
        }
        return {
          status: 200,
          data: {
            service: url.includes(':40110/') ? 'ingest-worker' : 'graph-worker',
            status: 'healthy',
          },
        };
      });
      const { GET } = await import('../../src/app/api/monitor/route');
      const body = await (await GET()).json();
      expect(body.services.find((service: any) => service.id === 'neo4j').available).toBe(
        connected
      );
    }
  );
});

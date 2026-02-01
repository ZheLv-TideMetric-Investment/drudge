const mockFileStorage = {
  getNewsStats: jest.fn()
};

const mockFutuService = {
  healthCheck: jest.fn(),
  getStatus: jest.fn()
};

const mockAwtmtService = {
  healthCheck: jest.fn(),
  getStatus: jest.fn()
};

jest.mock('../../../src/storage/FileStorage', () => ({
  __esModule: true,
  default: mockFileStorage
}));

jest.mock('../../../src/services/FutuLiveService', () => ({
  __esModule: true,
  default: mockFutuService
}));

jest.mock('../../../src/services/AwtmtLiveService', () => ({
  __esModule: true,
  default: mockAwtmtService
}));

import { getSystemStatus, healthCheck } from '../../../src/apis/system/status';
import { setEnv } from '../../helpers/env';
import { freezeTime } from '../../helpers/fake-time';

const normalizeErrorDetails = (result: any) => ({
  ...result,
  details: result.details ? { ...result.details, stack: '<stack>' } : result.details
});

describe('system status api', () => {
  let restoreTime: (() => void) | undefined;

  beforeEach(() => {
    restoreTime = freezeTime('2024-01-01T00:00:00.000Z');
    mockFileStorage.getNewsStats.mockReset();
    mockFutuService.healthCheck.mockReset();
    mockAwtmtService.healthCheck.mockReset();
    mockFutuService.getStatus.mockReset();
    mockAwtmtService.getStatus.mockReset();
  });

  afterEach(() => {
    restoreTime?.();
  });

  it('returns service status with health mapping', async () => {
    mockFileStorage.getNewsStats.mockResolvedValue({ totalCount: 2 });
    mockFutuService.healthCheck.mockResolvedValue(true);
    mockAwtmtService.healthCheck.mockResolvedValue(false);
    mockFutuService.getStatus.mockReturnValue({ name: 'futu' });
    mockAwtmtService.getStatus.mockReturnValue({ name: 'awtmt' });

    const result = await getSystemStatus();

    expect(result.success).toBe(true);
    expect(result.connections.futuLiveApi).toContain('✅');
    expect(result.connections.awtmtLiveApi).toContain('❌');
    expect(result.serviceStatus.futu).toEqual({ name: 'futu' });
    expect(result).toMatchSnapshot();
  });

  it('maps health statuses for alternate states', async () => {
    mockFileStorage.getNewsStats.mockResolvedValue({ totalCount: 2 });
    mockFutuService.healthCheck.mockResolvedValue(false);
    mockAwtmtService.healthCheck.mockResolvedValue(true);
    mockFutuService.getStatus.mockReturnValue({ name: 'futu' });
    mockAwtmtService.getStatus.mockReturnValue({ name: 'awtmt' });

    const result = await getSystemStatus();

    expect(result.connections.futuLiveApi).toContain('❌');
    expect(result.connections.awtmtLiveApi).toContain('✅');
  });

  it('returns error on failure', async () => {
    mockFileStorage.getNewsStats.mockRejectedValue(new Error('boom'));

    const result = await getSystemStatus();

    expect(result.success).toBe(false);
    expect(result.error).toBe('boom');
    expect(normalizeErrorDetails(result)).toMatchSnapshot();
  });

  it('returns health check payload', async () => {
    const restore = setEnv({ PORT: '' });
    const result = await healthCheck();

    expect(result.status).toBe('ok');
    expect(result.service).toBe('ingest-worker');
    expect(result.sources).toEqual(['futu_live', 'awtmt_live']);
    expect(result.port).toBe(39110);
    expect(result).toMatchSnapshot();
    restore();
  });

  it('uses env port when provided', async () => {
    const restore = setEnv({ PORT: '4567' });
    const result = await healthCheck();

    expect(result.port).toBe('4567');
    restore();
  });
});

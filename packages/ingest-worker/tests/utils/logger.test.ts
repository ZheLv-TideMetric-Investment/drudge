import fs from 'fs';
import path from 'path';
import winston from 'winston';
import { createTempDir } from '../helpers/tmp-dir';
import { setEnv } from '../helpers/env';

describe('logger', () => {
  it('formats meta values and creates log dir when missing', async () => {
    const temp = await createTempDir('drudge-logger-');
    const logFile = path.join(temp.path, 'logs', 'ingest-worker.log');
    const restoreEnv = setEnv({ LOG_FILE: logFile, NODE_ENV: 'development' });

    jest.resetModules();
    const { logger } = await import('../../src/utils/logger');

    logger.info('test message', {
      err: new Error('boom'),
      req: { constructor: { name: 'ClientRequest' } }
    });

    expect(fs.existsSync(path.dirname(logFile))).toBe(true);

    restoreEnv();
    await temp.cleanup();
  });

  it('handles empty meta in formatter', async () => {
    const restoreEnv = setEnv({ NODE_ENV: 'development', LOG_FILE: '' });

    jest.resetModules();
    const { logger } = await import('../../src/utils/logger');

    logger.format.transform({
      level: 'info',
      message: 'plain',
      timestamp: '2024-01-01T00:00:00.000Z'
    } as any);

    restoreEnv();
  });

  it('skips file transport when log file disabled in production', async () => {
    const restoreEnv = setEnv({ NODE_ENV: 'production' });

    jest.resetModules();
    jest.doMock('../../src/config/config', () => ({
      __esModule: true,
      default: {
        log: { level: 'info', file: '' }
      }
    }));

    const { logger } = await import('../../src/utils/logger');

    expect(
      logger.transports.some((transport) => transport instanceof winston.transports.File)
    ).toBe(false);

    jest.dontMock('../../src/config/config');
    restoreEnv();
  });
});

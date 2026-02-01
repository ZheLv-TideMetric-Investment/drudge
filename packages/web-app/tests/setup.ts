import fs from 'fs';
import os from 'os';
import path from 'path';
import { installNoNetworkGuard } from './guards/no-network';
import { installNoProdPathGuard } from './guards/no-prod-path';

const baseTempDir = path.join(os.tmpdir(), `drudge-tests-${process.pid}`);

process.env.TEST_MODE = 'true';
process.env.NEWS_DIRECTORY ??= path.join(baseTempDir, 'news');

jest.setTimeout(15000);

installNoNetworkGuard();
installNoProdPathGuard();

beforeEach(() => {
  installNoNetworkGuard();
  installNoProdPathGuard();
});

afterAll(async () => {
  await fs.promises.rm(baseTempDir, { recursive: true, force: true });
});

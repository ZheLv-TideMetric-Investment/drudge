import fs from 'fs';
import os from 'os';
import path from 'path';

export const createTempDir = async (prefix: string = 'drudge-test-') => {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), prefix));
  const cleanup = async () => {
    await fs.promises.rm(dir, { recursive: true, force: true });
  };
  return { path: dir, cleanup };
};

export const createTempDirSync = (prefix: string = 'drudge-test-') => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const cleanup = () => {
    fs.rmSync(dir, { recursive: true, force: true });
  };
  return { path: dir, cleanup };
};

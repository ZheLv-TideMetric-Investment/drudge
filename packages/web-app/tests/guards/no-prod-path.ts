import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve(process.cwd(), '..', '..');
const forbiddenRoots = [
  path.resolve(repoRoot, 'data'),
  path.resolve(repoRoot, 'neo4j'),
  path.resolve('/var/lib')
];

const normalizeTarget = (target: fs.PathLike | number) => {
  if (typeof target === 'number') {
    return null;
  }
  if (target instanceof URL) {
    return target.pathname;
  }
  return target.toString();
};

const isForbiddenPath = (target: string) => {
  const resolved = path.resolve(target);
  return forbiddenRoots.some((root) => resolved === root || resolved.startsWith(root + path.sep));
};

const assertSafePath = (target: fs.PathLike | number, context: string) => {
  const pathString = normalizeTarget(target);
  if (!pathString) {
    return;
  }
  if (isForbiddenPath(pathString)) {
    throw new Error(`Refusing to write to protected path in tests (${context}): ${pathString}`);
  }
};

const originals = new Map<string, (...args: any[]) => any>();

const getOriginal = (obj: any, method: string) => {
  const key = `${method}:${obj === fs.promises ? 'promises' : 'sync'}`;
  if (!originals.has(key)) {
    originals.set(key, obj[method].bind(obj));
  }
  return originals.get(key)!;
};

const guardMethod = (obj: any, method: string) => {
  const original = getOriginal(obj, method);
  if (jest.isMockFunction(obj[method])) {
    obj[method].mockImplementation((target: any, ...rest: any[]) => {
      assertSafePath(target, method);
      return original(target, ...rest);
    });
    return;
  }
  jest.spyOn(obj, method).mockImplementation((target: any, ...rest: any[]) => {
    assertSafePath(target, method);
    return original(target, ...rest);
  });
};

export const installNoProdPathGuard = () => {
  guardMethod(fs.promises, 'writeFile');
  guardMethod(fs.promises, 'appendFile');
  guardMethod(fs.promises, 'mkdir');
  guardMethod(fs.promises, 'rm');
  guardMethod(fs.promises, 'unlink');
  guardMethod(fs.promises, 'rename');
  guardMethod(fs.promises, 'copyFile');
  guardMethod(fs, 'writeFileSync');
  guardMethod(fs, 'appendFileSync');
  guardMethod(fs, 'mkdirSync');
  guardMethod(fs, 'rmSync');
  guardMethod(fs, 'unlinkSync');
  guardMethod(fs, 'renameSync');
  guardMethod(fs, 'copyFileSync');
};

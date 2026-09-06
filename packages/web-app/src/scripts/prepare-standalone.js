const fs = require('fs');
const path = require('path');

const appRoot = path.resolve(__dirname, '..', '..');
const standaloneRoot = path.join(appRoot, '.next', 'standalone', 'packages', 'web-app');

const copyDir = async (from, to) => {
  if (!fs.existsSync(from)) return;
  await fs.promises.mkdir(to, { recursive: true });
  await fs.promises.cp(from, to, { recursive: true, force: true });
};

const main = async () => {
  await copyDir(
    path.join(appRoot, '.next', 'static'),
    path.join(standaloneRoot, '.next', 'static')
  );
  await copyDir(path.join(appRoot, 'public'), path.join(standaloneRoot, 'public'));
  await copyDir(
    path.join(appRoot, 'assets', 'fonts'),
    path.join(standaloneRoot, 'assets', 'fonts')
  );
};

main().catch(error => {
  console.error('prepare-standalone failed:', error);
  process.exitCode = 1;
});

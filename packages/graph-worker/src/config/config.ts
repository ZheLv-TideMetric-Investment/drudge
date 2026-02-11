import { buildGraphConfig } from '@drudge/common';

const config = buildGraphConfig({
  baseDir: __dirname,
  loadEnv: true,
});

export default config;

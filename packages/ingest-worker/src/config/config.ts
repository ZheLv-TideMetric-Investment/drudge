import { buildIngestConfig } from '@drudge/common';

const config = buildIngestConfig({
  baseDir: __dirname,
  loadEnv: true,
});

export default config;

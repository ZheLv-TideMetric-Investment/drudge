import { buildWebConfig } from '@drudge/common';

const isServer = typeof window === 'undefined';

export const config = buildWebConfig({
  loadEnv: isServer,
});

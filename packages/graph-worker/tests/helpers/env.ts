export type EnvSnapshot = Record<string, string | undefined>;

export const setEnv = (vars: Record<string, string | undefined>): (() => void) => {
  const snapshot: EnvSnapshot = {};
  for (const [key, value] of Object.entries(vars)) {
    snapshot[key] = process.env[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  return () => {
    for (const [key, value] of Object.entries(snapshot)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
};

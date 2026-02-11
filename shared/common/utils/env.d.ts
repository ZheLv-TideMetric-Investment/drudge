export type EnvRecord = Record<string, string | undefined>;

export type DotenvOptions = {
  env?: EnvRecord;
  dotenvPath?: string;
  enabled?: boolean;
  force?: boolean;
};

export function loadDotenv(options?: DotenvOptions): boolean;

export function readString(env: EnvRecord, key: string, fallback?: string): string;
export function readInt(env: EnvRecord, key: string, fallback: number): number;
export function readFloat(env: EnvRecord, key: string, fallback: number): number;
export function readBoolean(env: EnvRecord, key: string, fallback?: boolean): boolean;
export function readCsv(env: EnvRecord, key: string): string[];
export function readPath(env: EnvRecord, key: string, fallbackPath: string): string;

export function getNodeEnv(env?: EnvRecord): string;
export function isProduction(env?: EnvRecord): boolean;
export function redactSecret(value: unknown): string;

export type IngestConfig = {
  nodeEnv: string;
  port: number;
  storage: {
    path: string;
  };
  newsApi: {
    url: string;
    pageSize: number;
    requestInterval: number;
  };
  notification: {
    enableWebhookNotification: boolean;
    webhookUrl: string;
  };
  log: {
    level: string;
    file: string;
  };
};

export type GraphConfig = {
  nodeEnv: string;
  port: number;
  server: {
    port: number;
  };
  neo4j: {
    uri: string;
    user: string;
    password: string;
    database: string;
  };
  ai: {
    provider: string;
    fallbackProvider: string;
    deepseek: { apiKey: string; model: string };
    google: { apiKey: string; model: string };
    qwen: { apiKey: string; model: string };
    xai: { apiKey: string; model: string; proxyUrl: string };
  };
  dataSource: {
    newsDirectory: string;
    failedNewsDirectory: string;
    supportedPrefixes: string[];
  };
  processing: {
    batchSize: number;
    retryAttempts: number;
    retryDelay: number;
    memory: {
      extractionChunkSize: number;
      processingChunkSize: number;
      aiBatchSize: number;
      warningThreshold: number;
      dangerThreshold: number;
      maxHeapSizeMB: number;
      monitoringIntervalMs: number;
      chunkDelayMs: number;
      enableAutoGC: boolean;
    };
  };
  notification: {
    enableWebhookNotification: boolean;
    webhookUrl: string;
  };
  logging: {
    level: string;
    format: string;
  };
};

export type WebConfig = {
  nodeEnv: string;
  port: number;
  neo4j: {
    uri: string;
    user: string;
    password: string;
    database: string;
  };
  ai: {
    provider: string;
    simpleProvider: string;
    deepseek: { model: string; apiKey: string };
    google: { model: string; apiKey: string };
    qwen: { model: string; apiKey: string };
    xai: { model: string; apiKey: string; proxyUrl: string };
    jina: { apiKey: string };
  };
  notification: {
    enableWebhookNotification: boolean;
    webhookUrls: string[];
  };
  cron: {
    highLevelScan: string;
    hourlySummary: string;
    dailySummary: string;
  };
  log: {
    level: string;
    file: string;
  };
};

export function buildIngestConfig(options?: {
  env?: EnvRecord;
  baseDir?: string;
  loadEnv?: boolean;
}): IngestConfig;

export function buildGraphConfig(options?: {
  env?: EnvRecord;
  baseDir?: string;
  loadEnv?: boolean;
}): GraphConfig;

export function buildWebConfig(options?: {
  env?: EnvRecord;
  loadEnv?: boolean;
}): WebConfig;

export interface ServiceProbe {
  id: 'web-app' | 'ingest-worker' | 'graph-worker' | 'neo4j';
  name: string;
  available: boolean | null;
  latencyMs: number;
}

export interface MonitorReport {
  checkedAt: string;
  services: ServiceProbe[];
  scanner: {
    lastScanTime: string | null;
    processedNewsCount: number;
    isRunning: boolean;
  };
  notificationEnabled: boolean;
}

export interface JobConfig {
  name: string;
  schedule: string;
  description: string;
  enabled: boolean;
  action: () => void | Promise<void>;
}

export interface JobStatus {
  name: string;
  schedule: string;
  description: string;
  enabled: boolean;
  running: boolean;
}

export interface HealthStatus {
  status: 'ok' | 'error';
  service: string;
  uptime: number;
  timestamp: string;
  jobs?: JobStatus[];
} 
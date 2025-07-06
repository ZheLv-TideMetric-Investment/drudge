/**
 * 定时任务配置
 */
export interface JobConfig {
  name: string;
  schedule: string;
  description: string;
  enabled: boolean;
  action: () => Promise<void>;
}

/**
 * 任务状态
 */
export interface JobStatus {
  name: string;
  schedule: string;
  description: string;
  enabled: boolean;
  running: boolean;
  lastRun?: string;
  nextRun?: string;
}

/**
 * 总结结果
 */
export interface SummaryResult {
  success: boolean;
  message: string;
  period: string;
  timestamp: string;
  data?: any;
  error?: string;
}

/**
 * 高级别新闻扫描结果
 */
export interface HighLevelScanResult {
  success: boolean;
  found: number;
  sent: number;
  message: string;
  period: string;
  timestamp: string;
  high_level_news?: Array<{
    newsId: string;
    title: string;
    level: string;
    urgency: string;
  }>;
  error?: string;
}

/**
 * 新闻级别枚举
 */
export enum NewsLevel {
  LEVEL_1 = 'Level 1',
  LEVEL_2 = 'Level 2',
  LEVEL_3 = 'Level 3',
  LEVEL_4 = 'Level 4',
  LEVEL_5 = 'Level 5'
}

/**
 * 通知类型
 */
export enum NotificationType {
  HIGH_LEVEL_NEWS = 'high_level_news',
  HOURLY_SUMMARY = 'hourly_summary',
  DAILY_SUMMARY = 'daily_summary',
  SYSTEM_ALERT = 'system_alert'
}

/**
 * 调用来源类型
 */
export enum CallSource {
  SCHEDULER = 'scheduler',    // 定时任务调用
  API = 'api',               // API 手动调用
  CLI = 'cli'                // CLI 调用
} 
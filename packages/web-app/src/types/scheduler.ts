/**
 * 定时器触发器类型枚举
 */
export enum SchedulerTrigger {
  EVERY_MINUTE = 'every_minute',          // 每分钟
  EVERY_5_MINUTES = 'every_5_minutes',    // 每5分钟  
  EVERY_30_MINUTES = 'every_30_minutes',  // 每半小时
  EVERY_HOUR = 'every_hour',              // 每小时（11-22点）
  OVERNIGHT = 'overnight'                 // 隔夜（10点）
}

/**
 * 定时器配置映射
 */
export const SCHEDULER_CRON_CONFIG = {
  [SchedulerTrigger.EVERY_MINUTE]: '* * * * *',           // 每分钟
  [SchedulerTrigger.EVERY_5_MINUTES]: '*/5 * * * *',      // 每5分钟
  [SchedulerTrigger.EVERY_30_MINUTES]: '*/30 * * * *',    // 每半小时
  [SchedulerTrigger.EVERY_HOUR]: '0 11-22 * * *',         // 每小时（11-22点）
  [SchedulerTrigger.OVERNIGHT]: '0 22 * * *'              // 隔夜（22点）
} as const;

/**
 * 定时器API请求接口
 */
export interface SchedulerApiRequest {
  trigger: SchedulerTrigger;
  timestamp: string;
  metadata?: Record<string, any>;
}

/**
 * 定时器API响应接口
 */
export interface SchedulerApiResponse {
  success: boolean;
  trigger: SchedulerTrigger;
  message: string;
  timestamp: string;
  data?: any;
  error?: string;
}

/**
 * 任务状态
 */
export interface JobStatus {
  trigger: SchedulerTrigger;
  description: string;
  enabled: boolean;
  running: boolean;
  lastRun?: string;
  nextRun?: string;
  cronExpression: string;
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
  API = 'api'                // API 手动调用
} 
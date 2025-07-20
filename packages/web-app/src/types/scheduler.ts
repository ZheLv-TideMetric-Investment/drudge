/**
 * 定时器触发器类型枚举
 */
export enum SchedulerTrigger {
  EVERY_MINUTE = 'every_minute', // 每分钟
  EVERY_5_MINUTES = 'every_5_minutes', // 每5分钟
  EVERY_30_MINUTES = 'every_30_minutes', // 每半小时
  EVERY_HOUR = 'every_hour', // 每小时（全天24小时）
  EVERY_HOUR_05 = 'every_hour_05', // 每小时05分（全天24小时）
  DAYTIME = 'daytime', // 白天（11-22点）
  DAYTIME_05 = 'daytime_05', // 白天05分（11-22点）
  OVERNIGHT = 'overnight', // 隔夜（10点）
  OVERNIGHT_05 = 'overnight_05', // 隔夜（10点05分）
  WEEKLY_FRIDAY_1605 = 'weekly_friday_1605', // 每周五16:05分
}

/**
 * 定时器配置映射
 */
export const SCHEDULER_CRON_CONFIG = {
  [SchedulerTrigger.EVERY_MINUTE]: '* * * * *', // 每分钟
  [SchedulerTrigger.EVERY_5_MINUTES]: '*/5 * * * *', // 每5分钟
  [SchedulerTrigger.EVERY_30_MINUTES]: '*/30 * * * *', // 每半小时
  [SchedulerTrigger.EVERY_HOUR]: '0 * * * *', // 每小时（全天24小时）
  [SchedulerTrigger.EVERY_HOUR_05]: '5 * * * *', // 每小时05分（全天24小时）
  [SchedulerTrigger.DAYTIME]: '0 11-22 * * *', // 白天（11-22点）
  [SchedulerTrigger.DAYTIME_05]: '5 11-22 * * *', // 白天05分（11-22点）
  [SchedulerTrigger.OVERNIGHT]: '0 10 * * *', // 隔夜（10点）
  [SchedulerTrigger.OVERNIGHT_05]: '5 10 * * *', // 隔夜（10点05分）
  [SchedulerTrigger.WEEKLY_FRIDAY_1605]: '5 16 * * 5', // 每周五16:05分
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
 * 通知类型
 */
export enum NotificationType {
  HIGH_LEVEL_NEWS = 'high_level_news',
  HOURLY_SUMMARY = 'hourly_summary',
  DAILY_SUMMARY = 'daily_summary',
  SYSTEM_ALERT = 'system_alert',
}
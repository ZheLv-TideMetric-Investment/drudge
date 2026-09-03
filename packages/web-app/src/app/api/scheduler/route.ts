import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { TimeZoneUtils } from '../../../lib/utils/timezone';
import {
  SchedulerTrigger,
  SchedulerApiRequest,
  SchedulerApiResponse,
} from '../../../types/scheduler';
import { highLevelNewsScanner } from '../../../lib/services/high-level-scanner';
import { summaryService } from '../../../lib/services/summary';
import { initializeServices } from '../../../lib/services/init';

// 请求验证模式
const schedulerRequestSchema = z.object({
  trigger: z.nativeEnum(SchedulerTrigger),
  timestamp: z.string(),
  metadata: z.record(z.unknown()).optional(),
});

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;

const getBeijingWeekday = (date: Date): number => {
  const beijingTime = new Date(date.getTime() + BEIJING_OFFSET_MS);
  return beijingTime.getUTCDay();
};

/**
 * 统一调度API接口
 * 处理所有定时器触发器的请求
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    // 确保服务已初始化
    await initializeServices();

    // 解析请求体
    const body = await request.json();
    const validatedBody = schedulerRequestSchema.parse(body) as SchedulerApiRequest;

    console.log(
      `[Scheduler API] 收到触发器请求: ${validatedBody.trigger} at ${validatedBody.timestamp}`
    );

    // 根据触发器类型执行不同的逻辑
    const result = await executeSchedulerLogic(validatedBody);

    const response: SchedulerApiResponse = {
      success: true,
      trigger: validatedBody.trigger,
      message: result.message,
      timestamp: TimeZoneUtils.nowUTC(),
      data: result.data,
    };

    const duration = Date.now() - startTime;
    console.log(`[Scheduler API] 触发器 ${validatedBody.trigger} 执行完成，耗时: ${duration}ms`);

    return NextResponse.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    console.error('[Scheduler API] 执行失败:', errorMessage);

    const errorResponse: SchedulerApiResponse = {
      success: false,
      trigger: SchedulerTrigger.EVERY_MINUTE, // 默认值
      message: `调度器执行失败: ${errorMessage}`,
      timestamp: TimeZoneUtils.nowUTC(),
      error: errorMessage,
    };

    return NextResponse.json(errorResponse, { status: 500 });
  }
}

/**
 * 根据触发器类型执行相应的业务逻辑
 */
async function executeSchedulerLogic(request: SchedulerApiRequest) {
  const { trigger, timestamp, metadata } = request;

  switch (trigger) {
    case SchedulerTrigger.EVERY_MINUTE:
      return await handleEveryMinute(timestamp, metadata);

    case SchedulerTrigger.EVERY_5_MINUTES:
      return await handleEvery5Minutes(timestamp, metadata);

    case SchedulerTrigger.EVERY_30_MINUTES:
      return await handleEvery30Minutes(timestamp, metadata);

    case SchedulerTrigger.EVERY_HOUR:
      return await handleEveryHour(timestamp, metadata);

    case SchedulerTrigger.EVERY_HOUR_05:
      return await handleEveryHour05(timestamp, metadata);

    case SchedulerTrigger.DAYTIME:
      return await handleDaytime(timestamp, metadata);

    case SchedulerTrigger.DAYTIME_05:
      return await handleDaytime05(timestamp, metadata);

    case SchedulerTrigger.OVERNIGHT:
      return await handleOvernight(timestamp, metadata);

    case SchedulerTrigger.OVERNIGHT_05:
      return await handleOvernight05(timestamp, metadata);

    case SchedulerTrigger.WEEKLY_FRIDAY_1605:
      return await handleWeeklyFriday1605(timestamp, metadata);

    default:
      throw new Error(`未知的触发器类型: ${trigger}`);
  }
}

/**
 * 处理每分钟触发器
 * 可用于系统健康检查、轻量级监控等
 */
async function handleEveryMinute(timestamp: string, metadata?: Record<string, unknown>) {
  console.log(`[每分钟触发器] 执行时间: ${timestamp}`);

  // 这里可以放置需要每分钟执行的轻量级任务
  // 例如：系统状态检查、内存监控等

  return {
    message: '每分钟触发器执行成功',
    data: {
      executedAt: timestamp,
      type: 'minute_check',
      metadata,
    },
  };
}

/**
 * 处理每5分钟触发器
 * 高级别新闻扫描
 */
async function handleEvery5Minutes(timestamp: string, metadata?: Record<string, unknown>) {
  console.log(`[每5分钟触发器] 执行高级别新闻扫描: ${timestamp}`);

  try {
    const scanResult = await highLevelNewsScanner.scanHighLevelNews(undefined, undefined, {
      sendNotifications: true,
      skipProcessed: true,
    });

    if (!scanResult.success) {
      throw new Error(scanResult.error || '高级别新闻扫描失败');
    }

    return {
      message: `高级别新闻扫描完成，发现 ${scanResult.found} 条新闻`,
      data: {
        executedAt: timestamp,
        found: scanResult.found,
        sent: scanResult.sent,
        period: scanResult.period,
        metadata,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '高级别新闻扫描失败';
    throw new Error(`高级别新闻扫描失败: ${errorMessage}`);
  }
}

/**
 * 处理每半小时触发器
 * 可用于中等频率的数据更新、缓存刷新等
 */
async function handleEvery30Minutes(timestamp: string, metadata?: Record<string, unknown>) {
  console.log(`[每半小时触发器] 执行时间: ${timestamp}`);

  // 这里可以放置需要每半小时执行的任务
  // 例如：数据缓存更新、中等频率的数据处理等

  return {
    message: '每半小时触发器执行成功',
    data: {
      executedAt: timestamp,
      type: 'half_hour_task',
      metadata,
    },
  };
}

/**
 * 处理每小时触发器（全天24小时）
 * 通用小时级任务
 */
async function handleEveryHour(timestamp: string, metadata?: Record<string, unknown>) {
  console.log(`[每小时触发器] 全天每小时执行: ${timestamp}`);

  // 这里可以放置需要全天24小时每小时执行的任务
  // 例如：系统清理、数据备份、健康检查等

  return {
    message: '每小时触发器执行成功（全天24小时）',
    data: {
      executedAt: timestamp,
      type: 'every_hour_24h',
      metadata,
    },
  };
}

/**
 * 处理每小时05分触发器（全天24小时）
 * 通用小时级延迟任务
 */
async function handleEveryHour05(timestamp: string, metadata?: Record<string, unknown>) {
  console.log(`[每小时05分触发器] 全天每小时05分执行: ${timestamp}`);

  // 这里可以放置需要全天24小时每小时05分执行的任务
  // 例如：数据处理、日志分析等

  return {
    message: '每小时05分触发器执行成功（全天24小时）',
    data: {
      executedAt: timestamp,
      type: 'every_hour_05_24h',
      metadata,
    },
  };
}

/**
 * 处理白天触发器（11-22点）
 * 工作时间任务
 */
async function handleDaytime(timestamp: string, metadata?: Record<string, unknown>) {
  console.log(`[白天触发器] 工作时间执行: ${timestamp}`);

  return {
    message: '白天触发器执行成功（11-22点）',
    data: {
      executedAt: timestamp,
      type: 'daytime',
      metadata,
    },
  };
}

/**
 * 处理白天05分触发器（11-22点）
 * 小时总结生成
 */
async function handleDaytime05(timestamp: string, metadata?: Record<string, unknown>) {
  console.log(`[白天05分触发器] 执行小时总结: ${timestamp}`);

  try {
    const currentHourRange = TimeZoneUtils.getCurrentHourRange();
    const hourEnd = new Date(currentHourRange.startTime);
    const hourStart = new Date(hourEnd.getTime() - HOUR_MS);

    const summaryResult = await summaryService.generateSummary(
      hourStart.toISOString(),
      hourEnd.toISOString(),
      true // 发送通知
    );
    if (!summaryResult.success) {
      throw new Error(summaryResult.error || summaryResult.message || '小时总结生成失败');
    }

    return {
      message: `小时总结生成完成: ${summaryResult.period}`,
      data: {
        ...summaryResult,
        executedAt: timestamp,
        metadata,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '总结生成失败';
    throw new Error(`小时总结生成失败: ${errorMessage}`);
  }
}

/**
 * 处理隔夜触发器（10点整）
 * 目前移动到10点05分执行
 */
async function handleOvernight(timestamp: string, metadata?: Record<string, unknown>) {
  console.log(`[隔夜触发器] : ${timestamp}`);

  return {
    message: '隔夜触发器执行成功',
    data: {
      executedAt: timestamp,
      type: 'overnight',
      metadata,
    },
  };
}

/**
 * 处理隔夜触发器（10点05分）
 * 每日总结生成
 */
async function handleOvernight05(timestamp: string, metadata?: Record<string, unknown>) {
  console.log(`[隔夜05分触发器] 执行每日总结: ${timestamp}`);

  try {
    // 计算总结时间范围：前一天22:05 - 今天10:05
    const todayRange = TimeZoneUtils.getTodayRange();
    const todayStart = new Date(todayRange.startTime);
    const summaryEnd = new Date(todayStart.getTime() + 10 * HOUR_MS);
    const summaryStart = new Date(summaryEnd.getTime() - 12 * HOUR_MS);

    const summaryResult = await summaryService.generateSummary(
      summaryStart.toISOString(),
      summaryEnd.toISOString(),
      true // 发送通知
    );
    if (!summaryResult.success) {
      throw new Error(summaryResult.error || summaryResult.message || '每日总结生成失败');
    }

    return {
      message: `每日总结生成完成: ${summaryResult.period}`,
      data: {
        ...summaryResult,
        executedAt: timestamp,
        metadata,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '每日总结生成失败';
    throw new Error(`每日总结生成失败: ${errorMessage}`);
  }
}

/**
 * 处理每周五16:05分触发器
 * 周报处理
 */
async function handleWeeklyFriday1605(timestamp: string, metadata?: Record<string, unknown>) {
  console.log(`[每周五16:05分触发器] 执行周报处理: ${timestamp}`);

  try {
    // 计算周报时间范围：上周五16:05 - 本周五16:05
    const todayRange = TimeZoneUtils.getTodayRange();
    const todayStart = new Date(todayRange.startTime);
    const weekday = getBeijingWeekday(new Date());
    const deltaDays = 5 - weekday;
    const weekEnd = new Date(todayStart.getTime() + deltaDays * DAY_MS + 16 * HOUR_MS);
    const weekStart = new Date(weekEnd.getTime() - 7 * DAY_MS);

    const summaryResult = await summaryService.generateSummary(
      weekStart.toISOString(),
      weekEnd.toISOString(),
      true // 发送通知
    );
    if (!summaryResult.success) {
      throw new Error(summaryResult.error || summaryResult.message || '周报生成失败');
    }

    return {
      message: `周报生成完成: ${summaryResult.period}`,
      data: {
        ...summaryResult,
        executedAt: timestamp,
        metadata,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '周报生成失败';
    throw new Error(`周报生成失败: ${errorMessage}`);
  }
}

/**
 * GET请求 - 获取调度器状态
 */
export async function GET() {
  try {
    // 确保服务已初始化
    await initializeServices();

    const status = {
      available_triggers: Object.values(SchedulerTrigger),
      server_time: TimeZoneUtils.nowUTC(),
      status: 'active',
    };

    return NextResponse.json(status);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '获取状态失败';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import moment from 'moment-timezone';
import {
  SchedulerTrigger,
  SchedulerApiRequest,
  SchedulerApiResponse,
  CallSource,
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
      timestamp: moment.tz('Asia/Shanghai').toISOString(),
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
      timestamp: moment.tz('Asia/Shanghai').toISOString(),
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
    // 使用定时扫描方法，会自动使用上次扫描时间作为起始时间
    const scanResult = await highLevelNewsScanner.scanHighLevelNewsScheduled(CallSource.SCHEDULER);

    return {
      message: `高级别新闻扫描完成，发现 ${scanResult.found} 条，发送 ${scanResult.sent} 条通知`,
      data: {
        ...scanResult,
        executedAt: timestamp,
        metadata,
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '扫描失败';
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
    const currentHour = moment().hour();

    // 只在11-22点生成总结
    if (currentHour < 11 || currentHour > 22) {
      return {
        message: `当前时间 ${currentHour}:05 不在工作时间范围 (11:05-22:05)`,
        data: {
          skipped: true,
          reason: '不在工作时间范围',
          executedAt: timestamp,
          metadata,
        },
      };
    }

    // 计算小时时间范围（从上一个小时05分到当前小时05分）
    const hourEnd = moment().hour(currentHour).minute(0).second(0).millisecond(0);
    const hourStart = moment(hourEnd).minute(0).subtract(1, 'hour');

    const summaryResult = await summaryService.generateSummary(
      hourStart.toISOString(),
      hourEnd.toISOString(),
      CallSource.SCHEDULER,
      true // 发送通知
    );

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
    const currentTime = moment();

    // 只在每天10:05执行
    if (currentTime.hour() !== 10 || currentTime.minute() !== 5) {
      return {
        message: `当前时间 ${currentTime.format('HH:mm')} 不是每日总结时间 (10:05)`,
        data: {
          skipped: true,
          reason: '不是每日总结时间',
          executedAt: timestamp,
          metadata,
        },
      };
    }

    // 计算总结时间范围：前一天22:05 - 今天10:05
    const summaryEnd = moment().hour(10).minute(0).second(0).millisecond(0);
    const summaryStart = moment(summaryEnd).subtract(1, 'day').hour(22).minute(0);

    const summaryResult = await summaryService.generateSummary(
      summaryStart.toISOString(),
      summaryEnd.toISOString(),
      CallSource.SCHEDULER,
      true // 发送通知
    );

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
    const currentTime = moment();

    // 确认是周五的16:05
    if (currentTime.day() !== 5 || currentTime.hour() !== 16 || currentTime.minute() !== 5) {
      return {
        message: `当前时间 ${currentTime.format('dddd HH:mm')} 不是周报时间 (周五 16:05)`,
        data: {
          skipped: true,
          reason: '不是周报时间',
          executedAt: timestamp,
          metadata,
        },
      };
    }

    // 计算周报时间范围：上周五16:05 - 本周五16:05
    const weekEnd = moment().day(5).hour(16).minute(0).second(0).millisecond(0);
    const weekStart = moment(weekEnd).subtract(1, 'week');

    const summaryResult = await summaryService.generateSummary(
      weekStart.toISOString(),
      weekEnd.toISOString(),
      CallSource.SCHEDULER,
      true // 发送通知
    );

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
      server_time: moment.tz('Asia/Shanghai').toISOString(),
      status: 'active',
    };

    return NextResponse.json(status);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '获取状态失败';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

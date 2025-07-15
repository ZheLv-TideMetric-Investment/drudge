import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { 
  SchedulerTrigger, 
  SchedulerApiRequest, 
  SchedulerApiResponse,
  CallSource 
} from '../../../types/scheduler';
import { highLevelNewsScanner } from '../../../lib/services/high-level-scanner';
import { summaryService } from '../../../lib/services/summary';

// 请求验证模式
const schedulerRequestSchema = z.object({
  trigger: z.nativeEnum(SchedulerTrigger),
  timestamp: z.string(),
  metadata: z.record(z.unknown()).optional()
});

/**
 * 统一调度API接口
 * 处理所有定时器触发器的请求
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // 解析请求体
    const body = await request.json();
    const validatedBody = schedulerRequestSchema.parse(body) as SchedulerApiRequest;
    
    console.log(`[Scheduler API] 收到触发器请求: ${validatedBody.trigger} at ${validatedBody.timestamp}`);
    
    // 根据触发器类型执行不同的逻辑
    const result = await executeSchedulerLogic(validatedBody);
    
    const response: SchedulerApiResponse = {
      success: true,
      trigger: validatedBody.trigger,
      message: result.message,
      timestamp: new Date().toISOString(),
      data: result.data
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
      timestamp: new Date().toISOString(),
      error: errorMessage
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
      
    case SchedulerTrigger.OVERNIGHT:
      return await handleOvernight(timestamp, metadata);
      
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
      metadata
    }
  };
}

/**
 * 处理每5分钟触发器
 * 高级别新闻扫描
 */
async function handleEvery5Minutes(timestamp: string, metadata?: Record<string, unknown>) {
  console.log(`[每5分钟触发器] 执行高级别新闻扫描: ${timestamp}`);
  
  try {
    const scanResult = await highLevelNewsScanner.scanHighLevelNews(CallSource.SCHEDULER);
    
    return {
      message: `高级别新闻扫描完成，发现 ${scanResult.found} 条，发送 ${scanResult.sent} 条通知`,
      data: {
        ...scanResult,
        executedAt: timestamp,
        metadata
      }
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
      metadata
    }
  };
}

/**
 * 处理每小时触发器（工作时间11-22点）
 * 小时总结生成
 */
async function handleEveryHour(timestamp: string, metadata?: Record<string, unknown>) {
  console.log(`[每小时触发器] 执行小时总结: ${timestamp}`);
  
  try {
    const summaryResult = await summaryService.generateHourlySummary(undefined, CallSource.SCHEDULER);
    
    return {
      message: `小时总结生成完成: ${summaryResult.period}`,
      data: {
        ...summaryResult,
        executedAt: timestamp,
        metadata
      }
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '总结生成失败';
    throw new Error(`小时总结生成失败: ${errorMessage}`);
  }
}

/**
 * 处理隔夜触发器（22点）
 * 每日总结生成
 */
async function handleOvernight(timestamp: string, metadata?: Record<string, unknown>) {
  console.log(`[隔夜触发器] 执行每日总结: ${timestamp}`);
  
  try {
    const summaryResult = await summaryService.generateDailySummary(CallSource.SCHEDULER);
    
    return {
      message: `每日总结生成完成: ${summaryResult.period}`,
      data: {
        ...summaryResult,
        executedAt: timestamp,
        metadata
      }
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '每日总结生成失败';
    throw new Error(`每日总结生成失败: ${errorMessage}`);
  }
}

/**
 * GET请求 - 获取调度器状态
 */
export async function GET() {
  try {
    const status = {
      available_triggers: Object.values(SchedulerTrigger),
      server_time: new Date().toISOString(),
      status: 'active'
    };
    
    return NextResponse.json(status);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '获取状态失败';
    return NextResponse.json(
      { error: errorMessage }, 
      { status: 500 }
    );
  }
} 
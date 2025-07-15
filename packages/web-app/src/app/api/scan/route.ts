import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { highLevelNewsScanner, ScanOptions } from '../../../lib/services/high-level-scanner';
import { CallSource } from '../../../types/scheduler';
import { initializeServices } from '../../../lib/services/init';

// 请求验证模式
const scanRequestSchema = z.object({
  startTime: z.string().optional().describe('开始时间 (ISO字符串)，不提供则使用上次扫描时间'),
  endTime: z.string().optional().describe('结束时间 (ISO字符串)，不提供则使用当前时间'),
  sendNotifications: z.boolean().optional().default(true).describe('是否发送通知'),
  skipProcessed: z.boolean().optional().default(true).describe('是否跳过已处理的新闻'),
  source: z.nativeEnum(CallSource).optional().default(CallSource.API)
});

/**
 * 扫描高级别新闻
 */
export async function POST(request: NextRequest) {
  try {
    // 确保服务已初始化
    await initializeServices();
    
    // 解析请求体
    const body = await request.json().catch(() => ({}));
    const validatedBody = scanRequestSchema.parse(body);
    
    console.log(`[Scan API] 收到扫描请求: ${validatedBody.startTime || 'auto'} - ${validatedBody.endTime || 'now'}`);
    
    // 构建扫描选项
    const options: ScanOptions = {
      sendNotifications: validatedBody.sendNotifications,
      skipProcessed: validatedBody.skipProcessed,
      source: validatedBody.source
    };
    
    // 执行扫描
    const result = await highLevelNewsScanner.scanHighLevelNews(
      validatedBody.startTime,
      validatedBody.endTime,
      options
    );
    
    return NextResponse.json({
      success: result.success,
      message: result.message,
      period: result.period,
      found: result.found,
      sent: result.sent,
      high_level_news: result.high_level_news,
      error: result.error,
      timestamp: result.timestamp
    });
    
  } catch (error) {
    console.error('[Scan API] 扫描失败:', error);
    
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    return NextResponse.json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * 获取扫描器状态和配置信息
 */
export async function GET() {
  try {
    // 获取扫描器状态
    const scannerStatus = highLevelNewsScanner.getStatus();
    
    const status = {
      scanner_status: scannerStatus,
      available_sources: Object.values(CallSource),
      supported_formats: ['ISO 8601 datetime string'],
      example_requests: {
        auto_scan: {
          description: '自动扫描（使用上次扫描时间到现在）',
          body: {}
        },
        time_range_scan: {
          description: '指定时间范围扫描',
          body: {
            startTime: '2025-01-15T10:00:00.000Z',
            endTime: '2025-01-15T11:00:00.000Z',
            sendNotifications: true,
            skipProcessed: false
          }
        },
        manual_scan: {
          description: '手动扫描最近30分钟（不跳过已处理）',
          body: {
            sendNotifications: true,
            skipProcessed: false
          }
        },
        query_only: {
          description: '仅查询不发送通知',
          body: {
            startTime: '2025-01-15T10:00:00.000Z',
            endTime: '2025-01-15T11:00:00.000Z',
            sendNotifications: false,
            skipProcessed: false
          }
        }
      },
      server_time: new Date().toISOString()
    };
    
    return NextResponse.json(status);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '获取状态失败';
    return NextResponse.json({
      error: errorMessage
    }, { status: 500 });
  }
} 
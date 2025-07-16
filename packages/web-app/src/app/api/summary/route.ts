import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import moment from 'moment-timezone';
import { summaryService, SummaryType } from '../../../lib/services/summary';
import { CallSource } from '../../../types/scheduler';
import { initializeServices } from '../../../lib/services/init';

// 请求验证模式
const summaryRequestSchema = z.object({
  startTime: z.string().describe('开始时间 (ISO字符串)'),
  endTime: z.string().describe('结束时间 (ISO字符串)'),
  summaryType: z.nativeEnum(SummaryType).optional().default(SummaryType.CUSTOM),
  source: z.nativeEnum(CallSource).optional().default(CallSource.API)
});

/**
 * 生成自定义时间范围的总结
 */
export async function POST(request: NextRequest) {
  try {
    // 确保服务已初始化
    await initializeServices();
    
    // 解析请求体
    const body = await request.json();
    const validatedBody = summaryRequestSchema.parse(body);
    
    console.log(`[Summary API] 收到总结请求: ${validatedBody.startTime} - ${validatedBody.endTime}, 类型: ${validatedBody.summaryType}`);
    
    // 生成总结
    const result = await summaryService.generateSummary(
      validatedBody.startTime,
      validatedBody.endTime,
      validatedBody.summaryType,
      validatedBody.source
    );
    
    return NextResponse.json({
      success: result.success,
      message: result.message,
      period: result.period,
      data: result.data,
      error: result.error,
      timestamp: result.timestamp
    });
    
  } catch (error) {
    console.error('[Summary API] 生成总结失败:', error);
    
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    return NextResponse.json({
      success: false,
      error: errorMessage,
      timestamp: moment.tz('Asia/Shanghai').toISOString()
    }, { status: 500 });
  }
}

/**
 * 获取总结服务状态和配置信息
 */
export async function GET() {
  try {
    const status = {
      available_types: Object.values(SummaryType),
      supported_formats: ['ISO 8601 datetime string'],
      example_request: {
        startTime: '2025-01-15T10:00:00.000Z',
        endTime: '2025-01-15T11:00:00.000Z',
        summaryType: 'custom',
        source: 'api'
      },
      server_time: moment.tz('Asia/Shanghai').toISOString()
    };
    
    return NextResponse.json(status);
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '获取状态失败';
    return NextResponse.json({
      error: errorMessage
    }, { status: 500 });
  }
} 
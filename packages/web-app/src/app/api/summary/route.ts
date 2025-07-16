import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { summaryService } from '../../../lib/services/summary';
import { CallSource } from '../../../types/scheduler';

// 定义验证模式
const summarySchema = z.object({
  startTime: z.string(),
  endTime: z.string(),
  sendNotification: z.boolean().optional().default(false),
  source: z.nativeEnum(CallSource).optional().default(CallSource.API),
});

/**
 * GET /api/summary - 生成新闻总结
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // 先获取参数
    const startTime = searchParams.get('startTime');
    const endTime = searchParams.get('endTime');
    const sendNotification = searchParams.get('sendNotification') === 'true';
    const source = searchParams.get('source') || CallSource.API;
    
    // 检查必要参数
    if (!startTime || !endTime) {
      return NextResponse.json({
        success: false,
        message: '缺少必要参数: startTime 和 endTime'
      }, { status: 400 });
    }

    // 使用 Zod 验证参数格式
    const validatedParams = summarySchema.parse({
      startTime,
      endTime,
      sendNotification,
      source,
    });

    console.log(`[Summary API] 收到总结请求: ${validatedParams.startTime} - ${validatedParams.endTime}, 通知: ${validatedParams.sendNotification}`);

    // 调用summary服务生成总结
    const result = await summaryService.generateSummary(
      validatedParams.startTime,
      validatedParams.endTime,
      validatedParams.source,
      validatedParams.sendNotification
    );

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('[Summary API] 参数验证失败:', error);
    
    return NextResponse.json({
      success: false,
      message: '参数验证失败',
      error: error instanceof Error ? error.message : '未知错误'
    }, { status: 400 });
  }
} 
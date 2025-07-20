import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { summaryService } from '../../../lib/services/summary';

// 定义验证模式
const summarySchema = z.object({
  startTime: z.string(),
  endTime: z.string(),
  sendNotification: z.boolean().optional().default(false),
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

    // 检查必要参数
    if (!startTime || !endTime) {
      return NextResponse.json(
        {
          success: false,
          message: '缺少必要参数: startTime 和 endTime',
          period: '',
          timestamp: new Date().toISOString(),
          error: 'Missing required parameters',
        },
        { status: 400 }
      );
    }

    // 使用 Zod 验证基本参数格式
    const validatedParams = summarySchema.parse({
      startTime,
      endTime,
      sendNotification,
    });

    console.log(
      `[Summary API] 收到总结请求: ${validatedParams.startTime} - ${validatedParams.endTime}, 通知: ${validatedParams.sendNotification}`
    );

    // 调用summary服务生成总结
    const result = await summaryService.generateSummary(
      validatedParams.startTime,
      validatedParams.endTime,
      validatedParams.sendNotification
    );

    // 根据结果返回适当的HTTP状态码
    const statusCode = result.success ? 200 : 500;

    // 记录结果日志
    if (result.success) {
      const data = result.data || {};
      if (data.empty) {
        console.log(`[Summary API] ${result.period} 时段没有新闻`);
      } else {
        console.log(
          `[Summary API] 总结生成成功: ${result.period}, 新闻数量: ${data.news_count || 0}, Level 1: ${data.high_level_count || 0}`
        );
      }
    } else {
      console.error(`[Summary API] 总结生成失败: ${result.message}`, result.error);
    }

    return NextResponse.json(result, { status: statusCode });
  } catch (error: unknown) {
    console.error('[Summary API] 参数验证失败:', error);

    return NextResponse.json(
      {
        success: false,
        message: '参数验证失败',
        period: '',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : '未知错误',
      },
      { status: 400 }
    );
  }
}

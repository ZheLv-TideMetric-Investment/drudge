import { NextResponse } from 'next/server';
import { scheduler } from '../../../../../lib/scheduler';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ jobName: string }> }
) {
  try {
    const { jobName } = await params;
    
    if (!jobName) {
      return NextResponse.json({
        success: false,
        error: '缺少任务名称参数',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    const result = await scheduler.triggerJob(jobName);
    
    return NextResponse.json({
      success: result,
      message: result ? `任务 ${jobName} 执行成功` : `任务 ${jobName} 执行失败`,
      timestamp: new Date().toISOString()
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 
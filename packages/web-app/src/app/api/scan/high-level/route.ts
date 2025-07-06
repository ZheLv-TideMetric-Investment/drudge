import { NextResponse } from 'next/server';
import { highLevelNewsScanner } from '../../../../lib/services/high-level-scanner';
import { CallSource } from '../../../../types/scheduler';

export async function POST(request: Request) {
  try {
    const { minutes } = await request.json().catch(() => ({}));
    
    const result = minutes ? 
      await highLevelNewsScanner.manualScan(minutes, CallSource.API) :
      await highLevelNewsScanner.scanHighLevelNews(CallSource.API);
    
    return NextResponse.json({
      success: result.success,
      found: result.found,
      sent: result.sent,
      message: result.message,
      period: result.period,
      high_level_news: result.high_level_news,
      error: result.error,
      timestamp: result.timestamp
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
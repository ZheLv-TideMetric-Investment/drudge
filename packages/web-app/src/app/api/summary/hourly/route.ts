import { NextResponse } from 'next/server';
import { summaryService } from '../../../../lib/services/summary';
import { CallSource } from '../../../../types/scheduler';

export async function POST(request: Request) {
  try {
    const { hour } = await request.json().catch(() => ({}));
    
    const result = await summaryService.generateHourlySummary(hour, CallSource.API);
    
    return NextResponse.json({
      success: result.success,
      message: result.message,
      period: result.period,
      data: result.data,
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
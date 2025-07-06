import { NextResponse } from 'next/server';
import { summaryService } from '../../../../lib/services/summary';
import { CallSource } from '../../../../types/scheduler';

export async function POST() {
  try {
    const result = await summaryService.generateDailySummary(CallSource.API);
    
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
import { NextResponse } from 'next/server';
import { scheduler } from '../../../../lib/scheduler';

export async function GET() {
  try {
    const status = scheduler.getStatus();
    return NextResponse.json({
      success: true,
      data: status,
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
import { NextResponse } from 'next/server';
import moment from 'moment-timezone';
import { graphService } from '../../../../lib/services/graph';

export async function GET() {
  try {
    const [graphStats, relationshipDistribution] = await Promise.all([
      graphService.getGraphStats(),
      graphService.getRelationshipDistribution()
    ]);

    return NextResponse.json({
      success: true,
      data: {
        ...graphStats,
        relationshipDistribution
      },
      timestamp: moment.tz('Asia/Shanghai').toISOString()
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('获取图谱统计信息失败:', errorMessage);
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      timestamp: moment.tz('Asia/Shanghai').toISOString()
    }, { status: 500 });
  }
} 
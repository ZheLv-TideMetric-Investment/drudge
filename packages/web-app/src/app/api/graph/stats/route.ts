import { NextResponse } from 'next/server';
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
      timestamp: new Date().toISOString()
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('获取图谱统计信息失败:', errorMessage);
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 
import { NextResponse } from 'next/server';
import { graphService } from '../../../../../../lib/services/graph';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ entityId: string }> }
) {
  try {
    const { entityId } = await params;
    const { searchParams } = new URL(request.url);
    const depth = parseInt(searchParams.get('depth') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    if (!entityId) {
      return NextResponse.json({
        success: false,
        error: '缺少实体ID',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    const neighborhoodData = await graphService.getEntityNeighborhood(entityId, depth, limit);

    return NextResponse.json({
      success: true,
      data: neighborhoodData,
      timestamp: new Date().toISOString()
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('获取实体邻居关系失败:', errorMessage);
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 
import { NextResponse } from 'next/server';
import { TimeZoneUtils } from '../../../../../lib/utils/timezone';
import { neo4jEntitiesService } from '../../../../../lib/neo4j';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const searchTerm = searchParams.get('searchTerm') ? decodeURIComponent(searchParams.get('searchTerm')!) : null;
    const nodeType = searchParams.get('nodeType');
    const limit = parseInt(searchParams.get('limit') || '20');

    // 允许空搜索词，这种情况下会返回所有数据

    const entities = await neo4jEntitiesService.searchEntities(
      searchTerm || '',
      nodeType || undefined,
      limit
    );

    return NextResponse.json({
      success: true,
      data: entities,
      count: entities.length,
      timestamp: TimeZoneUtils.nowUTC()
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('搜索实体失败:', errorMessage);
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      timestamp: TimeZoneUtils.nowUTC()
    }, { status: 500 });
  }
} 

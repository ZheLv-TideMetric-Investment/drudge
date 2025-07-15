import { NextResponse } from 'next/server';
import { queryService } from '../../../../../lib/services/query';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const searchTerm = searchParams.get('searchTerm');
    const nodeType = searchParams.get('nodeType');
    const limit = parseInt(searchParams.get('limit') || '20');

    if (!searchTerm) {
      return NextResponse.json({
        success: false,
        error: '缺少搜索关键词',
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    const entities = await queryService.searchEntities(searchTerm, nodeType || undefined, limit);

    return NextResponse.json({
      success: true,
      data: entities,
      count: entities.length,
      timestamp: new Date().toISOString()
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('搜索实体失败:', errorMessage);
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 
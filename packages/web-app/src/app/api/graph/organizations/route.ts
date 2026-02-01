import { NextResponse } from 'next/server';
import { TimeZoneUtils } from '../../../../lib/utils/timezone';
import { neo4jEntitiesService } from '../../../../lib/neo4j';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const searchTerm = searchParams.get('searchTerm');
    const limit = parseInt(searchParams.get('limit') || '20');

    let organizations;

    if (searchTerm) {
      // 搜索特定机构
      organizations = await neo4jEntitiesService.searchEntities(searchTerm, 'organization', limit);
    } else {
      // 获取所有机构（按连接数排序）
      organizations = await neo4jEntitiesService.searchEntities('', 'organization', limit);
    }

    return NextResponse.json({
      success: true,
      data: organizations,
      count: organizations.length,
      timestamp: TimeZoneUtils.nowUTC()
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('获取机构数据失败:', errorMessage);
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      timestamp: TimeZoneUtils.nowUTC()
    }, { status: 500 });
  }
} 

import { NextResponse } from 'next/server';
import moment from 'moment-timezone';
import { queryService } from '../../../../../lib/services/query';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const searchTerm = searchParams.get('searchTerm') ? decodeURIComponent(searchParams.get('searchTerm')!) : null;
    const nodeType = searchParams.get('nodeType');
    const limit = parseInt(searchParams.get('limit') || '20');

    // 允许空搜索词，这种情况下会返回所有数据
    // if (!searchTerm) {
    //   return NextResponse.json({
    //     success: false,
    //     error: '缺少搜索关键词',
    //     timestamp: moment.tz('Asia/Shanghai').toISOString()
    //   }, { status: 400 });
    // }

    const entities = await queryService.searchEntities(searchTerm || '', nodeType || undefined, limit);

    return NextResponse.json({
      success: true,
      data: entities,
      count: entities.length,
      timestamp: moment.tz('Asia/Shanghai').toISOString()
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('搜索实体失败:', errorMessage);
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      timestamp: moment.tz('Asia/Shanghai').toISOString()
    }, { status: 500 });
  }
} 
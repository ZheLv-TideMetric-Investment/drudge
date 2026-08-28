import { NextResponse } from 'next/server';
import { neo4jGraphService } from '../../../../lib/neo4j';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');
    const limit = parseInt(searchParams.get('limit') || '50');
    const nodeType = searchParams.get('nodeType');

    let graphData;

    if (query) {
      // 搜索图谱数据
      graphData = await neo4jGraphService.searchGraph(query, limit);
    } else if (nodeType) {
      // 按节点类型获取图谱数据
      graphData = await neo4jGraphService.getGraphByNodeType(nodeType, limit);
    } else {
      // 获取图谱概览
      graphData = await neo4jGraphService.getGraphOverview(limit);
    }

    return NextResponse.json({
      success: true,
      data: graphData,
      timestamp: new Date().toISOString()
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('获取图谱数据失败:', errorMessage);

    return NextResponse.json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

import { NextRequest } from 'next/server';
import { tzGraph } from '../../../../lib/neo4j/timezone-wrapper';
import { buildSuccessResponse, buildErrorResponse } from '../../../../lib/utils/api-helpers';

/**
 * GET /api/graph/hot-rank - 获取热点排行数据
 * 
 * 时区处理：
 * - 时间计算基于北京时间
 * - 返回的时间字段自动格式化为北京时间显示
 * - 响应时间戳使用北京时间
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7');
    const limit = parseInt(searchParams.get('limit') || '20');

    console.log(`[Hot Rank API] 获取热点排行: 过去${days}天, 限制${limit}条`);

    // 使用时区感知的graph服务
    const hotRankData = await tzGraph.getHotRankData(days, limit);

    return buildSuccessResponse(hotRankData, {
      timeFields: ['timestamp'], // 时间字段已经由tzGraph自动处理
      message: `成功获取过去${days}天的热点排行数据`
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Hot Rank API] 获取热点排行失败:', errorMessage);
    
    return buildErrorResponse(errorMessage);
  }
} 
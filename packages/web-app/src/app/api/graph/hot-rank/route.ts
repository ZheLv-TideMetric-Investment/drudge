import { NextRequest } from 'next/server';
import { neo4jGraphService } from '../../../../lib/neo4j';
import { buildSuccessResponse, buildErrorResponse } from '../../../../lib/utils/api-helpers';
import { formatTimeFields, formatBeijingTime } from '../../../../lib/utils/timezone';

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

    const hotRankData = await neo4jGraphService.getHotRankData(days, limit);
    const formattedHotNews = formatTimeFields(
      hotRankData.hotNews || [],
      ['timestamp'],
      'YYYY-MM-DD HH:mm:ss'
    );
    const formattedTimeStats = (hotRankData.timeStats || []).map((stat: any) => ({
      ...stat,
      date_display: formatBeijingTime(stat.newsDate || stat.date, 'YYYY-MM-DD')
    }));

    const responseData = {
      ...hotRankData,
      hotNews: formattedHotNews,
      timeStats: formattedTimeStats
    };

    return buildSuccessResponse(responseData, {
      timeFields: [],
      message: `成功获取过去${days}天的热点排行数据`
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Hot Rank API] 获取热点排行失败:', errorMessage);
    
    return buildErrorResponse(errorMessage);
  }
} 

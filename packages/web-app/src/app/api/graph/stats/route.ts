import { tzAnalytics, tzGraph } from '@/lib/neo4j/timezone-wrapper';
import { buildSuccessResponse, buildErrorResponse } from '@/lib/utils/api-helpers';

/**
 * GET /api/graph/stats - 获取图谱统计数据
 * 
 * 时区处理：
 * - 时间统计数据自动格式化为北京时间显示
 * - 响应时间戳使用北京时间
 */
export async function GET() {
  try {
    const [databaseStats, timeStats, graphStats] = await Promise.all([
      tzAnalytics.getTodayStats(),           // 使用时区感知的今日统计
      tzAnalytics.getTimeStats(),            // 使用时区感知的时间统计
      tzGraph.getGraphStats(),               // 使用时区感知的图谱统计
    ]);

    const responseData = {
      overview: databaseStats,
      timeStats,
      graphStats,
      // relationshipDistribution, // 暂时注释掉，因为tzAnalytics中没有这个方法
      metadata: {
        generated_at: timeStats.metadata?.beijing_now || '',
        timezone: 'Asia/Shanghai'
      }
    };

    return buildSuccessResponse(responseData, {
      timeFields: [], // 时间字段已经由时区感知服务处理
      message: '成功获取图谱统计数据'
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '获取图谱统计失败';
    console.error('[Graph Stats API] 获取图谱统计失败:', errorMessage);
    
    return buildErrorResponse(errorMessage);
  }
} 
import { neo4jAnalyticsService, neo4jGraphService } from '@/lib/neo4j';
import { buildSuccessResponse, buildErrorResponse } from '@/lib/utils/api-helpers';
import { TimeZoneUtils, formatBeijingTime, TIME_FORMATS } from '@/lib/utils/timezone';
import { BEIJING_TIMEZONE } from '@drudge/common';

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
      neo4jAnalyticsService.getDatabaseStats(),
      neo4jAnalyticsService.getTimeStats(),
      neo4jGraphService.getGraphData(),
    ]);

    const todayRange = TimeZoneUtils.getTodayRange();
    const overview = {
      ...databaseStats,
      period: {
        start: formatBeijingTime(todayRange.startTime, 'YYYY-MM-DD HH:mm:ss'),
        end: formatBeijingTime(todayRange.endTime, 'YYYY-MM-DD HH:mm:ss'),
        timezone: BEIJING_TIMEZONE
      }
    };

    const formattedTimeStats = {
      ...timeStats,
      daily: timeStats.daily?.map((day: any) => ({
        ...day,
        date_display: formatBeijingTime(day.date || day.dateDisplay, 'MM月DD日')
      })),
      todayHourly: timeStats.todayHourly?.map((hour: any) => ({
        ...hour,
        time_display: `${hour.hour.toString().padStart(2, '0')}:00`
      })),
      metadata: {
        ...timeStats.metadata,
        beijing_now: TimeZoneUtils.now(TIME_FORMATS.FULL),
        timezone: BEIJING_TIMEZONE
      }
    };

    const graphStatsWithMeta = {
      ...graphStats,
      generated_at: TimeZoneUtils.now(TIME_FORMATS.FULL),
      generated_at_utc: TimeZoneUtils.nowUTC()
    };

    const responseData = {
      overview,
      timeStats: formattedTimeStats,
      graphStats: graphStatsWithMeta,
      // relationshipDistribution, // 暂时注释掉，因为tzAnalytics中没有这个方法
      metadata: {
        generated_at: formattedTimeStats.metadata.beijing_now || '',
        timezone: BEIJING_TIMEZONE
      }
    };

    return buildSuccessResponse(responseData, {
      timeFields: [],
      message: '成功获取图谱统计数据'
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '获取图谱统计失败';
    console.error('[Graph Stats API] 获取图谱统计失败:', errorMessage);
    
    return buildErrorResponse(errorMessage);
  }
} 

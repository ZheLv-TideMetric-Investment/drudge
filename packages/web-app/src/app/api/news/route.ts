import { NextRequest } from 'next/server';
import { z } from 'zod';
import { neo4jNewsService } from '../../../lib/neo4j';
import { 
  parsePaginationParams, 
  buildSuccessResponse, 
  buildErrorResponse,
  validateTimeRange 
} from '../../../lib/utils/api-helpers';
import { buildTimeRange, formatTimeFields } from '../../../lib/utils/timezone';

// 请求参数验证模式
const newsListSchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  keyword: z.string().optional(),
  level: z.string().optional(),
  sortBy: z.enum(['timestamp', 'processedAt']).optional().default('timestamp'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc')
});

/**
 * GET /api/news - 获取新闻列表
 * 支持分页、时间筛选、关键词搜索等功能
 * 
 * 时区处理：
 * - 输入的时间参数视为北京时间
 * - 输出的时间字段自动格式化为北京时间显示
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // 解析和验证参数
    const params = newsListSchema.parse({
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '20',
      startTime: searchParams.get('startTime') || undefined,
      endTime: searchParams.get('endTime') || undefined,
      keyword: searchParams.get('keyword') || undefined,
      level: searchParams.get('level') || undefined,
      sortBy: searchParams.get('sortBy') || 'timestamp',
      sortOrder: searchParams.get('sortOrder') || 'desc'
    });

    // 验证时间范围
    const timeValidation = validateTimeRange(params.startTime, params.endTime);
    if (!timeValidation.isValid) {
      return buildErrorResponse(timeValidation.error!, 400);
    }

    // 解析分页参数
    const { page, limit } = parsePaginationParams(searchParams);

    console.log(`[News API] 获取新闻列表请求: 页码=${page}, 每页=${limit}, 关键词=${params.keyword}`);

    const timeRange = buildTimeRange(params.startTime, params.endTime);

    // 构建查询条件对象（时间参数转换为UTC）
    const queryConditions = {
      page,
      limit,
      startTime: timeRange.startTime,
      endTime: timeRange.endTime,
      keyword: params.keyword,
      level: params.level,
      sortBy: params.sortBy,
      sortOrder: params.sortOrder
    };

    const result = await neo4jNewsService.getNewsWithPagination(queryConditions);
    const formattedNews = formatTimeFields(
      result.news,
      ['timestamp', 'processedAt'],
      'YYYY-MM-DD HH:mm:ss'
    );

    // 构建分页响应数据
    const responseData = {
      news: formattedNews,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
        hasNext: page < Math.ceil(result.total / limit),
        hasPrev: page > 1
      },
      filters: {
        startTime: params.startTime,
        endTime: params.endTime,
        keyword: params.keyword,
        level: params.level,
        sortBy: params.sortBy,
        sortOrder: params.sortOrder
      }
    };

    return buildSuccessResponse(responseData, {
      timeFields: [],
      message: `成功获取${result.news.length}条新闻`
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '获取新闻列表失败';
    console.error('[News API] 获取新闻列表失败:', errorMessage);
    
    return buildErrorResponse(errorMessage);
  }
} 

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { tzNews } from '../../../../lib/neo4j/timezone-wrapper';
import { 
  parsePaginationParams, 
  buildSuccessResponse, 
  buildErrorResponse,
  validateTimeRange 
} from '../../../../lib/utils/api-helpers';

// 搜索参数验证模式
const searchSchema = z.object({
  q: z.string().min(1, '搜索关键词不能为空'),
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  level: z.string().optional(),
  searchFields: z.enum(['title', 'content', 'both']).optional().default('both'),
  sortBy: z.enum(['relevance', 'timestamp', 'processedAt']).optional().default('relevance')
});

/**
 * GET /api/news/search - 搜索新闻
 * 支持关键词搜索、时间筛选、相关性排序等功能
 * 
 * 时区处理：
 * - 输入的时间参数视为北京时间
 * - 输出的时间字段自动格式化为北京时间显示
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // 解析和验证参数
    const params = searchSchema.parse({
      q: searchParams.get('q'),
      page: searchParams.get('page') || '1',
      limit: searchParams.get('limit') || '20',
      startTime: searchParams.get('startTime') || undefined,
      endTime: searchParams.get('endTime') || undefined,
      level: searchParams.get('level') || undefined,
      searchFields: searchParams.get('searchFields') || 'both',
      sortBy: searchParams.get('sortBy') || 'relevance'
    });

    // 验证时间范围
    const timeValidation = validateTimeRange(params.startTime, params.endTime);
    if (!timeValidation.isValid) {
      return buildErrorResponse(timeValidation.error!, 400);
    }

    // 解析分页参数
    const { page, limit } = parsePaginationParams(searchParams);

    console.log(`[News Search API] 搜索请求: 关键词="${params.q}", 页码=${page}, 每页=${limit}`);

    // 构建搜索条件对象（时区转换在tzNews中自动处理）
    const searchConditions = {
      keyword: params.q,
      searchFields: params.searchFields,
      startTime: params.startTime,  // 北京时间，tzNews会自动转换为UTC
      endTime: params.endTime,      // 北京时间，tzNews会自动转换为UTC
      level: params.level,
      sortBy: params.sortBy,
      page,
      limit
    };

    // 使用时区感知的新闻服务进行搜索
    const searchResult = await tzNews.searchNews(searchConditions);

    // 构建响应数据
    const responseData = {
      news: searchResult.news,  // 时间字段已经自动格式化为北京时间
      pagination: {
        page,
        limit,
        total: searchResult.total,
        totalPages: Math.ceil(searchResult.total / limit),
        hasNext: page < Math.ceil(searchResult.total / limit),
        hasPrev: page > 1
      },
      searchInfo: {
        keyword: params.q,
        searchFields: params.searchFields,
        sortBy: params.sortBy,
        found: searchResult.total
      },
      filters: {
        startTime: params.startTime,
        endTime: params.endTime,
        level: params.level
      }
    };

    return buildSuccessResponse(responseData, {
      timeFields: [], // 时间字段已经由tzNews处理，无需重复格式化
      message: `找到${searchResult.total}条相关新闻`
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '新闻搜索失败';
    console.error('[News Search API] 搜索失败:', errorMessage);
    
    return buildErrorResponse(errorMessage);
  }
} 
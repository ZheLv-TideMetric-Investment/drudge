import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import moment from 'moment-timezone';
import { queryService } from '../../../lib/services/query';

// 查询参数类型
interface QueryParams {
  limit: number;
  offset: number;
  startTime?: string;
  endTime?: string;
  keyword?: string;
  level?: string;
}

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

    const page = parseInt(params.page);
    const limit = parseInt(params.limit);
    const offset = (page - 1) * limit;

    console.log(`[News API] 获取新闻列表请求: 页码=${page}, 每页=${limit}, 关键词=${params.keyword}`);

    // 构建 Cypher 查询
    const whereConditions: string[] = [];
    const queryParams: QueryParams = { limit, offset };

    // 时间范围筛选
    if (params.startTime) {
      whereConditions.push('n.timestamp >= $startTime');
      queryParams.startTime = moment(params.startTime).utc().toISOString();
    }
    
    if (params.endTime) {
      whereConditions.push('n.timestamp <= $endTime');
      queryParams.endTime = moment(params.endTime).utc().toISOString();
    }

    // 新闻级别筛选
    if (params.level) {
      whereConditions.push('n.news_level = $level');
      queryParams.level = params.level;
    }

    // 关键词搜索
    if (params.keyword) {
      whereConditions.push('(toLower(n.title) CONTAINS toLower($keyword) OR toLower(n.content) CONTAINS toLower($keyword))');
      queryParams.keyword = params.keyword;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // 排序字段映射
    const sortField = params.sortBy === 'processedAt' ? 'n.processedAt' : 'n.timestamp';
    const sortDirection = params.sortOrder.toUpperCase();

    // 获取新闻列表的查询
    const newsQuery = `
      MATCH (n:News)
      ${whereClause}
      RETURN 
        n.id as id,
        n.title as title,
        n.content as content,
        n.news_level as level,
        n.timestamp as timestamp,
        n.processedAt as processedAt,
        n.source as source,
        n.url as url
      ORDER BY ${sortField} ${sortDirection}
      SKIP $offset
      LIMIT $limit
    `;

    // 获取总数的查询
    const countQuery = `
      MATCH (n:News)
      ${whereClause}
      RETURN count(n) as total
    `;

    // 执行查询
    const [newsResult, countResult] = await Promise.all([
      queryService.neo4j.executeQuery(newsQuery, queryParams),
      queryService.neo4j.executeQuery(countQuery, queryParams)
    ]);

    const news = newsResult.records.map((record: { get: (key: string) => any }) => ({
      id: record.get('id'),
      title: record.get('title'),
      content: record.get('content'),
      level: record.get('level'),
      timestamp: record.get('timestamp'),
      processedAt: record.get('processedAt'),
      source: record.get('source'),
      url: record.get('url'),
      // 格式化时间显示
      displayTime: moment(record.get('timestamp')).tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm:ss'),
      processedDisplayTime: record.get('processedAt') ? 
        moment(record.get('processedAt')).tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm:ss') : null
    }));

    const total = countResult.records[0]?.get('total')?.toNumber() || 0;
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      success: true,
      data: {
        news,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNext: page < totalPages,
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
      },
      timestamp: moment.tz('Asia/Shanghai').toISOString()
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : '获取新闻列表失败';
    console.error('[News API] 获取新闻列表失败:', errorMessage);
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      timestamp: moment.tz('Asia/Shanghai').toISOString()
    }, { status: 500 });
  }
} 
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import moment from 'moment-timezone';
import { queryService } from '../../../../lib/services/query';

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

// 搜索参数类型
interface SearchParams {
  limit: number;
  offset: number;
  keyword: string;
  startTime?: string;
  endTime?: string;
  level?: string;
}

/**
 * GET /api/news/search - 搜索新闻
 * 支持关键词搜索、时间筛选、相关性排序等功能
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

    const page = parseInt(params.page);
    const limit = parseInt(params.limit);
    const offset = (page - 1) * limit;

    console.log(`[News Search API] 搜索请求: 关键词="${params.q}", 页码=${page}, 每页=${limit}`);

    // 构建搜索条件
    const whereConditions: string[] = [];
    const queryParams: SearchParams = { limit, offset, keyword: params.q };

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

    // 构建搜索字段条件
    let searchCondition = '';
    switch (params.searchFields) {
      case 'title':
        searchCondition = 'toLower(n.title) CONTAINS toLower($keyword)';
        break;
      case 'content':
        searchCondition = 'toLower(n.content) CONTAINS toLower($keyword)';
        break;
      case 'both':
      default:
        searchCondition = '(toLower(n.title) CONTAINS toLower($keyword) OR toLower(n.content) CONTAINS toLower($keyword))';
    }

    whereConditions.push(searchCondition);
    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

    // 构建排序子句
    let orderClause = '';
    switch (params.sortBy) {
      case 'timestamp':
        orderClause = 'ORDER BY n.timestamp DESC';
        break;
      case 'processedAt':
        orderClause = 'ORDER BY n.processedAt DESC';
        break;
      case 'relevance':
      default:
        // 简单的相关性排序：标题匹配优先，然后按时间
        orderClause = `
          ORDER BY 
            CASE WHEN toLower(n.title) CONTAINS toLower($keyword) THEN 1 ELSE 2 END,
            n.timestamp DESC
        `;
    }

    // 搜索查询（包含相关性评分）
    const searchQuery = `
      MATCH (n:News)
      ${whereClause}
      WITH n,
        CASE 
          WHEN toLower(n.title) CONTAINS toLower($keyword) THEN 2
          WHEN toLower(n.content) CONTAINS toLower($keyword) THEN 1
          ELSE 0
        END as relevanceScore
      RETURN 
        n.id as id,
        n.title as title,
        n.content as content,
        n.news_level as level,
        n.timestamp as timestamp,
        n.processedAt as processedAt,
        n.source as source,
        n.url as url,
        relevanceScore
      ${orderClause}
      SKIP $offset
      LIMIT $limit
    `;

    // 获取搜索结果总数
    const countQuery = `
      MATCH (n:News)
      ${whereClause}
      RETURN count(n) as total
    `;

    // 执行查询
    const [searchResult, countResult] = await Promise.all([
      queryService.neo4j.executeQuery(searchQuery, queryParams),
      queryService.neo4j.executeQuery(countQuery, queryParams)
    ]);

    // 处理搜索结果，添加关键词高亮
    const news = searchResult.records.map((record: { get: (key: string) => any }) => {
      const title = record.get('title') || '';
      const content = record.get('content') || '';
      
      // 简单的关键词高亮处理
      const highlightKeyword = (text: string, keyword: string) => {
        if (!text || !keyword) return text;
        const regex = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
      };

      return {
        id: record.get('id'),
        title: record.get('title'),
        content: record.get('content'),
        level: record.get('level'),
        timestamp: record.get('timestamp'),
        processedAt: record.get('processedAt'),
        source: record.get('source'),
        url: record.get('url'),
        relevanceScore: record.get('relevanceScore'),
        // 高亮显示版本
        highlightedTitle: highlightKeyword(title, params.q),
        highlightedContent: content ? highlightKeyword(content.substring(0, 200) + '...', params.q) : '',
        // 格式化时间显示
        displayTime: moment(record.get('timestamp')).tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm:ss'),
        processedDisplayTime: record.get('processedAt') ? 
          moment(record.get('processedAt')).tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm:ss') : null
      };
    });

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
        searchParams: {
          q: params.q,
          startTime: params.startTime,
          endTime: params.endTime,
          level: params.level,
          searchFields: params.searchFields,
          sortBy: params.sortBy
        }
      },
      timestamp: moment.tz('Asia/Shanghai').toISOString()
    });

  } catch (error) {
    const errorMessage = error instanceof z.ZodError 
      ? `参数验证失败: ${error.errors.map(e => e.message).join(', ')}`
      : error instanceof Error 
        ? error.message 
        : '搜索失败';
    
    console.error('[News Search API] 搜索失败:', errorMessage);
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      timestamp: moment.tz('Asia/Shanghai').toISOString()
    }, { status: 400 });
  }
} 
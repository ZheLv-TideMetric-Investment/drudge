import { NextRequest, NextResponse } from 'next/server';
import moment from 'moment-timezone';
import { queryService } from '../../../../lib/services/query';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '7');
    const limit = parseInt(searchParams.get('limit') || '20');

    // 计算时间范围
    const endTime = moment().tz('Asia/Shanghai');
    const startTime = moment(endTime).subtract(days, 'days');

    console.log(`[Hot Rank API] 获取热点排行: ${startTime.format()} - ${endTime.format()}`);

    // 查询热点新闻排行（按关联实体数量排序）
    const hotNewsQuery = `
      MATCH (n:News)-[:DESCRIBES]->(e:Event)
      WHERE n.timestamp >= $startTime AND n.timestamp <= $endTime
      OPTIONAL MATCH (e)-[]-(entity)
      WITH n, e, count(DISTINCT entity) as entityCount, 
           CASE WHEN n.news_level = '1' THEN 3 
                WHEN n.news_level = '2' THEN 2 
                ELSE 1 END as levelWeight
      WITH n, e, entityCount, levelWeight, 
           (entityCount * levelWeight) as hotScore
      RETURN 
        n.id as newsId,
        n.title as title,
        n.content as content,
        n.news_level as level,
        n.timestamp as timestamp,
        n.source as source,
        entityCount,
        hotScore
      ORDER BY hotScore DESC, n.timestamp DESC
      LIMIT $limit
    `;

    // 查询热点事件排行
    const hotEventsQuery = `
      MATCH (e:Event)<-[:DESCRIBES]-(n:News)
      WHERE n.timestamp >= $startTime AND n.timestamp <= $endTime
      OPTIONAL MATCH (e)-[]-(entity)
      WITH e, count(DISTINCT n) as newsCount, count(DISTINCT entity) as entityCount
      WHERE newsCount > 0
      RETURN 
        e.event_name as name,
        e.event_description as description,
        e.event_level as level,
        newsCount,
        entityCount,
        (newsCount * 2 + entityCount) as hotScore
      ORDER BY hotScore DESC
      LIMIT $limit
    `;

    // 查询时间统计数据（用于图表）
    const timeStatsQuery = `
      MATCH (n:News)
      WHERE n.timestamp >= $startTime AND n.timestamp <= $endTime
      WITH n, 
           datetime(n.timestamp).year as year,
           datetime(n.timestamp).month as month,
           datetime(n.timestamp).day as day,
           datetime(n.timestamp).hour as hour
      WITH date({year: year, month: month, day: day}) as date,
           hour,
           count(n) as count,
           sum(CASE WHEN n.news_level = '1' THEN 1 ELSE 0 END) as level1Count
      RETURN 
        toString(date) as date,
        hour,
        count,
        level1Count
      ORDER BY date DESC, hour DESC
    `;

    const [newsResult, eventsResult, timeStatsResult] = await Promise.all([
      queryService.neo4j.executeQuery(hotNewsQuery, {
        startTime: startTime.utc().toISOString(),
        endTime: endTime.utc().toISOString(),
        limit
      }),
      queryService.neo4j.executeQuery(hotEventsQuery, {
        startTime: startTime.utc().toISOString(),
        endTime: endTime.utc().toISOString(),
        limit
      }),
      queryService.neo4j.executeQuery(timeStatsQuery, {
        startTime: startTime.utc().toISOString(),
        endTime: endTime.utc().toISOString()
      })
    ]);

    // 处理热点新闻数据
    const hotNews = newsResult.records.map((record: { get: (key: string) => any }) => {
      const content = record.get('content') as string;
      return {
        newsId: record.get('newsId') as string,
        title: record.get('title') as string,
        content: content ? content.substring(0, 100) + '...' : '',
        level: record.get('level') as string,
        timestamp: record.get('timestamp') as string,
        source: record.get('source') as string,
        entityCount: (record.get('entityCount') as any).toNumber(),
        hotScore: (record.get('hotScore') as any).toNumber(),
        displayTime: moment(record.get('timestamp') as string).tz('Asia/Shanghai').format('MM-DD HH:mm')
      };
    });

    // 处理热点事件数据
    const hotEvents = eventsResult.records.map((record: { get: (key: string) => any }) => ({
      name: record.get('name') as string,
      description: record.get('description') as string,
      level: record.get('level') as string,
      newsCount: (record.get('newsCount') as any).toNumber(),
      entityCount: (record.get('entityCount') as any).toNumber(),
      hotScore: (record.get('hotScore') as any).toNumber()
    }));

    // 处理时间统计数据
    const timeStats = timeStatsResult.records.map((record: { get: (key: string) => any }) => ({
      date: record.get('date') as string,
      hour: (record.get('hour') as any).toNumber(),
      count: (record.get('count') as any).toNumber(),
      level1Count: (record.get('level1Count') as any).toNumber(),
      datetime: `${record.get('date')} ${(record.get('hour') as any).toString().padStart(2, '0')}:00`
    }));

    // 按日期聚合数据（用于趋势图）
    const dailyStats = timeStats.reduce((acc: Array<{date: string; count: number; level1Count: number; category: string}>, item: {date: string; count: number; level1Count: number}) => {
      const existingDay = acc.find(day => day.date === item.date);
      if (existingDay) {
        existingDay.count += item.count;
        existingDay.level1Count += item.level1Count;
      } else {
        acc.push({
          date: item.date,
          count: item.count,
          level1Count: item.level1Count,
          category: '新闻总数'
        });
      }
      return acc;
    }, []);

    return NextResponse.json({
      success: true,
      data: {
        hotNews,
        hotEvents,
        timeStats: {
          hourly: timeStats,
          daily: dailyStats
        },
        period: {
          startTime: startTime.format('YYYY-MM-DD HH:mm'),
          endTime: endTime.format('YYYY-MM-DD HH:mm'),
          days
        }
      },
      timestamp: moment.tz('Asia/Shanghai').toISOString()
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('获取热点排行失败:', errorMessage);
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      timestamp: moment.tz('Asia/Shanghai').toISOString()
    }, { status: 500 });
  }
} 
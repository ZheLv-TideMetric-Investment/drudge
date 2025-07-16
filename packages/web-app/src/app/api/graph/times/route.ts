import { NextResponse } from 'next/server';
import moment from 'moment-timezone';
import { queryService } from '../../../../lib/services/query';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const timeType = searchParams.get('timeType'); // DATETIME, DATE, TIME, PERIOD, OTHER
    const precision = searchParams.get('precision'); // YEAR, MONTH, DAY, HOUR, MINUTE, SECOND
    const limit = parseInt(searchParams.get('limit') || '20');

    // 构建Time节点的特殊查询
    let cypher = `
      MATCH (t:Time)
    `;
    
    const parameters: Record<string, unknown> = { limit };
    const conditions: string[] = [];

    if (timeType) {
      conditions.push('t.time_type = $timeType');
      parameters.timeType = timeType;
    }

    if (precision) {
      conditions.push('t.precision = $precision');
      parameters.precision = precision;
    }

    if (conditions.length > 0) {
      cypher += ` WHERE ${conditions.join(' AND ')}`;
    }

    cypher += `
      OPTIONAL MATCH (t)-[r]-()
      RETURN t as entity,
             'Time' as type,
             t.time_value as name,
             count(r) as connections
      ORDER BY connections DESC, t.time_value
      LIMIT $limit
    `;

    const result = await queryService.neo4j.executeQuery(cypher, parameters);

    const times = result.records.map((record: any) => ({
      entity: record.get('entity').properties,
      type: record.get('type'),
      name: record.get('name'),
      connections: record.get('connections').toNumber()
    }));

    return NextResponse.json({
      success: true,
      data: times,
      count: times.length,
      timestamp: moment.tz('Asia/Shanghai').toISOString()
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('获取时间数据失败:', errorMessage);
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      timestamp: moment.tz('Asia/Shanghai').toISOString()
    }, { status: 500 });
  }
} 
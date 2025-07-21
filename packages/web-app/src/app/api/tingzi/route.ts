import { NextRequest, NextResponse } from 'next/server';
import { processTingziMessage, TingziRequestBody } from '@/lib/services/robot';

// POST /api/tingzi 接口 - 统一处理所有tingzi请求
export async function POST(request: NextRequest) {
  try {
    // 验证 token
    const token = request.headers.get('token');
    if (token?.toLowerCase() !== 'tide') {
      return NextResponse.json({ error: 'Invalid token' }, { status: 403 });
    }

    const body: TingziRequestBody = await request.json();
    
    // 使用tingzi服务处理消息
    const result = await processTingziMessage(body);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Tingzi API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}

 
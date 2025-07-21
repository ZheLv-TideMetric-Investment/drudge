import { NextRequest, NextResponse } from 'next/server';
import { processRobotMessage, RobotRequestBody } from '@/lib/services/robot';

// POST /api/robot 接口 - 统一处理所有机器人请求
export async function POST(request: NextRequest) {
  try {
    // 验证 token
    const token = request.headers.get('token');
    if (token?.toLowerCase() !== 'tide') {
      return NextResponse.json({ error: 'Invalid token' }, { status: 403 });
    }

    const body: RobotRequestBody = await request.json();
    
    // 使用机器人服务处理消息
    const result = await processRobotMessage(body);

    return NextResponse.json(result);

  } catch (error) {
    console.error('Robot API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
}

 
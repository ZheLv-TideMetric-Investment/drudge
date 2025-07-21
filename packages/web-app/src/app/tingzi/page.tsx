'use client';

import { useState } from 'react';
import { Button, Input, Card, message as antMessage } from 'antd';

const { TextArea } = Input;

export default function TingziTestPage() {
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const testTingziAPI = async (endpoint: string) => {
    if (!message.trim()) {
      antMessage.error('请输入消息内容');
      return;
    }

    setLoading(true);
    try {
      const mockBody = {
        conversationId: 'test-conversation',
        atUsers: [],
        chatbotUserId: 'test-bot',
        msgId: 'test-msg',
        senderNick: '测试用户',
        isAdmin: false,
        sessionWebhookExpiredTime: Date.now() + 3600000,
        createAt: Date.now(),
        conversationType: '2',
        senderId: 'test-sender',
        conversationTitle: '测试对话',
        isInAtList: false,
        sessionWebhook: '', // 测试时不发送webhook
        text: { content: message },
        tingziCode: 'test-tingzi',
        msgtype: 'text'
      };

      const response = await fetch(`/api/tingzi${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'token': 'tide'
        },
        body: JSON.stringify(mockBody)
      });

      const data = await response.json();
      
      if (response.ok) {
        setResponse(JSON.stringify(data, null, 2));
        antMessage.success('API调用成功');
      } else {
        setResponse(JSON.stringify(data, null, 2));
        antMessage.error('API调用失败');
      }
    } catch (error) {
      console.error('API调用错误:', error);
      setResponse(`错误: ${error instanceof Error ? error.message : '未知错误'}`);
      antMessage.error('API调用出错');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Tingzi API测试</h1>
      
      <Card title="测试消息" className="mb-4">
        <TextArea
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="请输入要测试的消息内容..."
          className="mb-4"
        />
        
        <div className="space-x-4">
          <Button 
            type="primary" 
            onClick={() => testTingziAPI('')}
            loading={loading}
          >
            测试Tingzi API (/api/tingzi)
          </Button>
        </div>
      </Card>

      {response && (
        <Card title="API响应">
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
            {response}
          </pre>
        </Card>
      )}

              <Card title="API说明" className="mt-4">
          <div className="space-y-2 text-sm">
            <p><strong>Tingzi API:</strong> POST /api/tingzi - 统一处理所有tingzi请求</p>
            <p><strong>服务类型:</strong> 支持深度搜索、经济分析、快速搜索、自定义服务</p>
            <p><strong>指令格式:</strong> /economic、/经济、/quick、/快速、/custom、/自定义</p>
            <p><strong>Token验证:</strong> 需要在请求头中包含 token: &apos;tide&apos;</p>
            <p><strong>健康检查:</strong> 发送&ldquo;status check&rdquo;会返回&ldquo;ok&rdquo;</p>
          </div>
        </Card>
    </div>
  );
} 
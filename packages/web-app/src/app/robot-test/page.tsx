'use client';

import { useState } from 'react';
import { Button, Input, Card, message as antMessage } from 'antd';

const { TextArea } = Input;

export default function RobotTestPage() {
  const [message, setMessage] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const testRobotAPI = async (endpoint: string) => {
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
        robotCode: 'test-robot',
        msgtype: 'text'
      };

      const response = await fetch(`/api/robot${endpoint}`, {
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
      <h1 className="text-2xl font-bold mb-6">机器人API测试</h1>
      
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
            onClick={() => testRobotAPI('')}
            loading={loading}
          >
            测试基础API (/api/robot)
          </Button>
          
          <Button 
            type="default" 
            onClick={() => testRobotAPI('/pure')}
            loading={loading}
          >
            测试Pure API (/api/robot/pure)
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
          <p><strong>基础API:</strong> POST /api/robot - 使用jina-deepsearch-v2模型</p>
          <p><strong>Pure API:</strong> POST /api/robot/pure - 使用jina-deepsearch-v1模型，带经济投资提示词</p>
          <p><strong>Token验证:</strong> 需要在请求头中包含 token: &apos;tide&apos;</p>
          <p><strong>特殊消息:</strong> 发送&ldquo;活着没&rdquo;会返回&ldquo;活着呢&rdquo;</p>
        </div>
      </Card>
    </div>
  );
} 
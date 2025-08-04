import axios from 'axios';
import { 
  callJinaDeepSearch, 
  callJinaEconomicAnalysis, 
  callJinaQuickSearch,
  callJinaCustom,
  healthCheck,
  isHealthCheck,
  JinaResponse,
  JinaRequestOptions
} from './jina';

export interface TingziRequestBody {
  conversationId: string;
  atUsers: Array<{ dingtalkId: string }>;
  chatbotUserId: string;
  msgId: string;
  senderNick: string;
  isAdmin: boolean;
  sessionWebhookExpiredTime: number;
  createAt: number;
  conversationType: string;
  senderId: string;
  conversationTitle: string;
  isInAtList: boolean;
  sessionWebhook: string;
  text: { content: string };
  tingziCode: string;
  msgtype: string;
}

export interface TingziResponse {
  received: TingziRequestBody;
  jinaResponse: string;
  serviceType?: string;
}

// 服务类型枚举
export enum ServiceType {
  DEEP_SEARCH = 'deepsearch',
  ECONOMIC_ANALYSIS = 'economic',
  QUICK_SEARCH = 'quick',
  CUSTOM = 'custom'
}

// 解析服务类型
function parseServiceType(message: string): ServiceType {
  const lowerMessage = message.toLowerCase().trim();
  
  // 检查特殊指令
  if (lowerMessage.startsWith('/economic') || lowerMessage.startsWith('/经济')) {
    return ServiceType.ECONOMIC_ANALYSIS;
  }
  
  if (lowerMessage.startsWith('/quick') || lowerMessage.startsWith('/快速')) {
    return ServiceType.QUICK_SEARCH;
  }
  
  if (lowerMessage.startsWith('/custom') || lowerMessage.startsWith('/自定义')) {
    return ServiceType.CUSTOM;
  }
  
  // 默认使用深度搜索
  return ServiceType.DEEP_SEARCH;
}

// 提取实际消息内容（去除指令前缀）
function extractMessageContent(message: string): string {
  const lowerMessage = message.toLowerCase().trim();
  
  if (lowerMessage.startsWith('/economic ')) {
    return message.substring(10).trim();
  }
  
  if (lowerMessage.startsWith('/经济 ')) {
    return message.substring(3).trim();
  }
  
  if (lowerMessage.startsWith('/quick ')) {
    return message.substring(7).trim();
  }
  
  if (lowerMessage.startsWith('/快速 ')) {
    return message.substring(3).trim();
  }
  
  if (lowerMessage.startsWith('/custom ')) {
    return message.substring(8).trim();
  }
  
  if (lowerMessage.startsWith('/自定义 ')) {
    return message.substring(4).trim();
  }
  
  return message.trim();
}

// 调用对应的Jina服务
async function callJinaService(message: string, serviceType: ServiceType): Promise<JinaResponse> {
  const actualMessage = extractMessageContent(message);
  
  switch (serviceType) {
    case ServiceType.ECONOMIC_ANALYSIS:
      return await callJinaEconomicAnalysis(actualMessage);
    
    case ServiceType.QUICK_SEARCH:
      return await callJinaQuickSearch(actualMessage);
    
    case ServiceType.CUSTOM:
      // 自定义服务需要额外的配置，这里使用默认配置
      const customOptions: JinaRequestOptions = {
        model: 'jina-deepsearch-v1',
        reasoning_effort: 'medium',
        max_attempts: 2,
        no_direct_answer: false
      };
      return await callJinaCustom(actualMessage, customOptions);
    
    case ServiceType.DEEP_SEARCH:
    default:
      return await callJinaDeepSearch(actualMessage);
  }
}

// 发送webhook响应
async function sendWebhookResponse(webhookUrls: string[], senderNick: string, content: string): Promise<void> {
  if (!webhookUrls || webhookUrls.length === 0) {
    return;
  }
  
  const payload = {
    msgtype: 'markdown',
    markdown: {
      title: '[tide] 婷子',
      text: `@${senderNick} \n${content}`,
    }
  };

  const results = await Promise.allSettled(
    webhookUrls.map(async (webhookUrl) => {
      try {
        await axios.post(webhookUrl, payload);
        console.log('婷子webhook发送成功:', webhookUrl);
      } catch (error) {
        console.error('发送webhook失败:', error, 'URL:', webhookUrl);
      }
    })
  );

  const successCount = results.filter(result => result.status === 'fulfilled').length;
  console.log(`婷子webhook发送完成: ${successCount}/${webhookUrls.length} 成功`);
}

// 处理tingzi消息
export async function processTingziMessage(body: TingziRequestBody): Promise<TingziResponse> {
  const { text, sessionWebhook, senderNick } = body;
  const message = text?.content || '';
  
  let responseText = '';
  let serviceType: ServiceType | undefined;
  
  try {
    // 健康检查
    if (isHealthCheck(message)) {
      responseText = healthCheck();
    } else {
      // 解析服务类型
      serviceType = parseServiceType(message);
      
      // 调用对应的Jina服务
      const jinaResponse = await callJinaService(message, serviceType);
      responseText = `\n\n${jinaResponse.content}\n\n本次回答费用：${jinaResponse.cost.toFixed(2)}美元`;
    }
  } catch (error) {
    responseText = error instanceof Error ? error.message : '调用 Jina AI 时发生错误';
  }
  
  // 发送webhook响应
  await sendWebhookResponse([sessionWebhook], senderNick, responseText);
  
  return {
    received: body,
    jinaResponse: responseText,
    serviceType: serviceType
  };
}

// 获取服务类型说明
export function getServiceTypeDescription(serviceType: ServiceType): string {
  switch (serviceType) {
    case ServiceType.DEEP_SEARCH:
      return '深度搜索 (jina-deepsearch-v2)';
    case ServiceType.ECONOMIC_ANALYSIS:
      return '经济投资分析 (jina-deepsearch-v1)';
    case ServiceType.QUICK_SEARCH:
      return '快速搜索 (jina-deepsearch-v1)';
    case ServiceType.CUSTOM:
      return '自定义服务 (jina-deepsearch-v1)';
    default:
      return '未知服务';
  }
}

// 获取可用服务列表
export function getAvailableServices(): Array<{ type: ServiceType; command: string; description: string }> {
  return [
    {
      type: ServiceType.DEEP_SEARCH,
      command: '默认',
      description: '使用深度搜索模型进行通用AI对话'
    },
    {
      type: ServiceType.ECONOMIC_ANALYSIS,
      command: '/economic 或 /经济',
      description: '专门针对经济与投资领域进行深度分析'
    },
    {
      type: ServiceType.QUICK_SEARCH,
      command: '/quick 或 /快速',
      description: '快速搜索，适合简单问题'
    },
    {
      type: ServiceType.CUSTOM,
      command: '/custom 或 /自定义',
      description: '自定义配置的搜索服务'
    }
  ];
} 
import axios from 'axios';
import {
  callJinaDeepSearch,
  callJinaEconomicAnalysis,
  callJinaQuickSearch,
  callJinaCustom,
  healthCheck,
  isHealthCheck,
  JinaResponse,
  JinaRequestOptions,
} from './jina';
import { aiService, createMessages } from '../utils/llm';

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
  aiResponse: string;
  serviceType?: string;
  aiProvider?: 'xai' | 'jina';
}

// 服务类型枚举
export enum ServiceType {
  DEEP_SEARCH = 'deepsearch',
  ECONOMIC_ANALYSIS = 'economic',
  QUICK_SEARCH = 'quick',
  CUSTOM = 'custom',
}

// 解析服务类型和AI提供商
function parseServiceType(message: string): {
  serviceType: ServiceType;
  aiProvider: 'xai' | 'jina';
} {
  const lowerMessage = message.toLowerCase().trim();

  // 检查是否使用 Jina AI
  const useJina = lowerMessage.startsWith('/jina') || lowerMessage.startsWith('/吉娜');

  // 检查特殊指令（可以与 jina 组合使用）
  if (lowerMessage.includes('/economic') || lowerMessage.includes('/经济')) {
    return { serviceType: ServiceType.ECONOMIC_ANALYSIS, aiProvider: useJina ? 'jina' : 'xai' };
  }

  if (lowerMessage.includes('/quick') || lowerMessage.includes('/快速')) {
    return { serviceType: ServiceType.QUICK_SEARCH, aiProvider: useJina ? 'jina' : 'xai' };
  }

  if (lowerMessage.includes('/custom') || lowerMessage.includes('/自定义')) {
    return { serviceType: ServiceType.CUSTOM, aiProvider: useJina ? 'jina' : 'xai' };
  }

  // 默认使用深度搜索，AI提供商根据 jina 指令决定
  return { serviceType: ServiceType.DEEP_SEARCH, aiProvider: useJina ? 'jina' : 'xai' };
}

// 提取实际消息内容（去除指令前缀）
function extractMessageContent(message: string): string {
  let cleanMessage = message.trim();

  // 去除 jina 指令前缀
  if (cleanMessage.toLowerCase().startsWith('/jina ')) {
    cleanMessage = cleanMessage.substring(6).trim();
  } else if (cleanMessage.startsWith('/吉娜 ')) {
    cleanMessage = cleanMessage.substring(4).trim();
  }

  // 去除其他指令前缀
  const lowerMessage = cleanMessage.toLowerCase();

  if (lowerMessage.startsWith('/economic ')) {
    return cleanMessage.substring(10).trim();
  }

  if (cleanMessage.startsWith('/经济 ')) {
    return cleanMessage.substring(3).trim();
  }

  if (lowerMessage.startsWith('/quick ')) {
    return cleanMessage.substring(7).trim();
  }

  if (cleanMessage.startsWith('/快速 ')) {
    return cleanMessage.substring(3).trim();
  }

  if (lowerMessage.startsWith('/custom ')) {
    return cleanMessage.substring(8).trim();
  }

  if (cleanMessage.startsWith('/自定义 ')) {
    return cleanMessage.substring(4).trim();
  }

  return cleanMessage;
}

// 使用 xAI 处理消息
async function callXaiService(
  message: string,
  serviceType: ServiceType
): Promise<{ content: string; cost: number }> {
  const actualMessage = extractMessageContent(message);

  let systemPrompt = '';

  switch (serviceType) {
    case ServiceType.ECONOMIC_ANALYSIS:
      systemPrompt =
        '你是一位专业的经济与投资分析师。请对用户的问题提供深入的分析和见解，关注市场趋势、投资机会和风险评估。';
      break;
    case ServiceType.QUICK_SEARCH:
      systemPrompt = '你是一位高效的AI助手。请简洁明了地回答用户的问题，提供准确且有用的信息。';
      break;
    case ServiceType.CUSTOM:
      systemPrompt = '你是一位全能的AI助手。请根据用户的需求提供个性化的回答和建议。';
      break;
    case ServiceType.DEEP_SEARCH:
    default:
      systemPrompt = '你是一位知识渊博的AI助手。请对用户的问题进行深入分析，提供全面、准确的回答。';
      break;
  }

  const messages = createMessages(systemPrompt, actualMessage);
  const model = await aiService.createModel('xai');
  const response = await model.call(messages);

  if (!response.success) {
    throw new Error(response.error || 'xAI 调用失败');
  }

  // xAI 目前没有提供实际的 cost 信息，这里返回预估值
  const estimatedCost = (response.usage?.totalTokens || 0) * (15 / 1000000); // 假设每token 15/1000000美元

  return {
    content: response.data || '',
    cost: estimatedCost,
  };
}

// 调用对应的AI服务
async function callService(
  message: string,
  serviceType: ServiceType,
  aiProvider: 'xai' | 'jina'
): Promise<{ content: string; cost: number }> {
  if (aiProvider === 'jina') {
    const actualMessage = extractMessageContent(message);

    let jinaResponse: JinaResponse;

    switch (serviceType) {
      case ServiceType.ECONOMIC_ANALYSIS:
        jinaResponse = await callJinaEconomicAnalysis(actualMessage);
        break;

      case ServiceType.QUICK_SEARCH:
        jinaResponse = await callJinaQuickSearch(actualMessage);
        break;

      case ServiceType.CUSTOM:
        // 自定义服务需要额外的配置，这里使用默认配置
        const customOptions: JinaRequestOptions = {
          model: 'jina-deepsearch-v1',
          reasoning_effort: 'medium',
          max_attempts: 2,
          no_direct_answer: false,
        };
        jinaResponse = await callJinaCustom(actualMessage, customOptions);
        break;

      case ServiceType.DEEP_SEARCH:
      default:
        jinaResponse = await callJinaDeepSearch(actualMessage);
        break;
    }

    return {
      content: jinaResponse.content,
      cost: jinaResponse.cost,
    };
  } else {
    // 使用 xAI
    return await callXaiService(message, serviceType);
  }
}

// 发送webhook响应
async function sendWebhookResponse(
  webhookUrls: string[],
  senderNick: string,
  content: string
): Promise<void> {
  if (!webhookUrls || webhookUrls.length === 0) {
    return;
  }

  const payload = {
    msgtype: 'markdown',
    markdown: {
      title: '[tide] 婷子',
      text: `@${senderNick} \n${content}`,
    },
  };

  const results = await Promise.allSettled(
    webhookUrls.map(async webhookUrl => {
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
  let aiProvider: 'xai' | 'jina' = 'xai';

  try {
    // 健康检查
    if (isHealthCheck(message)) {
      responseText = healthCheck();
    } else {
      // 解析服务类型和AI提供商
      const parsedResult = parseServiceType(message);
      serviceType = parsedResult.serviceType;
      aiProvider = parsedResult.aiProvider;

      // 调用对应的AI服务
      const aiResponse = await callService(message, serviceType, aiProvider);
      const providerName = aiProvider === 'jina' ? 'Jina AI' : 'xAI';
      responseText = `\n\n${aiResponse.content}\n\n本次回答由 ${providerName} 提供，费用：${aiResponse.cost.toFixed(4)}美元`;
    }
  } catch (error) {
    const providerName = aiProvider === 'jina' ? 'Jina AI' : 'xAI';
    responseText = error instanceof Error ? error.message : `调用 ${providerName} 时发生错误`;
  }

  // 发送webhook响应
  await sendWebhookResponse([sessionWebhook], senderNick, responseText);

  return {
    received: body,
    aiResponse: responseText,
    serviceType: serviceType,
    aiProvider: aiProvider,
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
export function getAvailableServices(): Array<{
  type: ServiceType;
  command: string;
  description: string;
  aiProvider: string;
}> {
  return [
    {
      type: ServiceType.DEEP_SEARCH,
      command: '默认',
      description: '使用深度搜索模型进行通用AI对话（默认 xAI）',
      aiProvider: 'xAI/JinaAI',
    },
    {
      type: ServiceType.ECONOMIC_ANALYSIS,
      command: '/economic 或 /经济',
      description: '专门针对经济与投资领域进行深度分析',
      aiProvider: 'xAI/JinaAI',
    },
    {
      type: ServiceType.QUICK_SEARCH,
      command: '/quick 或 /快速',
      description: '快速搜索，适合简单问题',
      aiProvider: 'xAI/JinaAI',
    },
    {
      type: ServiceType.CUSTOM,
      command: '/custom 或 /自定义',
      description: '自定义配置的搜索服务',
      aiProvider: 'xAI/JinaAI',
    },
  ];
}

// 获取AI提供商切换说明
export function getAiProviderInstructions(): string {
  return `
AI提供商说明：
- 默认使用 xAI (Grok) 模型处理所有请求
- 使用 /jina 或 /吉娜 前缀可切换到 Jina AI
- 例如："/jina 今天的新闻" 或 "/吉娜 /economic 分析市场"
- 指令可以组合使用，如："/jina /quick 简单问题"
  `;
}

// @ts-nocheck
// @ts-nocheck
import { generateText } from 'ai';
import { deepseek } from '@ai-sdk/deepseek';
import config from '../config/config';
import logger from './logger';

export interface LLMCallOptions {
  temperature?: number;
  maxTokens?: number;
  system?: string;
}

export interface LLMResponse {
  success: boolean;
  data?: string;
  error?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface LLMJsonResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;  }
}

/**
 * 调用LLM并返回文本响应
 */
export async function callLLM(
  prompt: string, 
  options: LLMCallOptions = {}
): Promise<LLMResponse> {
  try {
    // 确保prompt是字符串类型
    if (typeof prompt !== 'string') {
      const errorMsg = `prompt参数必须是字符串，但收到: ${typeof prompt}`;
      logger.error(errorMsg, { prompt });
      return {
        success: false,
        error: errorMsg
      };
    }

    const {
      temperature = 0.7,
      maxTokens = 2000,
      system = '你是一个专业的AI助手。'
    } = options;

    logger.debug('调用LLM:', { prompt: prompt.substring(0, 100) + '...', options });

    const result = await generateText({
      model: deepseek(config.ai.model),
      prompt,
      temperature,
      maxTokens,
      system,
    });

    logger.debug('LLM响应成功:', { 
      textLength: result.text.length,
      usage: result.usage 
    });

    return {
      success: true,
      data: result.text,
      usage: result.usage ? {
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens
      } : undefined
    };

  } catch (error: any) {
    logger.error('LLM调用失败:', error);
    return {
      success: false,
      error: error.message || 'LLM调用失败'
    };
  }
}

/**
 * 调用LLM并返回JSON响应
 */
export async function callLLMWithJsonResponse<T = any>(
  prompt: string, 
  options: LLMCallOptions = {}
): Promise<LLMJsonResponse<T>> {
  try {
    const response = await callLLM(prompt, options);
    
    if (!response.success || !response.data) {
      return {
        success: false,
        error: response.error || 'LLM响应为空'
      };
    }

    // 尝试解析JSON
    let jsonData: T;
    try {
      jsonData = JSON.parse(response.data);
    } catch (parseError: any) {
      logger.error('JSON解析失败:', parseError);
      logger.error('原始响应:', response.data);
      return {
        success: false,
        error: `JSON解析失败: ${parseError.message}`
      };
    }

    return {
      success: true,
      data: jsonData,
      usage: response.usage
    };

  } catch (error: any) {
    logger.error('LLM JSON调用失败:', error);
    return {
      success: false,
      error: error.message || 'LLM JSON调用失败'
    };
  }
}

/**
 * 调用LLM进行批量处理
 */
export async function callLLMBatch(
  prompts: string[], 
  options: LLMCallOptions = {}
): Promise<LLMResponse[]> {
  const results: LLMResponse[] = [];
  
  for (const prompt of prompts) {
    const result = await callLLM(prompt, options);
    results.push(result);
    
    // 添加延迟避免API限流
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return results;
} 
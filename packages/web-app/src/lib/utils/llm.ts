import { z } from 'zod';

/**
 * 创建消息格式
 */
export function createMessages(systemPrompt: string, userPrompt: string): Array<{role: string, content: string}> {
  return [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];
}

/**
 * 调用 LLM 并返回 JSON 响应
 */
export async function callLLMWithJsonResponse(
  messages: Array<{role: string, content: string}>,
  options: {
    temperature?: number;
    schema?: z.ZodSchema<unknown>;
  } = {}
): Promise<{success: boolean, data?: unknown, error?: string}> {
  try {
    // 这里应该调用实际的 LLM API
    // 目前返回模拟数据
    console.warn('LLM 调用功能尚未实现，返回模拟数据', { options });
    
    // 模拟响应结构
    const mockResponse = {
      overall_summary: '本时段新闻情况正常',
      key_highlights: ['重要事件1', '重要事件2'],
      market_impact: '市场影响较小',
      focus_areas: ['关注点1', '关注点2'],
      severity_assessment: 'low' as const,
      confidence: 0.8
    };

    return {
      success: true,
      data: mockResponse
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('LLM 调用失败:', error);
    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * 验证 JSON 响应
 */
export function validateJsonResponse(data: unknown, schema: z.ZodSchema<unknown>): {success: boolean, data?: unknown, error?: string} {
  try {
    const validated = schema.parse(data);
    return {
      success: true,
      data: validated
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('JSON 响应验证失败:', error);
    return {
      success: false,
      error: errorMessage
    };
  }
} 
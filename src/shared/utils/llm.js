import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { deepseek } from '@ai-sdk/deepseek';

export async function callGemi(messages) {
  const { text } = await generateText({
    model: google('gemini-2.5-pro-preview-06-05'),
    messages: messages,
  });
  return text;
}

export async function callGemiV2(messages) {
  const { text } = await generateText({
    model: google('gemini-2.0-flash-exp'),
    messages: messages,
  });
  return text;
}

export async function callDeepSeek(messages) {
  const { text } = await generateText({
    model: deepseek('deepseek-reasoner'),
    messages: messages,
  });
  return text;
}

export async function callDeepSeekV3(messages) {
  const { text } = await generateText({
    model: deepseek('deepseek-chat'),
    messages: messages,
  });
  return text;
}

export async function callSimpleLLM(messages) {
  return callDeepSeekV3(messages);
  // return callGemi(messages);
}

export async function callLLM(messages) {
  // return callDeepSeek(messages);
  return callGemi(messages);
}

export async function callLLMWithJsonResponse(messages) {
  const jsonString = await callLLM(messages);

  return extractJsonFromResponse(jsonString);
}

function extractJsonFromResponse(jsonString) {
  let jsonContent = '';

  // 优先查找 ```json...``` 代码块
  const codeBlockMatch = jsonString.match(/```json\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    jsonContent = codeBlockMatch[1].trim();
  } else {
    // 如果没有代码块，尝试移除开头和结尾的markdown标记
    jsonContent = jsonString.replace(/^```json\s*|\s*```$/g, '').trim();
  }

  // 如果内容不是以 { 开始，尝试提取JSON对象
  if (!jsonContent.startsWith('{')) {
    const jsonMatch = jsonContent.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      jsonContent = jsonMatch[0];
    }
  }

  // 如果仍然没有找到有效的JSON，抛出更详细的错误
  if (!jsonContent || !jsonContent.trim().startsWith('{')) {
    throw new Error(`No valid JSON found in LLM response: ${jsonString}`);
  }

  // 修复常见的JSON格式错误
  jsonContent = fixCommonJsonErrors(jsonContent.trim());

  try {
    return JSON.parse(jsonContent);
  } catch (error) {
    throw new Error(
      `Failed to parse LLM response: Output: ${jsonString} Extracted JSON: ${jsonContent} Error: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

// 修复常见的JSON格式错误
function fixCommonJsonErrors(jsonContent) {
  // 修复 "key": ""; "" 这种格式错误 - 将其转换为 "key": ""
  jsonContent = jsonContent.replace(/"([^"]+)":\s*"[^"]*";\s*"[^"]*"/g, '"$1": ""');

  // 修复 "key": "value"; "key2": "value2" 这种用分号分隔的格式
  jsonContent = jsonContent.replace(/(":\s*"[^"]*")\s*;\s*"/g, '$1, "');

  // 修复多余的分号（在引号前）
  jsonContent = jsonContent.replace(/;\s*"/g, ', "');

  // 修复缺少逗号的情况（换行）
  jsonContent = jsonContent.replace(/"\s*\n\s*"/g, '",\n"');

  // 修复尾随逗号
  jsonContent = jsonContent.replace(/,\s*}/g, '}');
  jsonContent = jsonContent.replace(/,\s*]/g, ']');

  return jsonContent;
}

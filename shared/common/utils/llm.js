const createMessages = (systemPrompt, userPrompt) => [
  { role: 'system', content: systemPrompt },
  { role: 'user', content: userPrompt }
];

const formatPromptFields = (fields, options = {}) => {
  const separator = options.separator || '\n';
  const joiner = options.joiner || '：';
  return fields
    .filter(([label]) => label)
    .map(([label, value]) => `${label}${joiner}${value ?? ''}`)
    .join(separator);
};

const getLLMErrorMessage = (error, fallbackMessage = 'LLM调用失败') => {
  if (!error) return fallbackMessage;
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return fallbackMessage;
};

const normalizeLLMUsage = (usage) => {
  if (!usage) return undefined;
  const promptTokens = usage.promptTokens ?? usage.prompt_tokens ?? 0;
  const completionTokens = usage.completionTokens ?? usage.completion_tokens ?? 0;
  const totalTokens =
    usage.totalTokens ?? usage.total_tokens ?? (promptTokens + completionTokens);

  return {
    promptTokens,
    completionTokens,
    totalTokens,
  };
};

const parseJsonContent = (content) => {
  if (typeof content !== 'string') {
    return { value: content, parsed: true };
  }

  try {
    return { value: JSON.parse(content), parsed: true };
  } catch (_error) {
    return { value: content, parsed: false };
  }
};

const buildLLMLogMeta = (params = {}) => {
  const {
    provider,
    model,
    messages = [],
    options = {},
    usage,
    mode,
  } = params;

  const firstMessage = messages[0]?.content;

  return {
    provider,
    model,
    mode,
    messageCount: Array.isArray(messages) ? messages.length : 0,
    firstMessage: firstMessage ? `${firstMessage.substring(0, 100)}...` : undefined,
    temperature: options.temperature,
    timeout: options.timeout,
    schema: options.schema ? 'provided' : 'default',
    usage,
  };
};

module.exports = {
  createMessages,
  formatPromptFields,
  getLLMErrorMessage,
  normalizeLLMUsage,
  parseJsonContent,
  buildLLMLogMeta,
};

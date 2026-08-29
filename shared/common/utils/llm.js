const createMessages = (systemPrompt, userPrompt) => [
  { role: 'system', content: systemPrompt },
  { role: 'user', content: userPrompt }
];

const createJsonBodyFetch = (extraBody, fetchImpl) => {
  const bodyOverrides =
    extraBody && typeof extraBody === 'object' && !Array.isArray(extraBody)
      ? { ...extraBody }
      : {};

  return async (input, init = {}) => {
    const targetFetch = fetchImpl || globalThis.fetch;
    if (typeof targetFetch !== 'function') {
      throw new Error('fetch 不可用');
    }

    if (typeof init.body !== 'string') {
      return targetFetch(input, init);
    }

    let parsedBody;
    try {
      parsedBody = JSON.parse(init.body);
    } catch (_error) {
      return targetFetch(input, init);
    }

    if (!parsedBody || typeof parsedBody !== 'object' || Array.isArray(parsedBody)) {
      return targetFetch(input, init);
    }

    return targetFetch(input, {
      ...init,
      body: JSON.stringify({ ...parsedBody, ...bodyOverrides }),
    });
  };
};

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
  createJsonBodyFetch,
  formatPromptFields,
  getLLMErrorMessage,
  normalizeLLMUsage,
  parseJsonContent,
  buildLLMLogMeta,
};

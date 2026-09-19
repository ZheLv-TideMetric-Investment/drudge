// Only use an already running Ollama service. HTTP calls never start the service.
class LocalAiClient {
  constructor(config) {
    this.config = config;
    this.queue = Promise.resolve();
    this.unavailableUntil = 0;
  }

  async call(messages, options = {}) {
    if (!this.config?.baseUrl) return { success: false, reason: 'disabled' };

    const prepared = messages.map(message => ({ ...message }));
    if (options.schema) {
      prepared.unshift({
        role: 'system',
        content: `只返回符合以下 JSON Schema 的 JSON：${JSON.stringify(options.schema)}`,
      });
    }
    const outputLimit = 2048;
    const contextLength = this.config.contextLength;
    // UTF-8 bytes give a conservative upper bound for this byte-level tokenizer.
    // Leave room for chat-template tokens and the complete output; never truncate input.
    const inputBytes = prepared.reduce(
      (total, message) => total + new TextEncoder().encode(message.content).length,
      0
    );
    if (inputBytes > contextLength - outputLimit - 1024) {
      return { success: false, reason: 'context_limit' };
    }

    const deadline = Date.now() + this.config.timeoutMs;
    const task = this.queue.then(() => this.run(prepared, options, outputLimit, deadline));
    this.queue = task.then(
      () => undefined,
      () => undefined
    );
    return task;
  }

  async run(messages, options, outputLimit, deadline) {
    if (Date.now() < this.unavailableUntil) return { success: false, reason: 'unavailable' };
    if (Date.now() >= deadline) return { success: false, reason: 'timeout' };
    const baseUrl = this.config.baseUrl.replace(/\/$/, '');
    let ready;
    try {
      // This endpoint does not load a model. A manual stop is authoritative.
      ready = await this.request(`${baseUrl}/api/tags`, {}, Math.min(2000, deadline - Date.now()));
      if (!ready.models?.some(model => model.name === this.config.model)) {
        return { success: false, reason: 'model_missing' };
      }
    } catch {
      this.unavailableUntil = Date.now() + 5000;
      return { success: false, reason: 'unavailable' };
    }

    try {
      const response = await this.request(
        `${baseUrl}/api/chat`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: this.config.model,
            messages,
            stream: false,
            think: false,
            ...(options.schema ? { format: options.schema } : {}),
            options: {
              temperature: options.temperature ?? 0.3,
              num_ctx: this.config.contextLength,
              num_predict: outputLimit,
            },
          }),
        },
        deadline - Date.now()
      );
      const usage = {
        promptTokens: response.prompt_eval_count ?? 0,
        completionTokens: response.eval_count ?? 0,
        totalTokens: (response.prompt_eval_count ?? 0) + (response.eval_count ?? 0),
      };
      if (
        !response.done ||
        response.done_reason !== 'stop' ||
        !response.message?.content?.trim() ||
        usage.promptTokens + usage.completionTokens >= this.config.contextLength
      ) {
        return { success: false, reason: 'incomplete', usage };
      }
      let data = response.message.content;
      if (options.schema) {
        try {
          data = JSON.parse(data);
          if (options.validate && !options.validate(data)) {
            return { success: false, reason: 'invalid_json', usage };
          }
        } catch {
          return { success: false, reason: 'invalid_json', usage };
        }
      }
      return { success: true, data, usage };
    } catch {
      this.unavailableUntil = Date.now() + 5000;
      return { success: false, reason: 'request_failed' };
    }
  }

  async request(url, init, timeoutMs) {
    if (timeoutMs <= 0) throw new Error('Local AI deadline exceeded');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      if (!response.ok) throw new Error(`Local AI HTTP ${response.status}`);
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }
}

module.exports = { LocalAiClient };

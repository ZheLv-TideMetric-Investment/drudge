const OpenAI = require('openai');
const config = require('../config/config');
const logger = require('../utils/logger');

class AIService {
  constructor() {
    this.openai = new OpenAI({
      baseURL: config.ai.baseURL,
      apiKey: config.ai.apiKey,
    });
  }

  async summarizeNews(news) {
    try {
      if (!news || news.length === 0) {
        return '没有新的新闻需要总结';
      }

      const summary = await this.callAIService(news);
      return summary;
    } catch (error) {
      logger.error('AI总结失败:', error);
      return 'AI总结服务暂时不可用';
    }
  }

  async callAIService(news) {
    try {
      // 构建新闻内容
      const newsContent = news
        .map(item => {
          return `标题：${item.title}\n内容：${item.content}\n时间：${new Date(
            item.time * 1000
          ).toLocaleString()}\n`;
        })
        .join('\n');

      const completion = await this.openai.chat.completions.create({
        messages: [
          {
            role: 'system',
            content:
              '你是一个专业的新闻编辑，请对以下新闻进行总结，突出重要信息，并按照时间顺序组织内容。',
          },
          {
            role: 'user',
            content: `请对以下新闻进行总结：\n\n${newsContent}`,
          },
        ],
        model: config.ai.model,
        temperature: 0.7,
        max_tokens: 1000,
      });

      return completion.choices[0].message.content;
    } catch (error) {
      logger.error('调用AI服务失败:', error);
      throw error;
    }
  }
}

module.exports = new AIService();

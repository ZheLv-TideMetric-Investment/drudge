const axios = require('axios');
const config = require('./config');
const fingerprint = require('./fingerprint');
const aliasDict = require('./aliasDict');

class LLMExtractor {
    constructor() {
        this.apiKey = config.llm.apiKey;
        this.model = config.llm.model;
        this.maxTokens = config.llm.maxTokens;
        this.temperature = config.llm.temperature;
        this.timeout = config.llm.timeout;
    }

    async extract(articles) {
        const results = [];
        const batchSize = config.system.batchSize;

        for (let i = 0; i < articles.length; i += batchSize) {
            const batch = articles.slice(i, i + batchSize);
            const batchResults = await Promise.all(
                batch.map(article => this.processArticle(article))
            );
            results.push(...batchResults);
        }

        return results;
    }

    async processArticle(article) {
        try {
            const prompt = this.buildPrompt(article);
            const response = await this.callLLM(prompt);
            const extracted = await this.parseResponse(response);
            
            return {
                ...article,
                extracted,
                fingerprint: fingerprint.getFingerprint(article.content),
                isHot: this.checkIfHot(article, extracted)
            };
        } catch (error) {
            console.error('文章处理错误:', error);
            return {
                ...article,
                error: error.message
            };
        }
    }

    buildPrompt(article) {
        return `请分析以下新闻文章，提取关键信息：

标题：${article.title}
内容：${article.content}

请提取以下信息：
1. Who: 主要人物/组织
2. Where: 地点
3. When: 时间
4. What: 事件
5. How: 方式/过程
6. 事件类型：财经/政治/冲突/科技/社会
7. 重要性评分：0-1
8. 情感倾向：正面/负面/中性

请以JSON格式返回，格式如下：
{
    "who": ["人物1", "人物2"],
    "where": ["地点1", "地点2"],
    "when": "时间",
    "what": "事件描述",
    "how": "过程描述",
    "type": "事件类型",
    "importance": 0.8,
    "sentiment": "情感倾向"
}`;
    }

    async callLLM(prompt) {
        try {
            const response = await axios.post(
                'https://api.deepseek.com/v1/chat/completions',
                {
                    model: this.model,
                    messages: [{ role: 'user', content: prompt }],
                    max_tokens: this.maxTokens,
                    temperature: this.temperature
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: this.timeout
                }
            );

            return response.data.choices[0].message.content;
        } catch (error) {
            throw new Error(`LLM API调用失败: ${error.message}`);
        }
    }

    async parseResponse(response) {
        try {
            const extracted = JSON.parse(response);
            
            // 标准化实体名称（异步）
            extracted.who = await aliasDict.canonicalizeBatch(extracted.who || []);
            extracted.where = await aliasDict.canonicalizeBatch(extracted.where || []);

            return extracted;
        } catch (error) {
            throw new Error(`响应解析失败: ${error.message}`);
        }
    }

    checkIfHot(article, extracted) {
        // 检查关键词
        const hasHotKeyword = config.alert.keywords.some(keyword => 
            article.title.includes(keyword) || article.content.includes(keyword)
        );

        // 检查重要性
        const isImportant = extracted.importance >= config.alert.threshold;

        // 检查事件类型
        const isHotType = ['冲突', '政治', '财经'].includes(extracted.type);

        return hasHotKeyword || (isImportant && isHotType);
    }
}

module.exports = new LLMExtractor(); 
// @ts-nocheck
import { callLLM, callLLMWithJsonResponse } from '../../shared/utils/llm.js';
import logger from '../../shared/utils/logger.js';
/**
 * AI服务 - 提供各种AI功能的统一接口
 */
class AiService {
    initialized = false;
    /**
     * 初始化AI服务
     */
    async initialize() {
        try {
            this.initialized = true;
            logger.info('AI服务初始化完成');
        }
        catch (error) {
            logger.error('AI服务初始化失败:', error);
            throw error;
        }
    }
    /**
     * 新闻级别评估
     */
    async evaluateNewsLevel(title, content) {
        const prompt = `
作为专业的新闻分析师，请评估以下新闻的重要性级别（1-5级，1最重要，5最不重要）：

标题：${title}
内容：${content}

请按照以下标准评估：
- Level 1 (Critical): 对全球金融市场、经济体系或政治环境有极大冲击性的新闻
- Level 2 (High Priority): 具有高度重要性，影响重大经济体或企业决策、股市等
- Level 3 (Medium Priority): 对某些行业、公司或地区具有较高重要性
- Level 4 (Low Priority): 对市场、行业或公司产生较小影响
- Level 5 (Informational): 对当前事件的补充性说明或没有直接市场影响

请以JSON格式返回：
{
  "level": 数字(1-5),
  "reasoning": "评估理由",
  "confidence": 置信度(0-1),
  "urgency": "紧急程度(low/medium/high/critical)"
}`;
        return await callLLMWithJsonResponse(prompt, {
            temperature: 0.3,
            maxTokens: 500,
            system: '你是一个专业的新闻分析师，擅长评估新闻的重要性和市场影响。'
        });
    }
    /**
     * 实体提取
     */
    async extractEntities(request) {
        const prompt = `
请从以下新闻中提取实体信息：

标题：${request.title}
内容：${request.content}
时间：${request.timestamp}

请提取以下类型的实体：
1. 事件 (Events) - 新闻中描述的事件
2. 公司 (Companies) - 提到的公司或企业
3. 人物 (Persons) - 提到的人物
4. 机构 (Organizations) - 政府机构、组织等
5. 地点 (Locations) - 地理位置
6. 时间 (Times) - 特定的时间点或时间段

请以JSON格式返回：
{
  "entities": {
    "events": [{"event_name": "事件名", "description": "描述", "type": "事件类型"}],
    "companies": [{"company_name": "公司名", "industry": "行业", "country": "国家"}],
    "persons": [{"person_name": "姓名", "title": "职位", "company": "公司"}],
    "organizations": [{"organization_name": "机构名", "type": "类型"}],
    "locations": [{"location_name": "地点名", "type": "类型", "country": "国家"}],
    "times": [{"time_value": "时间值", "type": "类型"}]
  },
  "relationships": [{"from": "实体1", "to": "实体2", "type": "关系类型"}],
  "confidence": 置信度(0-1)
}`;
        return await callLLMWithJsonResponse(prompt, {
            temperature: 0.2,
            maxTokens: 2000,
            system: '你是一个专业的信息提取专家，擅长从文本中识别和提取结构化信息。'
        });
    }
    /**
     * 生成摘要
     */
    async generateSummary(request) {
        const stylePrompts = {
            brief: '请生成简洁的摘要，不超过100字',
            detailed: '请生成详细的摘要，包含主要细节',
            bullet_points: '请以要点形式生成摘要'
        };
        const style = request.style || 'brief';
        const maxLength = request.maxLength || 200;
        const prompt = `
请为以下内容生成摘要：

${request.content}

要求：
- ${stylePrompts[style]}
- 最大长度：${maxLength}字
- 突出关键信息和要点

请以JSON格式返回：
{
  "summary": "摘要内容",
  "key_points": ["要点1", "要点2", "要点3"],
  "confidence": 置信度(0-1)
}`;
        return await callLLMWithJsonResponse(prompt, {
            temperature: 0.4,
            maxTokens: Math.max(maxLength * 2, 500),
            system: '你是一个专业的内容摘要专家，擅长提取关键信息并生成简洁准确的摘要。'
        });
    }
    /**
     * 批量处理新闻级别评估
     */
    async batchEvaluateNewsLevel(newsItems) {
        const results = [];
        for (const item of newsItems) {
            try {
                const result = await this.evaluateNewsLevel(item.title, item.content);
                results.push(result);
                // 添加延迟避免API限流
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            catch (error) {
                logger.error('批量评估新闻级别失败:', error);
                results.push({
                    success: false,
                    error: error.message || '评估失败'
                });
            }
        }
        return results;
    }
    /**
     * 健康检查
     */
    async healthCheck() {
        try {
            const testResponse = await callLLM('Hello, this is a health check.', {
                temperature: 0.1,
                maxTokens: 50
            });
            return {
                status: testResponse.success ? 'healthy' : 'unhealthy',
                timestamp: new Date().toISOString(),
                error: testResponse.error
            };
        }
        catch (error) {
            logger.error('AI服务健康检查失败:', error);
            return {
                status: 'unhealthy',
                timestamp: new Date().toISOString(),
                error: error.message
            };
        }
    }
}
// 创建单例实例
const aiService = new AiService();
export default aiService;

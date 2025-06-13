import { callSimpleLLM } from '../utils/llm.js';
import logger from '../utils/logger.js';
import {
  EntityNode,
  EventNode,
  EntityExtractionResult,
  EntityTypes,
  EventTypes,
  RelationshipTypes,
} from '../models/GraphModels.js';

/**
 * 实体提取服务
 * 使用 AI 从新闻内容中提取实体、事件和关系
 */
class EntityExtractionService {
  constructor() {
    this.maxRetries = 3;
    this.retryDelay = 1000;
  }

  /**
   * 从新闻中提取实体和事件
   * @param {Object} newsItem - 新闻对象
   * @returns {EntityExtractionResult} - 提取结果
   */
  async extractFromNews(newsItem) {
    const startTime = Date.now();
    try {
      logger.info(`开始提取新闻实体和事件: ${newsItem.id}`);

      // 使用 AI 提取实体和事件
      const extractionData = await this.callAIExtraction(newsItem);

      // 解析和验证提取结果
      const result = this.parseExtractionResult(extractionData, newsItem);

      // 计算处理时间
      result.processingTime = Date.now() - startTime;

      logger.info(
        `新闻 ${newsItem.id} 实体提取完成: 实体 ${result.entities.length}个, 事件 ${result.events.length}个, 关系 ${result.relationships.length}个`
      );

      return result;
    } catch (error) {
      logger.error(`新闻 ${newsItem.id} 实体提取失败:`, error);
      return new EntityExtractionResult({
        confidence: 0,
        processingTime: Date.now() - startTime,
      });
    }
  }

  /**
   * 批量提取多个新闻的实体和事件
   * @param {Array} newsItems - 新闻对象数组
   * @returns {Array} - 提取结果数组
   */
  async batchExtract(newsItems) {
    const results = [];
    for (const newsItem of newsItems) {
      try {
        const result = await this.extractFromNews(newsItem);
        results.push(result);

        // 添加延迟避免过度请求 AI 服务
        await this.delay(200);
      } catch (error) {
        logger.error(`批量提取失败: ${newsItem.id}`, error);
        results.push(
          new EntityExtractionResult({
            confidence: 0,
            processingTime: 0,
          })
        );
      }
    }
    return results;
  }

  /**
   * 调用 AI 服务进行实体提取
   * @param {Object} newsItem - 新闻对象
   * @returns {Object} - AI 返回的提取数据
   */
  async callAIExtraction(newsItem) {
    const messages = [
      {
        role: 'system',
        content: `
你是一个专业的新闻实体和事件提取系统。请从给定的新闻内容中提取以下信息：

1. **实体（Entities）**：
   - 人物（Person）：人名、职位
   - 组织（Organization）：机构、组织名称
   - 公司（Company）：公司名称、股票代码
   - 地点（Location）：地理位置
   - 产品（Product）：产品名称
   - 货币（Currency）：货币名称
   - 股票（Stock）：股票名称、代码
   - 商品（Commodity）：商品名称
   - 概念（Concept）：概念、主题

2. **事件（Events）**：
   - 价格变动（PriceChange）：涨跌、波动
   - 收购并购（Acquisition）：收购、合并
   - 合作（Partnership）：合作、协议
   - 冲突争议（Conflict）：争议、冲突
   - 公告发布（Announcement）：发布、公告
   - 政策变化（PolicyChange）：政策调整
   - 财务业绩（FinancialResult）：财报、业绩
   - 市场动向（MarketMove）：市场趋势
   - 人事变动（LeadershipChange）：人事任免
   - 产品发布（ProductLaunch）：新品发布
   - 经济指标（EconomicIndicator）：经济数据

3. **关系（Relationships）**：
   - 实体间关系：CEO_OF, OWNS, PARTNER_OF, COMPETITOR_OF 等
   - 实体与事件关系：PARTICIPATED_IN, AFFECTED_BY, CAUSED

**输出格式要求**：
请以 JSON 格式返回，结构如下：

\`\`\`json
{
  "entities": [
    {
      "name": "实体名称",
      "type": "实体类型",
      "aliases": ["别名1", "别名2"],
      "description": "实体描述",
      "confidence": 0.9
    }
  ],
  "events": [
    {
      "type": "事件类型",
      "description": "事件描述",
      "sentiment": "positive/negative/neutral",
      "magnitude": 0.5,
      "entities": ["相关实体名称"]
    }
  ],
  "relationships": [
    {
      "type": "关系类型",
      "from": "源实体",
      "to": "目标实体",
      "description": "关系描述",
      "confidence": 0.8
    }
  ]
}
\`\`\`

**注意事项**：
- 确保提取的实体名称规范化（去除多余空格）
- 识别实体的不同表达方式作为别名
- 事件的sentiment：positive（正面）、negative（负面）、neutral（中性）
- magnitude：事件影响程度，-1到1的数值
- confidence：识别置信度，0到1的数值
- 只提取明确出现在新闻中的信息，不要推测
        `,
      },
      {
        role: 'user',
        content: `
请提取以下新闻的实体、事件和关系：

标题：${newsItem.title}
内容：${newsItem.content}
时间：${new Date(newsItem.time * 1000).toISOString()}
        `,
      },
    ];

    let lastError;
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await callSimpleLLM(messages);
        return this.parseAIResponse(response);
      } catch (error) {
        lastError = error;
        logger.warn(`AI 提取尝试 ${attempt} 失败:`, error.message);

        if (attempt < this.maxRetries) {
          await this.delay(this.retryDelay * attempt);
        }
      }
    }

    throw lastError;
  }

  /**
   * 解析 AI 响应
   * @param {string} response - AI 响应文本
   * @returns {Object} - 解析后的数据
   */
  parseAIResponse(response) {
    try {
      // 尝试直接解析 JSON
      const cleaned = response.trim();
      if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
        return JSON.parse(cleaned);
      }

      // 尝试提取 JSON 代码块
      const jsonMatch = cleaned.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }

      // 尝试提取 {} 包围的内容
      const objectMatch = cleaned.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        return JSON.parse(objectMatch[0]);
      }

      throw new Error('无法解析 AI 响应为 JSON 格式');
    } catch (error) {
      logger.error('解析 AI 响应失败:', error);
      logger.error('原始响应:', response);
      throw new Error(`AI 响应解析失败: ${error.message}`);
    }
  }

  /**
   * 解析提取结果
   * @param {Object} extractionData - AI 提取的原始数据
   * @param {Object} newsItem - 原始新闻
   * @returns {EntityExtractionResult} - 格式化的提取结果
   */
  parseExtractionResult(extractionData, newsItem) {
    const result = new EntityExtractionResult({});

    // 解析实体
    if (extractionData.entities && Array.isArray(extractionData.entities)) {
      for (const entityData of extractionData.entities) {
        try {
          const entity = new EntityNode({
            name: this.normalizeName(entityData.name),
            type: this.validateEntityType(entityData.type),
            aliases: entityData.aliases || [],
            description: entityData.description || '',
            confidence: entityData.confidence || 0.8,
          });
          result.addEntity(entity);
        } catch (error) {
          logger.warn('解析实体失败:', entityData, error.message);
        }
      }
    }

    // 解析事件
    if (extractionData.events && Array.isArray(extractionData.events)) {
      for (const eventData of extractionData.events) {
        try {
          const event = new EventNode({
            type: this.validateEventType(eventData.type),
            description: eventData.description || '',
            sentiment: this.validateSentiment(eventData.sentiment),
            magnitude: this.validateMagnitude(eventData.magnitude),
            timestamp: new Date(newsItem.time * 1000).toISOString(),
          });
          result.addEvent(event);
        } catch (error) {
          logger.warn('解析事件失败:', eventData, error.message);
        }
      }
    }

    // 解析关系
    if (extractionData.relationships && Array.isArray(extractionData.relationships)) {
      for (const relData of extractionData.relationships) {
        try {
          const relationship = {
            type: this.validateRelationshipType(relData.type),
            from: this.normalizeName(relData.from),
            to: this.normalizeName(relData.to),
            description: relData.description || '',
            confidence: relData.confidence || 0.8,
            source: newsItem.id,
          };
          result.addRelationship(relationship);
        } catch (error) {
          logger.warn('解析关系失败:', relData, error.message);
        }
      }
    }

    // 计算整体置信度
    const totalItems = result.entities.length + result.events.length + result.relationships.length;
    if (totalItems > 0) {
      const totalConfidence =
        result.entities.reduce((sum, e) => sum + e.confidence, 0) +
        result.events.length * 0.8 +
        result.relationships.reduce((sum, r) => sum + r.confidence, 0);
      result.confidence = totalConfidence / totalItems;
    }

    return result;
  }

  /**
   * 规范化名称
   */
  normalizeName(name) {
    if (!name || typeof name !== 'string') return '';
    return name.trim().replace(/\s+/g, ' ');
  }

  /**
   * 验证实体类型
   */
  validateEntityType(type) {
    const validTypes = Object.values(EntityTypes);
    return validTypes.includes(type) ? type : EntityTypes.OTHER;
  }

  /**
   * 验证事件类型
   */
  validateEventType(type) {
    const validTypes = Object.values(EventTypes);
    return validTypes.includes(type) ? type : EventTypes.OTHER;
  }

  /**
   * 验证关系类型
   */
  validateRelationshipType(type) {
    const validTypes = Object.values(RelationshipTypes);
    return validTypes.includes(type) ? type : RelationshipTypes.RELATED_TO;
  }

  /**
   * 验证情感值
   */
  validateSentiment(sentiment) {
    const validSentiments = ['positive', 'negative', 'neutral'];
    return validSentiments.includes(sentiment) ? sentiment : 'neutral';
  }

  /**
   * 验证影响程度
   */
  validateMagnitude(magnitude) {
    const num = parseFloat(magnitude);
    if (isNaN(num)) return 0;
    return Math.max(-1, Math.min(1, num));
  }

  /**
   * 延迟函数
   */
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export default new EntityExtractionService();

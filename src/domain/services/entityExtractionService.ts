// @ts-nocheck
import { callLLMWithJsonResponse, LLMMessage, createEntityExtractionSchema, createBatchEntityExtractionSchema } from '../../shared/utils/llm';
import logger from '../../shared/utils/logger';
import config from '../../shared/config/config';
import {
  Event,
  Company,
  Person,
  Organization,
  Location,
  Time,
  NewsExtractionResult,
} from '../entities/index';
import { 
  NewsLevel, 
  NewsLevelDescription, 
  SignificanceLevel,
  RelationshipTypes,
  EventTypes
} from '../../shared/types/enums';

/**
 * 新闻六要素提取服务
 * 基于5W1H原则从新闻中提取事件、公司、人物、机构、地点、时间信息
 */
class EntityExtractionService {
  constructor() {
    this.maxRetries = config.batch?.aiRetryAttempts || 3;
    this.retryDelay = 1000;
    
    // AI将直接判断新闻级别，不再使用关键词匹配和公司列表判断
  }

  /**
   * 从新闻中提取六要素信息
   * @param {Object} newsItem - 新闻对象
   * @returns {NewsExtractionResult} - 提取结果
   */
  async extractFromNews(newsItem) {
    const startTime = Date.now();
    try {
      logger.info(`开始提取新闻六要素: ${newsItem.id}`);

      // 使用AI提取六要素
      const extractionData = await this.callAIExtraction(newsItem);
      
      // 解析提取结果
      const result = this.parseExtractionResult(extractionData, newsItem);
      
      // 判断新闻级别
      result.news_level = this.determineNewsLevel(newsItem, result);
      
      // 计算处理时间
      result.processing_time = Date.now() - startTime;

      logger.info(
        `新闻 ${newsItem.id} 六要素提取完成: 事件${result.events.length}个, 公司${result.companies.length}个, ` +
        `人物${result.persons.length}个, 机构${result.organizations.length}个, ` +
        `地点${result.locations.length}个, 时间${result.times.length}个, ` +
        `级别: ${result.news_level}`
      );

      return result;
    } catch (error) {
      logger.error(`新闻 ${newsItem.id} 六要素提取失败:`, error);
      return new NewsExtractionResult({
        news_id: newsItem.id,
        confidence: 0,
        processing_time: Date.now() - startTime,
      });
    }
  }

  /**
   * 调用AI进行六要素提取
   * @param {Object} newsItem - 新闻对象
   * @returns {Object} - AI返回的提取数据
   */
  async callAIExtraction(newsItem) {
    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: `
你是一个专业的新闻六要素提取系统。请根据新闻学的5W1H原则，从给定新闻中提取以下信息，并对每个事件进行准确的新闻级别判断：

## 六要素提取规则：

### 1. What（什么事件）- Event
提取新闻中的主要事件，包括：
- event_name: 事件简短名称
- event_description: 事件详细描述
- event_type: 事件类型（财经事件/政策事件/市场事件/企业事件/经济事件/政治事件/社会事件/科技事件/其他事件）
- significance: 重要性级别（1-4，4为最高级别）
- sentiment: 情感倾向（positive/negative/neutral）
- magnitude: 影响程度（-1.0到1.0的数值）
- event_level: 新闻级别（Level 1/Level 2/Level 3/Level 4/Level 5）

### 2. Who（涉及谁）- 分为三类：
**Company（公司）:**
- company_name: 公司全名
- ticker: 股票代码（如有）
- industry: 行业分类
- market: 所属市场（如有）
- country: 所属国家（如有）

**Person（人物）:**
- person_name: 人物姓名
- title: 职位头衔
- company: 所在公司（如有）
- nationality: 国籍（如有）

**Organization（机构）:**
- organization_name: 机构名称
- type: 机构类型（政府机构/金融机构/国际组织等）
- country: 所属国家

### 3. Where（在哪里）- Location
- location_name: 地点名称
- type: 地点类型（如有）
- country: 所属国家
- region: 地区
- coordinates: 坐标信息（如有）

### 4. When（什么时候）- Time
- time_value: 精确时间值
- type: 时间类型（DATETIME/DATE等）
- precision: 精度（YEAR/MONTH/DAY/HOUR/MINUTE/SECOND）
- timezone: 时区（如有）

### 5. How（如何发生）- 体现在事件描述中

## News Level判断标准：
请根据新闻内容的重要性、影响范围和市场冲击力判断级别：

**Level 1 (紧急新闻) 🚨**
- 全球性极大冲击的突发事件
- 例子：全球经济危机、股市崩盘、国际战争、总统辞职、重大金融机构破产
- 特征：立即对全球金融市场产生重大冲击

**Level 2 (高优先级新闻) ⚠️**  
- 重要的金融、政策类事件
- 例子：央行政策调整、重大企业并购、贸易战、主要股指大跌超10%
- 特征：对重要经济体或行业产生显著影响

**Level 3 (中等优先级新闻) 📊**
- 对特定行业或公司有较大影响的事件
- 例子：重要公司财报、经济数据发布、高管变动、技术突破、政策解读
- 特征：对特定领域或公司产生中等程度影响

**Level 4 (低优先级新闻) 📋**
- 影响较小的局部性事件
- 例子：公司新产品发布、市场分析报告、地方政策变化、一般性商业活动
- 特征：局部影响，背景性信息

**Level 5 (信息性新闻) 📝**
- 纯信息性内容，无直接市场影响
- 例子：例行数据更新、统计信息、会议纪要、背景介绍、历史回顾
- 特征：无直接市场影响，纯信息补充

请在每个事件的 event_level 字段中准确标注对应级别。

## 重要提醒：
- 只提取新闻中明确提到的信息，不要推测
- 公司名称要标准化（如"苹果公司"统一为"Apple Inc."）
- **必须为每个事件都提供event_level字段**，根据上述判断标准准确分级
- 时间信息要尽可能精确
- 关系要准确反映新闻中的实际关联
        `,
      },
      {
        role: 'user',
        content: `
请提取以下新闻的六要素信息：

标题：${newsItem.title}
内容：${newsItem.content}
发布时间：${new Date(newsItem.time * 1000).toISOString()}
        `,
      },
    ];

    let lastError;
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const extractionData = await callLLMWithJsonResponse(messages, {
          schema: createEntityExtractionSchema(),
          timeout: 5 * 60 * 1000 // 5分钟超时
        });
        
        if (extractionData.success) {
          return extractionData.data;
        } else {
          throw new Error(extractionData.error || 'AI提取失败');
        }
      } catch (error) {
        lastError = error;
        logger.warn(`AI六要素提取尝试 ${attempt} 失败:`, error.message);

        if (attempt < this.maxRetries) {
          await this.delay(this.retryDelay * attempt);
        }
      }
    }

    throw lastError;
  }



  /**
   * 解析提取结果
   * @param {Object} extractionData - AI提取的原始数据
   * @param {Object} newsItem - 原始新闻
   * @returns {NewsExtractionResult} - 格式化的提取结果
   */
  parseExtractionResult(extractionData, newsItem) {
    const result = new NewsExtractionResult({
      newsId: newsItem.id,
    });

    // 解析事件
    if (extractionData.events && Array.isArray(extractionData.events)) {
      for (const eventData of extractionData.events) {
        try {
          const event = new Event({
            event_name: eventData.event_name || '',
            event_description: eventData.event_description || '',
            event_date: this.parseDate(newsItem.time),
            event_type: this.validateEventType(eventData.event_type),
            significance: this.validateSignificance(eventData.significance),
            sentiment: this.validateSentiment(eventData.sentiment),
            magnitude: this.validateMagnitude(eventData.magnitude),
            event_level: this.validateNewsLevel(eventData.event_level),
          });
          result.addEvent(event);
        } catch (error) {
          logger.warn('解析事件失败:', eventData, error.message);
        }
      }
    }

    // 解析公司
    if (extractionData.companies && Array.isArray(extractionData.companies)) {
      for (const companyData of extractionData.companies) {
        try {
          const company = new Company({
            company_name: companyData.company_name || '',
            ticker: companyData.ticker || null,
            industry: companyData.industry || null,
            market: companyData.market || null,
            country: companyData.country || null,
          });
          result.addCompany(company);
        } catch (error) {
          logger.warn('解析公司失败:', companyData, error.message);
        }
      }
    }

    // 解析人物
    if (extractionData.persons && Array.isArray(extractionData.persons)) {
      for (const personData of extractionData.persons) {
        try {
          const person = new Person({
            person_name: personData.person_name || '',
            title: personData.title || null,
            company: personData.company || null,
            nationality: personData.nationality || null,
          });
          result.addPerson(person);
        } catch (error) {
          logger.warn('解析人物失败:', personData, error.message);
        }
      }
    }

    // 解析机构
    if (extractionData.organizations && Array.isArray(extractionData.organizations)) {
      for (const orgData of extractionData.organizations) {
        try {
          const organization = new Organization({
            organization_name: orgData.organization_name || '',
            type: orgData.type || null,
            country: orgData.country || null,
          });
          result.addOrganization(organization);
        } catch (error) {
          logger.warn('解析机构失败:', orgData, error.message);
        }
      }
    }

    // 解析地点
    if (extractionData.locations && Array.isArray(extractionData.locations)) {
      for (const locationData of extractionData.locations) {
        try {
          const location = new Location({
            location_name: locationData.location_name || '',
            type: locationData.type || null,
            country: locationData.country || null,
            region: locationData.region || null,
            coordinates: locationData.coordinates || null,
          });
          result.addLocation(location);
        } catch (error) {
          logger.warn('解析地点失败:', locationData, error.message);
        }
      }
    }

    // 解析时间
    if (extractionData.times && Array.isArray(extractionData.times)) {
      for (const timeData of extractionData.times) {
        try {
          const time = new Time({
            time_value: timeData.time_value || timeData.timestamp || new Date(newsItem.time * 1000).toISOString(),
            type: timeData.type || 'DATETIME',
            precision: timeData.precision || 'SECOND',
            timezone: timeData.timezone,
          });
          result.addTime(time);
        } catch (error) {
          logger.warn('解析时间失败:', timeData, error.message);
        }
      }
    }

    // 解析关系
    if (extractionData.relationships && Array.isArray(extractionData.relationships)) {
      for (const relData of extractionData.relationships) {
        try {
          const relationship = {
            type: this.validateRelationshipType(relData.type),
            from: relData.from || '',
            to: relData.to || '',
            description: relData.description || '',
            confidence: 0.8,
            source: newsItem.id,
          };
          result.addRelationship(relationship);
        } catch (error) {
          logger.warn('解析关系失败:', relData, error.message);
        }
      }
    }

    // 计算整体置信度
    const totalItems = result.events.length + result.companies.length +
                      result.persons.length + result.organizations.length +
                      result.locations.length + result.times.length;
    result.confidence = totalItems > 0 ? 0.8 : 0;

    return result;
  }

  /**
   * 判断新闻级别（完全基于AI判断结果）
   * @param {Object} newsItem - 新闻对象
   * @param {NewsExtractionResult} result - 提取结果
   * @returns {string} - 新闻级别
   */
  determineNewsLevel(newsItem, result) {
    // 直接使用AI判断的事件级别
    if (result.events.length > 0) {
      // 获取最高级别的事件作为整体新闻级别
      const highestEventLevel = result.events.reduce((highest, event) => {
        const currentLevel = event.event_level || NewsLevel.LEVEL_5;
        const highestLevel = highest || NewsLevel.LEVEL_5;
        
        // 数值越小级别越高（Level 1 > Level 2 > ... > Level 5）
        const currentValue = this.getLevelValue(currentLevel);
        const highestValue = this.getLevelValue(highestLevel);
        
        return currentValue < highestValue ? currentLevel : highestLevel;
      }, NewsLevel.LEVEL_5);
      
      logger.debug(`新闻 ${newsItem.id} AI判断级别: ${highestEventLevel}，事件级别: ${result.events.map(e => e.event_level).join(', ')}`);
      return highestEventLevel;
    }

    // 默认级别 - 信息性新闻
    logger.debug(`新闻 ${newsItem.id} 无事件，使用默认级别: ${NewsLevel.LEVEL_5}`);
    return NewsLevel.LEVEL_5;
  }

  /**
   * 获取级别数值（用于比较，数值越小级别越高）
   */
  getLevelValue(level) {
    const levelMap = {
      [NewsLevel.LEVEL_1]: 1,
      [NewsLevel.LEVEL_2]: 2,
      [NewsLevel.LEVEL_3]: 3,
      [NewsLevel.LEVEL_4]: 4,
      [NewsLevel.LEVEL_5]: 5,
    };
    return levelMap[level] || 5;
  }



  /**
   * 解析日期
   */
  parseDate(timestamp) {
    return new Date(timestamp * 1000).toISOString().split('T')[0];
  }

  /**
   * 验证事件类型
   */
  validateEventType(type) {
    const validTypes = Object.values(EventTypes);
    return validTypes.includes(type) ? type : EventTypes.OTHER;
  }

  /**
   * 验证重要性级别
   */
  validateSignificance(significance) {
    const num = parseInt(significance);
    if (isNaN(num) || num < 1 || num > 4) return SignificanceLevel.MEDIUM;
    return num;
  }

  /**
   * 验证情感倾向
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
   * 验证关系类型
   */
  validateRelationshipType(type) {
    const validTypes = Object.values(RelationshipTypes);
    return validTypes.includes(type) ? type : RelationshipTypes.MENTIONED_IN;
  }

  /**
   * 验证新闻级别
   */
  validateNewsLevel(level) {
    const validLevels = Object.values(NewsLevel);
    return validLevels.includes(level) ? level : NewsLevel.LEVEL_5;
  }

  /**
   * 延迟函数
   */
  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 批量提取新闻六要素（简化版，用于NewsProcessingService）
   * @param {Array} newsItems - 新闻数组（一批，比如5条）
   * @returns {Array} - 提取结果数组
   */
  async batchExtractEntities(newsItems) {
    if (!newsItems || newsItems.length === 0) {
      return [];
    }

    const startTime = Date.now();
    logger.info(`开始批量AI提取${newsItems.length}条新闻的六要素`);
        
    try {
      // 调用批量AI提取
      const batchResults = await this.callBatchAIExtraction(newsItems);
      
      const processingTime = Date.now() - startTime;
      logger.info(`批量AI提取完成，${newsItems.length}条新闻，耗时${processingTime}ms，平均${Math.round(processingTime/newsItems.length)}ms/条`);
      
      return batchResults;
      } catch (error) {
      logger.error(`批量AI提取失败，回退到单条处理:`, error);
        
      // 回退到单条处理
      const results = [];
      for (const newsItem of newsItems) {
          try {
            const result = await this.extractFromNews(newsItem);
            results.push(result);
          } catch (singleError) {
            logger.error(`单条提取失败: ${newsItem.id}`, singleError);
            results.push(new NewsExtractionResult({
              news_id: newsItem.id,
              confidence: 0,
              processing_time: 0,
            }));
          }
        }
    
    return results;
    }
  }

  /**
   * 批量AI调用 - 一次性处理多条新闻（简化版）
   * @param {Array} newsItems - 新闻对象数组
   * @returns {Array} - 提取结果数组
   */
  async callBatchAIExtraction(newsItems) {
    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: `
你是一个专业的新闻六要素批量提取系统。请根据新闻学的5W1H原则，从给定的多条新闻中提取以下信息，并对每个事件进行准确的新闻级别判断：

## 六要素提取规则：

### 1. What（什么事件）- Event
提取新闻中的主要事件，包括：
- event_name: 事件简短名称
- event_description: 事件详细描述
- event_type: 事件类型（财经事件/政策事件/市场事件/企业事件/经济事件/政治事件/社会事件/科技事件/其他事件）
- significance: 重要性级别（1-4，4为最高级别）
- sentiment: 情感倾向（positive/negative/neutral）
- magnitude: 影响程度（-1.0到1.0的数值）
- event_level: 新闻级别（Level 1/Level 2/Level 3/Level 4/Level 5）

### 2. Who（涉及谁）- 分为三类：
**Company（公司）:**
- company_name: 公司全名
- ticker: 股票代码（如有）
- industry: 行业分类

**Person（人物）:**
- person_name: 人物姓名
- title: 职位头衔
- company: 所在公司（如有）
- nationality: 国籍（如有）

**Organization（机构）:**
- organization_name: 机构名称
- type: 机构类型（政府机构/金融机构/国际组织等）
- country: 所属国家

### 3. Where（在哪里）- Location
- location_name: 地点名称
- type: 地点类型（如有）
- country: 所属国家
- region: 地区
- coordinates: 坐标信息（如有）

### 4. When（什么时候）- Time
- time_value: 精确时间值
- type: 时间类型（DATETIME/DATE等）
- precision: 精度（YEAR/MONTH/DAY/HOUR/MINUTE/SECOND）
- timezone: 时区（如有）

### 5. How（如何发生）- 体现在事件描述中

## News Level判断标准：
请根据新闻内容的重要性、影响范围和市场冲击力判断级别：

**Level 1 (紧急新闻) 🚨**
- 全球性极大冲击的突发事件
- 例子：全球经济危机、股市崩盘、国际战争、总统辞职、重大金融机构破产
- 特征：立即对全球金融市场产生重大冲击

**Level 2 (高优先级新闻) ⚠️**  
- 重要的金融、政策类事件
- 例子：央行政策调整、重大企业并购、贸易战、主要股指大跌超10%
- 特征：对重要经济体或行业产生显著影响

**Level 3 (中等优先级新闻) 📊**
- 对特定行业或公司有较大影响的事件
- 例子：重要公司财报、经济数据发布、高管变动、技术突破、政策解读
- 特征：对特定领域或公司产生中等程度影响

**Level 4 (低优先级新闻) 📋**
- 影响较小的局部性事件
- 例子：公司新产品发布、市场分析报告、地方政策变化、一般性商业活动
- 特征：局部影响，背景性信息

**Level 5 (信息性新闻) 📝**
- 纯信息性内容，无直接市场影响
- 例子：例行数据更新、统计信息、会议纪要、背景介绍、历史回顾
- 特征：无直接市场影响，纯信息补充

请在每个事件的 event_level 字段中准确标注对应级别。

## 批量输出格式：
请为每条新闻返回一个独立的提取结果，按照以下JSON格式：

\`\`\`json
{
  "results": [
    {
      "news_id": "新闻ID",
      "events": [
        {
          "event_name": "事件名称",
          "event_description": "事件详细描述",
          "event_type": "事件类型",
          "significance": 2,
          "sentiment": "neutral",
          "magnitude": 0.0,
          "event_level": "Level 5"
        }
      ],
      "companies": [...],
      "persons": [...],
      "organizations": [...],
      "locations": [...],
      "times": [...],
      "relationships": [...]
    }
  ]
}
\`\`\`

## 重要提醒：
- 为每条新闻提供完整的独立提取结果
- 确保results数组的顺序与输入新闻的顺序一致
- 只提取新闻中明确提到的信息，不要推测
- 公司名称要标准化
- **必须为每个事件都提供event_level字段**，根据上述判断标准准确分级
- 保持结果的准确性和一致性
        `,
      },
      {
        role: 'user',
        content: `
请批量提取以下${newsItems.length}条新闻的六要素信息：

${newsItems.map((item, index) => `
### 新闻 ${index + 1} (ID: ${item.id})
标题：${item.title}
内容：${item.content}
发布时间：${new Date(item.time * 1000).toISOString()}
---
`).join('\n')}
        `,
      },
    ];

    let lastError;
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const batchData = await callLLMWithJsonResponse(messages, {
          schema: createBatchEntityExtractionSchema(),
          timeout: 10 * 60 * 1000 // 10分钟超时
        });
        
        if (!batchData.success) {
          throw new Error(batchData.error || 'AI批量提取失败');
        }
        
        // 解析每条新闻的结果，确保按顺序对应
        const results = [];
        for (let i = 0; i < newsItems.length; i++) {
          const newsItem = newsItems[i];
          
          // 先尝试按ID匹配，再按索引匹配
          let extractionData = batchData.data?.results?.find(r => r.news_id === newsItem.id);
          if (!extractionData && batchData.data?.results && batchData.data.results[i]) {
            extractionData = batchData.data.results[i];
            // 确保news_id正确设置
            extractionData.news_id = newsItem.id;
          }
          
          const result = this.parseExtractionResult(extractionData || {}, newsItem);
          results.push(result);
        }
        
        return results;
      } catch (error) {
        logger.info(JSON.stringify(error.message));
        lastError = error;
        logger.warn(`批量AI提取尝试 ${attempt} 失败:`, error.message);

        if (attempt < this.maxRetries) {
          await this.delay(this.retryDelay * attempt);
        }
      }
    }

    throw lastError;
  }




}

export default new EntityExtractionService(); 
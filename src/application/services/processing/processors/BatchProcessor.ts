// @ts-nocheck
import { BaseExtractor } from '../extractors/BaseExtractor';
import { ResultProcessor } from './ResultProcessor';
import { SingleProcessor } from './SingleProcessor';
import { callLLMWithJsonResponse, LLMMessage, createBatchEntityExtractionSchema } from '../../../../shared/utils/llm';
import { NewsExtractionResult } from '../../../../domain/entities/index';
import logger from '../../../../shared/utils/logger';
import config from '../../../../shared/config/config';

/**
 * 批量处理器
 * 负责批量处理多个新闻的实体提取
 */
export class BatchProcessor extends BaseExtractor {
  private resultProcessor: ResultProcessor;
  private singleProcessor: SingleProcessor;

  constructor() {
    super();
    this.resultProcessor = new ResultProcessor();
    this.singleProcessor = new SingleProcessor();
    this.maxRetries = config.batch?.aiRetryAttempts || 3;
  }

  /**
   * 批量提取新闻六要素（简化版，用于NewsProcessingService）
   * @param {Array} newsItems - 新闻数组（一批，比如5条）
   * @returns {Array} - 提取结果数组
   */
  async batchExtractEntities(newsItems: any[]): Promise<NewsExtractionResult[]> {
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
          const result = await this.singleProcessor.extractFromNews(newsItem);
          results.push(result);
        } catch (singleError) {
          logger.error(`单条提取失败: ${newsItem.id}`, singleError);
          results.push(new NewsExtractionResult({
            newsId: newsItem.id,
            title: newsItem.title,
            content: newsItem.content,
            timestamp: new Date(newsItem.time * 1000).toISOString(),
            source: newsItem.source,
            url: newsItem.url,
            level: newsItem.level,
            confidence: 0,
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
  private async callBatchAIExtraction(newsItems: any[]): Promise<NewsExtractionResult[]> {
    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: this.getBatchSystemPrompt(),
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
          
          const result = this.resultProcessor.parseExtractionResult(extractionData || {}, newsItem);
          result.news_level = this.resultProcessor.determineNewsLevel(newsItem, result);
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

  /**
   * 获取批量系统提示词
   */
  private getBatchSystemPrompt(): string {
    return `
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
    `;
  }
} 
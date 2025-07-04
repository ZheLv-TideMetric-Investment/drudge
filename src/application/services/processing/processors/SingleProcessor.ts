// @ts-nocheck
import { BaseExtractor } from '../extractors/BaseExtractor';
import { ResultProcessor } from './ResultProcessor';
import { callLLMWithJsonResponse, LLMMessage, createEntityExtractionSchema } from '../../../../shared/utils/llm';
import { NewsExtractionResult } from '../../../../domain/entities/index';
import logger from '../../../../shared/utils/logger';
import config from '../../../../shared/config/config';

/**
 * 单条处理器
 * 负责处理单个新闻的实体提取
 */
export class SingleProcessor extends BaseExtractor {
  private resultProcessor: ResultProcessor;

  constructor() {
    super();
    this.resultProcessor = new ResultProcessor();
    this.maxRetries = config.batch?.aiRetryAttempts || 3;
  }

  /**
   * 从新闻中提取六要素信息
   * @param {Object} newsItem - 新闻对象
   * @returns {NewsExtractionResult} - 提取结果
   */
  async extractFromNews(newsItem: any): Promise<NewsExtractionResult> {
    const startTime = Date.now();
    try {
      logger.info(`开始提取新闻六要素: ${newsItem.id}`);

      // 使用AI提取六要素
      const extractionData = await this.callAIExtraction(newsItem);
      
      // 解析提取结果
      const result = this.resultProcessor.parseExtractionResult(extractionData, newsItem);
      
      // 判断新闻级别
      result.news_level = this.resultProcessor.determineNewsLevel(newsItem, result);
      
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
        newsId: newsItem.id,
        title: newsItem.title,
        content: newsItem.content,
        timestamp: new Date(newsItem.time * 1000).toISOString(),
        source: newsItem.source,
        url: newsItem.url,
        level: newsItem.level,
        confidence: 0,
      });
    }
  }

  /**
   * 调用AI进行六要素提取
   * @param {Object} newsItem - 新闻对象
   * @returns {Object} - AI返回的提取数据
   */
  private async callAIExtraction(newsItem: any): Promise<any> {
    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: this.getSystemPrompt(),
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
   * 获取系统提示词
   */
  private getSystemPrompt(): string {
    return `
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
    `;
  }
} 
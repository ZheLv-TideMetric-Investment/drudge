import { logger } from '../utils/logger';
import aiService from './AiService';
import notificationService from './NotificationService';
import { z } from 'zod';
import * as chrono from 'chrono-node';
import { 
  NewsItem, 
  NewsExtractionResult, 
  Event, 
  Company, 
  Person, 
  Organization, 
  Location, 
  Time, 
  Relationship,
  LLMMessage 
} from '../types/index';

// ISO-8601 正则表达式
const iso8601 = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/;

// 强化版新闻六要素提取的schema - 与投资场景完全对齐
const newsExtractionSchema = z.object({
  events: z.array(z.object({
    event_name: z.string().min(1),
    event_description: z.string().min(1),
    event_type: z.enum(['macro','policy','market','corporate','industry','tech','geopolitics','other']),
    significance: z.number().int().min(1).max(4),
    sentiment: z.enum(['positive','negative','neutral']),
    magnitude: z.number().min(-1).max(1),
    event_level: z.enum(['Level 1','Level 2','Level 3','Level 4','Level 5']),
    event_date: z.string().regex(iso8601).optional().or(z.literal(''))
  })),

  companies: z.array(z.object({
    company_name: z.string().min(1),
    ticker: z.string().optional().or(z.literal('')),
    industry: z.string().optional().or(z.literal('')),
    market: z.string().optional().or(z.literal('')),
    country: z.string().optional().or(z.literal('')),
    aliases: z.array(z.string()).optional().default([])
  })),

  persons: z.array(z.object({
    person_name: z.string().min(1),
    title: z.string().optional().or(z.literal('')),
    company: z.string().optional().or(z.literal('')),
    nationality: z.string().optional().or(z.literal(''))
  })),

  organizations: z.array(z.object({
    organization_name: z.string().min(1),
    type: z.enum(['government','regulator','intl_org','fin_inst','industry_assoc','other']).optional().or(z.literal('')),
    country: z.string().optional().or(z.literal(''))
  })),

  locations: z.array(z.object({
    location_name: z.string().min(1),
    type: z.enum(['country','region','city','facility','other']).optional().or(z.literal('')),
    country: z.string().optional().or(z.literal('')),
    region: z.string().optional().or(z.literal('')),
    coordinates: z.object({
      latitude: z.number(),
      longitude: z.number()
    }).optional()
  })),

  times: z.array(z.object({
    time_value: z.string().min(1),
    type: z.enum(['DATETIME','DATE','TIME','PERIOD','OTHER']).optional().or(z.literal('')),
    precision: z.enum(['YEAR','MONTH','DAY','HOUR','MINUTE','SECOND']).optional().or(z.literal('')),
    timezone: z.string().optional().or(z.literal(''))
  })),

  relationships: z.array(z.object({
    type: z.enum([
      'LOCATED_IN','WORKS_FOR','OWNS','PARTICIPATES_IN','MERGES_WITH','ACQUIRES',
      'SUPPLIES','PARTNERS_WITH','SUED_BY','REGULATED_BY','INVESTS_IN','OTHER'
    ]),
    from: z.string().min(1),
    to: z.string().min(1),
    description: z.string().optional().or(z.literal('')),
    confidence: z.number().min(0).max(1).optional()
  }))
});

/**
 * 实体提取服务
 * 负责从新闻内容中提取结构化信息
 */
export class EntityExtractionService {
  private maxRetries = 3;
  private retryDelay = 2000;

  constructor() {}

  /**
   * 从单条新闻中提取六要素信息
   */
  async extractFromNews(newsItem: NewsItem): Promise<NewsExtractionResult> {
    const startTime = Date.now();
    
    try {
      logger.info(`🔍 开始提取新闻六要素: ${newsItem.id}`);

      // 使用AI提取六要素（现在包含内置兜底机制）
      const extractionData = await this.callAIExtraction(newsItem);
      
      // 检查是否是空的兜底结果
      const isFallbackResult = !extractionData || (
        Array.isArray(extractionData.events) && extractionData.events.length === 0 &&
        Array.isArray(extractionData.companies) && extractionData.companies.length === 0 &&
        Array.isArray(extractionData.persons) && extractionData.persons.length === 0 &&
        Array.isArray(extractionData.organizations) && extractionData.organizations.length === 0 &&
        Array.isArray(extractionData.locations) && extractionData.locations.length === 0 &&
        Array.isArray(extractionData.times) && extractionData.times.length === 0 &&
        Array.isArray(extractionData.relationships) && extractionData.relationships.length === 0
      );

      if (isFallbackResult) {
        logger.warn(`⚠️ 新闻 ${newsItem.id} 使用兜底结果 - AI 提取未产生有效数据`);
        const fallbackResult = this.createFallbackResultWithNewsInfo(newsItem);
        fallbackResult.processing_time = Date.now() - startTime;
        return fallbackResult;
      }
      
      // 解析提取结果
      const result = this.parseExtractionResult(extractionData, newsItem);
      
      // 判断新闻级别（使用新的冲突处理逻辑）
      result.news_level = this.determineNewsLevelWithConflictHandling(newsItem, result);
      
      // 标准化时间字段
      result.times = this.standardizeTimeFields(result.times);
      result.events = this.standardizeEventDates(result.events);
      
      // 计算处理时间
      result.processing_time = Date.now() - startTime;

      logger.info(
        `✅ 新闻 ${newsItem.id} 六要素提取完成: 事件${result.events.length}个, 公司${result.companies.length}个, ` +
        `人物${result.persons?.length || 0}个, 机构${result.organizations.length}个, ` +
        `地点${result.locations.length}个, 时间${result.times.length}个, ` +
        `关系${result.relationships.length}个, 级别: ${result.news_level}`
      );

      return result;
      
    } catch (error: any) {
      logger.error(`❌ 新闻 ${newsItem.id} 六要素提取异常:`, error);
      
      // 发送实体提取失败通知
      try {
        await notificationService.sendEntityExtractionFailureNotification(
          newsItem.id,
          error.message || '实体提取失败'
        );
      } catch (notifyError) {
        logger.error('发送实体提取失败通知失败:', notifyError);
      }
      
      // 返回带新闻信息的兜底结果
      const fallbackResult = this.createFallbackResultWithNewsInfo(newsItem);
      fallbackResult.processing_time = Date.now() - startTime;
      return fallbackResult;
    }
  }

  /**
   * 批量提取新闻六要素
   */
  async batchExtractEntities(newsItems: NewsItem[]): Promise<NewsExtractionResult[]> {
    logger.info(`🔄 开始批量提取六要素: ${newsItems.length} 条新闻`);
    
    const results: NewsExtractionResult[] = [];
    const batchSize = 3; // 小批量处理避免API限制

    for (let i = 0; i < newsItems.length; i += batchSize) {
      const batch = newsItems.slice(i, i + batchSize);
      
      logger.info(`处理批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(newsItems.length / batchSize)}`);
      
      const batchPromises = batch.map(newsItem => this.extractFromNews(newsItem));
      const batchResults = await Promise.all(batchPromises);
      
      results.push(...batchResults);
      
      // 添加延迟避免API限制
      if (i + batchSize < newsItems.length) {
        await this.delay(2000);
      }
    }
    
    logger.info(`✅ 批量六要素提取完成: ${results.length} 条新闻`);
    return results;
  }

  /**
   * 调用AI进行六要素提取（带重试和校验兜底）
   */
  private async callAIExtraction(newsItem: NewsItem): Promise<any> {
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
发布时间：${new Date((newsItem.time || 0) * 1000).toISOString()}
来源：${newsItem.source}
        `,
      },
    ];

    let lastError: any;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await aiService.callLLMWithJsonResponse(messages, {
          schema: newsExtractionSchema,
          timeout: 5 * 60 * 1000,
          temperature: 0.3
        });
        
        if (response.success) {
          // 对响应进行校验和兜底处理
          const validatedData = this.validateAndFallbackParsing(response.data, attempt);
          return validatedData;
        } else {
          throw new Error(response.error || 'AI提取失败');
        }
      } catch (error: any) {
        lastError = error;
        logger.warn(`AI六要素提取尝试 ${attempt} 失败: ${error.message}`, { 
          stack: error.stack 
        });

        // 即使出错，也尝试从错误中提取有用信息
        if (error.text || (error.response && error.response.text)) {
          try {
            const errorText = error.text || error.response.text;
            const extractedJson = this.extractJsonFromString(errorText);
            if (extractedJson) {
              const fixedJson = this.fixCommonSchemaIssues(extractedJson);
              const parsedResult = newsExtractionSchema.safeParse(fixedJson);
              if (parsedResult.success) {
                logger.info(`✅ 从错误响应中成功提取数据 (尝试 ${attempt})`);
                return parsedResult.data;
              }
            }
          } catch (extractError) {
            logger.debug(`从错误响应提取数据失败:`, extractError);
          }
        }

        // 指数退避延迟
        if (attempt < this.maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await this.delay(delay);
        }
      }
    }

    // 如果所有重试都失败，返回兜底结果而不是抛出错误
    logger.warn(`所有AI提取尝试都失败，返回兜底结果。最后错误:`, lastError?.message);
    return this.createFallbackResult();
  }

  /**
   * 校验并兜底解析（增强版）
   */
  private validateAndFallbackParsing(resp: any, attempt: number): any {
    try {
      // 首先尝试直接解析
      const parsed = newsExtractionSchema.safeParse(resp);
      if (parsed.success) {
        return parsed.data;
      }

      logger.debug(`Schema 验证失败 (尝试 ${attempt}):`, parsed.error.errors);

      // 如果是对象，尝试修复常见问题
      if (typeof resp === 'object' && resp !== null) {
        const fixedResp = this.fixCommonSchemaIssues(resp);
        const retryParsed = newsExtractionSchema.safeParse(fixedResp);
        if (retryParsed.success) {
          logger.info('✅ Schema 问题修复成功');
          return retryParsed.data;
        }
      }

      // 如果是字符串，尝试多种 JSON 提取方法
      if (typeof resp === 'string') {
        const extractedJson = this.extractJsonFromString(resp);
        if (extractedJson) {
          const fixedJson = this.fixCommonSchemaIssues(extractedJson);
          const finalParsed = newsExtractionSchema.safeParse(fixedJson);
          if (finalParsed.success) {
            logger.info('✅ 手动 JSON 提取和修复成功');
            return finalParsed.data;
          }
        }
      }

      // 如果都失败，构造兜底结果
      logger.warn(`所有解析尝试失败，使用兜底结果 (尝试 ${attempt})`);
      return this.createFallbackResult();

    } catch (error) {
      logger.error(`兜底解析失败 (尝试 ${attempt}):`, error);
      return this.createFallbackResult();
    }
  }

  /**
   * 修复常见的 Schema 问题
   */
  private fixCommonSchemaIssues(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const fixed = JSON.parse(JSON.stringify(data)); // 深拷贝

    // 修复 locations 中的 coordinates 问题
    if (fixed.locations && Array.isArray(fixed.locations)) {
      fixed.locations = fixed.locations.map((location: any) => {
        if (location.coordinates) {
          // 如果 coordinates 是空对象或无效值，设置为 undefined
          if (
            typeof location.coordinates !== 'object' ||
            location.coordinates === null ||
            Object.keys(location.coordinates).length === 0 ||
            typeof location.coordinates.latitude !== 'number' ||
            typeof location.coordinates.longitude !== 'number'
          ) {
            delete location.coordinates;
          }
        }
        return location;
      });
    }

    // 修复 companies 中的 aliases 问题
    if (fixed.companies && Array.isArray(fixed.companies)) {
      fixed.companies = fixed.companies.map((company: any) => {
        if (!company.aliases || !Array.isArray(company.aliases)) {
          company.aliases = [];
        }
        return company;
      });
    }

    // 修复 events 中的必需字段
    if (fixed.events && Array.isArray(fixed.events)) {
      fixed.events = fixed.events.map((event: any) => {
        // 确保 event_id 存在
        if (!event.event_id) {
          event.event_id = event.event_name ? 
            event.event_name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() + '_' + Date.now() :
            'event_' + Date.now();
        }
        
        // 修复 event_type 枚举
        const validEventTypes = ['macro', 'policy', 'market', 'corporate', 'industry', 'tech', 'geopolitics', 'other'];
        if (!validEventTypes.includes(event.event_type)) {
          event.event_type = 'other';
        }

        // 修复 sentiment 枚举
        const validSentiments = ['positive', 'negative', 'neutral'];
        if (!validSentiments.includes(event.sentiment)) {
          event.sentiment = 'neutral';
        }

        // 修复 event_level 枚举
        const validLevels = ['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5'];
        if (!validLevels.includes(event.event_level)) {
          event.event_level = 'Level 5';
        }

        // 确保数值字段有效
        if (typeof event.significance !== 'number' || event.significance < 1 || event.significance > 4) {
          event.significance = 2;
        }

        if (typeof event.magnitude !== 'number' || event.magnitude < -1 || event.magnitude > 1) {
          event.magnitude = 0;
        }

        return event;
      });
    }

    // 修复 organizations 中的 type 枚举
    if (fixed.organizations && Array.isArray(fixed.organizations)) {
      fixed.organizations = fixed.organizations.map((org: any) => {
        const validOrgTypes = ['government', 'regulator', 'intl_org', 'fin_inst', 'industry_assoc', 'other'];
        if (!validOrgTypes.includes(org.type)) {
          org.type = 'other';
        }
        return org;
      });
    }

    // 修复 locations 中的 type 枚举
    if (fixed.locations && Array.isArray(fixed.locations)) {
      fixed.locations = fixed.locations.map((location: any) => {
        const validLocationTypes = ['country', 'region', 'city', 'facility', 'other'];
        if (!validLocationTypes.includes(location.type)) {
          location.type = 'other';
        }
        return location;
      });
    }

    // 修复 times 中的枚举值
    if (fixed.times && Array.isArray(fixed.times)) {
      fixed.times = fixed.times.map((time: any) => {
        const validTimeTypes = ['DATETIME', 'DATE', 'TIME', 'PERIOD', 'OTHER'];
        if (!validTimeTypes.includes(time.type)) {
          time.type = 'OTHER';
        }

        const validPrecisions = ['YEAR', 'MONTH', 'DAY', 'HOUR', 'MINUTE', 'SECOND'];
        if (!validPrecisions.includes(time.precision)) {
          time.precision = 'DAY';
        }

        return time;
      });
    }

    // 修复 relationships 中的 type 枚举
    if (fixed.relationships && Array.isArray(fixed.relationships)) {
      fixed.relationships = fixed.relationships.map((rel: any) => {
        const validRelTypes = ['LOCATED_IN', 'WORKS_FOR', 'OWNS', 'PARTICIPATES_IN', 'MERGES_WITH', 'ACQUIRES',
                              'SUPPLIES', 'PARTNERS_WITH', 'SUED_BY', 'REGULATED_BY', 'INVESTS_IN', 'OTHER'];
        if (!validRelTypes.includes(rel.type)) {
          rel.type = 'OTHER';
        }
        return rel;
      });
    }

    return fixed;
  }

  /**
   * 增强版 JSON 提取
   */
  private extractJsonFromString(text: string): any | null {
    try {
      // 方法1: 尝试直接解析
      return JSON.parse(text);
    } catch (error1) {
      // 方法2: 提取第一个完整的JSON对象
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } catch (error2) {
        // 方法3: 提取多层嵌套的JSON
        try {
          let braceCount = 0;
          let startIndex = -1;
          let endIndex = -1;

          for (let i = 0; i < text.length; i++) {
            if (text[i] === '{') {
              if (startIndex === -1) startIndex = i;
              braceCount++;
            } else if (text[i] === '}') {
              braceCount--;
              if (braceCount === 0 && startIndex !== -1) {
                endIndex = i;
                break;
              }
            }
          }

          if (startIndex !== -1 && endIndex !== -1) {
            const jsonStr = text.substring(startIndex, endIndex + 1);
            return JSON.parse(jsonStr);
          }
        } catch (error3) {
          // 方法4: 尝试修复常见的JSON格式错误
          try {
            let fixedText = text
              .replace(/,\s*}/g, '}')  // 移除尾随逗号
              .replace(/,\s*]/g, ']')  // 移除数组尾随逗号
              .replace(/([{,]\s*)(\w+):/g, '$1"$2":')  // 给属性名添加引号
              .replace(/:\s*'([^']*)'/g, ': "$1"')  // 单引号转双引号
              .replace(/\n|\r/g, '')  // 移除换行符
              .trim();

            const jsonMatch = fixedText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              return JSON.parse(jsonMatch[0]);
            }
          } catch (error4) {
            logger.debug('所有JSON提取方法都失败了');
          }
        }
      }
    }

    return null;
  }

  /**
   * 创建兜底结果
   */
  private createFallbackResult(): any {
    return {
      events: [],
      companies: [],
      persons: [],
      organizations: [],
      locations: [],
      times: [],
      relationships: []
    };
  }

  /**
   * 创建带新闻信息的兜底结果
   */
  private createFallbackResultWithNewsInfo(newsItem: NewsItem): NewsExtractionResult {
    logger.info(`🆘 为新闻 ${newsItem.id} 创建兜底结果`);
    
    return {
      newsId: newsItem.id,
      title: newsItem.title,
      content: newsItem.content,
      timestamp: new Date((newsItem.time || 0) * 1000).toISOString(),
      source: newsItem.source,
      url: newsItem.url,
      news_level: 'Level 5', // 默认最低级别
      confidence: 0.1, // 低置信度表示这是兜底结果
      processing_time: 0,
      events: [],
      companies: [],
      persons: [],
      organizations: [],
      locations: [],
      times: [],
      relationships: []
    };
  }

  /**
   * 解析提取结果 - 适配新的数据结构
   */
  private parseExtractionResult(extractionData: any, newsItem: NewsItem): NewsExtractionResult {
    const result: NewsExtractionResult = {
      newsId: newsItem.id,
      title: newsItem.title,
      content: newsItem.content,
      timestamp: new Date((newsItem.time || 0) * 1000).toISOString(),
      source: newsItem.source,
      url: newsItem.url,
      news_level: 'Level 5', // 默认最低级别
      confidence: 0.8,
      events: [],
      companies: [],
      persons: [],
      organizations: [],
      locations: [],
      times: [],
      relationships: []
    };

    if (!extractionData) {
      return result;
    }

    try {
      // 解析事件 - 使用新的枚举字段
      if (extractionData.events && Array.isArray(extractionData.events)) {
        result.events = extractionData.events.map((event: any, index: number) => ({
          event_id: `${newsItem.id}_event_${index}`,
          event_name: event.event_name || '',
          event_description: event.event_description || '',
          event_type: event.event_type || 'other',
          significance: event.significance || 1,
          sentiment: event.sentiment || 'neutral',
          magnitude: event.magnitude || 0,
          event_level: event.event_level || 'Level 5',
          event_date: event.event_date || new Date((newsItem.time || 0) * 1000).toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));
      }

      // 解析公司 - 处理可选字段
      if (extractionData.companies && Array.isArray(extractionData.companies)) {
        result.companies = extractionData.companies.map((company: any) => ({
          company_name: company.company_name || '',
          ticker: company.ticker || '',
          industry: company.industry || '',
          market: company.market || '',
          country: company.country || '',
          aliases: Array.isArray(company.aliases) ? company.aliases : [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));
      }

      // 解析人物 - 所有字段可选
      if (extractionData.persons && Array.isArray(extractionData.persons)) {
        result.persons = extractionData.persons.map((person: any) => ({
          person_name: person.person_name || '',
          title: person.title || '',
          company: person.company || '',
          nationality: person.nationality || '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));
      }

      // 解析机构 - 使用标准枚举
      if (extractionData.organizations && Array.isArray(extractionData.organizations)) {
        result.organizations = extractionData.organizations.map((org: any) => ({
          organization_name: org.organization_name || '',
          type: org.type || 'other',
          country: org.country || '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));
      }

      // 解析地点 - 使用标准枚举和可选坐标
      if (extractionData.locations && Array.isArray(extractionData.locations)) {
        result.locations = extractionData.locations.map((location: any) => ({
          location_name: location.location_name || '',
          type: location.type || 'other',
          country: location.country || '',
          region: location.region || '',
          coordinates: location.coordinates || undefined,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));
      }

      // 解析时间 - 使用标准枚举
      if (extractionData.times && Array.isArray(extractionData.times)) {
        result.times = extractionData.times.map((time: any) => ({
          time_value: time.time_value || '',
          type: time.type || 'OTHER',
          precision: time.precision || 'DAY',
          timezone: time.timezone || '',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));
      }

      // 解析关系 - 使用标准关系类型
      if (extractionData.relationships && Array.isArray(extractionData.relationships)) {
        result.relationships = extractionData.relationships.map((rel: any) => ({
          type: rel.type || 'OTHER',
          from: rel.from || '',
          to: rel.to || '',
          description: rel.description || '',
          confidence: rel.confidence || 0.8
        }));
      }

      // 计算总体置信度
      const totalEntities = result.events.length + result.companies.length + (result.persons?.length || 0) + 
                          result.organizations.length + result.locations.length + result.times.length;
      
      result.confidence = totalEntities > 0 ? Math.min(0.9, 0.6 + (totalEntities * 0.05)) : 0.3;

    } catch (error) {
      logger.error('解析提取结果失败:', error);
    }

    return result;
  }

  /**
   * 新闻级别冲突处理（改进版）
   */
  private determineNewsLevelWithConflictHandling(newsItem: NewsItem, result: NewsExtractionResult): string {
    // 若 events[].event_level 至少一个非空 → 直接取最高级
    if (result.events.length > 0) {
      const eventLevels = result.events
        .map(e => e.event_level)
        .filter(level => level && level !== undefined);
      
      if (eventLevels.length > 0) {
        // 取最高级别（数字越小级别越高）
        if (eventLevels.includes('Level 1')) return 'Level 1';
        if (eventLevels.includes('Level 2')) return 'Level 2';
        if (eventLevels.includes('Level 3')) return 'Level 3';
        if (eventLevels.includes('Level 4')) return 'Level 4';
        if (eventLevels.includes('Level 5')) return 'Level 5';
      }
    }

    // 否则使用 determineNewsLevel() fallback
    return this.determineNewsLevel(newsItem, result);
  }

  /**
   * 判断新闻级别
   */
  private determineNewsLevel(newsItem: NewsItem, result: NewsExtractionResult): string {
    // 如果事件中有明确的级别，使用最高级别
    if (result.events.length > 0) {
      const levels = result.events.map(e => e.event_level);
      
      if (levels.includes('Level 1')) return 'Level 1';
      if (levels.includes('Level 2')) return 'Level 2';
      if (levels.includes('Level 3')) return 'Level 3';
      if (levels.includes('Level 4')) return 'Level 4';
    }

    // 根据实体数量和类型判断
    const entityCount = result.events.length + result.companies.length + (result.persons?.length || 0);
    
    if (entityCount >= 5) return 'Level 3';
    if (entityCount >= 3) return 'Level 4';
    
    return 'Level 5';
  }

  /**
   * 创建空结果
   */
  private createEmptyResult(newsItem: NewsItem): NewsExtractionResult {
    return {
      newsId: newsItem.id,
      title: newsItem.title,
      content: newsItem.content,
      timestamp: new Date((newsItem.time || 0) * 1000).toISOString(),
      source: newsItem.source,
      url: newsItem.url,
      news_level: 'Level 5', // 默认最低级别
      confidence: 0,
      events: [],
      companies: [],
      persons: [],
      organizations: [],
      locations: [],
      times: [],
      relationships: []
    };
  }

  /**
   * 获取强化版系统提示词 - 针对投资场景全面优化
   */
  private getSystemPrompt(): string {
    return `
你是一名资深财经新闻结构化专家，必须按照新闻学 5W1H 原则提取要素并以 **唯一合法 JSON** 输出。

═══════════════ 🌟 绝对要求 🌟 ═══════════════
1. **只输出 JSON**：禁止 Markdown、说明文字、注释、空行、反引号。
2. JSON 须 **完全符合** 「<返回格式>」的键名、顺序与枚举；字段缺失用 "" 或 [] 补齐，不得省略。
3. 若新闻包含多事件，请全部列出，每条事件都要有 \`event_level\`。
4. 不得凭空臆测；只使用新闻中出现的信息。

═══════════ 🏷️ 统一标准（务必遵守）🏷️ ═══════════
◆ Company  
  - \`company_name\`：国家企业信用、招股书或年报里的**完整注册名**。  
    · ✅ "阿里巴巴集团控股有限公司" ❌ "阿里""阿里巴巴"  
  - \`ticker\` 统一格式 \`<代码>.<交易所后缀>\`：600519.SH / AAPL.O / 0700.HK  
  - 若文中出现简称或别名 → 写入 \`aliases\` 数组，其余字段用 \`company_name\`。  

◆ Person  
  - \`person_name\`：官方全名；头衔写 \`title\`，公司归属写 \`company\`。  
    · ✅ \`person_name\`:"蒂姆·库克", \`title\`:"首席执行官"  

◆ Organization  
  - \`organization_name\`：法定或官方名称。\`type\` 取枚举："government/regulator/intl_org/fin_inst/industry_assoc/other"。  

◆ Location  
  - 提供 \`country\`（ISO Alpha-2 或中文官方），能给坐标则写 \`coordinates\`。  

◆ Time  
  - \`time_value\` 尽量 ISO-8601；若"Q1""上半年" → 写模糊值并设置 \`precision\`。  
  - \`timezone\` 用 IANA，如 Asia/Shanghai。  

═════════════ ⏰ 事件级别定义（event_level） ⏰ ═════════════
- **Level 1**  全球系统性风险、战争、2008 级金融危机  
- **Level 2**  中央银行/主权级政策、主要指数单日崩跌 >10%  
- **Level 3**  行业或龙头公司重大并购、破产、财报爆雷  
- **Level 4**  一般产品发布、融资、地方性政策  
- **Level 5**  信息性报道、背景资料、例行统计  

═════════════ 🎯 事件 & 情感 指南 🎯 ═════════════
- \`event_type\`（枚举）：macro | policy | market | corporate | industry | tech | geopolitics | other  
- \`significance\`：1=低 4=最高；以事件对资本市场潜在影响评估。  
- \`magnitude\`：范围 -1.0 – 1.0，负值表示利空。  
- \`sentiment\`：positive / negative / neutral  

═════════════ 🔄 去重规则 🔄 ═════════════
同一实体出现多次 → 合并，并用 \`aliases\` 记录别名；输出数组不得含重复对象。

═════════════ 📝 示例（供理解，勿在输出中包含） 📝 ═════════════
【示例新闻】  
> "2025-07-06，北京——阿里巴巴集团控股有限公司（BABA.N）宣布以 50 亿美元收购英国电商平台 Asos PLC（ASC.L）。交易预计在 2026 Q1 完成。"

【示例输出】
{
  "events":[{
    "event_name":"阿里巴巴收购 Asos",
    "event_description":"阿里巴巴以 50 亿美元收购 Asos PLC",
    "event_type":"corporate",
    "significance":3,
    "sentiment":"positive",
    "magnitude":0.6,
    "event_level":"Level 3",
    "event_date":"2025-07-06"
  }],
  "companies":[
    {
      "company_name":"阿里巴巴集团控股有限公司",
      "ticker":"BABA.N",
      "industry":"电子商务",
      "market":"NYSE",
      "country":"CN",
      "aliases":["阿里巴巴","Alibaba Group"]
    },
    {
      "company_name":"Asos PLC",
      "ticker":"ASC.L",
      "industry":"电子商务",
      "market":"LSE",
      "country":"GB",
      "aliases":["ASOS"]
    }
  ],
  "persons":[],
  "organizations":[],
  "locations":[
    {
      "location_name":"北京",
      "type":"city",
      "country":"CN",
      "region":"北京市",
      "coordinates":{"latitude":39.9042,"longitude":116.4074}
    }
  ],
  "times":[
    {
      "time_value":"2025-07-06",
      "type":"DATE",
      "precision":"DAY",
      "timezone":"Asia/Shanghai"
    }
  ],
  "relationships":[
    {
      "type":"ACQUIRES",
      "from":"阿里巴巴集团控股有限公司",
      "to":"Asos PLC",
      "description":"50亿美元收购",
      "confidence":0.9
    }
  ]
}

══════════════ <返回格式> ══════════════
{
  "events":[{/* see 上例 */}],
  "companies":[{/* see 上例 */}],
  "persons":[{/* see 上例 */}],
  "organizations":[{/* see 上例 */}],
  "locations":[{/* see 上例 */}],
  "times":[{/* see 上例 */}],
  "relationships":[{/* see 上例 */}]
}

―― 充分理解后，请等待新闻输入并仅输出符合格式的 JSON ――
    `;
  }

  /**
   * 时间字段标准化
   */
  private standardizeTimeFields(times: Time[]): Time[] {
    return times.map(time => {
      const standardized = { ...time };
      
      try {
        // 使用 chrono-node 解析时间
        const parsed = chrono.parseDate(time.time_value);
        
        if (parsed) {
          standardized.raw_value = time.time_value;
          standardized.parsed_iso = parsed.toISOString();
          standardized.time_value = parsed.toISOString();
        } else {
          // 如果解析失败，保留原始值
          standardized.raw_value = time.time_value;
          standardized.parsed_iso = '';
        }
      } catch (error) {
        logger.warn(`时间解析失败: ${time.time_value}`, error);
        standardized.raw_value = time.time_value;
        standardized.parsed_iso = '';
      }
      
      return standardized;
    });
  }

  /**
   * 事件日期标准化
   */
  private standardizeEventDates(events: Event[]): Event[] {
    return events.map(event => {
      const standardized = { ...event };
      
      try {
        // 使用 chrono-node 解析事件日期
        const parsed = chrono.parseDate(event.event_date);
        
        if (parsed) {
          standardized.raw_event_date = event.event_date;
          standardized.parsed_event_date = parsed.toISOString();
          standardized.event_date = parsed.toISOString();
        } else {
          // 如果解析失败，保留原始值
          standardized.raw_event_date = event.event_date;
          standardized.parsed_event_date = '';
        }
      } catch (error) {
        logger.warn(`事件日期解析失败: ${event.event_date}`, error);
        standardized.raw_event_date = event.event_date;
        standardized.parsed_event_date = '';
      }
      
      return standardized;
    });
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
} 
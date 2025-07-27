import { logger } from '../utils/logger';
import aiService from './AiService';
import notificationService from './NotificationService';
import { z } from 'zod';
import { getCurrentTime } from '../utils/timeUtils';
import {
  EVENT_TYPE_VALUES,
  SENTIMENT_VALUES,
  EVENT_LEVEL_VALUES,
  ORGANIZATION_TYPE_VALUES,
  LOCATION_TYPE_VALUES,
  RELATIONSHIP_TYPE_VALUES,
  EventLevel,
  EventType,
  Sentiment,
  OrganizationType,
  LocationType,
  RelationshipType,
  EVENT_TYPE_DESCRIPTIONS,
  ORGANIZATION_TYPE_DESCRIPTIONS,
  DEFAULT_EVENT_TYPE,
  DEFAULT_SENTIMENT,
  DEFAULT_EVENT_LEVEL,
  DEFAULT_ORGANIZATION_TYPE,
  DEFAULT_LOCATION_TYPE,
  DEFAULT_RELATIONSHIP_TYPE,
} from '../constants/enums';
import * as fs from 'fs';
import * as path from 'path';
import {
  NewsItem,
  NewsExtractionResult,
  Event,
  Company,
  Person,
  Organization,
  Location,
  Relationship,
  LLMMessage,
} from '../types/index';
import config from '../config/config';

// ISO-8601 正则表达式
const iso8601 = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/;

// 强化版新闻六要素提取的schema - 与投资场景完全对齐
const newsExtractionSchema = z.object({
  events: z.array(
    z.object({
      event_name: z.string().min(1),
      event_description: z.string().min(1),
      event_type: z.enum(EVENT_TYPE_VALUES as [string, ...string[]]),
      significance: z.number().int().min(1).max(4),
      sentiment: z.enum(SENTIMENT_VALUES as [string, ...string[]]),
      magnitude: z.number().min(-1).max(1),
      event_level: z.enum(EVENT_LEVEL_VALUES as [string, ...string[]]),
      timestamp: z.string().regex(iso8601).optional().or(z.literal('')),
    })
  ),

  companies: z.array(
    z.object({
      company_name: z.string().min(1),
      ticker: z.string().optional().or(z.literal('')),
      industry: z.string().optional().or(z.literal('')),
      market: z.string().optional().or(z.literal('')),
      country: z.string().optional().or(z.literal('')),
      aliases: z.array(z.string()).optional().default([]),
    })
  ),

  persons: z.array(
    z.object({
      person_name: z.string().min(1),
      title: z.string().optional().or(z.literal('')),
      company: z.string().optional().or(z.literal('')),
      nationality: z.string().optional().or(z.literal('')),
    })
  ),

  organizations: z.array(
    z.object({
      organization_name: z.string().min(1),
      type: z
        .enum(ORGANIZATION_TYPE_VALUES as [string, ...string[]])
        .optional()
        .or(z.literal('')),
      country: z.string().optional().or(z.literal('')),
    })
  ),

  locations: z.array(
    z.object({
      location_name: z.string().min(1),
      type: z
        .enum(LOCATION_TYPE_VALUES as [string, ...string[]])
        .optional()
        .or(z.literal('')),
      country: z.string().optional().or(z.literal('')),
      region: z.string().optional().or(z.literal('')),
    })
  ),

  relationships: z.array(
    z.object({
      type: z.enum(RELATIONSHIP_TYPE_VALUES as [string, ...string[]]),
      from: z.string().min(1),
      to: z.string().min(1),
      description: z.string().optional().or(z.literal('')),
      confidence: z.number().min(0).max(1).optional(),
    })
  ),
});

/**
 * 实体提取服务
 * 负责从新闻内容中提取结构化信息
 */
export class EntityExtractionService {
  private maxRetries = 5;
  private retryDelay = 2000;
  private failedNewsDir = path.join(process.cwd(), '../..', 'data', 'news', 'failed');

  constructor() {}

  /**
   * 从单条新闻中提取六要素信息
   */
  async extractFromNews(newsItem: NewsItem): Promise<NewsExtractionResult> {
    const startTime = Date.now();

    try {
      logger.info(`🔍 开始提取新闻六要素: ${newsItem.id}`);

      // 使用AI提取六要素（不允许兜底，必须成功）
      const extractionData = await this.callAIExtraction(newsItem);

      // 检查提取结果是否有效
      if (!extractionData) {
        throw new Error('AI提取返回空结果');
      }

      // 解析提取结果
      const result = this.parseExtractionResult(extractionData, newsItem);

      // 判断新闻级别（使用新的冲突处理逻辑）
      result.news_level = this.determineNewsLevelWithConflictHandling(newsItem, result);

      // 计算处理时间
      result.processing_time = Date.now() - startTime;

      logger.info(
        `✅ 新闻 ${newsItem.id} 六要素提取完成: 事件${result.events.length}个, 公司${result.companies.length}个, ` +
          `人物${result.persons?.length || 0}个, 机构${result.organizations.length}个, ` +
          `地点${result.locations.length}个, 关系${result.relationships.length}个, 级别: ${result.news_level}`
      );

      return result;
    } catch (error: any) {
      logger.error(`❌ 新闻 ${newsItem.id} 六要素提取异常:`, error);

      // 保存失败的新闻数据
      await this.saveFailedNews(newsItem, error);

      // 发送实体提取失败通知，包含provider信息和重试次数
      try {
        const providerInfo = aiService.getProviderInfo();
        const detailedError = `${error.message || '实体提取失败'} | 主Provider: ${providerInfo.current}${providerInfo.hasFallback ? `, 备用: ${providerInfo.fallback}` : ' (无备用)'}`;
        
        await notificationService.sendEntityExtractionFailureNotification(
          newsItem.id,
          detailedError,
          this.maxRetries // 发送重试次数信息
        );
      } catch (notifyError) {
        logger.error('发送实体提取失败通知失败:', notifyError);
      }

      // 重新抛出异常，不使用兜底结果
      throw error;
    }
  }

  /**
   * 批量提取新闻六要素 - 优化版本，分块处理避免内存溢出
   */
  async batchExtractEntities(newsItems: NewsItem[]): Promise<NewsExtractionResult[]> {
    logger.info(`🔄 开始批量提取六要素: ${newsItems.length} 条新闻`);

    // 从配置文件读取分块大小配置
    const CHUNK_SIZE = config.processing.memory.extractionChunkSize;
    const BATCH_SIZE = config.processing.memory.aiBatchSize;
    const CHUNK_DELAY = config.processing.memory.chunkDelayMs;
    const MEMORY_THRESHOLD =
      config.processing.memory.dangerThreshold *
      config.processing.memory.maxHeapSizeMB *
      1024 *
      1024;

    logger.info(
      `📊 内存优化配置: 分块大小=${CHUNK_SIZE}, AI批次=${BATCH_SIZE}, 延迟=${CHUNK_DELAY}ms`
    );

    const allResults: NewsExtractionResult[] = [];
    let totalSuccessful = 0;
    let totalFailed = 0;

    // 分块处理所有新闻
    for (let chunkStart = 0; chunkStart < newsItems.length; chunkStart += CHUNK_SIZE) {
      const chunk = newsItems.slice(chunkStart, chunkStart + CHUNK_SIZE);
      const chunkIndex = Math.floor(chunkStart / CHUNK_SIZE) + 1;
      const totalChunks = Math.ceil(newsItems.length / CHUNK_SIZE);

      logger.info(`🔄 处理分块 ${chunkIndex}/${totalChunks}: ${chunk.length} 条新闻`);

      // 记录分块开始时的内存使用情况
      const memoryBefore = process.memoryUsage();
      logger.debug(
        `内存使用 (分块${chunkIndex}开始): ${Math.round(memoryBefore.heapUsed / 1024 / 1024)}MB`
      );

      const chunkResults = await this.processNewsChunk(chunk, BATCH_SIZE);

      // 累计统计
      const chunkSuccessful = chunkResults.length;
      const chunkFailed = chunk.length - chunkSuccessful;
      totalSuccessful += chunkSuccessful;
      totalFailed += chunkFailed;

      // 将结果添加到总结果中
      allResults.push(...chunkResults);

      // 记录分块结束后的内存使用情况
      const memoryAfter = process.memoryUsage();
      logger.debug(
        `内存使用 (分块${chunkIndex}结束): ${Math.round(memoryAfter.heapUsed / 1024 / 1024)}MB`
      );

      // 如果内存使用超过阈值，触发垃圾回收
      if (memoryAfter.heapUsed > MEMORY_THRESHOLD) {
        logger.warn(
          `⚠️ 内存使用达到${Math.round(memoryAfter.heapUsed / 1024 / 1024)}MB，触发垃圾回收`
        );
        if (global.gc && config.processing.memory.enableAutoGC) {
          global.gc();
          const memoryAfterGC = process.memoryUsage();
          logger.info(
            `🗑️ 垃圾回收完成，内存释放到${Math.round(memoryAfterGC.heapUsed / 1024 / 1024)}MB`
          );
        }
      }

      // 分块间添加延迟，给系统喘息时间
      if (chunkStart + CHUNK_SIZE < newsItems.length) {
        await this.delay(CHUNK_DELAY);
      }

      logger.info(`✅ 分块${chunkIndex}处理完成: 成功${chunkSuccessful}条，失败${chunkFailed}条`);
    }

    const totalNews = newsItems.length;
    logger.info(
      `✅ 批量六要素提取完成: 成功 ${totalSuccessful} 条，失败 ${totalFailed} 条，总计 ${totalNews} 条新闻`
    );

    if (totalFailed > 0) {
      logger.warn(`⚠️ ${totalFailed} 条新闻处理失败，已保存到 data/news/failed 目录`);
    }

    return allResults;
  }

  /**
   * 处理单个新闻分块
   */
  private async processNewsChunk(
    newsChunk: NewsItem[],
    batchSize: number
  ): Promise<NewsExtractionResult[]> {
    const chunkResults: NewsExtractionResult[] = [];

    for (let i = 0; i < newsChunk.length; i += batchSize) {
      const batch = newsChunk.slice(i, i + batchSize);

      logger.debug(
        `处理子批次: ${i + 1}-${Math.min(i + batchSize, newsChunk.length)}/${newsChunk.length}`
      );

      const batchPromises = batch.map(async newsItem => {
        try {
          return await this.extractFromNews(newsItem);
        } catch (error) {
          logger.warn(`新闻 ${newsItem.id} 处理失败，跳过继续处理其他新闻`);
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);

      // 只添加成功处理的结果
      const successfulResults = batchResults.filter(
        result => result !== null
      ) as NewsExtractionResult[];
      chunkResults.push(...successfulResults);

      // 批次间添加延迟避免API限制
      if (i + batchSize < newsChunk.length) {
        await this.delay(2000);
      }
    }

    return chunkResults;
  }

  /**
   * 调用AI进行六要素提取（带重试机制）
   */
  private async callAIExtraction(newsItem: NewsItem): Promise<any> {
    // 获取AI服务的provider信息
    const providerInfo = aiService.getProviderInfo();
    logger.info(`🤖 使用AI提取六要素 - 主Provider: ${providerInfo.current}${providerInfo.hasFallback ? `, 备用: ${providerInfo.fallback}` : ''}`);

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
        发布时间：${newsItem.timestamp}
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
          temperature: 0.3,
        });

        if (response.success) {
          // 对响应进行校验和解析处理
          const validatedData = this.validateAndParsing(response.data, attempt);
          logger.debug(`✅ AI提取成功 (尝试 ${attempt})`);
          return validatedData;
        } else {
          throw new Error(response.error || 'AI提取失败');
        }
      } catch (error: any) {
        lastError = error;
        logger.warn(`AI六要素提取尝试 ${attempt} 失败: ${error.message}`, {
          stack: error.stack,
        });

        // 即使出错，也尝试从错误中提取有用信息
        if (error.text || (error.response && error.response.text)) {
          try {
            const errorText = error.text || error.response.text;
            logger.debug(`🔍 错误文本提取: ${errorText.substring(0, 500)}...`);

            const extractedJson = this.extractJsonFromString(errorText);
            if (extractedJson) {
              logger.debug(`🔍 JSON 提取成功，开始修复数据...`);
              const fixedJson = this.fixCommonSchemaIssues(extractedJson);
              logger.debug(`🔍 数据修复完成，验证 schema...`);

              const parsedResult = newsExtractionSchema.safeParse(fixedJson);
              if (parsedResult.success) {
                logger.info(`✅ 从错误响应中成功提取数据 (尝试 ${attempt})`);
                return parsedResult.data;
              } else {
                logger.warn(`❌ Schema 验证失败:`, parsedResult.error.errors.slice(0, 5));
              }
            } else {
              logger.debug(`❌ JSON 提取失败`);
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

    // 如果所有重试都失败，抛出最后一个错误
    logger.error(`所有AI提取尝试都失败。最后错误:`, lastError?.message);
    throw lastError || new Error('AI提取失败：所有重试都失败');
  }

  /**
   * 校验并解析数据（增强版）
   */
  private validateAndParsing(resp: any, attempt: number): any {
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

      // 如果都失败，抛出错误
      logger.error(`所有解析尝试失败 (尝试 ${attempt})`);
      throw new Error(`数据解析失败：无法解析AI返回的数据格式`);
    } catch (error) {
      logger.error(`数据解析异常 (尝试 ${attempt}):`, error);
      throw error;
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

    // 修复数组中的字符串化对象
    this.fixStringifiedObjectsInArrays(fixed);

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
      fixed.companies = fixed.companies
        .filter((company: any) => company && typeof company === 'object' && company.company_name)
        .map((company: any) => {
          if (!company.aliases || !Array.isArray(company.aliases)) {
            company.aliases = [];
          }
          return company;
        });
    }

    // 修复 events 中的必需字段
    if (fixed.events && Array.isArray(fixed.events)) {
      fixed.events = fixed.events
        .filter(
          (event: any) => event && typeof event === 'object' && (event.event_name || event.event_id)
        )
        .map((event: any) => {
          // 确保 event_id 存在
          if (!event.event_id) {
            event.event_id = event.event_name
              ? event.event_name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase() + '_' + Date.now()
              : 'event_' + Date.now();
          }

          // 修复 event_type 枚举
          if (!EVENT_TYPE_VALUES.includes(event.event_type)) {
            event.event_type = DEFAULT_EVENT_TYPE;
          }

          // 修复 sentiment 枚举
          if (!SENTIMENT_VALUES.includes(event.sentiment)) {
            event.sentiment = DEFAULT_SENTIMENT;
          }

          // 修复 event_level 枚举
          if (!EVENT_LEVEL_VALUES.includes(event.event_level)) {
            event.event_level = DEFAULT_EVENT_LEVEL;
          }

          // 确保数值字段有效
          if (
            typeof event.significance !== 'number' ||
            event.significance < 1 ||
            event.significance > 4
          ) {
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
      fixed.organizations = fixed.organizations
        .filter((org: any) => org && typeof org === 'object' && org.organization_name)
        .map((org: any) => {
          if (!ORGANIZATION_TYPE_VALUES.includes(org.type)) {
            org.type = DEFAULT_ORGANIZATION_TYPE;
          }
          return org;
        });
    }

    // 修复 locations 中的 type 枚举
    if (fixed.locations && Array.isArray(fixed.locations)) {
      fixed.locations = fixed.locations
        .filter(
          (location: any) => location && typeof location === 'object' && location.location_name
        )
        .map((location: any) => {
          if (!LOCATION_TYPE_VALUES.includes(location.type)) {
            location.type = DEFAULT_LOCATION_TYPE;
          }
          return location;
        });
    }

    // 修复 relationships 中的 type 枚举
    if (fixed.relationships && Array.isArray(fixed.relationships)) {
      fixed.relationships = fixed.relationships
        .filter((rel: any) => rel && typeof rel === 'object' && rel.from && rel.to)
        .map((rel: any) => {
          if (!RELATIONSHIP_TYPE_VALUES.includes(rel.type)) {
            rel.type = DEFAULT_RELATIONSHIP_TYPE;
          }
          return rel;
        });
    }

    return fixed;
  }

  /**
   * 修复数组中的字符串化对象
   */
  private fixStringifiedObjectsInArrays(data: any): void {
    const arrayFields = [
      'events',
      'companies',
      'persons',
      'organizations',
      'locations',
      'relationships',
    ];

    for (const field of arrayFields) {
      if (data[field] && Array.isArray(data[field])) {
        let fixedCount = 0;
        data[field] = data[field].map((item: any) => {
          // 如果数组项是字符串，尝试解析为对象
          if (typeof item === 'string') {
            try {
              const parsed = JSON.parse(item);
              if (typeof parsed === 'object' && parsed !== null) {
                fixedCount++;
                logger.debug(
                  `🔧 修复字符串化对象 ${field}[${fixedCount}]: ${item.substring(0, 100)}...`
                );
                return parsed;
              }
            } catch (error) {
              logger.debug(`无法解析字符串化对象: ${item}`);
            }
          }
          return item;
        });

        if (fixedCount > 0) {
          logger.info(`✅ 修复了 ${fixedCount} 个字符串化的 ${field} 对象`);
        }
      }
    }
  }

  /**
   * 从响应中提取和修复 JSON
   */
  private extractJsonFromString(jsonString: string): any | null {
    try {
      let jsonContent = '';

      // 优先查找 ```json...``` 代码块
      const codeBlockMatch = jsonString.match(/```json\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch && codeBlockMatch[1]) {
        jsonContent = codeBlockMatch[1].trim();
      } else {
        // 如果没有代码块，尝试移除开头和结尾的markdown标记
        jsonContent = jsonString.replace(/^```json\s*|\s*```$/g, '').trim();
      }

      // 如果内容不是以 { 开始，尝试提取JSON对象
      if (!jsonContent.startsWith('{')) {
        const jsonMatch = jsonContent.match(/\{[\s\S]*?\}/);
        if (jsonMatch) {
          jsonContent = jsonMatch[0];
        }
      }

      // 如果仍然没有找到有效的JSON，直接尝试从原始文本提取
      if (!jsonContent || !jsonContent.trim().startsWith('{')) {
        const jsonMatch = jsonString.match(/\{[\s\S]*?\}/);
        if (jsonMatch) {
          jsonContent = jsonMatch[0];
        } else {
          logger.debug(`未找到有效的JSON: ${jsonString.substring(0, 200)}...`);
          return null;
        }
      }

      // 修复常见的JSON格式错误
      jsonContent = this.fixCommonJsonErrors(jsonContent.trim());

      return JSON.parse(jsonContent);
    } catch (error) {
      logger.debug(`JSON解析失败: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * 修复常见的JSON格式错误
   */
  private fixCommonJsonErrors(jsonContent: string): string {
    // 修复 "key": ""; "" 这种格式错误 - 将其转换为 "key": ""
    jsonContent = jsonContent.replace(/"([^"]+)":\s*"[^"]*";\s*"[^"]*"/g, '"$1": ""');

    // 修复 "key": "value"; "key2": "value2" 这种用分号分隔的格式
    jsonContent = jsonContent.replace(/(":\s*"[^"]*")\s*;\s*"/g, '$1, "');

    // 修复多余的分号（在引号前）
    jsonContent = jsonContent.replace(/;\s*"/g, ', "');

    // 修复缺少逗号的情况（换行）
    jsonContent = jsonContent.replace(/"\s*\n\s*"/g, '",\n"');

    // 修复空key的问题：删除类似 ,"", 或 "","" 或 {"", 的无效键值对
    // 1. 修复 "key","","other_key" -> "key","other_key"
    jsonContent = jsonContent.replace(/,\s*""\s*,/g, ',');

    // 2. 修复对象开头的空key：{"","key" -> {"key"
    jsonContent = jsonContent.replace(/{\s*""\s*,/g, '{');

    // 3. 修复对象结尾的空key：,"","} -> "}
    jsonContent = jsonContent.replace(/,\s*""\s*}/g, '}');

    // 4. 修复单独的空key："key":"value","" -> "key":"value"
    jsonContent = jsonContent.replace(/,\s*""\s*(?=[,\]\}])/g, '');

    // 5. 修复空key后跟冒号的情况：""," -> 删除整个部分
    jsonContent = jsonContent.replace(/,\s*""\s*:\s*"[^"]*"/g, '');
    jsonContent = jsonContent.replace(/{\s*""\s*:\s*"[^"]*"\s*,/g, '{');

    // 6. 修复特殊情况：处理 "key","","next":"value" -> "key","next":"value"
    jsonContent = jsonContent.replace(/"([^"]+)"\s*,\s*""\s*,\s*"([^"]+)"/g, '"$1", "$2"');

    // 修复尾随逗号
    jsonContent = jsonContent.replace(/,\s*}/g, '}');
    jsonContent = jsonContent.replace(/,\s*]/g, ']');

    return jsonContent;
  }

  /**
   * 解析提取结果 - 适配新的数据结构
   */
  private parseExtractionResult(extractionData: any, newsItem: NewsItem): NewsExtractionResult {
    const result: NewsExtractionResult = {
      newsId: newsItem.id,
      title: newsItem.title,
      content: newsItem.content,
      timestamp: newsItem.timestamp,
      raw_time: newsItem.raw_time,
      source: newsItem.source,
      url: newsItem.url,
      news_level: DEFAULT_EVENT_LEVEL, // 默认最低级别
      confidence: 0.8,
      events: [],
      companies: [],
      persons: [],
      organizations: [],
      locations: [],
      relationships: [],
    };

    if (!extractionData) {
      return result;
    }

    try {
      // 解析事件 - 使用新的枚举字段
      if (extractionData.events && Array.isArray(extractionData.events)) {
        result.events = extractionData.events
          .filter((event: any) => event && typeof event === 'object' && event.event_name)
          .map((event: any, index: number) => ({
            event_id: `${newsItem.id}_event_${index}`,
            event_name: event.event_name || '',
            event_description: event.event_description || '',
            event_type: event.event_type || DEFAULT_EVENT_TYPE,
            significance: event.significance || 1,
            sentiment: event.sentiment || DEFAULT_SENTIMENT,
            magnitude: event.magnitude || 0,
            event_level: event.event_level || DEFAULT_EVENT_LEVEL,
            timestamp: event.timestamp || newsItem.timestamp,
            raw_time: newsItem.raw_time,
          }));
      }

      // 解析公司 - 处理可选字段
      if (extractionData.companies && Array.isArray(extractionData.companies)) {
        result.companies = extractionData.companies
          .filter((company: any) => company && typeof company === 'object' && company.company_name)
          .map((company: any) => ({
            company_name: company.company_name || '',
            ticker: company.ticker || '',
            industry: company.industry || '',
            market: company.market || '',
            country: company.country || '',
            aliases: Array.isArray(company.aliases) ? company.aliases : [],
          }));
      }

      // 解析人物 - 所有字段可选
      if (extractionData.persons && Array.isArray(extractionData.persons)) {
        result.persons = extractionData.persons
          .filter((person: any) => person && typeof person === 'object' && person.person_name)
          .map((person: any) => ({
            person_name: person.person_name || '',
            title: person.title || '',
            company: person.company || '',
            nationality: person.nationality || '',
          }));
      }

      // 解析机构 - 使用标准枚举
      if (extractionData.organizations && Array.isArray(extractionData.organizations)) {
        result.organizations = extractionData.organizations
          .filter((org: any) => org && typeof org === 'object' && org.organization_name)
          .map((org: any) => ({
            organization_name: org.organization_name || '',
            type: org.type || DEFAULT_ORGANIZATION_TYPE,
            country: org.country || '',
          }));
      }

      // 解析地点 - 使用标准枚举和可选坐标
      if (extractionData.locations && Array.isArray(extractionData.locations)) {
        result.locations = extractionData.locations
          .filter(
            (location: any) => location && typeof location === 'object' && location.location_name
          )
          .map((location: any) => ({
            location_name: location.location_name || '',
            type: location.type || DEFAULT_LOCATION_TYPE,
            country: location.country || '',
            region: location.region || '',
            coordinates: location.coordinates || undefined,
          }));
      }

      // 解析关系 - 使用标准关系类型
      if (extractionData.relationships && Array.isArray(extractionData.relationships)) {
        result.relationships = extractionData.relationships
          .filter((rel: any) => rel && typeof rel === 'object' && rel.from && rel.to)
          .map((rel: any) => ({
            type: rel.type || DEFAULT_RELATIONSHIP_TYPE,
            from: rel.from || '',
            to: rel.to || '',
            description: rel.description || '',
            confidence: rel.confidence || 0.8,
          }));
      }

      // 计算总体置信度
      const totalEntities =
        result.events.length +
        result.companies.length +
        (result.persons?.length || 0) +
        result.organizations.length +
        result.locations.length;

      result.confidence = totalEntities > 0 ? Math.min(0.9, 0.6 + totalEntities * 0.05) : 0.3;
    } catch (error) {
      logger.error('解析提取结果失败:', error);
    }

    return result;
  }

  /**
   * 新闻级别冲突处理（改进版）
   */
  private determineNewsLevelWithConflictHandling(
    newsItem: NewsItem,
    result: NewsExtractionResult
  ): string {
    // 若 events[].event_level 至少一个非空 → 直接取最高级
    if (result.events.length > 0) {
      const eventLevels = result.events
        .map(e => e.event_level)
        .filter(level => level && level !== undefined);

      if (eventLevels.length > 0) {
        // 取最高级别（数字越小级别越高）
        if (eventLevels.includes(EventLevel.LEVEL_1)) return EventLevel.LEVEL_1;
        if (eventLevels.includes(EventLevel.LEVEL_2)) return EventLevel.LEVEL_2;
        if (eventLevels.includes(EventLevel.LEVEL_3)) return EventLevel.LEVEL_3;
        if (eventLevels.includes(EventLevel.LEVEL_4)) return EventLevel.LEVEL_4;
        if (eventLevels.includes(EventLevel.LEVEL_5)) return EventLevel.LEVEL_5;
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

      if (levels.includes(EventLevel.LEVEL_1)) return EventLevel.LEVEL_1;
      if (levels.includes(EventLevel.LEVEL_2)) return EventLevel.LEVEL_2;
      if (levels.includes(EventLevel.LEVEL_3)) return EventLevel.LEVEL_3;
      if (levels.includes(EventLevel.LEVEL_4)) return EventLevel.LEVEL_4;
    }

    // 根据实体数量和类型判断
    const entityCount =
      result.events.length + result.companies.length + (result.persons?.length || 0);

    if (entityCount >= 5) return EventLevel.LEVEL_3;
    if (entityCount >= 3) return EventLevel.LEVEL_4;

    return EventLevel.LEVEL_5;
  }

  /**
   * 获取强化版系统提示词 - 针对投资场景全面优化
   * 使用枚举常量动态生成提示词，确保与代码中的枚举定义保持一致
   */
  private getSystemPrompt(): string {
    // 动态生成枚举值描述，避免硬编码
    const eventTypeList = EVENT_TYPE_VALUES.join(' | ');
    const sentimentList = SENTIMENT_VALUES.join(' / ');
    const organizationTypeList = ORGANIZATION_TYPE_VALUES.join('/');

    // 生成机构类型的详细描述，包含中文说明
    const organizationTypeDescriptions = ORGANIZATION_TYPE_VALUES.map(
      type => `${type}(${ORGANIZATION_TYPE_DESCRIPTIONS[type as OrganizationType]})`
    ).join('、');

    return `
你是一名资深财经新闻结构化专家，必须按照新闻学 5W1H 原则提取要素并以 **唯一合法 JSON** 输出。

═══════════════ 🌟 绝对要求 🌟 ═══════════════
1. **只输出 JSON**：禁止 Markdown、说明文字、注释、空行、反引号。
2. JSON 须 **完全符合** 「<返回格式>」的键名、顺序与枚举；字段缺失用 "" 或 [] 补齐，不得省略。
3. 若新闻包含多事件，请全部列出，每条事件都要有 \`event_level\`。
4. **不做推测**：仅使用新闻中出现的信息，若信息缺失，填写空值或数组，不推测填补。
   
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
  - \`organization_name\`：法定或官方名称。\`type\` 取枚举："${organizationTypeList}"。  
  - 类型说明：${organizationTypeDescriptions}  

◆ Location  
  - 提供 \`country\`（ISO Alpha-2 或中文官方）。  

═════════════ ⏰ 事件级别定义（event_level） ⏰ ═════════════
- **Level 1**  超级事件：对全球经济、市场、政治局势产生 **重大影响** 的突发性事件。通常会引发 **全球性的恐慌或波动**，具有 **系统性风险**，是资本市场的 **极端事件**。
  - **突发战争** 或 **战争的重要进展**（如战争爆发、重要的战役进展等）应评为 **Level 1**。
  - **全球重要人物的发言**（例如：美联储主席、欧盟委员会主席、世界主要领导人的重大讲话）或 **中、美、欧央行的主权政策变动**。
  - **全球主要指数的异常涨幅或跌幅**（例如：美股标普500、纳斯达克等指数单日跌幅超过 10%）。
  - **注意**：请谨慎评定为 **Level 1**，仅当事件具有 **全球性影响** 或 **对资本市场产生深远影响** 时，才应标记为 **Level 1**。

- **Level 2**  重要国家事件：对某个国家、地区或全球市场产生 **重大影响** 的事件，通常局限于 **特定国家** 或 **重要企业**。不会导致全球性恐慌，但影响力较大。
  - **持续发生的战争冲突进展** 或 **其他重要的政治动荡**（如：某国的政治危机、长时间的战争局势等）。
  - **中、美、欧** 以外的 **央行/主权级政策变动**，如日本央行的货币政策调整或新兴市场国家的重大金融政策。
  - **中美全球型大型企业的重大事件**（例如：财报暴雷、并购收购、企业破产等）。

- **Level 3**  行业内重大事件：对某个行业或公司产生 **重要影响** 的事件，通常影响 **行业内的其他公司**，但不会产生较大范围的资本市场波动。
  - **行业龙头公司** 的 **并购、破产、财报发布等重大事件**（例如：知名企业发布的财报结果不及预期，导致股价暴跌）。
  - **其他地区或行业内的公司** 发生的 **重大并购、破产、融资等事件**。

- **Level 4**  一般产品发布、地方性政策和金融新闻：这类事件通常不会引起 **重大市场波动**，对企业或特定行业产生较小影响。
  - **一般产品发布、技术发布**、**地方性政策变化**（如地方政府的税收优惠或经济发展政策等）。
  - **金融新闻**（如：季度财报、股东大会决议、公司战略公告等）。

- **Level 5**  信息性报道和背景资料：对市场 **影响微乎其微** 的常规信息，通常用于 **补充背景或提供数据**。
  - **日常信息性报道**（如：宏观经济数据、行业趋势报告、消费者信心指数等）。
  - **例行统计数据**（例如：失业率、GDP增速等指标）。

- **非金融相关新闻**：若新闻内容与 **金融市场无关**（如：娱乐、体育、科技、文化等），应根据事件的影响范围和重要性 **下调一级**（如：**Level 2** -> **Level 3**，**Level 3** -> **Level 4**）。这些新闻通常对资本市场没有直接影响。



═════════════ 🎯 事件 & 情感 指南 🎯 ═════════════
- \`event_type\`（枚举）：${eventTypeList}  
- \`significance\`：1=低 4=最高；以事件对资本市场潜在影响评估。  
- \`magnitude\`：范围 -1.0 – 1.0，负值表示利空。  
- \`sentiment\`：${sentimentList}  

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
    "event_type":"${EventType.CORPORATE}",
    "significance":3,
    "sentiment":"${Sentiment.POSITIVE}",
    "magnitude":0.6,
    "event_level":"${EventLevel.LEVEL_3}",
    "timestamp":"2025-07-06T00:00:00.000Z"
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
      "type":"${LocationType.CITY}",
      "country":"CN",
      "region":"北京市"
    }
  ],
  "relationships":[
    {
      "type":"${RelationshipType.ACQUIRES}",
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
  "relationships":[{/* see 上例 */}]
}

―― 充分理解后，请等待新闻输入并仅输出符合格式的 JSON ――

    `;
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 保存失败的新闻数据到指定目录
   */
  private async saveFailedNews(newsItem: NewsItem, error: any): Promise<void> {
    try {
      // 确保失败新闻目录存在
      if (!fs.existsSync(this.failedNewsDir)) {
        fs.mkdirSync(this.failedNewsDir, { recursive: true });
      }

      // 创建失败新闻的详细信息
      const failedNewsData = {
        newsItem,
        error: {
          message: error.message || 'Unknown error',
          stack: error.stack || '',
          timestamp: getCurrentTime(),
          service: 'EntityExtractionService',
        },
        metadata: {
          failedAt: getCurrentTime(),
          originalId: newsItem.id,
          source: newsItem.source,
          title: newsItem.title,
        },
      };

      // 生成文件名：使用新闻ID和时间戳
      const timestamp = getCurrentTime().replace(/[:.]/g, '-');
      const filename = `failed_${newsItem.id}_${timestamp}.json`;
      const filepath = path.join(this.failedNewsDir, filename);

      // 保存文件
      await fs.promises.writeFile(filepath, JSON.stringify(failedNewsData, null, 2), 'utf8');

      logger.warn(`❌ 失败新闻已保存: ${filepath}`);
    } catch (saveError) {
      logger.error(`保存失败新闻时出错: ${newsItem.id}`, saveError);
    }
  }
}

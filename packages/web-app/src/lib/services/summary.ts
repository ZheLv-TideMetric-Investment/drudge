import { formatPromptFields } from '@drudge/common';
import { TimeZoneUtils, TIME_FORMATS } from '../utils/timezone';
import { notificationService } from './notification';
import { neo4jNewsService } from '../neo4j';
import { SummaryResult } from '../../types/scheduler';
import { aiService, createMessages, callSimpleAIText } from '../utils/llm';
import { EventLevel } from '../../../constants/enums';

interface ConcurrencyConfig {
  batchSize: number;
  batchInterval: number;
}

interface SummaryConcurrencyConfig {
  ai: ConcurrencyConfig;
  database: ConcurrencyConfig;
}

type TimeInput = string | Date;

const toDate = (input: TimeInput): Date => {
  const date = input instanceof Date ? new Date(input.getTime()) : new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new Error('无效的时间格式');
  }
  return date;
};

const toDateOrNull = (input: TimeInput): Date | null => {
  const date = input instanceof Date ? new Date(input.getTime()) : new Date(input);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toISOStringSafe = (input: TimeInput): string => {
  return toDate(input).toISOString();
};

const resolveUnixSeconds = (value: unknown): number => {
  if (typeof value === 'number') {
    return value;
  }
  const date = new Date(value as any);
  const timestamp = date.getTime();
  return Number.isNaN(timestamp) ? 0 : Math.floor(timestamp / 1000);
};

const DEFAULT_CONCURRENCY: SummaryConcurrencyConfig = {
  ai: {
    batchSize: 10,
    batchInterval: 100,
  },
  database: {
    batchSize: 20,
    batchInterval: 100,
  },
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function limitConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
  delayMs: number
): Promise<T[]> {
  const results: Array<T | null> = new Array(tasks.length).fill(null);
  let nextIndex = 0;

  const worker = async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= tasks.length) return;

      if (delayMs > 0 && index !== 0) {
        await delay(delayMs);
      }

      try {
        results[index] = await tasks[index]();
      } catch (error) {
        console.error(`任务 ${index + 1} 执行失败:`, error);
        results[index] = null;
      }
    }
  };

  const poolSize = Math.min(concurrency, tasks.length);
  await Promise.all(Array.from({ length: poolSize }, worker));

  return results.filter((result): result is T => result !== null);
}

async function runTasks<T>(
  label: string,
  tasks: Array<() => Promise<T>>,
  config: ConcurrencyConfig
): Promise<T[]> {
  if (tasks.length === 0) return [];

  const safeBatchSize = Math.max(1, config.batchSize);
  const safeInterval = Math.max(0, config.batchInterval);

  console.log(
    `🚀 ${label}: ${tasks.length} 个任务 (并发 ${safeBatchSize}, 间隔 ${safeInterval}ms)`
  );
  const results = await limitConcurrency(tasks, safeBatchSize, safeInterval);
  console.log(`✅ ${label} 完成，成功 ${results.length}/${tasks.length} 个`);

  return results;
}

export function buildPrompt(systemPrompt: string, userPrompt: string) {
  return createMessages(systemPrompt, userPrompt);
}

export function groupByLevel(newsItems: any[]): Record<string, any[]> {
  const grouped: Record<string, any[]> = {};

  newsItems.forEach(item => {
    const level = item.level || 'Unknown';
    if (!grouped[level]) {
      grouped[level] = [];
    }

    const hasTimestamp = item.timestamp !== undefined && item.timestamp !== null;
    const hasTime = item.time !== undefined && item.time !== null;
    const timeValue = hasTimestamp
      ? resolveUnixSeconds(item.timestamp)
      : hasTime
        ? resolveUnixSeconds(item.time)
        : 0;

    grouped[level].push({
      newsId: item.newsId,
      title: item.title,
      content: item.content || '',
      time: timeValue,
    });
  });

  return grouped;
}

function parseLevelNumber(level: string): number {
  const match = level.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 999;
}

function mergeLevelSummaries(levelSummaries: Record<string, string>): string {
  console.log(`🔗 合并 ${Object.keys(levelSummaries).length} 个level的总结...`);

  const levelEntries = Object.entries(levelSummaries);
  levelEntries.sort(([a], [b]) => parseLevelNumber(a) - parseLevelNumber(b));

  return levelEntries
    .map(([level, summary]) => `## ${level}级新闻总结\n\n${summary}`)
    .join('\n\n---\n\n');
}

function formatPeriod(start: TimeInput, end: TimeInput): string {
  const startDate = toDateOrNull(start);
  const endDate = toDateOrNull(end);

  if (!startDate || !endDate) {
    return '';
  }

  const startDay = TimeZoneUtils.format(startDate, TIME_FORMATS.DATE);
  const endDay = TimeZoneUtils.format(endDate, TIME_FORMATS.DATE);
  const startText = TimeZoneUtils.format(startDate, TIME_FORMATS.NEWS_TIME);
  const endText = TimeZoneUtils.format(endDate, TIME_FORMATS.NEWS_TIME);

  if (startDay === endDay) {
    return `${startText}-${TimeZoneUtils.format(endDate, TIME_FORMATS.TIME_SHORT)}`;
  }

  return `${startText}-${endText}`;
}

function createEmptyResult(
  timeRangeDesc: string,
  start: TimeInput,
  end: TimeInput
): SummaryResult {
  return {
    success: true,
    message: `${timeRangeDesc} 时段没有新闻`,
    period: timeRangeDesc,
    timestamp: TimeZoneUtils.now(TIME_FORMATS.FULL),
    data: {
      empty: true,
      time_range: {
        start: toISOStringSafe(start),
        end: toISOStringSafe(end),
      },
    },
  };
}

function createSuccessResult(
  timeRangeDesc: string,
  start: TimeInput,
  end: TimeInput,
  newsData: any,
  summaryContent: string,
  stats: any
): SummaryResult {
  return {
    success: true,
    message: `新闻总结生成完成`,
    period: timeRangeDesc,
    timestamp: TimeZoneUtils.now(TIME_FORMATS.FULL),
    data: {
      news_count: newsData.news_count,
      high_level_count: getHighLevelCount(newsData),
      summary: summaryContent,
      time_range: {
        start: toISOStringSafe(start),
        end: toISOStringSafe(end),
      },
      enhanced_stats: stats,
    },
  };
}

function getSystemPrompt(): string {
  return `You are "宏观‑量化快讯引擎", an LLM that converts raw multilingual financial headlines
into an actionable Markdown briefing for global portfolio managers and economists.

############################################################
◆ 一、聚合与去重  
- 同主题多条 → 合并，保留最大冲击数字 & 最新时间，用 *(截至 HH:MM)*。  
- 删除无新增数据的纯重复。  

############################################################
◆ 二、着重与标记规则  
- **加粗**：所有数字、指数/品种、机构/公司/人名。  
- Emoji 方向：▲ 涨；▼ 跌；⏫ 创新高；⏬ 创新低。  
- 颜色：  
  • ⬆︎涨幅 / 利好 → <span style="color:#16a34a">…</span>  
  • ⬇︎跌幅 / 利空 → <span style="color:#dc2626">…</span>  
  (宏观中性或日期、时间无需上色)

############################################################
◆ 三、Markdown 输出模板  
### 新闻内容  
- **…** *(HH:MM)* [历史：…]  
- …  

############################################################
◆ 四、硬性排版规范  
* 列表符统一 - ；每条 ≤ 40 字，仅陈述事实。  
* 时间统一用 *斜体(HH:MM)*；跨日则 *YYYY‑MM‑DD HH:MM*。  
* **数字原样输出**（不转中文大写、不加千位分隔符）。  
* 若某条新闻含历史背景，则正文后紧跟  
  [历史：关键脉络 ≤ 30 字]；无历史信息时省略方括号。  
* 全文中文；除 Emoji、颜色签外不加其他装饰；禁止评论、预测或情绪化字眼。`;
}

async function generateAiSummary(newsContent: string): Promise<string> {
  console.log(`🎯 开始生成新闻总结...`);

  const systemPrompt = getSystemPrompt();
  const userPrompt = `新闻内容：\n\n${newsContent}`;
  const messages = buildPrompt(systemPrompt, userPrompt);

  const result = await aiService.callLLM(messages, { temperature: 0.7 });

  if (!result.success || !result.data) {
    throw new Error(result.error || 'AI生成的内容为空');
  }

  console.log(`✅ 总结生成完成`);
  return result.data;
}

async function fetchNewsEntities(newsId: string): Promise<any[]> {
  return await neo4jNewsService.getNewsEntities(newsId);
}

export async function fetchNews(
  start: TimeInput,
  end: TimeInput
): Promise<any> {
  console.log(`📅 获取 ${formatPeriod(start, end)} 时间范围内的新闻`);
  return await neo4jNewsService.getNewsInTimeRange(
    toISOStringSafe(start),
    toISOStringSafe(end)
  );
}

async function extractEntitiesFromNews(newsItems: any[]): Promise<any[]> {
  console.log(`🔍 开始获取 ${newsItems.length} 条新闻的实体信息...`);

  const tasks = newsItems.map((newsItem: any) => {
    return async () => {
      try {
        const entities = await fetchNewsEntities(newsItem.newsId);
        return entities.filter((e: any) => e.type !== 'Location');
      } catch (error) {
        console.error(`获取新闻 ${newsItem.newsId} 的实体信息失败:`, error);
        return [];
      }
    };
  });

  const results = await runTasks(
    '获取新闻实体信息',
    tasks,
    DEFAULT_CONCURRENCY.database
  );

  const allEntities = results
    .flatMap(result => result)
    .filter(
      (entity, index, self) =>
        index === self.findIndex(e => e.name === entity.name && e.type === entity.type)
    );

  console.log(`收集到 ${allEntities.length} 个去重后的有效实体(已过滤Location类型)`);
  return allEntities;
}

function getEntityTypeName(entityType?: string): string {
  const typeMapping: Record<string, string> = {
    Company: '公司',
    Person: '人物',
    Organization: '机构',
    Location: '地理位置',
    Unknown: '其他实体',
  };

  const normalizedType = entityType || 'Unknown';
  return typeMapping[normalizedType] || normalizedType;
}

async function summarizeHistoricalNewsByEntities(
  entityHistoricalNews: Record<string, any[]>,
  newsEntities: any[]
): Promise<Record<string, string>> {
  const entitySummaries: Record<string, string> = {};

  console.log(`开始总结 ${Object.keys(entityHistoricalNews).length} 个实体的历史新闻`);

  const tasks = Object.entries(entityHistoricalNews).map(([entityName, historicalNews]) => {
    return async () => {
      try {
        const entity = newsEntities.find((e: any) => e.name === entityName)!;
        const entityTypeName = getEntityTypeName(entity.type);

        console.log(
          `正在总结 ${entityName}(${entityTypeName}) 相关的 ${historicalNews.length} 条历史新闻`
        );

        const historicalContent = historicalNews
          .map(news => {
            const timeStr = TimeZoneUtils.formatBeijingTime(news.timestamp, 'MM-DD HH:mm');
            return `[${timeStr}] ${news.title}\n${news.content || ''}\n`;
          })
          .join('\n');

        const systemPrompt = `你是一个专业的金融新闻分析师。请对以下与${entityName}(${entityTypeName})相关的历史新闻进行简洁总结：

要求：
- 用中文回答
- 突出关键发展脉络和趋势变化
- 篇幅控制在50字以内
- 格式：关键动态描述，不需要提及实体名称
- 如果信息重复或不重要，可以总结为趋势性描述`;

        const userPrompt = `${entityName}相关历史新闻：\n\n${historicalContent}`;

        const result = await callSimpleAIText(systemPrompt, userPrompt, {
          temperature: 0.3,
        });

        if (result.success && result.data?.trim()) {
          return { entityName, summary: result.data.trim() };
        }

        console.warn(`${entityName} 历史新闻总结失败:`, result.error);
        return null;
      } catch (error: any) {
        console.error(`总结 ${entityName} 历史新闻失败:`, error);
        return null;
      }
    };
  });

  const results = await runTasks('实体历史新闻总结', tasks, DEFAULT_CONCURRENCY.ai);

  results.forEach(result => {
    if (result) {
      entitySummaries[result.entityName] = result.summary;
    }
  });

  console.log(`实体历史总结完成，成功生成 ${Object.keys(entitySummaries).length} 个实体的总结`);
  return entitySummaries;
}

async function getHistoricalNewsForEntities(
  entities: any[],
  startTime: TimeInput
): Promise<any[]> {
  if (entities.length === 0) {
    console.log('没有实体，跳过历史新闻查询');
    return [];
  }

  console.log(`📚 开始查询 ${entities.length} 个实体的历史新闻...`);
  const startDate = toDate(startTime);
  const oneMonthAgo = new Date(startDate.getTime());
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  const allHistoricalNews = await neo4jNewsService.getHistoricalNewsByEntities(
    entities,
    oneMonthAgo.toISOString(),
    startDate.toISOString()
  );

  console.log(`查询完成，共获得 ${allHistoricalNews.length} 条历史新闻`);
  return allHistoricalNews;
}

async function generateEntitySummaries(
  entities: any[],
  allHistoricalNews: any[]
): Promise<Record<string, string>> {
  if (entities.length === 0 || allHistoricalNews.length === 0) {
    console.log('没有实体或历史新闻，跳过实体总结生成');
    return {};
  }

  console.log(`🤖 开始为 ${entities.length} 个实体生成历史新闻总结...`);

  const entityHistoricalNews: Record<string, any[]> = {};
  entities.forEach((entity: any) => {
    const entityName = entity.name;
    const relatedNews = allHistoricalNews.filter(
      (news: any) => news.relatedEntity === entityName
    );

    if (relatedNews.length > 0) {
      entityHistoricalNews[entityName] = relatedNews
        .sort(
          (a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )
        .slice(0, 50);
    }
  });

  return await summarizeHistoricalNewsByEntities(entityHistoricalNews, entities);
}

async function enrichNewsWithHistoricalContext(
  newsItems: any[],
  entitySummaries: Record<string, string>
): Promise<Record<string, string>> {
  console.log(`📝 开始为 ${newsItems.length} 条新闻关联历史新闻（按level分组）...`);

  const groupedNews = groupByLevel(newsItems);
  const levelContents: Record<string, string> = {};

  const levelTasks = Object.entries(groupedNews).map(([level, news]) => {
    return async () => {
      console.log(`📝 处理 ${level}级新闻，共 ${news.length} 条`);

      const newsTasks = news.map((item: any) => {
        return async () => {
          const newsEntities = await fetchNewsEntities(item.newsId)
            .then(entities => entities.filter((e: any) => e.type !== 'Location'))
            .catch(() => []);

          let newsText = formatPromptFields(
            [
              ['标题', item.title],
              ['内容', item.content],
              ['时间', TimeZoneUtils.formatBeijingTime(new Date(item.time * 1000), TIME_FORMATS.FULL)],
            ],
            { separator: '\n' }
          );

          if (newsEntities.length > 0) {
            const entityList = newsEntities.map((e: any) => `${e.name}(${e.type})`).join('、');
            newsText += `\n关联实体：${entityList}`;

            const relatedSummaries = newsEntities
              .map((entity: any) => entitySummaries[entity.name])
              .filter(Boolean);

            if (relatedSummaries.length > 0) {
              const historicalSummary = newsEntities
                .filter((entity: any) => entitySummaries[entity.name])
                .map((entity: any) => `${entity.name}: ${entitySummaries[entity.name]}`)
                .join('；');
              newsText += `\n[历史：${historicalSummary}]`;
            }
          }

          return newsText + '\n';
        };
      });

      const newsResults = await runTasks(
        `${level}级新闻关联`,
        newsTasks,
        DEFAULT_CONCURRENCY.database
      );
      const levelContent = newsResults.join('\n');

      return { level, content: `【${level}级新闻】\n${levelContent}` };
    };
  });

  const results = await runTasks('level新闻关联', levelTasks, DEFAULT_CONCURRENCY.database);

  results.forEach(({ level, content }) => {
    levelContents[level] = content;
  });

  console.log(`📝 新闻关联完成，生成了 ${Object.keys(levelContents).length} 个level的内容`);
  return levelContents;
}

async function generateLevelSummaries(levelContents: Record<string, string>): Promise<string> {
  console.log(`🎯 开始并发生成新闻总结，共 ${Object.keys(levelContents).length} 个level...`);

  const levelEntries = Object.entries(levelContents);
  levelEntries.sort(([a], [b]) => parseLevelNumber(a) - parseLevelNumber(b));

  const tasks = levelEntries.map(([level, content]) => {
    return async () => {
      try {
        console.log(`🎯 正在为 ${level}级新闻生成总结...`);
        const levelSummary = await generateAiSummary(content);
        console.log(`✅ ${level}级新闻总结生成完成`);
        return { level, summary: levelSummary, success: true };
      } catch (error: any) {
        console.error(`❌ ${level}级新闻总结生成失败:`, error);
        return {
          level,
          summary: `${level}级新闻总结生成失败：${error.message}`,
          success: false,
        };
      }
    };
  });

  const results = await runTasks('level总结生成', tasks, DEFAULT_CONCURRENCY.ai);

  const levelSummaries: Record<string, string> = {};
  let successCount = 0;
  let failureCount = 0;

  results.forEach(result => {
    if (result) {
      levelSummaries[result.level] = result.summary;
      if (result.success) {
        successCount++;
      } else {
        failureCount++;
      }
    }
  });

  console.log(`🎯 并发生成完成: 成功 ${successCount} 个, 失败 ${failureCount} 个`);
  const finalSummary = mergeLevelSummaries(levelSummaries);
  console.log(`✅ 所有level总结生成完成并合并`);

  return finalSummary;
}

async function calculateStats(
  newsData: any,
  allEntities: any[],
  allHistoricalNews: any[],
  entitySummaries: Record<string, string>
): Promise<any> {
  console.log(`📊 计算统计信息...`);

  const newsWithEntities = await Promise.all(
    newsData.news_items.map(async (item: any) => {
      try {
        const entities = await fetchNewsEntities(item.newsId);
        return entities.filter((e: any) => e.type !== 'Location').length > 0;
      } catch {
        return false;
      }
    })
  );

  const newsWithHistoricalContext = await Promise.all(
    newsData.news_items.map(async (item: any) => {
      try {
        const entities = await fetchNewsEntities(item.newsId);
        const filteredEntities = entities.filter((e: any) => e.type !== 'Location');
        return filteredEntities.some((entity: any) => entitySummaries[entity.name]);
      } catch {
        return false;
      }
    })
  );

  const stats = {
    total_entities_found: allEntities.length,
    total_historical_news: allHistoricalNews.length,
    news_with_entities: newsWithEntities.filter(Boolean).length,
    news_with_historical_context: newsWithHistoricalContext.filter(Boolean).length,
    unique_entities_processed: allEntities.length,
  };

  console.log(
    `📊 统计完成: ${stats.total_entities_found}个实体, ${stats.total_historical_news}条历史新闻, ${stats.news_with_entities}条新闻有实体, ${stats.news_with_historical_context}条新闻有历史新闻`
  );

  return stats;
}

export async function notify(
  sendNotification: boolean,
  summaryContent: string,
  start: TimeInput,
  end: TimeInput,
  newsData: any
): Promise<void> {
  if (!sendNotification) return;

  try {
    const highLevelNews =
      newsData.news_items?.filter((item: any) => item.level === EventLevel.LEVEL_1) || [];

    await notificationService.sendNormalSummaryNotification(
      { summary: summaryContent },
      toISOStringSafe(start),
      toISOStringSafe(end),
      highLevelNews
    );
  } catch (error) {
    console.error('发送通知失败:', error);
  }
}

function getHighLevelCount(newsData: any): number {
  return newsData.news_items?.filter((item: any) => item.level === EventLevel.LEVEL_1).length || 0;
}

export const summaryHandlers = {
  fetchNews,
  extractEntitiesFromNews,
  getHistoricalNewsForEntities,
  generateEntitySummaries,
  enrichNewsWithHistoricalContext,
  generateLevelSummaries,
  calculateStats,
  notify,
};

export async function generateSummary(
  startTime: TimeInput,
  endTime: TimeInput,
  sendNotification: boolean = false
): Promise<SummaryResult> {
  try {
    const start = toDate(startTime);
    const end = toDate(endTime);

    if (start.getTime() > end.getTime()) {
      throw new Error('开始时间不能晚于结束时间');
    }

    const timeRangeDesc = formatPeriod(start, end);
    console.log(`开始生成新闻总结: ${timeRangeDesc}`);
    console.log(`🚀 启用实体增强功能: 图谱关联分析 + 历史新闻`);

    const newsData = await summaryHandlers.fetchNews(start, end);
    if (newsData.news_count === 0) {
      return createEmptyResult(timeRangeDesc, start, end);
    }

    const allEntities = await summaryHandlers.extractEntitiesFromNews(newsData.news_items);
    const allHistoricalNews = await summaryHandlers.getHistoricalNewsForEntities(
      allEntities,
      start
    );
    const entitySummaries = await summaryHandlers.generateEntitySummaries(
      allEntities,
      allHistoricalNews
    );
    const levelContents = await summaryHandlers.enrichNewsWithHistoricalContext(
      newsData.news_items,
      entitySummaries
    );
    const finalSummary = await summaryHandlers.generateLevelSummaries(levelContents);
    const stats = await summaryHandlers.calculateStats(
      newsData,
      allEntities,
      allHistoricalNews,
      entitySummaries
    );

    await summaryHandlers.notify(sendNotification, finalSummary, start, end, newsData);

    return createSuccessResult(timeRangeDesc, start, end, newsData, finalSummary, stats);
  } catch (error: any) {
    console.error('生成总结失败:', error);
    const timeRangeDesc = formatPeriod(startTime, endTime);
    return {
      success: false,
      message: `生成新闻总结失败`,
      period: timeRangeDesc,
      error: error.message,
      timestamp: TimeZoneUtils.now(TIME_FORMATS.FULL),
    };
  }
}

export const summaryService = {
  generateSummary,
};

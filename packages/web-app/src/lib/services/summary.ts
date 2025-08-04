import moment from 'moment-timezone';
import { TimeZoneUtils } from '../utils/timezone';
import { queryService } from './query';
import { notificationService } from './notification';
import { neo4jNewsService } from '../neo4j';
import { SummaryResult } from '../../types/scheduler';
import { aiService, createMessages, callSimpleAIText } from '../utils/llm';
import { EventLevel } from '../../../constants/enums';

/**
 * 平滑启动配置 - 用于降低峰值QPS
 */
interface SmoothStartConfig {
  // AI调用配置
  ai: {
    batchSize: number;    // 每批启动任务数量
    batchInterval: number; // 批次启动间隔（毫秒）
  };
  // 数据库查询配置
  database: {
    batchSize: number;    // 每批启动任务数量
    batchInterval: number; // 批次启动间隔（毫秒）
  };
}

/**
 * 总结服务
 * 提供通用的时间区间新闻总结功能（不落库）
 * 增强功能：基于图谱实体的历史新闻关联分析
 */
class SummaryService {
  private newsService = neo4jNewsService;

  // 平滑启动配置
  private smoothStartConfig: SmoothStartConfig = {
    ai: {
      batchSize: 10,       // AI调用每批启动10个任务
      batchInterval: 100,  // 每100ms启动一批，QPS=100
    },
    database: {
      batchSize: 20,       // 数据库查询每批启动20个任务
      batchInterval: 100,  // 每100ms启动一批，QPS=200
    },
  };

  /**
   * 更新平滑启动配置
   * @param config 新的平滑启动配置
   * 
   * 使用示例：
   * // 降低AI调用QPS到50：每100ms启动5个任务
   * summaryService.updateSmoothStartConfig({
   *   ai: { batchSize: 5, batchInterval: 100 }
   * });
   * 
   * // 设置QPS=80：每125ms启动10个任务 (10 * 1000 / 125 = 80)
   * summaryService.updateSmoothStartConfig({
   *   ai: { batchSize: 10, batchInterval: 125 }
   * });
   */
  updateSmoothStartConfig(config: Partial<SmoothStartConfig>): void {
    if (config.ai) {
      this.smoothStartConfig.ai = { ...this.smoothStartConfig.ai, ...config.ai };
    }
    if (config.database) {
      this.smoothStartConfig.database = { ...this.smoothStartConfig.database, ...config.database };
    }
    
    // 显示更新后的QPS信息
    const aiQPS = (this.smoothStartConfig.ai.batchSize * 1000) / this.smoothStartConfig.ai.batchInterval;
    const dbQPS = (this.smoothStartConfig.database.batchSize * 1000) / this.smoothStartConfig.database.batchInterval;
    
    console.log('🔧 平滑启动配置已更新:', this.smoothStartConfig);
    console.log(`📊 QPS设置 - AI: ${aiQPS.toFixed(1)}, 数据库: ${dbQPS.toFixed(1)}`);
  }

  /**
   * 获取当前平滑启动配置
   */
  getSmoothStartConfig(): SmoothStartConfig {
    return { ...this.smoothStartConfig };
  }

  /**
   * 生成新闻总结
   * @param startTime 开始时间（ISO字符串或moment对象）
   * @param endTime 结束时间（ISO字符串或moment对象）
   * @param sendNotification 是否发送通知，默认为false
   */
  async generateSummary(
    startTime: string | moment.Moment,
    endTime: string | moment.Moment,
    sendNotification: boolean = false
  ): Promise<SummaryResult> {
    try {
      // 转换时间格式
      const start = moment(startTime);
      const end = moment(endTime);

      if (!start.isValid() || !end.isValid()) {
        throw new Error('无效的时间格式');
      }

      if (start.isAfter(end)) {
        throw new Error('开始时间不能晚于结束时间');
      }

      const timeRangeDesc = this.formatPeriod(start, end);
      console.log(`开始生成新闻总结: ${timeRangeDesc}`);
      console.log(`🚀 启用实体增强功能: 图谱关联分析 + 历史新闻`);

      // 1. 获取指定时间的新闻
      const newsData = await this.getNewsInTimeRange(start, end);
      if (newsData.news_count === 0) {
        return this.createEmptyResult(timeRangeDesc, start, end);
      }

      // 2. 获取新闻对应的实体，并聚合去重
      const allEntities = await this.extractEntitiesFromNews(newsData.news_items);

      console.log('找到有效实体，使用增强模式生成总结');
      // 增强模式：构建包含历史的新闻内容

      // 3. 查询出每个实体对应的历史新闻
      const allHistoricalNews = await this.getHistoricalNewsForEntities(allEntities, start);

      // 4. 对每个实体对应的历史新闻进行总结
      const entitySummaries = await this.generateEntitySummaries(allEntities, allHistoricalNews);

      // 5. 对指定时间的新闻，按照实体关联历史新闻总结（按level分组）
      const levelContents = await this.enrichNewsWithHistoricalContext(
        newsData.news_items,
        allEntities,
        entitySummaries
      );

      // 6. 按level分批生成总结
      const finalSummary = await this.generateLevelSummaries(levelContents);

      // 7. 统计和通知
      const stats = await this.calculateStats(
        newsData,
        allEntities,
        allHistoricalNews,
        entitySummaries
      );
      await this.handleNotification(sendNotification, finalSummary, start, end, newsData);

      return this.createSuccessResult(timeRangeDesc, start, end, newsData, finalSummary, stats);
    } catch (error: any) {
      console.error('生成总结失败:', error);
      const timeRangeDesc = this.formatPeriod(moment(startTime), moment(endTime));
      return {
        success: false,
        message: `生成新闻总结失败`,
        period: timeRangeDesc,
        error: error.message,
        timestamp: moment().tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm:ss'),
      };
    }
  }

  /**
   * 1. 获取指定时间的新闻
   */
  private async getNewsInTimeRange(start: moment.Moment, end: moment.Moment): Promise<any> {
    console.log(`📅 获取 ${this.formatPeriod(start, end)} 时间范围内的新闻`);
    return await queryService.getHourlySummary(start.toISOString(), end.toISOString());
  }

  /**
   * 创建空结果响应
   */
  private createEmptyResult(
    timeRangeDesc: string,
    start: moment.Moment,
    end: moment.Moment
  ): SummaryResult {
    return {
      success: true,
      message: `${timeRangeDesc} 时段没有新闻`,
      period: timeRangeDesc,
      timestamp: moment().tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm:ss'),
      data: {
        empty: true,
        time_range: {
          start: start.toISOString(),
          end: end.toISOString(),
        },
      },
    };
  }

  /**
   * 2. 从新闻中提取并去重实体
   */
  private async extractEntitiesFromNews(newsItems: any[]): Promise<any[]> {
    console.log(`🔍 开始获取 ${newsItems.length} 条新闻的实体信息...`);

    // 创建任务数组
    const tasks = newsItems.map((newsItem: any) => {
      return async () => {
        try {
          const entities = await this.getNewsEntities(newsItem.newsId);
          // 过滤掉 Location 类型的实体（区域类型）
          return entities.filter((e: any) => e.type !== 'Location');
        } catch (error) {
          console.error(`获取新闻 ${newsItem.newsId} 的实体信息失败:`, error);
          return [];
        }
      };
    });

    // 使用平滑启动控制任务
    console.log(`🔍 使用平滑启动获取新闻实体信息`);
    const results = await this.executeSmoothStart(
      tasks, 
      this.smoothStartConfig.database.batchSize, 
      this.smoothStartConfig.database.batchInterval
    );

    // 收集所有实体并去重
    const allEntities = results
      .flatMap(result => result)
      .filter(
        (entity, index, self) =>
          // 去重：根据实体名称和类型去重
          index === self.findIndex(e => e.name === entity.name && e.type === entity.type)
      );

    console.log(`收集到 ${allEntities.length} 个去重后的有效实体(已过滤Location类型)`);
    return allEntities;
  }

  /**
   * 获取新闻的所有关联实体
   */
  private async getNewsEntities(newsId: string): Promise<any[]> {
    return await this.newsService.getNewsEntities(newsId);
  }

  /**
   * 按实体分组对历史新闻进行总结
   */
  /**
   * 平滑启动任务 - 降低峰值QPS（不等待任务完成）
   * @param tasks 任务数组
   * @param batchSize 每批启动的任务数量，默认10
   * @param batchInterval 批次启动间隔（毫秒），默认100ms
   * @returns Promise数组结果
   */
  private async executeSmoothStart<T>(
    tasks: (() => Promise<T>)[],
    batchSize: number = 10,
    batchInterval: number = 100
  ): Promise<T[]> {
    const results: T[] = [];
    const allPromises: Promise<T | null>[] = [];
    
    const totalBatches = Math.ceil(tasks.length / batchSize);
    const estimatedQPS = (batchSize * 1000) / batchInterval;
    
    console.log(`🚀 开始平滑启动 ${tasks.length} 个任务`);
    console.log(`📊 配置: 每批 ${batchSize} 个，间隔 ${batchInterval}ms，预估QPS: ${estimatedQPS.toFixed(1)}`);
    console.log(`⏱️ 预计启动完成时间: ${(totalBatches * batchInterval / 1000).toFixed(1)} 秒`);
    
    // 分批启动任务，不等待完成
    for (let i = 0; i < tasks.length; i += batchSize) {
      const batch = tasks.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      
      console.log(`🚀 启动第 ${batchNum}/${totalBatches} 批 ${batch.length} 个任务`);
      
      // 启动当前批次的所有任务，但不等待完成
      const batchPromises = batch.map(async (task, index) => {
        try {
          const result = await task();
          return result;
        } catch (error) {
          console.error(`❌ 批次 ${batchNum} 任务 ${index + 1} 失败:`, error);
          return null;
        }
      });
      
      // 将当前批次的Promise添加到总列表
      allPromises.push(...batchPromises);
      
      // 如果不是最后一批，等待间隔后继续启动下一批
      if (i + batchSize < tasks.length) {
        await new Promise(resolve => setTimeout(resolve, batchInterval));
      }
    }
    
    console.log(`🎯 所有任务已启动，等待执行完成...`);
    
    // 等待所有任务完成
    const allResults = await Promise.allSettled(allPromises);
    
    // 收集结果
    allResults.forEach(result => {
      if (result.status === 'fulfilled' && result.value !== null) {
        results.push(result.value);
      }
    });
    
    console.log(`✅ 所有任务执行完成，成功 ${results.length}/${tasks.length} 个`);
    return results;
  }

  private async summarizeHistoricalNewsByEntities(
    entityHistoricalNews: Record<string, any[]>,
    newsEntities: any[]
  ): Promise<Record<string, string>> {
    const entitySummaries: Record<string, string> = {};

    console.log(`开始总结 ${Object.keys(entityHistoricalNews).length} 个实体的历史新闻，使用平滑启动模式`);

    // 创建任务数组
    const tasks = Object.entries(entityHistoricalNews).map(([entityName, historicalNews]) => {
      return async () => {
        try {
          const entity = newsEntities.find((e: any) => e.name === entityName);
          const entityType = entity?.type || 'Unknown';
          const entityTypeName = this.getEntityTypeName(entityType);

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
          } else {
            console.warn(`${entityName} 历史新闻总结失败:`, result.error);
            return null;
          }
        } catch (error: any) {
          console.error(`总结 ${entityName} 历史新闻失败:`, error);
          return null;
        }
      };
    });

    // 使用平滑启动控制AI任务，降低QPS峰值
    const results = await this.executeSmoothStart(
      tasks, 
      this.smoothStartConfig.ai.batchSize, 
      this.smoothStartConfig.ai.batchInterval
    );

    // 收集成功的总结结果
    results.forEach(result => {
      if (result) {
        entitySummaries[result.entityName] = result.summary;
      }
    });

    console.log(`实体历史总结完成，成功生成 ${Object.keys(entitySummaries).length} 个实体的总结`);
    return entitySummaries;
  }

  /**
   * 获取实体类型的中文名称
   */
  private getEntityTypeName(entityType: string): string {
    const typeMapping: Record<string, string> = {
      Company: '公司',
      Person: '人物',
      Organization: '机构',
      Location: '地理位置', // 虽然已过滤，但保留映射
      Unknown: '其他实体',
    };

    return typeMapping[entityType] || entityType;
  }

  /**
   * 3. 查询实体对应的历史新闻
   */
  private async getHistoricalNewsForEntities(
    entities: any[],
    startTime: moment.Moment
  ): Promise<any[]> {
    if (entities.length === 0) {
      console.log('没有实体，跳过历史新闻查询');
      return [];
    }

    console.log(`📚 开始查询 ${entities.length} 个实体的历史新闻...`);
    // 计算 startTime 之前一个月的时间范围
    const oneMonthAgo = moment(startTime).subtract(1, 'month');

    const allHistoricalNews = await this.newsService.getHistoricalNewsByEntities(
      entities,
      oneMonthAgo.toISOString(),
      startTime.toISOString()
    );

    console.log(`查询完成，共获得 ${allHistoricalNews.length} 条历史新闻`);
    return allHistoricalNews;
  }

  /**
   * 4. 对每个实体的历史新闻进行总结
   */
  private async generateEntitySummaries(
    entities: any[],
    allHistoricalNews: any[]
  ): Promise<Record<string, string>> {
    if (entities.length === 0 || allHistoricalNews.length === 0) {
      console.log('没有实体或历史新闻，跳过实体总结生成');
      return {};
    }

    console.log(`🤖 开始为 ${entities.length} 个实体生成历史新闻总结...`);

    // 按实体分组历史新闻
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

    // 为每个实体生成总结
    const entitySummaries = await this.summarizeHistoricalNewsByEntities(
      entityHistoricalNews,
      entities
    );

    console.log(`实体总结完成，成功生成 ${Object.keys(entitySummaries).length} 个实体的历史新闻`);
    return entitySummaries;
  }

  /**
   * 5. 为新闻关联历史新闻（按level分组返回）
   */
  private async enrichNewsWithHistoricalContext(
    newsItems: any[],
    allEntities: any[],
    entitySummaries: Record<string, string>
  ): Promise<Record<string, string>> {
    console.log(`📝 开始为 ${newsItems.length} 条新闻关联历史新闻（按level分组）...`);

    const groupedNews = this.groupNewsByLevel(newsItems);
    const levelContents: Record<string, string> = {};

    // 创建level处理任务
    const levelTasks = Object.entries(groupedNews).map(([level, news]) => {
      return async () => {
        console.log(`📝 处理 ${level}级新闻，共 ${news.length} 条`);

        // 创建新闻处理任务
        const newsTasks = news.map((item: any) => {
          return async () => {
            // 获取该新闻的实体
            const newsEntities = await this.getNewsEntities(item.newsId)
              .then(entities => entities.filter((e: any) => e.type !== 'Location'))
              .catch(() => []);

            let newsText = `标题：${item.title}\n内容：${item.content}\n时间：${moment(item.time * 1000)
              .tz('Asia/Shanghai')
              .format('YYYY-MM-DD HH:mm:ss')}`;

            if (newsEntities.length > 0) {
              const entityList = newsEntities.map((e: any) => `${e.name}(${e.type})`).join('、');
              newsText += `\n关联实体：${entityList}`;

              // 获取相关的历史新闻
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

         // 使用平滑启动处理新闻
         const newsResults = await this.executeSmoothStart(
           newsTasks, 
           this.smoothStartConfig.database.batchSize, 
           this.smoothStartConfig.database.batchInterval
         );
        const levelContent = newsResults.join('\n');
        
        return { level, content: `【${level}级新闻】\n${levelContent}` };
      };
    });

    // 使用平滑启动处理level
    console.log(`📝 使用平滑启动处理level`);
    const results = await this.executeSmoothStart(
      levelTasks, 
      this.smoothStartConfig.database.batchSize, 
      this.smoothStartConfig.database.batchInterval
    );

    // 转换为Record格式
    results.forEach(({ level, content }) => {
      levelContents[level] = content;
    });

    console.log(`📝 新闻关联完成，生成了 ${Object.keys(levelContents).length} 个level的内容`);
    return levelContents;
  }

  /**
   * 6. 按level分批生成总结（并发调用）
   */
  private async generateLevelSummaries(levelContents: Record<string, string>): Promise<string> {
    console.log(`🎯 开始并发生成新闻总结，共 ${Object.keys(levelContents).length} 个level...`);

    const levelEntries = Object.entries(levelContents);

    // 按level顺序排序（数字越小优先级越高）
    levelEntries.sort(([a], [b]) => {
      const levelA = this.parseLevelNumber(a);
      const levelB = this.parseLevelNumber(b);
      return levelA - levelB;
    });

    // 创建任务数组，使用并发控制
    const tasks = levelEntries.map(([level, content]) => {
      return async () => {
        try {
          console.log(`🎯 正在为 ${level}级新闻生成总结...`);
          const levelSummary = await this.generateAISummary(content);
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

    // 使用平滑启动生成level总结
    console.log(`🎯 使用平滑启动生成level总结`);
    const results = await this.executeSmoothStart(
      tasks, 
      this.smoothStartConfig.ai.batchSize, 
      this.smoothStartConfig.ai.batchInterval
    );

    // 收集成功和失败的结果
    const levelSummaries: Record<string, string> = {};
    let successCount = 0;
    let failureCount = 0;

    results.forEach((result) => {
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

    // 合并所有level的总结
    const finalSummary = this.mergeLevelSummaries(levelSummaries);
    console.log(`✅ 所有level总结生成完成并合并`);

    return finalSummary;
  }

  /**
   * 解析level编号
   */
  private parseLevelNumber(level: string): number {
    // 提取数字，如果没有数字则返回999（放在最后）
    const match = level.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 999;
  }

  /**
   * 合并多个level的总结
   */
  private mergeLevelSummaries(levelSummaries: Record<string, string>): string {
    console.log(`🔗 合并 ${Object.keys(levelSummaries).length} 个level的总结...`);

    const levelEntries = Object.entries(levelSummaries);

    // 按level顺序排序
    levelEntries.sort(([a], [b]) => {
      const levelA = this.parseLevelNumber(a);
      const levelB = this.parseLevelNumber(b);
      return levelA - levelB;
    });

    // 合并总结，保持各level的独立性
    const mergedSummary = levelEntries
      .map(([level, summary]) => {
        // 为每个level添加标题分隔
        return `## ${level}级新闻总结\n\n${summary}`;
      })
      .join('\n\n---\n\n');

    return mergedSummary;
  }

  /**
   * 7. 单个内容的AI总结生成方法
   */
  private async generateAISummary(newsContent: string): Promise<string> {
    console.log(`🎯 开始生成新闻总结...`);

    const systemPrompt = this.getSystemPrompt();
    const userPrompt = `新闻内容：\n\n${newsContent}`;
    const messages = createMessages(systemPrompt, userPrompt);

    const result = await aiService.callLLM(messages, { temperature: 0.7 });

    if (!result.success || !result.data) {
      throw new Error(result.error || 'AI生成的内容为空');
    }

    console.log(`✅ 总结生成完成`);
    return result.data;
  }

  /**
   * 8. 计算统计信息
   */
  private async calculateStats(
    newsData: any,
    allEntities: any[],
    allHistoricalNews: any[],
    entitySummaries: Record<string, string>
  ): Promise<any> {
    console.log(`📊 计算统计信息...`);

    const newsWithEntities = await Promise.all(
      newsData.news_items.map(async (item: any) => {
        try {
          const entities = await this.getNewsEntities(item.newsId);
          return entities.filter((e: any) => e.type !== 'Location').length > 0;
        } catch {
          return false;
        }
      })
    );

    const newsWithHistoricalContext = await Promise.all(
      newsData.news_items.map(async (item: any) => {
        try {
          const entities = await this.getNewsEntities(item.newsId);
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

  /**
   * 9. 处理通知发送
   */
  private async handleNotification(
    sendNotification: boolean,
    summaryContent: string,
    start: moment.Moment,
    end: moment.Moment,
    newsData: any
  ): Promise<void> {
    if (sendNotification) {
      await this.sendNotification(summaryContent, start, end, newsData);
    }
  }

  /**
   * 10. 创建成功结果
   */
  private createSuccessResult(
    timeRangeDesc: string,
    start: moment.Moment,
    end: moment.Moment,
    newsData: any,
    summaryContent: string,
    stats: any
  ): SummaryResult {
    return {
      success: true,
      message: `新闻总结生成完成`,
      period: timeRangeDesc,
      timestamp: moment().tz('Asia/Shanghai').format('YYYY-MM-DD HH:mm:ss'),
      data: {
        news_count: newsData.news_count,
        high_level_count: this.getHighLevelCount(newsData),
        summary: summaryContent,
        time_range: {
          start: start.toISOString(),
          end: end.toISOString(),
        },
        enhanced_stats: stats,
      },
    };
  }

  /**
   * 获取统一的系统提示词（无二级分类，简化为新闻总结和历史背景）
   */
  private getSystemPrompt(): string {
    const prompt = `You are "宏观‑量化快讯引擎", an LLM that converts raw multilingual financial headlines
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

    return prompt;
  }

  /**
   * 按级别分组新闻
   */
  private groupNewsByLevel(newsItems: any[]): Record<string, any[]> {
    const grouped: Record<string, any[]> = {};

    newsItems.forEach(item => {
      const level = item.level || 'Unknown';
      if (!grouped[level]) {
        grouped[level] = [];
      }

      // 转换时间戳格式
      const timeValue =
        typeof item.timestamp === 'number' ? item.timestamp : moment(item.timestamp).unix();

      grouped[level].push({
        newsId: item.newsId,
        title: item.title,
        content: item.content || '',
        time: timeValue,
      });
    });

    return grouped;
  }

  /**
   * 发送通知
   */
  private async sendNotification(
    summaryData: string,
    start: moment.Moment,
    end: moment.Moment,
    newsData: any
  ): Promise<void> {
    try {
      // 检查是否有高级别新闻（仅 Level 1）
      const highLevelNews =
        newsData.news_items?.filter((item: any) => item.level === EventLevel.LEVEL_1) || [];

      // 有高级别新闻时发送通知
      await notificationService.sendNormalSummaryNotification(
        { summary: summaryData },
        start.toISOString(),
        end.toISOString(),
        highLevelNews
      );
    } catch (error) {
      console.error('发送通知失败:', error);
      // 通知失败不影响总结生成，只记录错误
    }
  }

  /**
   * 获取高级别新闻数量
   */
  private getHighLevelCount(newsData: any): number {
    return (
      newsData.news_items?.filter((item: any) => item.level === EventLevel.LEVEL_1).length || 0
    );
  }

  /**
   * 格式化时间段 - 显示北京时间
   */
  private formatPeriod(start: moment.Moment, end: moment.Moment): string {
    // 转换为北京时间显示
    const beijingStart = start.clone().tz('Asia/Shanghai');
    const beijingEnd = end.clone().tz('Asia/Shanghai');

    if (beijingStart.isSame(beijingEnd, 'day')) {
      return `${beijingStart.format('MM-DD HH:mm')}-${beijingEnd.format('HH:mm')}`;
    } else {
      return `${beijingStart.format('MM-DD HH:mm')}-${beijingEnd.format('MM-DD HH:mm')}`;
    }
  }
}

export const summaryService = new SummaryService();
export { SummaryService };


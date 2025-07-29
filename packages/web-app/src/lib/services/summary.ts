import moment from 'moment-timezone';
import { TimeZoneUtils } from '../utils/timezone';
import { queryService } from './query';
import { notificationService } from './notification';
import { neo4jNewsService } from '../neo4j';
import { SummaryResult } from '../../types/scheduler';
import { aiService, createMessages, callSimpleAIText } from '../utils/llm';
import { EventLevel } from '../../../constants/enums';

/**
 * 总结服务
 * 提供通用的时间区间新闻总结功能（不落库）
 * 增强功能：基于图谱实体的历史新闻关联分析
 */
class SummaryService {
  private newsService = neo4jNewsService;

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

      let newsContent: string;
      let enhanced = false;
      let entitySummaries: Record<string, string> = {};
      let allHistoricalNews: any[] = [];

      if (allEntities.length === 0) {
        console.log('没有找到有效实体，使用基础模式生成总结');
        // 基础模式：只构建基础新闻内容
        newsContent = this.buildBasicNewsContent(newsData.news_items);
        enhanced = false;
      } else {
        console.log('找到有效实体，使用增强模式生成总结');
        // 增强模式：构建包含历史的新闻内容

        // 3. 查询出每个实体对应的历史新闻
        allHistoricalNews = await this.getHistoricalNewsForEntities(allEntities, start);

        // 4. 对每个实体对应的历史新闻进行总结
        entitySummaries = await this.generateEntitySummaries(allEntities, allHistoricalNews);

        // 5. 对指定时间的新闻，按照实体关联历史新闻总结
        newsContent = await this.enrichNewsWithHistoricalContext(
          newsData.news_items,
          allEntities,
          entitySummaries
        );
        enhanced = true;
      }

      // 6. 统一生成总结
      const finalSummary = await this.generateAISummary(newsContent, enhanced);

      // 统计和通知
      const stats = await this.calculateStats(
        newsData,
        allEntities,
        allHistoricalNews,
        entitySummaries
      );
      await this.handleNotification(sendNotification, finalSummary, start, end, newsData);

      return this.createSuccessResult(
        timeRangeDesc,
        start,
        end,
        newsData,
        finalSummary,
        stats,
        enhanced
      );
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

    const newsWithEntities = await Promise.allSettled(
      newsItems.map(async (newsItem: any) => {
        try {
          const entities = await this.getNewsEntities(newsItem.newsId);
          // 过滤掉 Location 类型的实体（区域类型）
          return entities.filter((e: any) => e.type !== 'Location');
        } catch (error) {
          console.error(`获取新闻 ${newsItem.newsId} 的实体信息失败:`, error);
          return [];
        }
      })
    );

    // 收集所有实体并去重
    const allEntities = newsWithEntities
      .filter(result => result.status === 'fulfilled')
      .flatMap(result => result.value)
      .filter(
        (entity, index, self) =>
          // 去重：根据实体名称和类型去重
          index === self.findIndex(e => e.name === entity.name && e.type === entity.type)
      );

    console.log(`收集到 ${allEntities.length} 个去重后的有效实体(已过滤Location类型)`);
    return allEntities;
  }

  /**
   * 构建基础新闻内容（无实体增强）
   */
  private buildBasicNewsContent(newsItems: any[]): string {
    const groupedNews = this.groupNewsByLevel(newsItems);
    return Object.entries(groupedNews)
      .map(([level, news]) => {
        const levelContent = news
          .map(item => {
            return `标题：${item.title}\n内容：${item.content}\n时间：${moment(item.time * 1000)
              .tz('Asia/Shanghai')
              .format('YYYY-MM-DD HH:mm:ss')}\n`;
          })
          .join('\n');
        return `【${level}级新闻】\n${levelContent}`;
      })
      .join('\n\n');
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
  private async summarizeHistoricalNewsByEntities(
    entityHistoricalNews: Record<string, any[]>,
    newsEntities: any[]
  ): Promise<Record<string, string>> {
    const entitySummaries: Record<string, string> = {};

    // 为每个实体并行生成总结
    const summaryPromises = Object.entries(entityHistoricalNews).map(
      async ([entityName, historicalNews]) => {
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
      }
    );

    const results = await Promise.allSettled(summaryPromises);

    // 收集成功的总结结果
    results.forEach(result => {
      if (result.status === 'fulfilled' && result.value) {
        entitySummaries[result.value.entityName] = result.value.summary;
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
   * 5. 为新闻关联历史新闻
   */
  private async enrichNewsWithHistoricalContext(
    newsItems: any[],
    allEntities: any[],
    entitySummaries: Record<string, string>
  ): Promise<string> {
    console.log(`📝 开始为 ${newsItems.length} 条新闻关联历史新闻...`);

    const groupedNews = this.groupNewsByLevel(newsItems);

    const newsContentPromises = Object.entries(groupedNews).map(async ([level, news]) => {
      const levelContentPromises = news.map(async (item: any) => {
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
      });

      const levelContent = (await Promise.all(levelContentPromises)).join('\n');
      return `【${level}级新闻】\n${levelContent}`;
    });

    return (await Promise.all(newsContentPromises)).join('\n\n');
  }

  /**
   * 6. 统一的总结生成方法
   */
  private async generateAISummary(newsContent: string, enhanced: boolean = false): Promise<string> {
    const mode = enhanced ? '增强模式' : '基础模式';
    console.log(`🎯 开始生成新闻总结 (${mode})...`);

    const systemPrompt = this.getSystemPrompt();
    const userPrompt = `新闻内容：\n\n${newsContent}`;
    const messages = createMessages(systemPrompt, userPrompt);

    const result = await aiService.callLLM(messages, { temperature: 0.7 });

    if (!result.success || !result.data) {
      throw new Error(result.error || 'AI生成的内容为空');
    }

    console.log(`✅ ${mode}总结生成完成`);
    return result.data;
  }

  /**
   * 计算统计信息
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
   * 处理通知发送
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
   * 创建成功结果
   */
  private createSuccessResult(
    timeRangeDesc: string,
    start: moment.Moment,
    end: moment.Moment,
    newsData: any,
    summaryContent: string,
    stats: any,
    enhanced: boolean = false
  ): SummaryResult {
    const mode = enhanced ? '增强模式' : '基础模式';
    return {
      success: true,
      message: `新闻总结生成完成（${mode}）`,
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
   * 获取统一的系统提示词（历史背景信息改为“行内 [历史：……]”写法）
   */
  private getSystemPrompt(): string {
    const basePrompt = `You are "宏观‑量化快讯引擎", an LLM that converts raw multilingual financial headlines into an actionable Markdown briefing for global portfolio managers and economists.

############################################################
◆ 一、重要级映射与无地域偏好  
1. 输入若含"【1级新闻】"，全部保留；在输出中以 "### 1级新闻" 单独分段呈现。  
2. 无级别新闻由模型自动归档，不因国家/市场来源加权或降权。  
3. 每个段内再依下表 **Scope Tier** 排序（同级只按时间倒序）。  

| Scope Tier | 定义 | 典型示例 |
|------------|------|----------|
| **宏观政策/系统风险** | 任一央行/财政部决议、主权违约、G‑20 / IMF / 世行决策，或关键宏观指标（GDP、CPI、PMI、失业率等） | 欧央行加息；土耳其通胀爆表 |
| **跨市场价格冲击** | 股、债、汇、期货、商品等当日波动 ≥ ±1 σ 或异常成交/资金流 | 原油⏫5%、比特币⏬8% |
| **行业／主题驱动** | 行业政策、供需冲击、跨国监管文件、重大并购、集体涨跌 | 全球半导体补贴法案 |
| **大型主体事件** | 全球前 100 市值公司、G‑SIB、AAA/AA 主权或机构债信变动、IPO > 10 亿美元 | 台积电财报；沙特阿美配股 |
| **一般公司／区域新闻** | 中小市值公司、地方经济、社会/科技/民生资讯 | 手机品牌新品发布 |

> **同级别不同国家事件一律平等排序**。

############################################################
◆ 二、聚合与去重  
- 同主题多条 → 合并，保留最大冲击数字 & 最新时间，用 *(截至 HH:MM)*。  
- 删除无新增数据的纯重复。  

############################################################
◆ 三、着重与标记规则  
- **加粗**：所有数字、指数/品种、机构/公司/人名。  
- Emoji 方向：▲ 涨；▼ 跌；⏫ 创新高；⏬ 创新低。  
- 颜色：  
  • ⬆︎涨幅 / 利好 → <span style="color:#16a34a">…</span>  
  • ⬇︎跌幅 / 利空 → <span style="color:#dc2626">…</span>  
  (宏观中性或日期、时间无需上色)`;

    const outputTemplate = `

############################################################
◆ 四、Markdown 输出模板  
### 概览  
一句 ≤ 25 字，高亮 **方向 + 关键数字/事件**。  

### N级新闻(N数值大的排最前；若存在)  
- **…** *(HH:MM)* [历史：…]  
- …  

### 宏观政策 / 系统风险  
- **…** *(HH:MM)* [历史：…]  
- …  

### 跨市场价格冲击  
- **…** *(HH:MM)* [历史：…]  
- …  

### 行业 / 主题  
- **…** *(HH:MM)* [历史：…]  
- …  

### 大型主体事件  
- **…** *(HH:MM)* [历史：…]  
- …  

### 其他  
- **…** *(HH:MM)* [历史：…]  
- …  `;

    const hardRules = `

############################################################
◆ 五、硬性排版规范

* 列表符统一 - ；每条 ≤ 40 字，仅陈述事实。  
* 时间统一用 *斜体(HH:MM)*；跨日则 *YYYY‑MM‑DD HH:MM*。  
* **数字原样输出**（不转中文大写、不加千位分隔符）。  
* 若某分段无内容，则整段省略。  
* **若该条新闻含历史背景，则正文后紧跟 [历史：关键脉络 ≤ 30 字]；无历史信息时省略方括号。**  
* 全文中文；除模板 Emoji 与标、颜色签外不加其他装饰；禁止评论、预测或情绪化字眼。`;

    return basePrompt + outputTemplate + hardRules;
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

import moment from 'moment-timezone';
import { queryService } from './query';
import { notificationService } from './notification';
import { neo4jNewsService } from '../neo4j';
import { SummaryResult } from '../../types/scheduler';
import { aiService, createMessages } from '../utils/llm';
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
      console.log(`🚀 启用实体增强功能: 图谱关联分析 + 历史新闻背景`);

      // 1. 从Neo4j获取时间范围内的新闻数据
      const newsData = await this.getNewsData(start, end);

      if (newsData.news_count === 0) {
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

      // 2. 按级别分组新闻
      const groupedNews = this.groupNewsByLevel(newsData.news_items);

      // 3. 增强功能：获取新闻的实体信息和历史新闻背景
      let historicalContext = '';
      const enhancedNewsItems: any[] = [];

      for (const newsItem of newsData.news_items) {
        try {
          // 3.1 获取新闻的关联实体
          const entities = await this.getNewsEntities(newsItem.newsId);

          // 3.2 查询实体相关的历史新闻
          const newsTimestamp = moment(newsItem.timestamp * 1000);
          const historicalNews = await this.getEntityHistoricalNews(entities, newsTimestamp);

          // 3.3 对历史新闻进行总结
          const historicalSummary = await this.summarizeHistoricalNews(historicalNews);

          enhancedNewsItems.push({
            ...newsItem,
            entities: entities.map((e: any) => ({ name: e.name, type: e.type })),
            entityCount: entities.length,
            historicalNewsCount: historicalNews.length,
            historicalContext: historicalSummary,
          });

          // 收集所有历史背景信息
          if (historicalSummary) {
            historicalContext += `\n【${newsItem.title}】相关历史背景：\n${historicalSummary}\n`;
          }
        } catch (error) {
          console.error(`处理新闻 ${newsItem.newsId} 的实体信息失败:`, error);
          // 如果处理实体失败，仍然保留原始新闻信息
          enhancedNewsItems.push(newsItem);
        }
      }

      // 4. 使用AI生成增强的总结（包含历史背景）
      const newsContent = Object.entries(groupedNews)
        .map(([level, news]) => {
          const levelContent = news
            .map(item => {
              // 查找对应的增强信息
              const enhancedItem = enhancedNewsItems.find(ei => ei.newsId === item.newsId);
              let newsText = `标题：${item.title}\n内容：${item.content}\n时间：${moment(
                item.time * 1000
              )
                .tz('Asia/Shanghai')
                .format('YYYY-MM-DD HH:mm:ss')}`;

              // 添加实体信息
              if (enhancedItem && enhancedItem.entities && enhancedItem.entities.length > 0) {
                const entityList = enhancedItem.entities
                  .map((e: any) => `${e.name}(${e.type})`)
                  .join('、');
                newsText += `\n关联实体：${entityList}`;
              }

              return newsText + '\n';
            })
            .join('\n');
          return `【${level}级新闻】\n${levelContent}`;
        })
        .join('\n\n');

      const systemPrompt = this.getEnhancedSystemPrompt(historicalContext);

      const userPrompt = `新闻内容：\n\n${newsContent}`;
      const messages = createMessages(systemPrompt, userPrompt);

      const result = await aiService.callLLM(messages, {
        temperature: 0.7,
      });

      if (!result.success || !result.data) {
        throw new Error(result.error || 'AI生成的内容为空');
      }

      const summaryContent = result.data;

      // 输出增强功能统计
      const totalEntities = enhancedNewsItems.reduce(
        (sum, item) => sum + (item.entityCount || 0),
        0
      );
      const totalHistoricalNews = enhancedNewsItems.reduce(
        (sum, item) => sum + (item.historicalNewsCount || 0),
        0
      );
      const newsWithContext = enhancedNewsItems.filter(item => item.historicalContext).length;

      console.log(
        `📊 增强分析完成: 发现${totalEntities}个实体, 关联${totalHistoricalNews}条历史新闻, ${newsWithContext}条新闻有历史背景`
      );

      // 5. 发送通知（如果需要）
      if (sendNotification) {
        await this.sendNotification(summaryContent, start, end, newsData);
      }

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
          // 增强数据统计
          enhanced_stats: {
            total_entities_found: enhancedNewsItems.reduce(
              (sum, item) => sum + (item.entityCount || 0),
              0
            ),
            total_historical_news: enhancedNewsItems.reduce(
              (sum, item) => sum + (item.historicalNewsCount || 0),
              0
            ),
            news_with_entities: enhancedNewsItems.filter(item => item.entityCount > 0).length,
            news_with_historical_context: enhancedNewsItems.filter(item => item.historicalContext)
              .length,
            has_historical_context: !!historicalContext.trim(),
          },
        },
      };
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
   * 获取新闻数据
   */
  private async getNewsData(start: moment.Moment, end: moment.Moment): Promise<any> {
    // 传递UTC时间给查询服务
    return await queryService.getHourlySummary(start.toISOString(), end.toISOString());
  }

  /**
   * 获取新闻的所有关联实体
   */
  private async getNewsEntities(newsId: string): Promise<any[]> {
    return await this.newsService.getNewsEntities(newsId);
  }

  /**
   * 根据实体查询过去一个月的相关新闻
   */
  private async getEntityHistoricalNews(
    entities: any[],
    currentNewsTimestamp: moment.Moment
  ): Promise<any[]> {
    if (entities.length === 0) {
      return [];
    }

    // 计算一个月前的时间
    const oneMonthAgo = moment(currentNewsTimestamp).subtract(1, 'month');

    return await this.newsService.getHistoricalNewsByEntities(
      entities,
      oneMonthAgo.toISOString(),
      currentNewsTimestamp.toISOString()
    );
  }

  /**
   * 使用AI对历史新闻进行总结提取
   */
  private async summarizeHistoricalNews(historicalNews: any[]): Promise<string> {
    try {
      if (historicalNews.length === 0) {
        return '';
      }

      console.log(`开始总结 ${historicalNews.length} 条历史新闻`);

      // 按时间排序并格式化历史新闻
      const sortedNews = historicalNews
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .slice(0, 15); // 限制数量避免token过多

      const historicalContent = sortedNews
        .map(news => {
          const timeStr = moment(news.timestamp).tz('Asia/Shanghai').format('MM-DD HH:mm');
          return `[${timeStr}] ${news.title}\n${news.content || ''}\n`;
        })
        .join('\n');

      const systemPrompt = `你是一个专业的金融新闻分析师。请对以下历史新闻进行简洁的主题总结，重点关注：

1. 主要事件和趋势的发展脉络
2. 关键实体（公司、人物、机构）的重要动态
3. 市场影响和政策变化
4. 时间线上的重要节点

要求：
- 用中文回答
- 按主题分类总结，不要逐条列举
- 每个主题不超过2-3句话
- 突出对当前新闻有参考价值的背景信息
- 总篇幅控制在200字以内`;

      const userPrompt = `历史新闻内容：\n\n${historicalContent}`;
      const messages = createMessages(systemPrompt, userPrompt);

      const result = await aiService.callLLM(messages, {
        temperature: 0.7,
      });

      if (!result.success || !result.data) {
        console.error('历史新闻总结失败:', result.error);
        return '';
      }

      console.log('历史新闻总结完成');
      return result.data;
    } catch (error: any) {
      console.error('总结历史新闻失败:', error);
      return '';
    }
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

  /**
   * 获取增强的系统提示词
   */
  private getEnhancedSystemPrompt(historicalContext: string): string {
    const basePrompt = `You are "宏观‑量化快讯引擎", an LLM that converts raw multilingual financial headlines into an actionable Markdown briefing for global portfolio managers and economists.

############################################################
◆ 一、重要级映射与无地域偏好  
1. 输入若含"【1级新闻】"，全部保留；在输出中以 "### 1级新闻" 单独分段呈现。  
2. 无级别新闻由模型自动归档，不因国家/市场来源加权或降权。  
3. 每个段内再依下表 **Scope Tier** 排序（同级只按时间倒序）。  

| Scope Tier | 定义 | 典型示例 |
|------------|------|----------|
| **宏观政策/系统风险** | 任一央行/财政部决议、主权违约、G‑20 / IMF / 世行决策，或关键宏观指标（GDP、CPI、PMI、失业率等） | 欧央行加息；土耳其通胀爆表 |
| **跨市场价格冲击** | 股、债、汇、期货、商品等当日波动 ≥ ±1 σ 或异常成交/资金流 | 原油⏫5%、比特币⏬8% |
| **行业／主题驱动** | 行业政策、供需冲击、跨国监管文件、重大并购、集体涨跌 | 全球半导体补贴法案 |
| **大型主体事件** | 全球前 100 市值公司、G‑SIB、AAA/AA 主权或机构债信变动、IPO > 10 亿美元 | 台积电财报；沙特阿美配股 |
| **一般公司／区域新闻** | 中小市值公司、地方经济、社会/科技/民生资讯 | 手机品牌新品发布 |

> **同级别不同国家事件一律平等排序**。

############################################################
◆ 二、聚合与去重  
- 同主题多条 → 合并，保留最大冲击数字 & 最新时间，用 *(截至 HH:MM)*。  
- 删除无新增数据的纯重复。  

############################################################
◆ 三、着重与标记规则  
- **加粗**：所有数字、指数/品种、机构/公司/人名。  
- Emoji 方向：▲ 涨；▼ 跌；⏫ 创新高；⏬ 创新低。  
- 颜色：  
  • ⬆︎涨幅 / 利好 → <span style="color:#16a34a">…</span>  
  • ⬇︎跌幅 / 利空 → <span style="color:#dc2626">…</span>  
  (宏观中性或日期、时间无需上色)

############################################################
◆ 四、Markdown 输出模板  
### 概览  
一句 ≤ 25 字，高亮 **方向 + 关键数字/事件**。  

### N级新闻(N数值大的排最前；若存在)  
- **…** *(HH:MM)*  
- …  

### 宏观政策 / 系统风险  
- **…** *(HH:MM)*  
- …  

### 跨市场价格冲击  
- **…** *(HH:MM)*  
- …  

### 行业 / 主题  
- **…** *(HH:MM)*  
- …  

### 大型主体事件  
- **…** *(HH:MM)*  
- …  

### 其他  
- **…** *(HH:MM)*  
- …  

############################################################
◆ 五、硬性排版规范

* 列表符统一 - ；每条 ≤ 40 字，仅陈述事实。
* 时间统一用 *斜体(HH:MM)*；跨日则 *YYYY‑MM‑DD HH:MM*。
* **数字原样输出**（不转中文大写、不加千位分隔符）。
* 若某分段无内容，则整段省略。
* 全文中文；除模板 Emoji 与标、颜色签外不加其他装饰；禁止评论、预测或情绪化字眼。

############################################################
◆ 六、输出示例

### 概览

**A股、港股午后齐升**，两市成交再破**1万亿**

### 1级新闻

* **A股三大指数▲翻红**，大金融板块领涨 *(13:12)*

### 宏观政策 / 系统风险

* **北约**拟至 **2032** 年防务支出占 **GDP 5 %** *(13:34)*

### 跨市场价格冲击

* <span style="color:#16a34a">**恒指▲2 %**</span>；<span style="color:#16a34a">**恒生科技▲2.3 %**</span> *(13:42)*
* <span style="color:#16a34a">**富时中国 A50 期指▲2 %**</span> *(13:39)*

### 行业 / 主题

* **港股中资券商股▲6–22 %**，**弘业期货**领涨 *(13:46)*
* **国际能源署**：2025 年电动车销量或破 **2000万辆** *(13:45)*

### 大型主体事件

* **中国平安市值重返 1 万亿元** *(13:41)*
* **东方财富成交额达 100 亿元**，股价▲5.8 % *(13:42)*

### 其他

* **京东外卖**午间部分地区出现无人接单 *(13:08)*`;

    // 如果有历史背景信息，则在提示词中加入增强指导
    if (historicalContext.trim()) {
      return (
        basePrompt +
        `

############################################################
◆ 七、历史背景信息增强

基于图谱分析，以下是相关实体的历史背景信息，请在生成总结时参考这些信息来：
1. 更好地理解当前新闻的意义和影响
2. 识别事件发展的趋势和脉络
3. 突出关键变化和转折点
4. 提供更准确的市场影响判断

**历史背景参考：**
${historicalContext}

注意：历史背景仅作为理解参考，不要在最终输出中直接引用或重复历史内容，而是要结合历史信息更准确地分析当前新闻的重要性和影响。`
      );
    }

    return basePrompt;
  }

  /**
   * 测试增强功能 - 获取单条新闻的实体和历史背景
   */
  async testEnhancedFeatures(newsId: string): Promise<any> {
    try {
      console.log(`🧪 测试新闻 ${newsId} 的增强功能`);

      // 获取实体
      const entities = await this.getNewsEntities(newsId);
      console.log(
        `发现 ${entities.length} 个实体:`,
        entities.map(e => `${e.name}(${e.type})`)
      );

      if (entities.length > 0) {
        // 查询历史新闻
        const currentTime = moment();
        const historicalNews = await this.getEntityHistoricalNews(entities, currentTime);
        console.log(`找到 ${historicalNews.length} 条历史相关新闻`);

        // 生成历史总结
        const historicalSummary = await this.summarizeHistoricalNews(historicalNews);
        console.log('历史总结:', historicalSummary);

        return {
          success: true,
          newsId,
          entities,
          historicalNewsCount: historicalNews.length,
          historicalSummary,
          historicalNews: historicalNews.slice(0, 5), // 返回前5条作为示例
        };
      } else {
        return {
          success: true,
          newsId,
          message: '该新闻没有找到关联实体',
        };
      }
    } catch (error: any) {
      console.error('测试增强功能失败:', error);
      return {
        success: false,
        error: error.message,
        newsId,
      };
    }
  }
}

export const summaryService = new SummaryService();
export { SummaryService };

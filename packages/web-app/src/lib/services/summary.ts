import moment from 'moment-timezone';
import { queryService } from './query';
import { notificationService } from './notification';
import { SummaryResult, CallSource } from '../../types/scheduler';
import { aiService, createMessages } from '../utils/llm';

/**
 * 总结服务
 * 提供通用的时间区间新闻总结功能（不落库）
 */
class SummaryService {

  /**
   * 生成新闻总结
   * @param startTime 开始时间（ISO字符串或moment对象）
   * @param endTime 结束时间（ISO字符串或moment对象）
   * @param source 调用来源
   * @param sendNotification 是否发送通知，默认为false
   */
  async generateSummary(
    startTime: string | moment.Moment,
    endTime: string | moment.Moment,
    source: CallSource = CallSource.API,
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

      // 1. 从Neo4j获取时间范围内的新闻数据
      const newsData = await this.getNewsData(start, end);

      if (newsData.news_count === 0) {
        return {
          success: true,
          message: `${timeRangeDesc} 时段没有新闻`,
          period: timeRangeDesc,
          timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
          data: { 
            empty: true, 
            time_range: {
              start: start.toISOString(),
              end: end.toISOString()
            }
          }
        };
      }

      // 2. 按级别分组新闻
      const groupedNews = this.groupNewsByLevel(newsData.news_items);

      // 3. 使用AI生成总结
      const newsContent = Object.entries(groupedNews)
        .map(([level, news]) => {
          const levelContent = news
            .map(item => {
              return `标题：${item.title}\n内容：${item.content}\n时间：${moment(item.time * 1000).format('YYYY-MM-DD HH:mm:ss')}\n`;
            })
            .join('\n');
          return `【${level}级新闻】\n${levelContent}`;
        })
        .join('\n\n');

      const systemPrompt = `You are "宏观‑量化快讯引擎", an LLM that converts raw multilingual financial headlines into an actionable Markdown briefing for global portfolio managers and economists.

############################################################
◆ 一、重要级映射与无地域偏好  
1. 输入若含"【N级新闻】"，**N越大越重要**，全部保留；在输出中以 "### N级新闻" 单独分段呈现，按 N 递减排序。  
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
- 30 分钟内同主题多条 → 合并，保留最大冲击数字 & 最新时间，用 *(截至 HH:MM)*。  
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

### L2 行业 / 主题

* **港股中资券商股▲6–22 %**，**弘业期货**领涨 *(13:46)*
* **国际能源署**：2025 年电动车销量或破 **2000万辆** *(13:45)*

### L3 大型主体事件

* **中国平安市值重返 1 万亿元** *(13:41)*
* **东方财富成交额达 100 亿元**，股价▲5.8 % *(13:42)*

### L4 其他

* **京东外卖**午间部分地区出现无人接单 *(13:08)*`;

      const userPrompt = `新闻内容：\n\n${newsContent}`;
      const messages = createMessages(systemPrompt, userPrompt);
      
      const result = await aiService.callLLM(messages, {
        temperature: 0.7,
      });

      if (!result.success || !result.data) {
        throw new Error(result.error || 'AI生成的内容为空');
      }

      const summaryContent = result.data;

      // 4. 发送通知（如果需要）
      if (sendNotification) {
        await this.sendNotification(summaryContent, start, end, newsData, source);
      }

      return {
        success: true,
        message: `新闻总结生成完成`,
        period: timeRangeDesc,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
        data: {
          news_count: newsData.news_count,
          high_level_count: this.getHighLevelCount(newsData),
          summary: summaryContent,
          time_range: {
            start: start.toISOString(),
            end: end.toISOString()
          }
        }
      };

    } catch (error: any) {
      console.error('生成总结失败:', error);
      const timeRangeDesc = this.formatPeriod(moment(startTime), moment(endTime));
      return {
        success: false,
        message: `生成新闻总结失败`,
        period: timeRangeDesc,
        error: error.message,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };
    }
  }

  /**
   * 获取新闻数据
   */
  private async getNewsData(start: moment.Moment, end: moment.Moment): Promise<any> {
    // 注意：这里传递的是北京时间的ISO字符串，query服务会自动转换为UTC
    return await queryService.getHourlySummary(start.toISOString(), end.toISOString());
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
      const timeValue = typeof item.timestamp === 'number' ? 
        item.timestamp : 
        moment(item.timestamp).unix();
      
      grouped[level].push({
        title: item.title,
        content: item.content || '',
        time: timeValue
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
    newsData: any,
    source: CallSource
  ): Promise<void> {
    try {
      // 检查是否有高级别新闻
      const highLevelNews = newsData.news_items?.filter((item: any) => 
        item.level === 'Level 1' || item.level === 'Level 2'
      ) || [];

      if (highLevelNews.length > 0) {
        // 有高级别新闻时发送通知
        await notificationService.sendHourlySummaryNotification(
          { summary: summaryData }, 
          start.toISOString(), 
          end.toISOString(), 
          highLevelNews, 
          source
        );
      }
    } catch (error) {
      console.error('发送通知失败:', error);
      // 通知失败不影响总结生成，只记录错误
    }
  }

  /**
   * 获取高级别新闻数量
   */
  private getHighLevelCount(newsData: any): number {
    return newsData.news_items?.filter((item: any) => 
      item.level === 'Level 1' || item.level === 'Level 2'
    ).length || 0;
  }

  /**
   * 格式化时间段
   */
  private formatPeriod(start: moment.Moment, end: moment.Moment): string {
    if (start.isSame(end, 'day')) {
      return `${start.format('MM-DD HH:mm')}-${end.format('HH:mm')}`;
    } else {
      return `${start.format('MM-DD HH:mm')}-${end.format('MM-DD HH:mm')}`;
    }
  }
}

export const summaryService = new SummaryService();
export { SummaryService }; 
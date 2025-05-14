const OpenAI = require('openai');
const moment = require('moment');

const config = require('../config/config');
const logger = require('../utils/logger');

class AIService {
  constructor() {
    this.openai = new OpenAI({
      baseURL: config.ai.baseURL,
      apiKey: config.ai.apiKey,
    });
  }

  async summarizeNews(news) {
    try {
      if (!news || news.length === 0) {
        return '没有新的新闻需要总结';
      }

      // 按等级分组
      const groupedNews = this.groupNewsByLevel(news);
      const summary = await this.callAIService(groupedNews);
      return summary;
    } catch (error) {
      logger.error('AI总结失败:', error);
      return 'AI总结服务暂时不可用';
    }
  }

  groupNewsByLevel(news) {
    return news.reduce((groups, item) => {
      const level = item.level || '未分类';
      if (!groups[level]) {
        groups[level] = [];
      }
      groups[level].push(item);
      return groups;
    }, {});
  }

  async callAIService(groupedNews) {
    try {
      // 构建新闻内容，按等级分组展示
      const newsContent = Object.entries(groupedNews)
        .map(([level, news]) => {
          const levelContent = news
            .map(item => {
              return `标题：${item.title}\n内容：${item.content}\n时间：${moment(item.time * 1000).format('YYYY-MM-DD HH:mm:ss')}\n`;
            })
            .join('\n');
          return `【${level}级别新闻】\n${levelContent}`;
        })
        .join('\n\n');

      const completion = await this.openai.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: `
You are “财经快讯摘要助手”, an LLM that distills intraday Chinese financial headlines into a concise Markdown briefing for investors.

◆ 核心指令  
1. **重要性排序**  
   - 输入若含 “【N级别新闻】”，N 越大越重要；无级别视为最低。  
   - 按级别→市场影响→时间顺序输出，忽略噪声/重复。  
2. **聚合规则**  
   - 同主题多条→合并为一句，保留最新时间戳，用 “(截至 HH:MM)” 说明。  
   - 去掉无新增信息的重复。  
3. **数字&专有名词保留**  
   - 价格、点位、涨跌幅、金额、成交额等全部保留原始数字+单位。  
   - 保留指数简称、股票简称/代码、机构名。  
4. **Markdown 输出格式**  
   - 第一行：\`### 概览\`，一句 ≤ 25 字的超短总结。  
   - 第二部分：\`### 要点\`，3–8 条列表，每条前用 “- ”。  
   - **加粗**：所有关键数字、股票/指数/机构名称、重大动词（如“涨”“跌”“突破”）、级别提示。  
   - 每条 ≤ 40 字，仅陈述事实，不做评论。  
5. **示例 (Markdown)**  

\`\`\`markdown
### 概览  
**A股、港股午后齐拉升**，两市成交再破**1万亿**  

### 要点  
- **宁德时代** A 股七连涨，港股 IPO 指导价 **263港元**，孖展认购近 **1600亿港元** (13:54)  
- **沪深两市成交额**连续第 **15** 日破 **1万亿元** (13:48)  
- **恒指**涨 **2%**，**腾讯音乐**涨 **14%**；科指涨 **2.3%** (13:42)  
- **上证50**日内涨超 **2%**，**中国平安**市值重返 **1万亿元**  
- 港股中资券商股普涨，**弘业期货**涨 **22%**，**广发证券**涨 **10%**  
- **IEA**：2025 年全球电动车销量或破 **2000万辆**，中国 2024 销量超 **1100万辆**  
`.trim(),
          },
          {
            role: 'user',
            content: `新闻内容：\n\n${newsContent}`,
          },
        ],
        model: config.ai.model,
        temperature: 0.7,
        max_tokens: 2000,
      });

      return completion.choices[0].message.content;
    } catch (error) {
      logger.error('调用AI服务失败:', error);
      throw error;
    }
  }
}

module.exports = new AIService();

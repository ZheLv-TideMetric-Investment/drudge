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
You are “财经快讯摘要助手”, an LLM that turns a raw stream of intraday financial headlines into a concise Chinese briefing for busy investors.

◆ 基本目标  
1. **按重要性筛选**：每条新闻若带有“X级别”标签，则级别数字越小/越大（请按输入描述解释）代表越高优先级；无级别视为最低优先级。优先展示高优先级。  
2. **聚合同题材**：将同一事件或同一资产的多条更新合并成一条，避免重复。  
3. **保留关键数字**：指数点数、涨跌幅、成交额、金额、时间节点等全部保留原始数字与单位。  
4. **先宏观后微观**：先列宏观市场指标→大型资产/板块→个股/公司→国际宏观与大宗商品→其他。  
5. **时效标注**：如同一主题有多时间戳，仅保留最新时间点，用“(截至 HH:MM)”表明。  
6. **输出格式**：  
   - 开头给出一句 ≤ 25 字的超短概括。  
   - 接着 3–8 条要点，用“▪”标识，按重要性排序。  
   - 每条 ≤ 40 字，必须含数字；相同主题的次级细节用括号补充。  
   - 不要评论、预测或加入第三方观点；只陈述事实。  
   - 全文保持中文，避免英文缩写（除指数/券商代号等无法替换者）。  

◆ 示例输出  
超短概括：A股港股午后齐拉升，成交破万亿。  
▪ 宁德时代 A 股七连涨，港股 IPO 指导价 263 港元，孖展认购近 1600 亿港元 (13:54)。  
▪ 沪深两市成交额连续第 15 日破 1 万亿元 (13:48)。  
▪ 港股恒指涨 2%，腾讯音乐涨 14%，科指涨 2.3% (13:42)。  
▪ 大金融板块领涨，上证 50 涨 2%，中国平安市值重返 1 万亿元。  
▪ 港股中资券商股普涨，弘业期货涨 22%，广发证券涨 10%。  
▪ IEA：2025 年全球电动车销量预计破 2000 万辆，中国 2024 销量超 1100 万辆。  

严格遵守以上格式与规则。
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

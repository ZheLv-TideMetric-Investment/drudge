import moment from 'moment-timezone';
import logger from '../utils/logger.js';
import storageService from './storageService.js';
import { callLLMWithJsonResponse, callLLM } from '../utils/llm.js';
import { promises as fs } from 'fs';
import path from 'path';

// 设置默认时区为北京时间
moment.tz.setDefault('Asia/Shanghai');

/**
 * 草蛇灰线系统 - 事件捕猎服务
 * 负责识别特级事件，将其晋升为捕猎对象，并进行回溯分析
 */
class HuntService {
  constructor() {
    this.huntBasePath = path.join(process.cwd(), 'data', 'hunts');
    this.activeHunts = new Map();
    this.ensureHuntDirectory();
  }

  async ensureHuntDirectory() {
    try {
      await fs.mkdir(this.huntBasePath, { recursive: true });
    } catch (error) {
      logger.error('创建捕猎数据目录失败:', error);
    }
  }

  async checkEventPromotion(recentNews) {
    try {
      if (!recentNews || recentNews.length === 0) {
        return null;
      }

      logger.info(`开始检查事件晋升，新闻数量: ${recentNews.length}`);

      const huntCandidate = await this.identifySpecialEvent(recentNews);

      if (huntCandidate && huntCandidate.shouldHunt) {
        logger.info(`发现捕猎对象: ${huntCandidate.title}`);

        const timeline = await this.buildTimeline(huntCandidate);
        const huntObject = await this.createHuntObject(huntCandidate, timeline);
        const initialReport = await this.generateHuntingReport(huntObject);

        huntObject.report = initialReport;
        huntObject.status = 'active';
        huntObject.lastUpdate = moment().toISOString();

        await this.saveHuntObject(huntObject);
        this.activeHunts.set(huntObject.id, huntObject);

        logger.info(`捕猎对象创建成功: ${huntObject.id}`);
        return huntObject;
      }

      return null;
    } catch (error) {
      logger.error('检查事件晋升失败:', error);
      return null;
    }
  }

  async identifySpecialEvent(news) {
    try {
      const newsContent = news.slice(0, 20).map(item => ({
        title: item.title,
        content: item.content,
        time: moment(item.time * 1000).format('YYYY-MM-DD HH:mm:ss'),
        level: item.level,
      }));

      const messages = [
        {
          role: 'system',
          content: `
你是草蛇灰线系统的事件识别专家。你的任务是从新闻中识别可能需要"捕猎"的特级事件。

## 捕猎标准
满足以下任一条件的事件应被识别为捕猎对象：

1. **特级事件**：
   - 国际军事冲突、地缘政治危机
   - 重大自然灾害或突发公共卫生事件
   - 金融市场重大波动（主要指数波动>5%）
   - 重要政治人物变动或重大政策宣布
   - 重大恐怖袭击或安全事件

2. **持续发酵事件**：
   - 同一主题在24小时内出现3条以上相关新闻
   - 涉及多个国家或地区的连锁反应
   - 可能产生长期影响的事件

3. **系统性风险事件**：
   - 可能引发连锁反应的事件
   - 影响全球或区域稳定的事件
   - 可能改变行业格局的重大事件

## 输出格式
返回JSON格式：
{
  "shouldHunt": boolean,
  "confidence": number,
  "title": "事件标题",
  "keywords": ["关键词1", "关键词2"],
  "category": "事件类别",
  "impactLevel": "影响等级(high/medium/low)",
  "reason": "识别原因",
  "relatedNewsIds": ["相关新闻ID"]
}

如果没有符合条件的事件，返回 {"shouldHunt": false}
`,
        },
        {
          role: 'user',
          content: `请分析以下新闻，识别是否存在需要捕猎的特级事件：\n\n${JSON.stringify(newsContent, null, 2)}`,
        },
      ];

      const result = await callLLMWithJsonResponse(messages);
      return result;
    } catch (error) {
      logger.error('AI识别特级事件失败:', error);
      return null;
    }
  }

  async buildTimeline(huntCandidate) {
    try {
      const sevenDaysAgo = moment().subtract(7, 'days');
      const now = moment();

      logger.info(
        `回溯时间范围: ${sevenDaysAgo.format('YYYY-MM-DD HH:mm:ss')} 到 ${now.format('YYYY-MM-DD HH:mm:ss')}`
      );

      const pastNews = await storageService.getByTimeRange(sevenDaysAgo, now);
      const relatedNews = await this.findRelatedNews(pastNews, huntCandidate);

      const timeline = relatedNews
        .sort((a, b) => a.time - b.time)
        .map(news => ({
          time: moment(news.time * 1000).toISOString(),
          title: news.title,
          content: news.content,
          importance: this.calculateImportance(news, huntCandidate),
        }));

      logger.info(`构建时间线完成，相关新闻数量: ${timeline.length}`);
      return timeline;
    } catch (error) {
      logger.error('构建时间线失败:', error);
      return [];
    }
  }

  async findRelatedNews(allNews, huntCandidate) {
    try {
      const keywords = huntCandidate.keywords || [];
      const preFiltered = allNews.filter(news => {
        const text = `${news.title} ${news.content}`.toLowerCase();
        return keywords.some(keyword => text.includes(keyword.toLowerCase()));
      });

      if (preFiltered.length > 100) {
        const batches = [];
        for (let i = 0; i < preFiltered.length; i += 20) {
          batches.push(preFiltered.slice(i, i + 20));
        }

        let relatedNews = [];
        for (const batch of batches) {
          const batchRelated = await this.aiFilterRelatedNews(batch, huntCandidate);
          relatedNews = [...relatedNews, ...batchRelated];
        }
        return relatedNews;
      }

      return preFiltered;
    } catch (error) {
      logger.error('查找相关新闻失败:', error);
      return [];
    }
  }

  async aiFilterRelatedNews(newsBatch, huntCandidate) {
    try {
      const messages = [
        {
          role: 'system',
          content: `
你需要从新闻列表中筛选出与目标事件相关的新闻。

目标事件信息：
- 标题：${huntCandidate.title}
- 关键词：${huntCandidate.keywords?.join(', ')}
- 类别：${huntCandidate.category}

筛选标准：
1. 直接提及相同的人物、地点、机构
2. 属于相同的事件链条
3. 可能是事件的前因或后果
4. 涉及相同的主题或影响领域

返回格式：相关新闻的ID数组，如 ["id1", "id2", "id3"]
`,
        },
        {
          role: 'user',
          content: `请从以下新闻中筛选出相关的新闻ID：

${JSON.stringify(
  newsBatch.map(n => ({
    id: n.id,
    title: n.title,
    content: n.content.substring(0, 200),
  })),
  null,
  2
)}`,
        },
      ];

      const result = await callLLMWithJsonResponse(messages);
      const relatedIds = result.relatedIds || result;

      return newsBatch.filter(news => relatedIds.includes(news.id));
    } catch (error) {
      logger.error('AI筛选相关新闻失败:', error);
      return newsBatch;
    }
  }

  calculateImportance(news, huntCandidate) {
    let score = 0;

    score += (news.level || 1) * 10;

    const text = `${news.title} ${news.content}`.toLowerCase();
    const keywords = huntCandidate.keywords || [];
    keywords.forEach(keyword => {
      if (text.includes(keyword.toLowerCase())) {
        score += 5;
      }
    });

    const newsTime = moment(news.time * 1000);
    const hoursAgo = moment().diff(newsTime, 'hours');
    if (hoursAgo < 24) {
      score += 10;
    } else if (hoursAgo < 72) {
      score += 5;
    }

    return Math.min(score, 100);
  }

  async createHuntObject(huntCandidate, timeline) {
    const huntObject = {
      id: `hunt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      title: huntCandidate.title,
      keywords: huntCandidate.keywords,
      category: huntCandidate.category,
      impactLevel: huntCandidate.impactLevel,
      createdAt: moment().toISOString(),
      status: 'active',
      timeline: timeline,
      confidence: huntCandidate.confidence,
      reason: huntCandidate.reason,
      progressUpdates: [],
      lastUpdate: moment().toISOString(),
    };

    return huntObject;
  }

  async generateHuntingReport(huntObject) {
    try {
      const messages = [
        {
          role: 'system',
          content: `
你是草蛇灰线系统的报告生成专家，需要为捕猎对象生成详细的"追杀令"报告。

报告应包含：
1. **事件概述** - 事件的核心要点和重要性
2. **发展脉络** - 基于时间线梳理事件发展过程
3. **多维影响分析** - 政治、经济、社会等层面的影响
4. **风险评估** - 可能的发展趋势和风险点
5. **监控要点** - 需要重点关注的后续发展指标

使用Markdown格式，语言简洁专业，重点突出。
`,
        },
        {
          role: 'user',
          content: `
请为以下捕猎对象生成追杀令报告：

**基本信息：**
- 标题：${huntObject.title}
- 类别：${huntObject.category}
- 影响等级：${huntObject.impactLevel}
- 识别原因：${huntObject.reason}

**发展时间线：**
${huntObject.timeline
  .map(item => `- ${moment(item.time).format('MM-DD HH:mm')} ${item.title}`)
  .join('\n')}

**关键词：** ${huntObject.keywords?.join(', ')}
`,
        },
      ];

      const report = await callLLM(messages);
      return report;
    } catch (error) {
      logger.error('生成追杀令报告失败:', error);
      return `# 追杀令报告\n\n## 事件：${huntObject.title}\n\n报告生成失败，请检查系统状态。`;
    }
  }

  async saveHuntObject(huntObject) {
    try {
      const filePath = path.join(this.huntBasePath, `${huntObject.id}.json`);
      await fs.writeFile(filePath, JSON.stringify(huntObject, null, 2));
      logger.info(`捕猎对象保存成功: ${huntObject.id}`);
    } catch (error) {
      logger.error('保存捕猎对象失败:', error);
      throw error;
    }
  }

  async getActiveHunts() {
    try {
      const files = await fs.readdir(this.huntBasePath);
      const huntFiles = files.filter(file => file.startsWith('hunt_') && file.endsWith('.json'));

      const activeHunts = [];
      for (const file of huntFiles) {
        const filePath = path.join(this.huntBasePath, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const huntObject = JSON.parse(content);

        if (huntObject.status === 'active') {
          activeHunts.push(huntObject);
          this.activeHunts.set(huntObject.id, huntObject);
        }
      }

      logger.info(`加载活跃捕猎对象: ${activeHunts.length} 个`);
      return activeHunts;
    } catch (error) {
      logger.error('获取活跃捕猎对象失败:', error);
      return [];
    }
  }

  async manualTerminateHunt(huntId) {
    try {
      const huntObject = this.activeHunts.get(huntId);
      if (!huntObject) {
        logger.warn(`捕猎对象不存在或已非活跃状态: ${huntId}`);
        return false;
      }

      huntObject.status = 'terminated';
      huntObject.terminatedAt = moment().toISOString();
      huntObject.terminationReason = 'manual';
      huntObject.lastUpdate = moment().toISOString();

      await this.saveHuntObject(huntObject);
      this.activeHunts.delete(huntId);

      logger.info(`手动终止捕猎成功: ${huntId}`);
      return true;
    } catch (error) {
      logger.error('手动终止捕猎失败:', error);
      return false;
    }
  }
}

export default new HuntService();

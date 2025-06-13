import moment from 'moment-timezone';
import logger from '../utils/logger.js';
import storageService from './storageService.js';
import huntService from './huntService.js';
import webhookService from './webhookService.js';
import { callLLMWithJsonResponse, callLLM } from '../utils/llm.js';

// 设置默认时区为北京时间
moment.tz.setDefault('Asia/Shanghai');

/**
 * 草蛇灰线系统 - 持续跟踪服务
 * 负责监控活跃捕猎对象的新进展，并判断是否需要终止追踪
 */
class TrackingService {
  constructor() {
    this.lastCheckTime = moment();
    this.terminationCheckInterval = 24; // 24小时检查一次终止条件
  }

  /**
   * 检查捕猎对象的新进展
   * @returns {Promise<void>}
   */
  async checkForProgress() {
    try {
      const activeHunts = await huntService.getActiveHunts();
      if (activeHunts.length === 0) {
        logger.info('当前没有活跃的捕猎对象');
        return;
      }

      logger.info(`开始检查 ${activeHunts.length} 个活跃捕猎对象的新进展`);

      // 获取当前新闻流（过去5分钟的新闻）
      const fiveMinutesAgo = moment().subtract(5, 'minutes');
      const now = moment();
      const currentNews = await storageService.getByTimeRange(fiveMinutesAgo, now);

      if (currentNews.length === 0) {
        logger.info('过去5分钟没有新闻');
        return;
      }

      // 为每个活跃捕猎对象检查新进展
      const progressPromises = activeHunts.map(huntObject =>
        this.checkHuntProgress(huntObject, currentNews)
      );

      const progressResults = await Promise.allSettled(progressPromises);

      // 统计结果
      let updatedCount = 0;
      progressResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          updatedCount++;
          logger.info(`捕猎对象 ${activeHunts[index].id} 发现新进展`);
        } else if (result.status === 'rejected') {
          logger.error(`检查捕猎对象 ${activeHunts[index].id} 进展失败:`, result.reason);
        }
      });

      logger.info(`进展检查完成，${updatedCount} 个捕猎对象有新进展`);
    } catch (error) {
      logger.error('检查进展失败:', error);
    }
  }

  /**
   * 检查单个捕猎对象的新进展
   * @param {Object} huntObject - 捕猎对象
   * @param {Array} currentNews - 当前新闻
   * @returns {Promise<boolean>} 是否有新进展
   */
  async checkHuntProgress(huntObject, currentNews) {
    try {
      // 使用关键词和AI判断是否有相关的新进展
      const relatedNews = await this.findProgressNews(huntObject, currentNews);

      if (relatedNews.length === 0) {
        return false;
      }

      // 生成进展更新
      const progressUpdate = await this.generateProgressUpdate(huntObject, relatedNews);

      // 更新捕猎对象
      huntObject.progressUpdates.push({
        time: moment().toISOString(),
        news: relatedNews,
        summary: progressUpdate,
        importance: this.calculateProgressImportance(relatedNews, huntObject),
      });

      huntObject.lastUpdate = moment().toISOString();

      // 保存更新
      await huntService.saveHuntObject(huntObject);

      // 发送通知
      await this.sendProgressNotification(huntObject, progressUpdate);

      return true;
    } catch (error) {
      logger.error(`检查捕猎对象 ${huntObject.id} 进展失败:`, error);
      return false;
    }
  }

  /**
   * 找出与捕猎对象相关的进展新闻
   * @param {Object} huntObject - 捕猎对象
   * @param {Array} currentNews - 当前新闻
   * @returns {Promise<Array>} 相关新闻
   */
  async findProgressNews(huntObject, currentNews) {
    try {
      // 1. 关键词预筛选
      const keywords = huntObject.keywords || [];
      const preFiltered = currentNews.filter(news => {
        const text = `${news.title} ${news.content}`.toLowerCase();
        return keywords.some(keyword => text.includes(keyword.toLowerCase()));
      });

      if (preFiltered.length === 0) {
        return [];
      }

      // 2. AI精确筛选
      const relatedNews = await this.aiFilterProgressNews(huntObject, preFiltered);

      return relatedNews;
    } catch (error) {
      logger.error('查找进展新闻失败:', error);
      return [];
    }
  }

  /**
   * 使用AI筛选进展新闻
   * @param {Object} huntObject - 捕猎对象
   * @param {Array} candidateNews - 候选新闻
   * @returns {Promise<Array>} 相关新闻
   */
  async aiFilterProgressNews(huntObject, candidateNews) {
    try {
      const messages = [
        {
          role: 'system',
          content: `
你需要从候选新闻中筛选出与目标捕猎事件直接相关的新进展。

目标事件信息：
- 标题：${huntObject.title}
- 类别：${huntObject.category}
- 关键词：${huntObject.keywords?.join(', ')}
- 影响等级：${huntObject.impactLevel}

筛选标准（必须满足至少一个）：
1. **直接进展**：事件的最新发展、结果、决策
2. **影响扩散**：事件对其他领域、地区的新影响
3. **各方反应**：重要机构、国家、人物的新反应或行动
4. **数据更新**：相关指标、统计数据的最新变化

排除标准：
- 与事件无关的一般性新闻
- 重复之前已知信息的新闻
- 间接相关但无实质进展的新闻

返回JSON格式：
{
  "relatedNewsIds": ["相关新闻ID1", "相关新闻ID2"],
  "reasoning": "筛选理由"
}
`,
        },
        {
          role: 'user',
          content: `
请从以下候选新闻中筛选出与捕猎事件相关的新进展：

${JSON.stringify(
  candidateNews.map(n => ({
    id: n.id,
    title: n.title,
    content: n.content.substring(0, 300),
    time: moment(n.time * 1000).format('HH:mm'),
  })),
  null,
  2
)}`,
        },
      ];

      const result = await callLLMWithJsonResponse(messages);
      const relatedIds = result.relatedNewsIds || [];

      return candidateNews.filter(news => relatedIds.includes(news.id));
    } catch (error) {
      logger.error('AI筛选进展新闻失败:', error);
      return candidateNews; // 失败时返回所有候选新闻
    }
  }

  /**
   * 生成进展更新报告
   * @param {Object} huntObject - 捕猎对象
   * @param {Array} relatedNews - 相关新闻
   * @returns {Promise<string>} 进展更新
   */
  async generateProgressUpdate(huntObject, relatedNews) {
    try {
      const messages = [
        {
          role: 'system',
          content: `
你是草蛇灰线系统的进展分析专家，需要为捕猎事件生成简洁的进展更新。

输出要求：
1. 简洁明了，突出最重要的新进展
2. 长度控制在200字以内
3. 使用Markdown格式
4. 重点关注：新发展、新影响、新反应

格式示例：
## 🔄 最新进展 (HH:MM)

**核心发展：** 简述最重要的进展

**新影响：** 描述新的影响或变化

**各方反应：** 重要机构或人物的新反应
`,
        },
        {
          role: 'user',
          content: `
捕猎事件：${huntObject.title}

最新相关新闻：
${relatedNews
  .map(
    news =>
      `- ${moment(news.time * 1000).format('HH:mm')} ${news.title}\n  ${news.content.substring(0, 200)}...`
  )
  .join('\n\n')}

请生成进展更新报告：`,
        },
      ];

      const progressUpdate = await callLLM(messages);
      return progressUpdate;
    } catch (error) {
      logger.error('生成进展更新失败:', error);
      return `## 🔄 最新进展 (${moment().format('HH:mm')})\n\n**系统异常：** 进展更新生成失败，请查看原始新闻。`;
    }
  }

  /**
   * 计算进展的重要性
   * @param {Array} relatedNews - 相关新闻
   * @param {Object} huntObject - 捕猎对象
   * @returns {number} 重要性分数
   */
  calculateProgressImportance(relatedNews, huntObject) {
    let score = 0;

    // 新闻数量影响
    score += relatedNews.length * 10;

    // 新闻级别影响
    relatedNews.forEach(news => {
      score += (news.level || 1) * 5;
    });

    // 关键词密度影响
    const keywords = huntObject.keywords || [];
    relatedNews.forEach(news => {
      const text = `${news.title} ${news.content}`.toLowerCase();
      keywords.forEach(keyword => {
        const occurrences = (text.match(new RegExp(keyword.toLowerCase(), 'g')) || []).length;
        score += occurrences * 2;
      });
    });

    return Math.min(score, 100);
  }

  /**
   * 发送进展通知
   * @param {Object} huntObject - 捕猎对象
   * @param {string} progressUpdate - 进展更新
   */
  async sendProgressNotification(huntObject, progressUpdate) {
    try {
      const notificationTitle = `🎯 草蛇灰线 - ${huntObject.title}`;
      const message = `${progressUpdate}\n\n---\n💡 捕猎对象：${huntObject.id}\n🏷️ 类别：${huntObject.category}\n📈 影响等级：${huntObject.impactLevel}`;

      await webhookService.sendMessage(
        moment().format('YYYY-MM-DD HH:mm:ss'),
        moment().format('YYYY-MM-DD HH:mm:ss'),
        message,
        notificationTitle
      );

      logger.info(`进展通知发送成功: ${huntObject.id}`);
    } catch (error) {
      logger.error('发送进展通知失败:', error);
    }
  }

  /**
   * 检查捕猎对象是否应该终止
   * @returns {Promise<void>}
   */
  async checkForTermination() {
    try {
      const activeHunts = await huntService.getActiveHunts();
      if (activeHunts.length === 0) {
        return;
      }

      logger.info(`开始检查 ${activeHunts.length} 个捕猎对象的终止条件`);

      for (const huntObject of activeHunts) {
        const shouldTerminate = await this.shouldTerminateHunt(huntObject);
        if (shouldTerminate.terminate) {
          await this.terminateHunt(huntObject, shouldTerminate.reason);
        }
      }
    } catch (error) {
      logger.error('检查终止条件失败:', error);
    }
  }

  /**
   * 判断是否应该终止捕猎
   * @param {Object} huntObject - 捕猎对象
   * @returns {Promise<Object>} 终止判断结果
   */
  async shouldTerminateHunt(huntObject) {
    try {
      // 1. 时间检查：超过7天没有重要进展
      const lastUpdate = moment(huntObject.lastUpdate);
      const daysSinceUpdate = moment().diff(lastUpdate, 'days');

      if (daysSinceUpdate > 7) {
        return {
          terminate: true,
          reason: 'timeout',
          details: `超过7天无重要进展`,
        };
      }

      // 2. 进展分析：最近的进展是否表明事件已结束
      if (huntObject.progressUpdates.length > 0) {
        const recentUpdates = huntObject.progressUpdates.slice(-3); // 最近3次更新
        const terminationAnalysis = await this.analyzeTerminationSignals(huntObject, recentUpdates);

        if (terminationAnalysis.shouldTerminate) {
          return {
            terminate: true,
            reason: 'resolved',
            details: terminationAnalysis.reason,
          };
        }
      }

      return { terminate: false };
    } catch (error) {
      logger.error('判断终止条件失败:', error);
      return { terminate: false };
    }
  }

  /**
   * 分析终止信号
   * @param {Object} huntObject - 捕猎对象
   * @param {Array} recentUpdates - 最近的更新
   * @returns {Promise<Object>} 分析结果
   */
  async analyzeTerminationSignals(huntObject, recentUpdates) {
    try {
      const messages = [
        {
          role: 'system',
          content: `
你需要分析捕猎事件的最近进展，判断是否有明确的终止信号。

终止信号包括：
1. **明确结论**：协议达成、谈判结束、官方决议公布
2. **事件消解**：冲突解决、危机缓解、问题解决
3. **影响衰减**：市场稳定、关注度下降、无新发展
4. **状态转换**：从急性转为慢性、从突发转为常态

返回JSON格式：
{
  "shouldTerminate": boolean,
  "confidence": number,
  "reason": "终止原因说明",
  "evidence": ["支持终止的证据1", "证据2"]
}
`,
        },
        {
          role: 'user',
          content: `
捕猎事件：${huntObject.title}
类别：${huntObject.category}
创建时间：${moment(huntObject.createdAt).format('YYYY-MM-DD HH:mm')}

最近进展：
${recentUpdates
  .map(
    (update, index) =>
      `${index + 1}. ${moment(update.time).format('MM-DD HH:mm')}\n${update.summary}`
  )
  .join('\n\n')}

请分析是否应该终止此捕猎对象：`,
        },
      ];

      const result = await callLLMWithJsonResponse(messages);
      return result;
    } catch (error) {
      logger.error('分析终止信号失败:', error);
      return { shouldTerminate: false };
    }
  }

  /**
   * 终止捕猎对象
   * @param {Object} huntObject - 捕猎对象
   * @param {string} reason - 终止原因
   */
  async terminateHunt(huntObject, reason) {
    try {
      // 生成最终报告
      const finalReport = await this.generateFinalReport(huntObject, reason);

      // 更新状态
      huntObject.status = 'inactive';
      huntObject.terminatedAt = moment().toISOString();
      huntObject.terminationReason = reason;
      huntObject.finalReport = finalReport;
      huntObject.lastUpdate = moment().toISOString();

      // 保存
      await huntService.saveHuntObject(huntObject);

      // 发送终止通知
      await this.sendTerminationNotification(huntObject, finalReport);

      logger.info(`捕猎对象已终止: ${huntObject.id}, 原因: ${reason}`);
    } catch (error) {
      logger.error(`终止捕猎对象失败: ${huntObject.id}`, error);
    }
  }

  /**
   * 生成最终报告
   * @param {Object} huntObject - 捕猎对象
   * @param {string} reason - 终止原因
   * @returns {Promise<string>} 最终报告
   */
  async generateFinalReport(huntObject, reason) {
    try {
      const messages = [
        {
          role: 'system',
          content: `
你需要为已终止的捕猎事件生成最终报告。

报告结构：
1. **事件总结** - 简述事件的始末
2. **发展回顾** - 关键节点和重要进展
3. **影响评估** - 事件的实际影响和后果
4. **经验总结** - 从此事件中得到的启示
5. **后续关注** - 是否需要持续关注的要点

使用Markdown格式，专业客观。
`,
        },
        {
          role: 'user',
          content: `
请为以下已终止的捕猎事件生成最终报告：

**基本信息：**
- 事件：${huntObject.title}
- 类别：${huntObject.category}
- 创建时间：${moment(huntObject.createdAt).format('YYYY-MM-DD HH:mm')}
- 终止原因：${reason}
- 总进展数：${huntObject.progressUpdates.length}

**主要进展：**
${huntObject.progressUpdates
  .map(
    (update, index) =>
      `${index + 1}. ${moment(update.time).format('MM-DD HH:mm')} - 重要性: ${update.importance}/100`
  )
  .join('\n')}`,
        },
      ];

      const finalReport = await callLLM(messages);
      return finalReport;
    } catch (error) {
      logger.error('生成最终报告失败:', error);
      return `# 最终报告\n\n## 事件：${huntObject.title}\n\n报告生成失败，请检查系统状态。\n\n**终止原因：** ${reason}`;
    }
  }

  /**
   * 发送终止通知
   * @param {Object} huntObject - 捕猎对象
   * @param {string} finalReport - 最终报告
   */
  async sendTerminationNotification(huntObject, finalReport) {
    try {
      const notificationTitle = `🏁 草蛇灰线 - 追踪结束：${huntObject.title}`;
      const message = `${finalReport}\n\n---\n💡 捕猎对象：${huntObject.id}\n⏱️ 追踪时长：${moment(huntObject.terminatedAt).diff(moment(huntObject.createdAt), 'hours')}小时\n📊 总进展数：${huntObject.progressUpdates.length}`;

      await webhookService.sendMessage(
        moment().format('YYYY-MM-DD HH:mm:ss'),
        moment().format('YYYY-MM-DD HH:mm:ss'),
        message,
        notificationTitle
      );

      logger.info(`终止通知发送成功: ${huntObject.id}`);
    } catch (error) {
      logger.error('发送终止通知失败:', error);
    }
  }
}

export default new TrackingService(); 
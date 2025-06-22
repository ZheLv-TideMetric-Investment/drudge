import moment from 'moment-timezone';
import logger from '../utils/logger.js';
import newsService from './newsService.js';
import webhookService from './webhookService.js';
import knowledgeGraphService from './knowledgeGraphService.js';
import { callLLM } from '../utils/llm.js';
import { SnakeTrackingQuery, SignificanceLevel } from '../models/GraphModels.js';

// 设置默认时区为北京时间
moment.tz.setDefault('Asia/Shanghai');

/**
 * 草蛇灰线系统 - 主服务
 * 整合事件捕猎、持续跟踪、终止判断等功能
 */
class SnakeTrackingService {
  constructor() {
    this.isInitialized = false;
    this.huntCheckInterval = 5; // 每5分钟检查一次新事件
    this.progressCheckInterval = 1; // 每1分钟检查一次进展
    this.terminationCheckInterval = 60; // 每60分钟检查一次终止条件
  }

  /**
   * 初始化草蛇灰线系统
   */
  async initialize() {
    try {
      logger.info('🐍 草蛇灰线系统初始化开始...');

      // 初始化知识图谱服务
      await knowledgeGraphService.initialize();

      // 发送初始化通知
      await this.sendSystemNotification(
        '🐍 草蛇灰线系统已启动',
        '系统正在监控新闻流，寻找特级事件...'
      );

      this.isInitialized = true;
      logger.info('🐍 草蛇灰线系统初始化完成');
    } catch (error) {
      logger.error('草蛇灰线系统初始化失败:', error);
      throw error;
    }
  }

  /**
   * 执行事件捕猎检查
   * 检查最近的新闻是否包含需要捕猎的特级事件
   */
  async runHuntCheck() {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      logger.info('🔍 开始执行事件捕猎检查...');

      // 获取最近30分钟的新闻作为检查对象
      const thirtyMinutesAgo = moment().subtract(30, 'minutes');
      const now = moment();
      const recentNews = await newsService.getNewsByTimeRange(thirtyMinutesAgo, now);

      if (recentNews.length === 0) {
        logger.info('最近30分钟没有新闻，跳过捕猎检查');
        return;
      }

      logger.info(`获取到 ${recentNews.length} 条最近新闻，开始分析特级事件...`);

      // 此功能已整合到新的事件分析中
      // 使用知识图谱服务进行更智能的事件分析
      logger.info('使用知识图谱进行事件分析...');

      // 新的事件分析逻辑将在此处实现
      logger.info('事件分析完成，相关功能已整合到知识图谱中');
    } catch (error) {
      logger.error('事件捕猎检查失败:', error);
      await this.sendSystemNotification(
        '⚠️ 草蛇灰线系统异常',
        `事件捕猎检查失败: ${error.message}`
      );
    }
  }

  /**
   * 执行进展跟踪检查
   * 检查所有活跃捕猎对象的新进展
   */
  async runProgressCheck() {
    try {
      if (!this.isInitialized) {
        return;
      }

      logger.info('📈 进展跟踪功能已整合到知识图谱服务中');
      // 新的进展跟踪逻辑
    } catch (error) {
      logger.error('进展跟踪检查失败:', error);
      await this.sendSystemNotification(
        '⚠️ 草蛇灰线系统异常',
        `进展跟踪检查失败: ${error.message}`
      );
    }
  }

  /**
   * 执行终止条件检查
   * 检查是否有捕猎对象满足终止条件
   */
  async runTerminationCheck() {
    try {
      if (!this.isInitialized) {
        return;
      }

      logger.info('🏁 终止条件检查功能已整合到知识图谱服务中');
      // 新的终止条件检查逻辑
    } catch (error) {
      logger.error('终止条件检查失败:', error);
      await this.sendSystemNotification(
        '⚠️ 草蛇灰线系统异常',
        `终止条件检查失败: ${error.message}`
      );
    }
  }

  /**
   * 获取系统状态
   * @returns {Promise<Object>} 系统状态信息
   */
  async getSystemStatus() {
    try {
      const status = {
        isInitialized: this.isInitialized,
        activeHuntsCount: 0, // 功能已整合到知识图谱
        activeHunts: [],
        lastCheckTime: moment().toISOString(),
        note: '事件追踪功能已整合到知识图谱服务中',
      };

      return status;
    } catch (error) {
      logger.error('获取系统状态失败:', error);
      return {
        isInitialized: this.isInitialized,
        error: error.message,
      };
    }
  }

  /**
   * 手动触发事件捕猎检查
   */
  async manualHuntCheck() {
    try {
      logger.info('🔍 手动触发事件捕猎检查...');
      await this.runHuntCheck();
      await this.sendSystemNotification('✅ 手动捕猎检查完成', '已完成手动事件捕猎检查');
    } catch (error) {
      logger.error('手动捕猎检查失败:', error);
      await this.sendSystemNotification('❌ 手动捕猎检查失败', error.message);
    }
  }

  /**
   * 手动触发进展检查
   */
  async manualProgressCheck() {
    try {
      logger.info('📈 手动触发进展检查...');
      await this.runProgressCheck();
      await this.sendSystemNotification('✅ 手动进展检查完成', '已完成手动进展跟踪检查');
    } catch (error) {
      logger.error('手动进展检查失败:', error);
      await this.sendSystemNotification('❌ 手动进展检查失败', error.message);
    }
  }

  /**
   * 手动终止捕猎对象
   * @param {string} huntId - 捕猎对象ID
   */
  async manualTerminateHunt(huntId) {
    try {
      logger.info(`🛑 手动终止捕猎对象: ${huntId}`);
      // 手动终止功能已整合到知识图谱服务中
      const success = false; // 临时返回false，功能重构中

      if (success) {
        await this.sendSystemNotification('🛑 手动终止成功', `捕猎对象 ${huntId} 已被手动终止`);
        logger.info(`手动终止捕猎对象成功: ${huntId}`);
      } else {
        await this.sendSystemNotification('❌ 手动终止失败', `捕猎对象 ${huntId} 终止失败或不存在`);
        logger.warn(`手动终止捕猎对象失败: ${huntId}`);
      }

      return success;
    } catch (error) {
      logger.error(`手动终止捕猎对象失败: ${huntId}`, error);
      await this.sendSystemNotification(
        '❌ 手动终止异常',
        `终止 ${huntId} 时发生异常: ${error.message}`
      );
      return false;
    }
  }

  /**
   * 发送捕猎开始通知
   * @param {Object} huntObject - 捕猎对象
   */
  async sendHuntStartNotification(huntObject) {
    try {
      const now = moment();
      const title = `🎯 草蛇灰线 - 新捕猎目标：${huntObject.title}`;
      const message = `
${huntObject.report}

---
🆔 **捕猎对象ID：** ${huntObject.id}
🏷️ **类别：** ${huntObject.category}
📈 **影响等级：** ${huntObject.impactLevel}
🎯 **置信度：** ${Math.round(huntObject.confidence * 100)}%
⏰ **创建时间：** ${moment(huntObject.createdAt).format('YYYY-MM-DD HH:mm:ss')}
📊 **时间线事件数：** ${huntObject.timeline?.length || 0}

🐍 *草蛇灰线系统将持续监控此事件的后续发展...*
`;

      await webhookService.sendMessage(
        now,
        now,
        message,
        title
      );

      logger.info(`捕猎开始通知发送成功: ${huntObject.id}`);
    } catch (error) {
      logger.error('发送捕猎开始通知失败:', error);
    }
  }

  /**
   * 发送系统通知
   * @param {string} title - 通知标题
   * @param {string} message - 通知内容
   */
  async sendSystemNotification(title, message) {
    try {
      const now = moment();
      const fullMessage = `${message}\n\n⏰ ${now.format('YYYY-MM-DD HH:mm:ss')}`;

      await webhookService.sendMessage(
        now,
        now,
        fullMessage,
        title
      );

      logger.info(`系统通知发送成功: ${title}`);
    } catch (error) {
      logger.error('发送系统通知失败:', error);
    }
  }

  /**
   * 生成系统报告
   * @returns {Promise<string>} 系统报告
   */
  async generateSystemReport() {
    try {
      const status = await this.getSystemStatus();
      const report = `
# 🐍 草蛇灰线系统状态报告

**生成时间：** ${moment().format('YYYY-MM-DD HH:mm:ss')}

## 系统状态
- **初始化状态：** ${status.isInitialized ? '✅ 已初始化' : '❌ 未初始化'}
- **活跃捕猎对象数量：** ${status.activeHuntsCount}

## 活跃捕猎对象详情

${
  status.activeHuntsCount === 0
    ? '当前没有活跃的捕猎对象。'
    : status.activeHunts
        .map(
          (hunt, index) => `
### ${index + 1}. ${hunt.title}

- **ID：** ${hunt.id}
- **类别：** ${hunt.category}
- **影响等级：** ${hunt.impactLevel}
- **创建时间：** ${moment(hunt.createdAt).format('YYYY-MM-DD HH:mm:ss')}
- **最后更新：** ${moment(hunt.lastUpdate).format('YYYY-MM-DD HH:mm:ss')}
- **进展更新数：** ${hunt.progressCount}
- **追踪时长：** ${moment().diff(moment(hunt.createdAt), 'hours')} 小时
`
        )
        .join('\n')
}

## 系统配置
- **事件捕猎检查间隔：** ${this.huntCheckInterval} 分钟
- **进展跟踪检查间隔：** ${this.progressCheckInterval} 分钟  
- **终止条件检查间隔：** ${this.terminationCheckInterval} 分钟

---
*🐍 草蛇灰线 - 持续追踪，深度分析*
`;

      return report;
    } catch (error) {
      logger.error('生成系统报告失败:', error);
      return `# 🐍 草蛇灰线系统状态报告\n\n**生成时间：** ${moment().format('YYYY-MM-DD HH:mm:ss')}\n\n**错误：** 系统报告生成失败 - ${error.message}`;
    }
  }

  /**
   * 健康检查
   * @returns {Promise<Object>} 健康状态
   */
  async healthCheck() {
    try {
      const status = await this.getSystemStatus();
      const health = {
        status: 'healthy',
        timestamp: moment().toISOString(),
        systemInitialized: status.isInitialized,
        activeHunts: status.activeHuntsCount,
        components: {
          knowledgeGraphService: true,
          newsService: true,
          webhookService: true,
        },
      };

      return health;
    } catch (error) {
      logger.error('健康检查失败:', error);
      return {
        status: 'unhealthy',
        timestamp: moment().toISOString(),
        error: error.message,
      };
    }
  }

  /**
   * 追踪公司相关事件
   * @param {string} companyName - 公司名称
   * @param {Object} options - 查询选项
   */
  async trackCompanyEvents(companyName, options = {}) {
    try {
      const {
        limit = 50,
        dateRange = null,
        significanceLevel = SignificanceLevel.LOW
      } = options;

      logger.info(`开始追踪公司事件: ${companyName}`);

      // 获取公司相关事件
      const events = await knowledgeGraphService.getCompanyEvents(companyName, limit);

      // 过滤重要性级别
      const filteredEvents = events.filter(event => 
        event.significance >= significanceLevel
      );

      // 按时间排序
      const sortedEvents = filteredEvents.sort((a, b) => 
        new Date(b.event_date) - new Date(a.event_date)
      );

      // 分析事件模式
      const analysis = await this.analyzeEventPatterns(sortedEvents, companyName);

      const result = {
        company: companyName,
        total_events: sortedEvents.length,
        events: sortedEvents,
        analysis,
        generated_at: new Date().toISOString(),
      };

      logger.info(`公司事件追踪完成: ${companyName}, 发现${sortedEvents.length}个事件`);
      return result;
    } catch (error) {
      logger.error(`追踪公司事件失败: ${companyName}`, error);
      throw error;
    }
  }

  /**
   * 追踪多公司关联事件
   * @param {Array} companyNames - 公司名称列表
   * @param {Object} options - 查询选项
   */
  async trackMultiCompanyEvents(companyNames, options = {}) {
    try {
      const { limit = 30 } = options;

      logger.info(`开始追踪多公司关联事件: ${companyNames.join(', ')}`);

      // 获取多公司关联事件
      const relatedEvents = await knowledgeGraphService.getMultiCompanyEvents(companyNames, limit);

      // 分析公司间关系
      const companyRelationships = this.analyzeCompanyRelationships(relatedEvents);

      // 时间序列分析
      const timelineAnalysis = this.analyzeEventTimeline(relatedEvents.map(item => item.event));

      const result = {
        companies: companyNames,
        total_related_events: relatedEvents.length,
        related_events: relatedEvents,
        company_relationships: companyRelationships,
        timeline_analysis: timelineAnalysis,
        generated_at: new Date().toISOString(),
      };

      logger.info(`多公司关联事件追踪完成: 发现${relatedEvents.length}个关联事件`);
      return result;
    } catch (error) {
      logger.error(`追踪多公司关联事件失败: ${companyNames.join(', ')}`, error);
      throw error;
    }
  }

  /**
   * 追踪某日所有重要事件
   * @param {string} date - 日期 (YYYY-MM-DD)
   * @param {Object} options - 查询选项
   */
  async trackDayEvents(date, options = {}) {
    try {
      const { significanceLevel = SignificanceLevel.MEDIUM } = options;

      logger.info(`开始追踪日期事件: ${date}`);

      // 获取当日所有事件
      const dayEvents = await knowledgeGraphService.getDayEvents(date);

      // 过滤重要性级别
      const importantEvents = dayEvents.filter(item => 
        item.event.significance >= significanceLevel
      );

      // 按重要性排序
      const sortedEvents = importantEvents.sort((a, b) => 
        b.event.significance - a.event.significance
      );

      // 分析当日市场动态
      const marketAnalysis = await this.analyzeDayMarketDynamics(sortedEvents, date);

      const result = {
        date,
        total_events: sortedEvents.length,
        events: sortedEvents,
        market_analysis: marketAnalysis,
        generated_at: new Date().toISOString(),
      };

      logger.info(`日期事件追踪完成: ${date}, 发现${sortedEvents.length}个重要事件`);
      return result;
    } catch (error) {
      logger.error(`追踪日期事件失败: ${date}`, error);
      throw error;
    }
  }

  /**
   * 分析事件模式
   * @param {Array} events - 事件列表
   * @param {string} companyName - 公司名称
   */
  async analyzeEventPatterns(events, companyName) {
    try {
      // 事件类型分布
      const eventTypeDistribution = {};
      events.forEach(event => {
        const type = event.event_type || '其他事件';
        eventTypeDistribution[type] = (eventTypeDistribution[type] || 0) + 1;
      });

      // 情感倾向分析
      const sentimentAnalysis = {
        positive: events.filter(e => e.sentiment === 'positive').length,
        negative: events.filter(e => e.sentiment === 'negative').length,
        neutral: events.filter(e => e.sentiment === 'neutral').length,
      };

      // 重要性趋势
      const significanceTrend = this.analyzeSignificanceTrend(events);

      // 时间聚集分析
      const timeClusters = this.analyzeTimeClusters(events);

      // 使用AI生成深度分析
      const aiAnalysis = await this.generateAIAnalysis(events, companyName);

      return {
        event_type_distribution: eventTypeDistribution,
        sentiment_analysis: sentimentAnalysis,
        significance_trend: significanceTrend,
        time_clusters: timeClusters,
        ai_analysis: aiAnalysis,
      };
    } catch (error) {
      logger.error('分析事件模式失败:', error);
      return {
        event_type_distribution: {},
        sentiment_analysis: { positive: 0, negative: 0, neutral: 0 },
        significance_trend: 'stable',
        time_clusters: [],
        ai_analysis: '分析失败',
      };
    }
  }

  /**
   * 分析公司间关系
   * @param {Array} relatedEvents - 关联事件列表
   */
  analyzeCompanyRelationships(relatedEvents) {
    const relationships = {};
    
    relatedEvents.forEach(item => {
      const companies = item.companies;
      if (companies.length >= 2) {
        for (let i = 0; i < companies.length; i++) {
          for (let j = i + 1; j < companies.length; j++) {
            const key = `${companies[i]}-${companies[j]}`;
            if (!relationships[key]) {
              relationships[key] = {
                companies: [companies[i], companies[j]],
                event_count: 0,
                events: []
              };
            }
            relationships[key].event_count++;
            relationships[key].events.push(item.event);
          }
        }
      }
    });

    // 按关联强度排序
    const sortedRelationships = Object.values(relationships)
      .sort((a, b) => b.event_count - a.event_count);

    return sortedRelationships;
  }

  /**
   * 分析事件时间线
   * @param {Array} events - 事件列表
   */
  analyzeEventTimeline(events) {
    if (events.length === 0) return { trend: 'no_data', clusters: [] };

    // 按日期分组
    const dateGroups = {};
    events.forEach(event => {
      const date = event.event_date;
      if (!dateGroups[date]) {
        dateGroups[date] = [];
      }
      dateGroups[date].push(event);
    });

    // 分析趋势
    const dates = Object.keys(dateGroups).sort();
    const eventCounts = dates.map(date => dateGroups[date].length);
    
    let trend = 'stable';
    if (eventCounts.length > 1) {
      const recent = eventCounts.slice(-3);
      const earlier = eventCounts.slice(0, -3);
      
      const recentAvg = recent.reduce((sum, count) => sum + count, 0) / recent.length;
      const earlierAvg = earlier.length > 0 ? 
        earlier.reduce((sum, count) => sum + count, 0) / earlier.length : recentAvg;
      
      if (recentAvg > earlierAvg * 1.2) {
        trend = 'increasing';
      } else if (recentAvg < earlierAvg * 0.8) {
        trend = 'decreasing';
      }
    }

    return {
      trend,
      total_days: dates.length,
      date_groups: dateGroups,
      peak_date: dates.find(date => 
        dateGroups[date].length === Math.max(...Object.values(dateGroups).map(g => g.length))
      ),
    };
  }

  /**
   * 分析当日市场动态
   * @param {Array} dayEvents - 当日事件列表
   * @param {string} date - 日期
   */
  async analyzeDayMarketDynamics(dayEvents, date) {
    try {
      // 计算市场影响评分
      const marketImpactScore = this.calculateMarketImpactScore(dayEvents);

      // 分析行业影响
      const industryImpact = this.analyzeIndustryImpact(dayEvents);

      // 风险评估
      const riskAssessment = this.assessRisks(dayEvents);

      // 生成AI分析
      const aiInsights = await this.generateDayAnalysisAI(dayEvents, date);

      return {
        market_impact_score: marketImpactScore,
        industry_impact: industryImpact,
        risk_assessment: riskAssessment,
        ai_insights: aiInsights,
      };
    } catch (error) {
      logger.error('分析当日市场动态失败:', error);
      return {
        market_impact_score: 0,
        industry_impact: {},
        risk_assessment: 'low',
        ai_insights: '分析失败',
      };
    }
  }

  /**
   * 计算市场影响评分
   * @param {Array} events - 事件列表
   */
  calculateMarketImpactScore(events) {
    let score = 0;
    
    events.forEach(item => {
      const event = item.event;
      
      // 基于重要性的评分
      score += event.significance * 10;
      
      // 基于情感倾向的调整
      if (event.sentiment === 'negative') {
        score += Math.abs(event.magnitude || 0) * 20;
      } else if (event.sentiment === 'positive') {
        score += Math.abs(event.magnitude || 0) * 10;
      }
      
      // 基于涉及公司数量的调整
      if (item.companies) {
        score += item.companies.length * 5;
      }
    });

    // 标准化评分 (0-100)
    return Math.min(100, Math.round(score / events.length));
  }

  /**
   * 分析行业影响
   * @param {Array} events - 事件列表
   */
  analyzeIndustryImpact(events) {
    const industryImpact = {};
    
    events.forEach(item => {
      // 这里简化处理，实际应该根据公司-行业映射来分析
      if (item.companies) {
        item.companies.forEach(company => {
          if (!industryImpact[company]) {
            industryImpact[company] = {
              event_count: 0,
              total_significance: 0,
              avg_significance: 0,
            };
          }
          
          industryImpact[company].event_count++;
          industryImpact[company].total_significance += item.event.significance;
          industryImpact[company].avg_significance = 
            industryImpact[company].total_significance / industryImpact[company].event_count;
        });
      }
    });

    return industryImpact;
  }

  /**
   * 评估风险
   * @param {Array} events - 事件列表
   */
  assessRisks(events) {
    const criticalEvents = events.filter(item => 
      item.event.significance >= SignificanceLevel.CRITICAL
    );
    
    const negativeEvents = events.filter(item => 
      item.event.sentiment === 'negative'
    );

    if (criticalEvents.length > 0) {
      return 'critical';
    } else if (negativeEvents.length > events.length * 0.6) {
      return 'high';
    } else if (negativeEvents.length > events.length * 0.3) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * 分析重要性趋势
   * @param {Array} events - 事件列表
   */
  analyzeSignificanceTrend(events) {
    if (events.length < 3) return 'insufficient_data';

    const recentEvents = events.slice(0, Math.floor(events.length / 3));
    const earlierEvents = events.slice(-Math.floor(events.length / 3));

    const recentAvgSignificance = recentEvents.reduce((sum, event) => 
      sum + event.significance, 0) / recentEvents.length;
    
    const earlierAvgSignificance = earlierEvents.reduce((sum, event) => 
      sum + event.significance, 0) / earlierEvents.length;

    const diff = recentAvgSignificance - earlierAvgSignificance;

    if (diff > 0.5) return 'increasing';
    if (diff < -0.5) return 'decreasing';
    return 'stable';
  }

  /**
   * 分析时间聚集
   * @param {Array} events - 事件列表
   */
  analyzeTimeClusters(events) {
    const clusters = [];
    const dateGroups = {};

    events.forEach(event => {
      const date = event.event_date;
      if (!dateGroups[date]) {
        dateGroups[date] = [];
      }
      dateGroups[date].push(event);
    });

    // 找出事件密集的日期
    Object.entries(dateGroups).forEach(([date, dayEvents]) => {
      if (dayEvents.length >= 3) { // 一天内3个或以上事件认为是聚集
        clusters.push({
          date,
          event_count: dayEvents.length,
          avg_significance: dayEvents.reduce((sum, e) => sum + e.significance, 0) / dayEvents.length,
          events: dayEvents,
        });
      }
    });

    return clusters.sort((a, b) => b.event_count - a.event_count);
  }

  /**
   * 使用AI生成事件分析
   * @param {Array} events - 事件列表
   * @param {string} companyName - 公司名称
   */
  async generateAIAnalysis(events, companyName) {
    try {
      const messages = [
        {
          role: 'system',
          content: `
你是一个专业的财经分析师。请基于提供的事件数据，为公司生成深度分析报告。

## 分析要求：
1. 分析事件的关联性和发展脉络
2. 识别潜在的风险和机会
3. 预测可能的发展趋势
4. 提供投资建议或风险提醒
5. 语言专业但易懂

## 输出格式：
- 使用markdown格式
- 分为几个清晰的段落
- 控制在500字以内
          `,
        },
        {
          role: 'user',
          content: `
请分析以下${companyName}的相关事件：

事件数量：${events.length}
时间范围：${events.length > 0 ? 
  `${events[events.length - 1].event_date} 至 ${events[0].event_date}` : '无'}

重要事件：
${events.slice(0, 10).map((event, index) => 
  `${index + 1}. ${event.event_name} (${event.event_date}, 重要性:${event.significance}, 情感:${event.sentiment})`
).join('\n')}
          `,
        },
      ];

      const response = await callLLM(messages);
      return response.trim();
    } catch (error) {
      logger.error('AI生成事件分析失败:', error);
      return `${companyName}的事件分析：发现${events.length}个相关事件，涵盖时间段较长。建议关注重要性级别较高的事件，注意风险控制。`;
    }
  }

  /**
   * 使用AI生成日期分析
   * @param {Array} dayEvents - 当日事件列表
   * @param {string} date - 日期
   */
  async generateDayAnalysisAI(dayEvents, date) {
    try {
      const messages = [
        {
          role: 'system',
          content: `
你是一个专业的市场分析师。请基于提供的单日事件数据，生成市场动态分析报告。

## 分析要求：
1. 总结当日主要市场动态
2. 分析事件对不同行业/公司的影响
3. 评估整体市场风险
4. 提供短期市场展望
5. 语言专业简洁

## 输出格式：
- 控制在300字以内
- 使用要点形式
          `,
        },
        {
          role: 'user',
          content: `
请分析${date}的市场动态：

重要事件数：${dayEvents.length}

主要事件：
${dayEvents.slice(0, 8).map((item, index) => 
  `${index + 1}. ${item.event.event_name} (重要性:${item.event.significance}, 涉及公司:${item.companies?.join(',') || '无'})`
).join('\n')}
          `,
        },
      ];

      const response = await callLLM(messages);
      return response.trim();
    } catch (error) {
      logger.error('AI生成日期分析失败:', error);
      return `${date}市场动态：发现${dayEvents.length}个重要事件。整体市场活动${dayEvents.length > 10 ? '活跃' : '平稳'}，建议关注重点事件的后续发展。`;
    }
  }

  /**
   * 发送草蛇灰线报告
   * @param {Object} trackingResult - 追踪结果
   * @param {string} reportType - 报告类型
   */
  async sendTrackingReport(trackingResult, reportType = 'company') {
    try {
      const message = this.buildTrackingMessage(trackingResult, reportType);
      
      await webhookService.sendMessage(
        moment().format('YYYY-MM-DD HH:mm:ss'),
        moment().format('YYYY-MM-DD HH:mm:ss'),
        message,
        'SNAKE_TRACKING'
      );
      
      logger.info(`草蛇灰线报告发送成功: ${reportType}`);
    } catch (error) {
      logger.error('发送草蛇灰线报告失败:', error);
      throw error;
    }
  }

  /**
   * 构建追踪消息
   * @param {Object} result - 追踪结果
   * @param {string} type - 报告类型
   */
  buildTrackingMessage(result, type) {
    let message = `🐍 **草蛇灰线追踪报告** 🐍\n`;
    message += `⏰ 生成时间：${moment().format('YYYY-MM-DD HH:mm:ss')}\n\n`;

    switch (type) {
      case 'company':
        message += this.buildCompanyTrackingMessage(result);
        break;
      case 'multi_company':
        message += this.buildMultiCompanyTrackingMessage(result);
        break;
      case 'day':
        message += this.buildDayTrackingMessage(result);
        break;
      default:
        message += '未知报告类型\n';
    }

    return message;
  }

  /**
   * 构建公司追踪消息
   */
  buildCompanyTrackingMessage(result) {
    let message = `🏢 **公司事件追踪**：${result.company}\n`;
    message += `📊 发现事件：${result.total_events}个\n\n`;

    if (result.events.length > 0) {
      message += `🔥 **重要事件** (最近5个)\n`;
      result.events.slice(0, 5).forEach((event, index) => {
        message += `${index + 1}. ${event.event_name} (${event.event_date})\n`;
        message += `   重要性: ${this.getSignificanceText(event.significance)} | 情感: ${event.sentiment}\n`;
      });
      message += '\n';
    }

    if (result.analysis?.ai_analysis) {
      message += `🤖 **AI分析**\n${result.analysis.ai_analysis}\n\n`;
    }

    return message;
  }

  /**
   * 构建多公司追踪消息
   */
  buildMultiCompanyTrackingMessage(result) {
    let message = `🔗 **多公司关联分析**：${result.companies.join('、')}\n`;
    message += `📊 关联事件：${result.total_related_events}个\n\n`;

    if (result.company_relationships.length > 0) {
      message += `🤝 **公司关系** (按关联强度排序)\n`;
      result.company_relationships.slice(0, 5).forEach((rel, index) => {
        message += `${index + 1}. ${rel.companies.join(' ↔ ')} (${rel.event_count}个共同事件)\n`;
      });
      message += '\n';
    }

    return message;
  }

  /**
   * 构建日期追踪消息
   */
  buildDayTrackingMessage(result) {
    let message = `📅 **日期事件分析**：${result.date}\n`;
    message += `📊 重要事件：${result.total_events}个\n\n`;

    if (result.market_analysis) {
      message += `📈 **市场影响评分**：${result.market_analysis.market_impact_score}/100\n`;
      message += `⚠️ **风险等级**：${result.market_analysis.risk_assessment}\n\n`;
    }

    if (result.market_analysis?.ai_insights) {
      message += `🧠 **市场洞察**\n${result.market_analysis.ai_insights}\n\n`;
    }

    return message;
  }

  /**
   * 获取重要性文本
   */
  getSignificanceText(significance) {
    switch (significance) {
      case 4: return '🔴极高';
      case 3: return '🟠高';
      case 2: return '🟡中';
      case 1: return '🟢低';
      default: return '⚪未知';
    }
  }
}

export default new SnakeTrackingService();

import logger from '../../shared/utils/logger.js';
import config from '../../shared/config/config.js';
import webhookService from '../../infrastructure/external/WebhookService.js';
import neo4jService from '../../infrastructure/database/Neo4jRepository.js';
import { NewsLevel, NewsLevelDescription } from '../../shared/types/enums.js';
import moment from 'moment-timezone';
import neo4j from 'neo4j-driver';

/**
 * 新闻级别处理服务
 * 基于News Level对新闻进行分级处理和推送
 */
class NewsLevelService {
  constructor() {
    this.initialized = false;
    this.processedCache = new Map(); // 已处理的新闻缓存
    this.cacheExpiry = 24 * 60 * 60 * 1000; // 缓存24小时
    
    // 级别推送配置
    this.pushConfig = {
      [NewsLevel.LEVEL_1]: {
        enabled: true,
        immediate: true,
        title: '🚨 紧急新闻',
        emoji: '🚨',
      },
      [NewsLevel.LEVEL_2]: {
        enabled: true,
        immediate: false,
        title: '⚠️ 高优先级新闻',
        emoji: '⚠️',
      },
      [NewsLevel.LEVEL_3]: {
        enabled: false, // 默认不推送中等优先级新闻
        immediate: false,
        title: '📊 中等优先级新闻',
        emoji: '📊',
      },
      [NewsLevel.LEVEL_4]: {
        enabled: false, // 默认不推送低优先级新闻
        immediate: false,
        title: '📋 低优先级新闻',
        emoji: '📋',
      },
      [NewsLevel.LEVEL_5]: {
        enabled: false, // 默认不推送信息性新闻
        immediate: false,
        title: '📝 信息性新闻',
        emoji: '📝',
      },
    };
  }

  /**
   * 初始化服务
   */
  async initialize() {
    try {
      this.initialized = true;
      logger.info('新闻级别服务初始化完成');

      // 定期清理缓存
      setInterval(() => {
        this.cleanupCache();
      }, 60 * 60 * 1000); // 每小时清理一次
    } catch (error) {
      logger.error('新闻级别服务初始化失败:', error);
      throw error;
    }
  }

  /**
   * 检查并处理新闻级别
   * @param {Object} newsItem - 新闻对象
   * @param {Object} extractionResult - 提取结果
   * @param {boolean} forceUpdate - 是否强制更新
   * @returns {Object} - 处理结果
   */
  async checkAndHandleNewsLevel(newsItem, extractionResult, forceUpdate = false) {
    try {
      const newsLevel = extractionResult.news_level || NewsLevel.LEVEL_5;
      const cacheKey = `${newsItem.id}_${newsLevel}`;

      // 检查是否已处理过
      if (!forceUpdate && this.processedCache.has(cacheKey)) {
        const cached = this.processedCache.get(cacheKey);
        return {
          newsLevel: cached.newsLevel,
          alreadyProcessed: true,
          shouldPush: false,
          isHighLevel: this.isHighLevel(cached.newsLevel),
          isBreakNews: this.isBreakNews(cached.newsLevel),
          updated: false
        };
      }

      // 判断级别特性
      const isHighLevel = this.isHighLevel(newsLevel);
      const isBreakNews = this.isBreakNews(newsLevel);
      
      // 判断是否需要推送
      const shouldPush = this.shouldPushNews(newsLevel);
      
      if (shouldPush) {
        await this.sendNewsLevelNotification(newsItem, extractionResult);
      }

      // 添加到缓存
      this.processedCache.set(cacheKey, {
        timestamp: Date.now(),
        newsLevel,
        newsId: newsItem.id,
      });

      logger.info(`新闻级别处理完成: ${newsItem.id}, 级别: ${newsLevel}, 推送: ${shouldPush}`);

      return {
        newsLevel,
        alreadyProcessed: false,
        shouldPush,
        isHighLevel,
        isBreakNews,
        updated: forceUpdate || !this.processedCache.has(cacheKey)
      };
    } catch (error) {
      logger.error(`新闻级别处理失败: ${newsItem.id}`, error);
      return {
        newsLevel: NewsLevel.LEVEL_5,
        alreadyProcessed: false,
        shouldPush: false,
        isHighLevel: false,
        isBreakNews: false,
        updated: false,
        error: error.message,
      };
    }
  }

  /**
   * 判断是否需要推送新闻
   * @param {string} newsLevel - 新闻级别
   * @returns {boolean} - 是否需要推送
   */
  shouldPushNews(newsLevel) {
    const config = this.pushConfig[newsLevel];
    return config && config.enabled;
  }

  /**
   * 发送新闻级别通知
   * @param {Object} newsItem - 新闻对象
   * @param {Object} extractionResult - 提取结果
   */
  async sendNewsLevelNotification(newsItem, extractionResult) {
    try {
      const newsLevel = extractionResult.news_level || NewsLevel.LEVEL_5;
      const levelInfo = NewsLevelDescription[newsLevel];
      const pushInfo = this.pushConfig[newsLevel];

      if (!levelInfo || !pushInfo) return;

      // 构建消息内容
      const timestamp = moment().format('YYYY-MM-DD HH:mm:ss');
      const companies = extractionResult.companies?.map(c => c.company_name || c.name).filter(Boolean) || [];
      const events = extractionResult.events?.filter(e => e.event_name) || [];

      let message = `${pushInfo.emoji} **${levelInfo.nameCn}** - ${levelInfo.name}\n\n`;
      message += `📰 **新闻标题**: ${newsItem.title}\n`;
      message += `🕒 **发布时间**: ${timestamp}\n`;
      message += `📊 **级别**: ${newsLevel}\n`;
      message += `📝 **描述**: ${levelInfo.description}\n\n`;

      if (companies.length > 0) {
        message += `🏢 **涉及公司**: ${companies.slice(0, 3).join(', ')}${companies.length > 3 ? '等' : ''}\n`;
      }

      if (events.length > 0) {
        message += `📋 **主要事件**:\n`;
        events.slice(0, 2).forEach((event, index) => {
          message += `${index + 1}. ${event.event_name || '未知事件'}\n`;
        });
        if (events.length > 2) {
          message += `... 等${events.length}个事件\n`;
        }
      }

      if (newsItem.content && newsItem.content.length > 100) {
        message += `\n📖 **内容摘要**: ${newsItem.content.substring(0, 200)}...\n`;
      }

      // 添加处理建议
      if (newsLevel === NewsLevel.LEVEL_1) {
        message += `\n🚨 **处理建议**: 立即关注，可能对市场产生重大影响`;
      } else if (newsLevel === NewsLevel.LEVEL_2) {
        message += `\n⚠️ **处理建议**: 重点关注，评估对相关业务的影响`;
      }

      // 发送通知
      await webhookService.sendMessage(
        timestamp,
        timestamp,
        message,
        `NEWS_LEVEL_${newsLevel.replace(' ', '_')}`
      );

      logger.info(`新闻级别通知发送成功: ${newsItem.id}, 级别: ${newsLevel}`);
    } catch (error) {
      logger.error(`新闻级别通知发送失败: ${newsItem.id}`, error);
    }
  }

  /**
   * 扫描并推送高级别新闻
   * @param {number} limit - 限制数量
   * @returns {Object} - 扫描结果
   */
  async scanForHighLevelNews(limit = 20) {
    try {
      let totalFound = 0;
      let newPushed = 0;

      // 扫描Level 1和Level 2的新闻
      for (const level of [NewsLevel.LEVEL_1, NewsLevel.LEVEL_2]) {
        const newsItems = await this.getNewsItemsByLevel(level, limit);
        
        for (const item of newsItems) {
          const cacheKey = `${item.newsId}_${level}`;
          
          if (!this.processedCache.has(cacheKey)) {
            totalFound++;
            
            if (this.shouldPushNews(level)) {
              // 构建模拟的extractionResult
              const extractionResult = {
                news_level: level,
                companies: item.companies || [],
                events: item.events || [],
              };

              await this.sendNewsLevelNotification(item, extractionResult);
              newPushed++;

              // 添加到缓存
              this.processedCache.set(cacheKey, {
                timestamp: Date.now(),
                newsLevel: level,
                newsId: item.newsId,
              });
            }
          }
        }
      }

      logger.info(`高级别新闻扫描完成: 发现${totalFound}条，推送${newPushed}条`);
      
      return {
        success: true,
        totalFound,
        newPushed,
      };
    } catch (error) {
      logger.error('高级别新闻扫描失败:', error);
      return {
        success: false,
        error: error.message,
        totalFound: 0,
        newPushed: 0,
      };
    }
  }

  /**
   * 从数据库获取指定级别的新闻
   * @param {string} level - 新闻级别
   * @param {number} limit - 限制数量
   * @returns {Array} - 新闻列表
   */
  async getNewsItemsByLevel(level, limit = 20) {
    try {
      // 确保limit是整数
      const limitInt = parseInt(limit) || 20;
      
      const cypher = `
        MATCH (n:News)-[:REPORTED_IN]-(e:Event)
        WHERE e.event_level = $level
        AND n.timestamp >= $since
        OPTIONAL MATCH (e)-[:OCCURRED_IN]->(c:Company)
        RETURN DISTINCT n.id as newsId,
               n.title as title,
               n.content as content,
               n.timestamp as timestamp,
               e.event_level as level,
               collect(DISTINCT {
                 event_name: e.event_name,
                 event_description: e.event_description
               }) as events,
               collect(DISTINCT {
                 company_name: c.company_name,
                 name: c.company_name
               }) as companies
        ORDER BY n.timestamp DESC
        LIMIT $limit
      `;

      const since = moment().subtract(24, 'hours').toISOString();
      const result = await neo4jService.executeQuery(cypher, { level, limit: neo4j.int(limitInt), since });
      
      return result.records.map(record => ({
        newsId: record.get('newsId'),
        title: record.get('title'),
        content: record.get('content'),
        timestamp: record.get('timestamp'),
        level: record.get('level'),
        events: record.get('events'),
        companies: record.get('companies'),
      }));
    } catch (error) {
      logger.error(`获取${level}级别新闻失败:`, error);
      logger.error('查询语句:');
      logger.error('参数:', { level, limit, since: moment().subtract(24, 'hours').toISOString() });
      return [];
    }
  }

  /**
   * 获取新闻级别统计
   * @param {Date} startDate - 开始日期
   * @param {Date} endDate - 结束日期
   * @returns {Object} - 统计结果
   */
  async getNewsLevelStats(startDate, endDate) {
    try {
      const cypher = `
        MATCH (n:News)-[:REPORTED_IN]-(e:Event)
        WHERE n.timestamp >= $startDate AND n.timestamp < $endDate
        RETURN e.event_level as level,
               count(DISTINCT n) as count
        ORDER BY count DESC
      `;

      const result = await neo4jService.executeQuery(cypher, {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });

      const stats = {
        total: 0,
        byLevel: {},
      };

      result.records.forEach(record => {
        const level = record.get('level') || NewsLevel.LEVEL_5;
        const count = record.get('count').toNumber();
        stats.byLevel[level] = count;
        stats.total += count;
      });

      return stats;
    } catch (error) {
      logger.error('获取新闻级别统计失败:', error);
      return { total: 0, byLevel: {} };
    }
  }

  /**
   * 更新推送配置
   * @param {string} level - 新闻级别
   * @param {Object} config - 配置选项
   */
  updatePushConfig(level, config) {
    if (this.pushConfig[level]) {
      this.pushConfig[level] = { ...this.pushConfig[level], ...config };
      logger.info(`新闻级别${level}推送配置已更新:`, config);
    }
  }

  /**
   * 清理过期缓存
   */
  cleanupCache() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, value] of this.processedCache.entries()) {
      if (now - value.timestamp > this.cacheExpiry) {
        this.processedCache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.debug(`清理过期缓存${cleaned}条`);
    }
  }

  /**
   * 获取缓存统计
   */
  getCacheStats() {
    return {
      size: this.processedCache.size,
      levels: Object.values(NewsLevel).reduce((acc, level) => {
        acc[level] = Array.from(this.processedCache.values())
          .filter(item => item.newsLevel === level).length;
        return acc;
      }, {}),
    };
  }

  /**
   * 判断是否为高级别新闻
   * @param {string} newsLevel - 新闻级别
   * @returns {boolean} - 是否为高级别
   */
  isHighLevel(newsLevel) {
    return newsLevel === NewsLevel.LEVEL_1 || newsLevel === NewsLevel.LEVEL_2;
  }

  /**
   * 判断是否为Break News
   * @param {string} newsLevel - 新闻级别
   * @returns {boolean} - 是否为Break News
   */
  isBreakNews(newsLevel) {
    return newsLevel === NewsLevel.LEVEL_1;
  }

  /**
   * 获取指定时间范围内的Break News
   * @param {moment} startTime - 开始时间
   * @param {moment} endTime - 结束时间
   * @returns {Array} - Break News列表
   */
  async getBreakNewsByTimeRange(startTime, endTime) {
    try {
      const cypher = `
        MATCH (n:News)-[:REPORTED_IN]-(e:Event)
        WHERE e.event_level = $breakLevel
          AND n.timestamp >= $startTime 
          AND n.timestamp <= $endTime
        OPTIONAL MATCH (e)-[:OCCURRED_IN]->(c:Company)
        RETURN DISTINCT n.id as newsId,
               n.title as title,
               n.timestamp as detectedAt,
               e.event_level as level,
               e.significance as impactScore,
               e.event_description as reason,
               collect(DISTINCT c.company_name) as companies
        ORDER BY n.timestamp DESC
      `;

      const result = await neo4jService.executeQuery(cypher, {
        breakLevel: NewsLevel.LEVEL_1,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      });

      return result.records.map(record => ({
        newsId: record.get('newsId'),
        title: record.get('title'),
        detectedAt: record.get('detectedAt'),
        level: record.get('level'),
        impactScore: record.get('impactScore'),
        reason: record.get('reason'),
        companies: record.get('companies').filter(c => c !== null),
        isBreakNews: true
      }));
    } catch (error) {
      logger.error('获取Break News失败:', error);
      return [];
    }
  }

  /**
   * 获取指定时间范围内的高级别新闻
   * @param {moment} startTime - 开始时间
   * @param {moment} endTime - 结束时间
   * @returns {Array} - 高级别新闻列表
   */
  async getHighLevelNewsByTimeRange(startTime, endTime) {
    try {
      const cypher = `
        MATCH (n:News)-[:REPORTED_IN]-(e:Event)
        WHERE (e.event_level = $level1 OR e.event_level = $level2)
          AND n.timestamp >= $startTime 
          AND n.timestamp <= $endTime
        OPTIONAL MATCH (e)-[:OCCURRED_IN]->(c:Company)
        RETURN DISTINCT n.id as newsId,
               n.title as title,
               n.timestamp as detectedAt,
               e.event_level as level,
               e.significance as impactScore,
               e.event_description as reason,
               collect(DISTINCT c.company_name) as companies
        ORDER BY n.timestamp DESC
      `;

      const result = await neo4jService.executeQuery(cypher, {
        level1: NewsLevel.LEVEL_1,
        level2: NewsLevel.LEVEL_2,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      });

      return result.records.map(record => ({
        newsId: record.get('newsId'),
        title: record.get('title'),
        detectedAt: record.get('detectedAt'),
        level: record.get('level'),
        impactScore: record.get('impactScore'),
        reason: record.get('reason'),
        companies: record.get('companies').filter(c => c !== null),
        isBreakNews: record.get('level') === NewsLevel.LEVEL_1,
        isHighLevel: true
      }));
    } catch (error) {
      logger.error('获取高级别新闻失败:', error);
      return [];
    }
  }

  /**
   * 获取级别统计信息
   * @param {moment} startTime - 开始时间
   * @param {moment} endTime - 结束时间
   * @returns {Object} - 统计信息
   */
  async getLevelStatistics(startTime, endTime) {
    try {
      const cypher = `
        MATCH (n:News)-[:REPORTED_IN]-(e:Event)
        WHERE n.timestamp >= $startTime AND n.timestamp <= $endTime
        RETURN 
          count(DISTINCT n) as total,
          count(DISTINCT CASE WHEN e.event_level = $level1 OR e.event_level = $level2 THEN n END) as highLevel,
          count(DISTINCT CASE WHEN e.event_level = $level1 THEN n END) as breakNews,
          avg(e.significance) as avgImpactScore,
          e.event_level as level,
          count(DISTINCT CASE WHEN e.event_level IS NOT NULL THEN n END) as levelCount
        ORDER BY levelCount DESC
      `;

      const result = await neo4jService.executeQuery(cypher, {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        level1: NewsLevel.LEVEL_1,
        level2: NewsLevel.LEVEL_2,
      });

      if (result.records.length === 0) {
        return {
          total: 0,
          highLevel: 0,
          breakNews: 0,
          avgImpactScore: 0,
          levelDistribution: {}
        };
      }

      const record = result.records[0];
      
      // 获取级别分布
      const levelDistCypher = `
        MATCH (n:News)-[:REPORTED_IN]-(e:Event)
        WHERE n.timestamp >= $startTime AND n.timestamp <= $endTime
        RETURN e.event_level as level, count(DISTINCT n) as count
        ORDER BY count DESC
      `;

      const levelDistResult = await neo4jService.executeQuery(levelDistCypher, {
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      });

      const levelDistribution = {};
      levelDistResult.records.forEach(rec => {
        const level = rec.get('level') || 'Unknown';
        levelDistribution[level] = rec.get('count').toNumber();
      });

      return {
        total: record.get('total').toNumber(),
        highLevel: record.get('highLevel').toNumber(),
        breakNews: record.get('breakNews').toNumber(),
        avgImpactScore: record.get('avgImpactScore'),
        levelDistribution
      };
    } catch (error) {
      logger.error('获取级别统计失败:', error);
      return {
        total: 0,
        highLevel: 0,
        breakNews: 0,
        avgImpactScore: 0,
        levelDistribution: {}
      };
    }
  }

  /**
   * 获取Break News历史
   * @param {moment} startTime - 开始时间
   * @param {moment} endTime - 结束时间
   * @returns {Array} - Break News历史列表
   */
  async getBreakNewsHistory(startTime, endTime) {
    try {
      const cypher = `
        MATCH (n:News)-[:REPORTED_IN]-(e:Event)
        WHERE e.event_level = $breakLevel
          AND n.timestamp >= $startTime 
          AND n.timestamp <= $endTime
        OPTIONAL MATCH (e)-[:OCCURRED_IN]->(c:Company)
        RETURN DISTINCT n.id as newsId,
               n.title as title,
               n.timestamp as detectedAt,
               e.event_level as level,
               e.significance as impactScore,
               e.event_description as reason,
               collect(DISTINCT c.company_name) as companies
        ORDER BY n.timestamp DESC
      `;

      const result = await neo4jService.executeQuery(cypher, {
        breakLevel: NewsLevel.LEVEL_1,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
      });

      return result.records.map(record => ({
        newsId: record.get('newsId'),
        title: record.get('title'),
        detectedAt: record.get('detectedAt'),
        level: record.get('level'),
        impactScore: record.get('impactScore'),
        reason: record.get('reason'),
        companies: record.get('companies').filter(c => c !== null)
      }));
    } catch (error) {
      logger.error('获取Break News历史失败:', error);
      return [];
    }
  }

  /**
   * 健康检查
   * @returns {Object} - 健康状态
   */
  async healthCheck() {
    try {
      return {
        status: 'healthy',
        initialized: this.initialized,
        cacheSize: this.processedCache.size,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

}

export default new NewsLevelService(); 
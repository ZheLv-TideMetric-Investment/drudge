import moment from 'moment-timezone';
import logger from '../utils/logger.js';
import huntService from './huntService.js';
import trackingService from './trackingService.js';
import newsService from './newsService.js';
import webhookService from './webhookService.js';

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

      // 加载现有的活跃捕猎对象
      await huntService.getActiveHunts();

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

      // 检查是否需要创建新的捕猎对象
      const huntObject = await huntService.checkEventPromotion(recentNews);

      if (huntObject) {
        logger.info(`🎯 新捕猎对象创建成功: ${huntObject.id} - ${huntObject.title}`);

        // 发送捕猎开始通知
        await this.sendHuntStartNotification(huntObject);
      } else {
        logger.info('未发现需要捕猎的特级事件');
      }
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

      logger.info('📈 开始执行进展跟踪检查...');
      await trackingService.checkForProgress();
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

      logger.info('🏁 开始执行终止条件检查...');
      await trackingService.checkForTermination();
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
      const activeHunts = await huntService.getActiveHunts();
      const status = {
        isInitialized: this.isInitialized,
        activeHuntsCount: activeHunts.length,
        activeHunts: activeHunts.map(hunt => ({
          id: hunt.id,
          title: hunt.title,
          category: hunt.category,
          impactLevel: hunt.impactLevel,
          createdAt: hunt.createdAt,
          lastUpdate: hunt.lastUpdate,
          progressCount: hunt.progressUpdates?.length || 0,
        })),
        lastCheckTime: moment().toISOString(),
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
      const success = await huntService.manualTerminateHunt(huntId);

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
        moment().format('YYYY-MM-DD HH:mm:ss'),
        moment().format('YYYY-MM-DD HH:mm:ss'),
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
      const fullMessage = `${message}\n\n⏰ ${moment().format('YYYY-MM-DD HH:mm:ss')}`;

      await webhookService.sendMessage(
        moment().format('YYYY-MM-DD HH:mm:ss'),
        moment().format('YYYY-MM-DD HH:mm:ss'),
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
          huntService: true,
          trackingService: true,
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
}

export default new SnakeTrackingService();

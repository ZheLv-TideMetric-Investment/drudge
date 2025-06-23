import logger from '../shared/utils/logger.js';
import moment from 'moment-timezone';
import snakeTrackingService from '../application/services/snakeTrackingService.js';
import webhookService from '../infrastructure/external/WebhookService.js';

// 设置默认时区为北京时间
moment.tz.setDefault('Asia/Shanghai');

/**
 * 草蛇灰线追踪脚本
 * 专门负责事件追踪、进展检查和线索发现
 */
class SnakeTracker {
  constructor() {
    this.snakeTracking = snakeTrackingService;
    this.webhook = webhookService;
    this.commands = {
      'hunt': this.triggerHuntCheck.bind(this),
      'progress': this.triggerProgressCheck.bind(this),
      'status': this.getSystemStatus.bind(this),
      'report': this.generateReport.bind(this),
      'history': this.getHuntHistory.bind(this),
      'terminate': this.terminateHunt.bind(this),
      'create': this.createHunt.bind(this),
      'update': this.updateHunt.bind(this),
      'search': this.searchHunts.bind(this),
      'analyze': this.analyzeHunt.bind(this),
      'health': this.healthCheck.bind(this),
      'init': this.initializeSystem.bind(this),
      'help': this.showHelp.bind(this)
    };
  }

  /**
   * 初始化服务
   */
  async initialize() {
    try {
      await this.snakeTracking.initialize();
      return true;
    } catch (error) {
      logger.error('初始化草蛇灰线服务失败:', error);
      throw error;
    }
  }

  /**
   * 手动触发事件捕猎检查
   */
  async triggerHuntCheck() {
    try {
      await this.initialize();
      
      logger.info('🔍 开始手动触发事件捕猎检查...');
      console.log('🔍 正在检查新的捕猎目标...');

      const result = await this.snakeTracking.manualHuntCheck();

      if (result.success) {
        console.log(`✅ 捕猎检查完成`);
        console.log(`   新发现: ${result.newHunts || 0} 个捕猎目标`);
        console.log(`   更新: ${result.updatedHunts || 0} 个现有目标`);
        
        if (result.newHunts > 0) {
          console.log('\n🎯 新发现的捕猎目标:');
          (result.hunts || []).forEach((hunt, index) => {
            console.log(`${index + 1}. ${hunt.title}`);
            console.log(`   类别: ${hunt.category}`);
            console.log(`   影响等级: ${hunt.impactLevel}`);
            console.log('');
          });
        }
      } else {
        console.error(`❌ 捕猎检查失败: ${result.error}`);
      }

      return result;

    } catch (error) {
      const errorMsg = `❌ 捕猎检查失败: ${error.message}`;
      console.error(errorMsg);
      logger.error('手动捕猎检查失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 手动触发进展检查
   */
  async triggerProgressCheck() {
    try {
      await this.initialize();

      logger.info('📈 开始手动触发进展检查...');
      console.log('📈 正在检查捕猎目标进展...');

      const result = await this.snakeTracking.manualProgressCheck();

      if (result.success) {
        console.log(`✅ 进展检查完成`);
        console.log(`   检查目标: ${result.checkedHunts || 0} 个`);
        console.log(`   发现进展: ${result.progressUpdates || 0} 个`);
        console.log(`   完成目标: ${result.completedHunts || 0} 个`);

        if (result.progressUpdates > 0) {
          console.log('\n📊 进展更新:');
          (result.updates || []).forEach((update, index) => {
            console.log(`${index + 1}. ${update.huntTitle}`);
            console.log(`   新进展: ${update.progressCount} 条`);
            console.log(`   状态: ${update.status}`);
            console.log('');
          });
        }
      } else {
        console.error(`❌ 进展检查失败: ${result.error}`);
      }

      return result;

    } catch (error) {
      const errorMsg = `❌ 进展检查失败: ${error.message}`;
      console.error(errorMsg);
      logger.error('手动进展检查失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取系统状态
   */
  async getSystemStatus() {
    try {
      await this.initialize();

      logger.info('📊 获取草蛇灰线系统状态...');

      const status = await this.snakeTracking.getSystemStatus();

      console.log('\n=== 🐍 草蛇灰线系统状态 ===');
      console.log(`初始化状态: ${status.isInitialized ? '✅ 已初始化' : '❌ 未初始化'}`);
      console.log(`活跃捕猎对象数量: ${status.activeHuntsCount || 0}`);
      console.log(`总捕猎对象数量: ${status.totalHuntsCount || 0}`);
      console.log(`今日新增: ${status.todayNewHunts || 0}`);
      console.log(`本周完成: ${status.weekCompletedHunts || 0}`);

      if (status.activeHunts && status.activeHunts.length > 0) {
        console.log('\n🎯 活跃捕猎对象:');
        console.log(''.padEnd(80, '='));

        status.activeHunts.forEach((hunt, index) => {
          console.log(`${index + 1}. ${hunt.title}`);
          console.log(`   ID: ${hunt.id}`);
          console.log(`   类别: ${hunt.category || '未知'}`);
          console.log(`   影响等级: ${hunt.impactLevel || '未知'}`);
          console.log(`   创建时间: ${moment(hunt.createdAt).format('YYYY-MM-DD HH:mm:ss')}`);
          console.log(`   最后更新: ${moment(hunt.lastUpdate).format('YYYY-MM-DD HH:mm:ss')}`);
          console.log(`   进展数: ${hunt.progressCount || 0}`);
          console.log('');
        });
      }

      if (status.recentProgress && status.recentProgress.length > 0) {
        console.log('📈 最新进展:');
        console.log(''.padEnd(80, '='));

        status.recentProgress.slice(0, 5).forEach((progress, index) => {
          console.log(`${index + 1}. ${progress.huntTitle}`);
          console.log(`   时间: ${moment(progress.detectedAt).format('YYYY-MM-DD HH:mm:ss')}`);
          console.log(`   进展: ${progress.summary}`);
          console.log('');
        });
      }

      console.log(`状态更新时间: ${moment().format('YYYY-MM-DD HH:mm:ss')}`);

      return {
        success: true,
        status,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };

    } catch (error) {
      console.error(`❌ 获取状态失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 生成系统报告
   */
  async generateReport(days = 7) {
    try {
      await this.initialize();

      const daysNum = parseInt(days) || 7;
      logger.info(`📋 生成最近 ${daysNum} 天的系统报告...`);

      const report = await this.snakeTracking.generateSystemReport(daysNum);

      console.log(`\n=== 🐍 草蛇灰线系统报告 (最近${daysNum}天) ===`);
      console.log(report);

      return {
        success: true,
        period: `${daysNum} 天`,
        report,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };

    } catch (error) {
      console.error(`❌ 生成报告失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取捕猎历史
   */
  async getHuntHistory(limit = 20) {
    try {
      await this.initialize();

      const limitNum = parseInt(limit) || 20;
      logger.info(`📜 获取捕猎历史，限制: ${limitNum} 条`);

      const history = await this.snakeTracking.getHuntHistory(limitNum);

      if (history.length === 0) {
        console.log('📜 暂无捕猎历史记录');
        return { success: true, count: 0 };
      }

      console.log(`📜 捕猎历史记录 (最新 ${history.length} 条):`);
      console.log(''.padEnd(80, '='));

      history.forEach((hunt, index) => {
        const statusIcon = hunt.status === 'active' ? '🟢' : hunt.status === 'completed' ? '✅' : '⏸️';
        console.log(`${index + 1}. ${statusIcon} ${hunt.title}`);
        console.log(`   类别: ${hunt.category || '未知'}`);
        console.log(`   创建: ${moment(hunt.createdAt).format('YYYY-MM-DD HH:mm:ss')}`);
        console.log(`   状态: ${hunt.status || '未知'}`);
        console.log(`   进展: ${hunt.progressCount || 0} 条`);
        if (hunt.completedAt) {
          console.log(`   完成: ${moment(hunt.completedAt).format('YYYY-MM-DD HH:mm:ss')}`);
        }
        console.log('');
      });

      return {
        success: true,
        count: history.length,
        history,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };

    } catch (error) {
      console.error(`❌ 获取历史失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 手动终止捕猎目标
   */
  async terminateHunt(huntId) {
    try {
      await this.initialize();

      if (!huntId) {
        console.error('❌ 请提供要终止的捕猎对象ID');
        return { success: false, error: '缺少捕猎对象ID' };
      }

      logger.info(`🛑 手动终止捕猎对象: ${huntId}`);

      const success = await this.snakeTracking.manualTerminateHunt(huntId);

      if (success) {
        console.log(`✅ 捕猎对象 ${huntId} 终止成功`);
        return { success: true, huntId, terminated: true };
      } else {
        console.log(`❌ 捕猎对象 ${huntId} 终止失败`);
        return { success: false, huntId, error: '终止失败' };
      }

    } catch (error) {
      console.error(`❌ 终止捕猎失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 创建新的捕猎目标
   */
  async createHunt(title, category, impactLevel) {
    try {
      await this.initialize();

      if (!title) {
        console.error('❌ 请提供捕猎目标标题');
        return { success: false, error: '缺少标题' };
      }

      logger.info(`🎯 创建新捕猎目标: ${title}`);

      const huntData = {
        title,
        category: category || '手动创建',
        impactLevel: impactLevel || 'medium',
        createdAt: new Date(),
        status: 'active'
      };

      const result = await this.snakeTracking.createHunt(huntData);

      if (result.success) {
        console.log(`✅ 捕猎目标创建成功`);
        console.log(`   ID: ${result.huntId}`);
        console.log(`   标题: ${title}`);
        console.log(`   类别: ${category || '手动创建'}`);
        console.log(`   影响等级: ${impactLevel || 'medium'}`);
      } else {
        console.error(`❌ 捕猎目标创建失败: ${result.error}`);
      }

      return result;

    } catch (error) {
      console.error(`❌ 创建捕猎目标失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 更新捕猎目标
   */
  async updateHunt(huntId, field, value) {
    try {
      await this.initialize();

      if (!huntId || !field || !value) {
        console.error('❌ 请提供捕猎目标ID、字段名和新值');
        return { success: false, error: '参数不完整' };
      }

      logger.info(`🔄 更新捕猎目标: ${huntId}`);

      const updateData = { [field]: value };
      const result = await this.snakeTracking.updateHunt(huntId, updateData);

      if (result.success) {
        console.log(`✅ 捕猎目标更新成功`);
        console.log(`   ID: ${huntId}`);
        console.log(`   字段: ${field}`);
        console.log(`   新值: ${value}`);
      } else {
        console.error(`❌ 捕猎目标更新失败: ${result.error}`);
      }

      return result;

    } catch (error) {
      console.error(`❌ 更新捕猎目标失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 搜索捕猎目标
   */
  async searchHunts(keyword, limit = 10) {
    try {
      await this.initialize();

      if (!keyword) {
        console.error('❌ 请提供搜索关键词');
        return { success: false, error: '缺少关键词' };
      }

      const limitNum = parseInt(limit) || 10;
      logger.info(`🔍 搜索捕猎目标: ${keyword}，限制: ${limitNum} 条`);

      const results = await this.snakeTracking.searchHunts(keyword, limitNum);

      if (results.length === 0) {
        console.log(`🔍 没有找到与 "${keyword}" 相关的捕猎目标`);
        return { success: true, count: 0, keyword };
      }

      console.log(`🔍 找到 ${results.length} 个相关的捕猎目标:`);
      console.log(''.padEnd(80, '='));

      results.forEach((hunt, index) => {
        const statusIcon = hunt.status === 'active' ? '🟢' : hunt.status === 'completed' ? '✅' : '⏸️';
        console.log(`${index + 1}. ${statusIcon} ${hunt.title}`);
        console.log(`   ID: ${hunt.id}`);
        console.log(`   类别: ${hunt.category || '未知'}`);
        console.log(`   相关度: ${(hunt.relevance * 100).toFixed(1)}%`);
        console.log(`   进展: ${hunt.progressCount || 0} 条`);
        console.log('');
      });

      return {
        success: true,
        keyword,
        count: results.length,
        results,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };

    } catch (error) {
      console.error(`❌ 搜索失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 分析捕猎目标
   */
  async analyzeHunt(huntId) {
    try {
      await this.initialize();

      if (!huntId) {
        console.error('❌ 请提供捕猎目标ID');
        return { success: false, error: '缺少捕猎目标ID' };
      }

      logger.info(`🔍 分析捕猎目标: ${huntId}`);

      const analysis = await this.snakeTracking.analyzeHunt(huntId);

      if (analysis.success) {
        console.log(`🔍 捕猎目标分析结果:`);
        console.log(`   ID: ${huntId}`);
        console.log(`   标题: ${analysis.hunt.title}`);
        console.log(`   状态: ${analysis.hunt.status}`);
        console.log(`   进展数: ${analysis.progressCount || 0}`);
        console.log(`   活跃度: ${analysis.activity || 'N/A'}`);
        console.log(`   趋势: ${analysis.trend || 'N/A'}`);
        
        if (analysis.recentProgress && analysis.recentProgress.length > 0) {
          console.log(`\n📈 最新进展:`);
          analysis.recentProgress.slice(0, 3).forEach((progress, index) => {
            console.log(`   ${index + 1}. ${progress.summary}`);
            console.log(`      时间: ${moment(progress.detectedAt).format('YYYY-MM-DD HH:mm:ss')}`);
          });
        }

        if (analysis.recommendations && analysis.recommendations.length > 0) {
          console.log(`\n💡 建议:`);
          analysis.recommendations.forEach((rec, index) => {
            console.log(`   ${index + 1}. ${rec}`);
          });
        }
      } else {
        console.error(`❌ 分析失败: ${analysis.error}`);
      }

      return analysis;

    } catch (error) {
      console.error(`❌ 分析失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    try {
      logger.info('🩺 执行草蛇灰线系统健康检查...');

      const health = await this.snakeTracking.healthCheck();

      console.log('\n=== 🐍 草蛇灰线系统健康状态 ===');
      console.log(`状态: ${health.status === 'healthy' ? '✅ 健康' : '❌ 异常'}`);
      console.log(`检查时间: ${moment(health.timestamp).format('YYYY-MM-DD HH:mm:ss')}`);
      console.log(`系统初始化: ${health.systemInitialized ? '✅' : '❌'}`);
      console.log(`活跃捕猎数: ${health.activeHunts || 0}`);
      console.log(`数据库连接: ${health.databaseConnection ? '✅' : '❌'}`);

      if (health.components) {
        console.log('\n组件状态:');
        Object.entries(health.components).forEach(([component, status]) => {
          console.log(`  ${component}: ${status ? '✅' : '❌'}`);
        });
      }

      if (health.error) {
        console.log(`\n错误信息: ${health.error}`);
      }

      if (health.warnings && health.warnings.length > 0) {
        console.log('\n⚠️  警告:');
        health.warnings.forEach(warning => {
          console.log(`  - ${warning}`);
        });
      }

      return {
        success: true,
        health,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };

    } catch (error) {
      console.error(`❌ 健康检查失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 初始化系统
   */
  async initializeSystem() {
    try {
      logger.info('🚀 初始化草蛇灰线系统...');
      console.log('🚀 正在初始化草蛇灰线系统...');

      await this.snakeTracking.initialize();

      console.log('✅ 草蛇灰线系统初始化完成');

      return {
        success: true,
        message: '系统初始化完成',
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };

    } catch (error) {
      console.error(`❌ 系统初始化失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 显示帮助信息
   */
  showHelp() {
    const helpText = `
🐍 草蛇灰线追踪脚本使用说明

可用命令:
  hunt                    - 手动触发事件捕猎检查
  progress                - 手动触发进展检查
  status                  - 查看系统状态
  report <天数>            - 生成系统报告 (默认7天)
  history <数量>           - 获取捕猎历史 (默认20条)
  terminate <捕猎ID>       - 手动终止指定捕猎对象
  create <标题> <类别> <等级> - 创建新捕猎目标
  update <ID> <字段> <值>   - 更新捕猎目标
  search <关键词> <数量>    - 搜索捕猎目标 (默认10条)
  analyze <捕猎ID>         - 分析捕猎目标
  health                  - 健康检查
  init                    - 初始化系统
  help                    - 显示帮助信息

使用示例:
  npm run snake:hunt                         # 触发捕猎检查
  npm run snake:progress                     # 触发进展检查
  npm run snake:status                       # 查看系统状态
  npm run snake:report 3                     # 生成3天报告
  npm run snake:terminate hunt_12345         # 终止指定捕猎
  npm run snake:create "新闻标题" "科技" "high"  # 创建捕猎目标
  npm run snake:search "苹果公司" 5           # 搜索相关捕猎
  npm run snake:analyze hunt_12345           # 分析捕猎目标
  npm run snake:health                       # 健康检查
`;

    console.log(helpText);
    return { success: true, message: '帮助信息已显示' };
  }

  /**
   * 执行命令
   */
  async execute(command, ...args) {
    if (!this.commands[command]) {
      console.error(`❌ 未知命令: ${command}`);
      this.showHelp();
      return { success: false, error: `未知命令: ${command}` };
    }

    try {
      const result = await this.commands[command](...args);
      return result;
    } catch (error) {
      logger.error(`执行命令失败: ${command}`, error);
      return { success: false, error: error.message };
    }
  }
}

// 主执行逻辑
async function main() {
  const command = process.argv[2] || 'help';
  const args = process.argv.slice(3);

  const tracker = new SnakeTracker();
  const result = await tracker.execute(command, ...args);

  if (result.success) {
    logger.info(`草蛇灰线命令执行成功: ${command}`);
    process.exit(0);
  } else {
    logger.error(`草蛇灰线命令执行失败: ${command}`, result.error);
    process.exit(1);
  }
}

main().catch(error => {
  logger.error('草蛇灰线脚本执行失败:', error);
  process.exit(1);
}); 
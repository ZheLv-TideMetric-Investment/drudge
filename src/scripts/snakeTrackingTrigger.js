import snakeTrackingService from '../services/snakeTrackingService.js';
import logger from '../../shared/utils/logger.js';
import moment from 'moment-timezone';

// 设置默认时区为北京时间
moment.tz.setDefault('Asia/Shanghai');

/**
 * 草蛇灰线系统手动触发脚本
 *
 * 使用方法：
 * npm run snake:hunt - 手动触发事件捕猎检查
 * npm run snake:progress - 手动触发进展检查
 * npm run snake:status - 查看系统状态
 * npm run snake:report - 生成系统报告
 * npm run snake:terminate <huntId> - 手动终止指定捕猎对象
 * npm run snake:health - 健康检查
 */

async function main() {
  const command = process.argv[2];
  const param = process.argv[3];

  try {
    switch (command) {
      case 'hunt':
        logger.info('🔍 手动触发事件捕猎检查...');
        await snakeTrackingService.manualHuntCheck();
        break;

      case 'progress':
        logger.info('📈 手动触发进展检查...');
        await snakeTrackingService.manualProgressCheck();
        break;

      case 'status':
        logger.info('📊 获取系统状态...');
        const status = await snakeTrackingService.getSystemStatus();
        console.log('\n=== 🐍 草蛇灰线系统状态 ===');
        console.log(`初始化状态: ${status.isInitialized ? '✅ 已初始化' : '❌ 未初始化'}`);
        console.log(`活跃捕猎对象数量: ${status.activeHuntsCount}`);

        if (status.activeHunts && status.activeHunts.length > 0) {
          console.log('\n活跃捕猎对象:');
          status.activeHunts.forEach((hunt, index) => {
            console.log(`${index + 1}. ${hunt.title}`);
            console.log(`   ID: ${hunt.id}`);
            console.log(`   类别: ${hunt.category}`);
            console.log(`   影响等级: ${hunt.impactLevel}`);
            console.log(`   创建时间: ${moment(hunt.createdAt).format('YYYY-MM-DD HH:mm:ss')}`);
            console.log(`   最后更新: ${moment(hunt.lastUpdate).format('YYYY-MM-DD HH:mm:ss')}`);
            console.log(`   进展数: ${hunt.progressCount}`);
            console.log('');
          });
        }
        break;

      case 'report':
        logger.info('📋 生成系统报告...');
        const report = await snakeTrackingService.generateSystemReport();
        console.log('\n' + report);
        break;

      case 'terminate':
        if (!param) {
          console.error('❌ 请提供要终止的捕猎对象ID');
          console.log('使用方法: node snakeTrackingTrigger.js terminate <huntId>');
          process.exit(1);
        }
        logger.info(`🛑 手动终止捕猎对象: ${param}`);
        const success = await snakeTrackingService.manualTerminateHunt(param);
        if (success) {
          console.log(`✅ 捕猎对象 ${param} 终止成功`);
        } else {
          console.log(`❌ 捕猎对象 ${param} 终止失败`);
        }
        break;

      case 'health':
        logger.info('🩺 执行健康检查...');
        const health = await snakeTrackingService.healthCheck();
        console.log('\n=== 🐍 草蛇灰线系统健康状态 ===');
        console.log(`状态: ${health.status === 'healthy' ? '✅ 健康' : '❌ 异常'}`);
        console.log(`检查时间: ${moment(health.timestamp).format('YYYY-MM-DD HH:mm:ss')}`);
        console.log(`系统初始化: ${health.systemInitialized ? '✅' : '❌'}`);
        console.log(`活跃捕猎数: ${health.activeHunts}`);

        if (health.components) {
          console.log('\n组件状态:');
          Object.entries(health.components).forEach(([component, status]) => {
            console.log(`  ${component}: ${status ? '✅' : '❌'}`);
          });
        }

        if (health.error) {
          console.log(`\n错误信息: ${health.error}`);
        }
        break;

      case 'init':
        logger.info('🚀 初始化草蛇灰线系统...');
        await snakeTrackingService.initialize();
        console.log('✅ 草蛇灰线系统初始化完成');
        break;

      default:
        console.log('🐍 草蛇灰线系统手动触发脚本');
        console.log('\n可用命令:');
        console.log('  hunt      - 手动触发事件捕猎检查');
        console.log('  progress  - 手动触发进展检查');
        console.log('  status    - 查看系统状态');
        console.log('  report    - 生成系统报告');
        console.log('  terminate <huntId> - 手动终止指定捕猎对象');
        console.log('  health    - 健康检查');
        console.log('  init      - 初始化系统');
        console.log('\n使用示例:');
        console.log('  node src/scripts/snakeTrackingTrigger.js hunt');
        console.log('  node src/scripts/snakeTrackingTrigger.js terminate hunt_1234567890_abc123');
        break;
    }

    logger.info('✅ 操作完成');
    process.exit(0);
  } catch (error) {
    logger.error('❌ 操作失败:', error);
    console.error(`\n❌ 错误: ${error.message}`);
    process.exit(1);
  }
}

main();

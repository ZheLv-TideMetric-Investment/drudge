// @ts-nocheck
import logger from '../../shared/utils/logger';
import moment from 'moment-timezone';
import systemHealthService from '../../application/services/system/SystemHealthService';

// 设置默认时区为北京时间
moment.tz.setDefault('Asia/Shanghai');

/**
 * 系统健康检查脚本 - 命令行入口
 * 所有业务逻辑已移到 SystemHealthService 中
 */
class SystemHealthScript {
  constructor() {
    this.healthService = systemHealthService;
    this.commands = {
      'check': this.runFullHealthCheck.bind(this),
      'quick': this.runQuickCheck.bind(this),
      'services': this.checkServices.bind(this),
      'database': this.checkDatabase.bind(this),
      'storage': this.checkStorage.bind(this),
      'config': this.checkConfiguration.bind(this),
      'dependencies': this.checkDependencies.bind(this),
      'network': this.checkNetwork.bind(this),
      'stats': this.getSystemStats.bind(this),
      'fix': this.attemptAutoFix.bind(this),
      'report': this.generateHealthReport.bind(this),
      'help': this.showHelp.bind(this)
    };
  }

  /**
   * 运行完整健康检查
   */
  async runFullHealthCheck() {
    console.log('🩺 正在进行完整系统健康检查...\n');
    
    const result = await this.healthService.runFullHealthCheck();
    
    if (result.success) {
      this.displayHealthResults(result);
    } else {
      console.error(`❌ 健康检查失败: ${result.error}`);
    }
    
    return result;
  }

  /**
   * 运行快速检查
   */
  async runQuickCheck() {
    console.log('⚡ 正在进行快速健康检查...\n');
    
    const result = await this.healthService.runQuickCheck();
    
    if (result.success) {
      this.displayHealthResults(result);
    } else {
      console.error(`❌ 快速检查失败: ${result.error}`);
    }
    
    return result;
  }

  /**
   * 检查服务状态
   */
  async checkServices() {
    console.log('🔧 检查服务状态...\n');
    
    const result = await this.healthService.checkServices();
    this.displaySimpleResults('服务检查', result);
    
    return result;
  }

  /**
   * 检查数据库
   */
  async checkDatabase() {
    console.log('🗄️ 检查数据库...\n');
    
    const result = await this.healthService.checkDatabase();
    this.displaySimpleResults('数据库检查', result);
    
    return result;
  }

  /**
   * 检查存储
   */
  async checkStorage() {
    console.log('💾 检查存储...\n');
    
    const result = await this.healthService.checkStorage();
    this.displaySimpleResults('存储检查', result);
    
    return result;
  }

  /**
   * 检查配置
   */
  async checkConfiguration() {
    console.log('🔧 检查配置...\n');
    
    const result = await this.healthService.checkConfiguration();
    this.displaySimpleResults('配置检查', result);
    
    return result;
  }

  /**
   * 检查依赖
   */
  async checkDependencies() {
    console.log('📦 检查依赖...\n');
    
    const result = await this.healthService.checkDependencies();
    this.displaySimpleResults('依赖检查', result);
    
    return result;
  }

  /**
   * 检查网络
   */
  async checkNetwork() {
    console.log('🌐 检查网络...\n');
    
    const result = await this.healthService.checkNetwork();
    this.displaySimpleResults('网络检查', result);
    
    return result;
  }

  /**
   * 获取系统统计
   */
  async getSystemStats() {
    console.log('📊 获取系统统计...\n');
    
    const result = await this.healthService.getSystemStats();
    
    if (result.success) {
      this.displaySystemStats(result.stats);
    } else {
      console.error(`❌ 获取统计失败: ${result.error}`);
    }
    
    return result;
  }

  /**
   * 尝试自动修复
   */
  async attemptAutoFix() {
    console.log('🔧 尝试自动修复...\n');
    
    const result = await this.healthService.attemptAutoFix();
    
    if (result.success) {
      this.displayAutoFixResults(result.fixes);
    } else {
      console.error(`❌ 自动修复失败: ${result.error}`);
    }
    
    return result;
  }

  /**
   * 生成健康报告
   */
  async generateHealthReport() {
    console.log('📋 生成健康报告...\n');
    
    const result = await this.healthService.generateHealthReport();
    
    if (result.success) {
      this.displayHealthReport(result.report);
    } else {
      console.error(`❌ 生成报告失败: ${result.error}`);
    }
    
    return result;
  }

  /**
   * 显示帮助信息
   */
  showHelp() {
    console.log(`
🩺 系统健康检查工具

用法:
  npm run health <command> [options]

命令:
  check         运行完整健康检查
  quick         运行快速健康检查
  services      检查服务状态
  database      检查数据库
  storage       检查存储
  config        检查配置
  dependencies  检查依赖
  network       检查网络连接
  stats         获取系统统计信息
  fix           尝试自动修复问题
  report        生成详细健康报告
  help          显示帮助信息

示例:
  npm run health check
  npm run health quick
  npm run health stats
  npm run health fix
`);
  }

  /**
   * 显示健康检查结果
   */
  displayHealthResults(result) {
    console.log('📊 健康检查结果:');
    console.log(''.padEnd(60, '='));
    
    // 显示摘要
    if (result.summary) {
      const { total, passed, failed, warnings, health_score } = result.summary;
      console.log(`✅ 通过: ${passed}/${total} (${Math.round((passed/total)*100)}%)`);
      console.log(`❌ 失败: ${failed}/${total}`);
      console.log(`⚠️  警告: ${warnings}/${total}`);
      console.log(`🏥 健康评分: ${health_score}/100`);
      console.log('');
    }

    // 显示详细结果
    if (result.results) {
      const categories = [...new Set(result.results.map(r => r.category))];
      
      categories.forEach(category => {
        console.log(`📋 ${category}:`);
        const categoryResults = result.results.filter(r => r.category === category);
        
        categoryResults.forEach(item => {
          const icon = this.getStatusIcon(item.status);
          console.log(`  ${icon} ${item.check}: ${item.message}`);
        });
        console.log('');
      });
    }

    // 显示建议
    if (result.recommendations && result.recommendations.length > 0) {
      console.log('💡 建议:');
      result.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. [${rec.priority}] ${rec.message}`);
        if (rec.actions && rec.actions.length > 0) {
          rec.actions.forEach(action => {
            console.log(`   - ${action}`);
          });
        }
      });
    }
  }

  /**
   * 显示简单结果
   */
  displaySimpleResults(title, result) {
    console.log(`📊 ${title}结果:`);
    console.log(''.padEnd(40, '='));
    
    if (result.success) {
      console.log('✅ 检查成功');
    } else {
      console.log(`❌ 检查失败: ${result.error}`);
    }
  }

  /**
   * 显示系统统计
   */
  displaySystemStats(stats) {
    console.log('📊 系统统计:');
    console.log(''.padEnd(40, '='));
    
    console.log(`🕒 时间: ${stats.timestamp}`);
    console.log(`⏱️  运行时间: ${Math.round(stats.uptime)} 秒`);
    console.log(`💾 内存使用: ${Math.round(stats.memory.used / 1024 / 1024)} MB`);
    console.log(`🚀 Node.js 版本: ${stats.node_version}`);
    console.log('');
    
    if (stats.services) {
      console.log('📋 服务状态:');
      Object.entries(stats.services).forEach(([service, serviceStats]) => {
        console.log(`  ${service}: ${JSON.stringify(serviceStats)}`);
      });
    }
  }

  /**
   * 显示自动修复结果
   */
  displayAutoFixResults(fixes) {
    console.log('🔧 自动修复结果:');
    console.log(''.padEnd(40, '='));
    
    fixes.forEach((fix, index) => {
      const icon = fix.status === 'success' ? '✅' : '❌';
      console.log(`${index + 1}. ${icon} ${fix.component} - ${fix.action}`);
      if (fix.error) {
        console.log(`   错误: ${fix.error}`);
      }
    });
  }

  /**
   * 显示健康报告
   */
  displayHealthReport(report) {
    console.log('📋 健康报告:');
    console.log(''.padEnd(60, '='));
    
    console.log(`🕒 生成时间: ${report.timestamp}`);
    console.log('');
    
    if (report.summary) {
      console.log('📊 摘要:');
      console.log(`  总检查项: ${report.summary.total}`);
      console.log(`  通过: ${report.summary.passed}`);
      console.log(`  失败: ${report.summary.failed}`);
      console.log(`  警告: ${report.summary.warnings}`);
      console.log(`  健康评分: ${report.summary.health_score}/100`);
      console.log('');
    }

    if (report.recommendations && report.recommendations.length > 0) {
      console.log('💡 建议:');
      report.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. [${rec.priority}] ${rec.message}`);
      });
    }
  }

  /**
   * 获取状态图标
   */
  getStatusIcon(status) {
    const icons = {
      'PASS': '✅',
      'FAIL': '❌',
      'WARN': '⚠️',
      'INFO': 'ℹ️'
    };
    return icons[status] || '❓';
  }

  /**
   * 执行命令
   */
  async execute(command, ...args) {
    const handler = this.commands[command];
    if (!handler) {
      console.error(`❌ 未知命令: ${command}`);
      this.showHelp();
      return { success: false, error: `未知命令: ${command}` };
    }

    try {
      return await handler(...args);
    } catch (error) {
      console.error(`❌ 执行命令失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}

// 主函数
async function main() {
  const script = new SystemHealthScript();
  const command = process.argv[2] || 'help';
  const args = process.argv.slice(3);

  const result = await script.execute(command, ...args);
  
  if (result && !result.success) {
    process.exit(1);
  }
}

// 错误处理
process.on('unhandledRejection', (error) => {
  console.error('未处理的Promise拒绝:', error);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error);
  process.exit(1);
});

// 运行主函数
// @ts-ignore
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default SystemHealthScript; 
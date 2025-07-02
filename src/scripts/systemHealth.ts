// @ts-nocheck
import logger from '../shared/utils/logger';
import moment from 'moment-timezone';
import config from '../shared/config/config';
import newsApiService from '../infrastructure/external/NewsApiService';
import fileStorage from '../infrastructure/storage/FileStorage';
import knowledgeGraphService from '../application/services/knowledgeGraphService';
import newsLevelService from '../application/services/newsLevelService';

import webhookService from '../infrastructure/external/WebhookService';

// 设置默认时区为北京时间
moment.tz.setDefault('Asia/Shanghai');

/**
 * 系统健康检查脚本
 * 专门负责整个系统的健康状态检查和故障诊断
 */
class SystemHealthChecker {
  constructor() {
    this.results = [];
    this.services = {
      newsApi: newsApiService,
      storage: fileStorage,
      knowledgeGraph: knowledgeGraphService,
      newsLevel: newsLevelService,
      webhook: webhookService
    };
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
    try {
      logger.info('🩺 开始完整系统健康检查...');
      console.log('🩺 正在进行完整系统健康检查...\n');

      this.results = [];

      // 按顺序执行各项检查
      await this.checkConfiguration();
      await this.checkDependencies();
      await this.checkNetwork();
      await this.checkDatabase();
      await this.checkStorage();
      await this.checkServices();

      // 生成报告
      return this.generateReport();

    } catch (error) {
      console.error(`❌ 健康检查失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 运行快速检查
   */
  async runQuickCheck() {
    try {
      logger.info('⚡ 开始快速健康检查...');
      console.log('⚡ 正在进行快速健康检查...\n');

      this.results = [];

      // 只检查关键组件
      await this.checkConfiguration();
      await this.checkDatabase();
      await this.checkServices();

      return this.generateReport();

    } catch (error) {
      console.error(`❌ 快速检查失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 检查配置
   */
  async checkConfiguration() {
    console.log('🔧 检查系统配置...');

    // 检查配置文件
    try {
      if (config) {
        this.results.push({
          category: '配置',
          check: '配置文件加载',
          status: 'PASS',
          message: '配置文件加载成功'
        });
      }
    } catch (error) {
      this.results.push({
        category: '配置',
        check: '配置文件加载',
        status: 'FAIL',
        message: `配置文件加载失败: ${error.message}`
      });
    }

    // 检查环境变量
    const envVars = [
      { name: 'AI_API_KEY', required: true },
      { name: 'WEBHOOK_URL', required: true },
      { name: 'NEO4J_URI', required: false },
      { name: 'NEO4J_USER', required: false },
      { name: 'NEO4J_PASSWORD', required: false }
    ];

    envVars.forEach(envVar => {
      if (process.env[envVar.name]) {
        this.results.push({
          category: '配置',
          check: `环境变量: ${envVar.name}`,
          status: 'PASS',
          message: '已配置'
        });
      } else {
        this.results.push({
          category: '配置',
          check: `环境变量: ${envVar.name}`,
          status: envVar.required ? 'FAIL' : 'WARN',
          message: envVar.required ? '必需环境变量未配置' : '可选环境变量未配置'
        });
      }
    });

    // 检查重要配置项
    const configChecks = [
      { path: 'news.sources', name: '新闻源配置' },
      { path: 'ai.model', name: 'AI模型配置' },
      { path: 'scheduler.enabled', name: '调度器配置' },
      { path: 'webhook.retryAttempts', name: '通知配置' }
    ];

    configChecks.forEach(check => {
      try {
        const value = check.path.split('.').reduce((obj, key) => obj?.[key], config);
        if (value !== undefined) {
          this.results.push({
            category: '配置',
            check: check.name,
            status: 'PASS',
            message: `配置正常: ${value}`
          });
        } else {
          this.results.push({
            category: '配置',
            check: check.name,
            status: 'WARN',
            message: '配置项未设置'
          });
        }
      } catch (error) {
        this.results.push({
          category: '配置',
          check: check.name,
          status: 'FAIL',
          message: `配置检查失败: ${error.message}`
        });
      }
    });

    return true;
  }

  /**
   * 检查依赖
   */
  async checkDependencies() {
    console.log('📦 检查系统依赖...');

    const requiredDeps = [
      'moment-timezone',
      'node-cron',
      'axios',
      'winston',
      '@ai-sdk/deepseek',
      'neo4j-driver'
    ];

    for (const dep of requiredDeps) {
      try {
        await import(dep);
        this.results.push({
          category: '依赖',
          check: `依赖包: ${dep}`,
          status: 'PASS',
          message: '依赖可用'
        });
      } catch (error) {
        this.results.push({
          category: '依赖',
          check: `依赖包: ${dep}`,
          status: 'FAIL',
          message: `依赖缺失: ${error.message}`
        });
      }
    }

    return true;
  }

  /**
   * 检查网络连接
   */
  async checkNetwork() {
    console.log('🌐 检查网络连接...');

    // 检查外部API连接
    try {
      const healthResult = await this.services.newsApi.healthCheck();
      this.results.push({
        category: '网络',
        check: '新闻API连接',
        status: healthResult.status === 'healthy' ? 'PASS' : 'FAIL',
        message: healthResult.status === 'healthy' ? 'API连接正常' : '新闻API连接异常'
      });
    } catch (error) {
      this.results.push({
        category: '网络',
        check: '新闻API连接',
        status: 'FAIL',
        message: `新闻API连接失败: ${error.message}`
      });
    }

    // 检查Webhook连接
    try {
      const webhookResult = await this.services.webhook.healthCheck();
      this.results.push({
        category: '网络',
        check: 'Webhook连接',
        status: webhookResult.status === 'healthy' ? 'PASS' : 'FAIL',
        message: webhookResult.status === 'healthy' ? 'Webhook连接正常' : 'Webhook连接异常'
      });
    } catch (error) {
      this.results.push({
        category: '网络',
        check: 'Webhook连接',
        status: 'FAIL',
        message: `Webhook连接失败: ${error.message}`
      });
    }

    return true;
  }

  /**
   * 检查数据库
   */
  async checkDatabase() {
    console.log('🗄️  检查数据库连接...');

    try {
      await this.services.knowledgeGraph.initialize();
      const healthResult = await this.services.knowledgeGraph.healthCheck();
      
      this.results.push({
        category: '数据库',
        check: 'Neo4j连接',
        status: healthResult.status === 'healthy' ? 'PASS' : 'FAIL',
        message: healthResult.status === 'healthy' ? '数据库连接正常' : '数据库连接异常'
      });

      // 检查数据库统计
      if (healthResult.status === 'healthy') {
        try {
          const stats = await this.services.knowledgeGraph.getStats();
          this.results.push({
            category: '数据库',
            check: '数据库统计',
            status: 'PASS',
            message: `节点: ${stats.nodes || 0}, 关系: ${stats.relationships || 0}`
          });
        } catch (error) {
          this.results.push({
            category: '数据库',
            check: '数据库统计',
            status: 'WARN',
            message: `统计信息获取失败: ${error.message}`
          });
        }
      }

    } catch (error) {
      this.results.push({
        category: '数据库',
        check: 'Neo4j连接',
        status: 'FAIL',
        message: `数据库连接失败: ${error.message}`
      });
    }

    return true;
  }

  /**
   * 检查存储
   */
  async checkStorage() {
    console.log('💾 检查存储系统...');

    // 检查数据目录
    const requiredDirs = ['data', 'data/news', 'logs'];

    for (const dir of requiredDirs) {
      try {
        const fs = await import('fs/promises');
        await fs.access(dir);
        this.results.push({
          category: '存储',
          check: `目录: ${dir}`,
          status: 'PASS',
          message: '目录存在'
        });
      } catch (error) {
        this.results.push({
          category: '存储',
          check: `目录: ${dir}`,
          status: 'FAIL',
          message: '目录不存在'
        });
      }
    }

    // 检查文件存储
    try {
              const allNews = await this.services.storage.getAll();
        const sampleNews = allNews.slice(0, 1);
      this.results.push({
        category: '存储',
        check: '文件存储访问',
        status: 'PASS',
        message: `存储正常，包含 ${allNews.length} 条数据`
      });
    } catch (error) {
      this.results.push({
        category: '存储',
        check: '文件存储访问',
        status: 'FAIL',
        message: `存储访问失败: ${error.message}`
      });
    }

    return true;
  }

  /**
   * 检查服务
   */
  async checkServices() {
    console.log('⚙️  检查应用服务...');

    const serviceChecks = [
      { name: '新闻等级服务', service: 'newsLevel' }
    ];

    for (const check of serviceChecks) {
      try {
        await this.services[check.service].initialize();
        const healthResult = await this.services[check.service].healthCheck();
        
        this.results.push({
          category: '服务',
          check: check.name,
          status: healthResult.status === 'healthy' ? 'PASS' : 'FAIL',
          message: healthResult.status === 'healthy' ? '服务正常' : '服务异常'
        });
      } catch (error) {
        this.results.push({
          category: '服务',
          check: check.name,
          status: 'FAIL',
          message: `服务检查失败: ${error.message}`
        });
      }
    }

    return true;
  }

  /**
   * 获取系统统计
   */
  async getSystemStats() {
    try {
      console.log('📊 收集系统统计信息...');

      const stats = {
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          platform: process.platform,
          nodeVersion: process.version,
          timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
        }
      };

      // 收集数据统计
      try {
        const allNews = await this.services.storage.getAll();
        stats.data = {
          totalNews: allNews.length,
          latestNews: allNews[0] ? moment(allNews[0].time * 1000).format('YYYY-MM-DD HH:mm:ss') : null
        };
      } catch (error) {
        stats.data = { error: error.message };
      }

      // 收集图谱统计
      try {
        await this.services.knowledgeGraph.initialize();
        const graphStats = await this.services.knowledgeGraph.getStats();
        stats.graph = graphStats;
      } catch (error) {
        stats.graph = { error: error.message };
      }

      console.log('📊 系统统计信息:');
      console.log(`   系统运行时间: ${Math.floor(stats.system.uptime / 3600)}h ${Math.floor((stats.system.uptime % 3600) / 60)}m`);
      console.log(`   内存使用: ${Math.round(stats.system.memory.rss / 1024 / 1024)}MB`);
      console.log(`   Node.js版本: ${stats.system.nodeVersion}`);
      console.log(`   总新闻数: ${stats.data.totalNews || 'N/A'}`);
      console.log(`   图谱节点: ${stats.graph.nodes || 'N/A'}`);
      console.log(`   图谱关系: ${stats.graph.relationships || 'N/A'}`);

      return { success: true, stats };

    } catch (error) {
      console.error(`❌ 统计信息收集失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 尝试自动修复
   */
  async attemptAutoFix() {
    try {
      logger.info('🔧 尝试自动修复系统问题...');
      console.log('🔧 正在尝试自动修复...');

      const fixes = [];

      // 检查并创建缺失目录
      const requiredDirs = ['data', 'data/news', 'logs'];
      const fs = await import('fs/promises');

      for (const dir of requiredDirs) {
        try {
          await fs.access(dir);
        } catch (error) {
          try {
            await fs.mkdir(dir, { recursive: true });
            fixes.push(`✅ 创建目录: ${dir}`);
          } catch (createError) {
            fixes.push(`❌ 创建目录失败: ${dir} - ${createError.message}`);
          }
        }
      }

      // 尝试重新初始化服务
      try {
        await this.services.knowledgeGraph.initialize();
        fixes.push('✅ 知识图谱服务重新初始化成功');
      } catch (error) {
        fixes.push(`❌ 知识图谱服务初始化失败: ${error.message}`);
      }

      if (fixes.length > 0) {
        console.log('\n🔧 自动修复结果:');
        fixes.forEach(fix => console.log(`   ${fix}`));
      } else {
        console.log('✅ 未发现可自动修复的问题');
      }

      return {
        success: true,
        fixes,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      };

    } catch (error) {
      console.error(`❌ 自动修复失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 生成健康报告
   */
  async generateHealthReport() {
    try {
      logger.info('📋 生成健康报告...');

      // 先运行完整检查
      await this.runFullHealthCheck();

      // 生成详细报告
      const reportData = {
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
        summary: this.generateSummary(),
        details: this.results,
        recommendations: this.generateRecommendations()
      };

      // 保存报告文件
      const fs = await import('fs/promises');
      const reportFile = `health-report-${moment().format('YYYYMMDD-HHmmss')}.json`;
      await fs.writeFile(reportFile, JSON.stringify(reportData, null, 2));

      console.log(`📋 健康报告已生成: ${reportFile}`);

      return {
        success: true,
        reportFile,
        summary: reportData.summary,
        timestamp: reportData.timestamp
      };

    } catch (error) {
      console.error(`❌ 生成报告失败: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * 生成摘要
   */
  generateSummary() {
    const categories = {};
    
    this.results.forEach(result => {
      if (!categories[result.category]) {
        categories[result.category] = { pass: 0, fail: 0, warn: 0 };
      }
      categories[result.category][result.status.toLowerCase()]++;
    });

    const total = this.results.length;
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const warned = this.results.filter(r => r.status === 'WARN').length;

    return {
      total,
      passed,
      failed,
      warned,
      healthScore: Math.round((passed / total) * 100),
      categories
    };
  }

  /**
   * 生成建议
   */
  generateRecommendations() {
    const recommendations = [];
    const failedChecks = this.results.filter(r => r.status === 'FAIL');
    const warnedChecks = this.results.filter(r => r.status === 'WARN');

    if (failedChecks.length > 0) {
      recommendations.push('🔴 关键问题需要立即解决:');
      failedChecks.forEach(check => {
        recommendations.push(`   - ${check.check}: ${check.message}`);
      });
    }

    if (warnedChecks.length > 0) {
      recommendations.push('🟡 建议关注的问题:');
      warnedChecks.forEach(check => {
        recommendations.push(`   - ${check.check}: ${check.message}`);
      });
    }

    if (failedChecks.length === 0 && warnedChecks.length === 0) {
      recommendations.push('✅ 系统运行良好，无需特别关注');
    }

    return recommendations;
  }

  /**
   * 生成报告
   */
  generateReport() {
    const summary = this.generateSummary();
    
    console.log('\n=== 🩺 系统健康检查报告 ===');
    console.log(`检查时间: ${moment().format('YYYY-MM-DD HH:mm:ss')}`);
    console.log(`健康评分: ${summary.healthScore}%`);
    console.log('');

    // 按类别显示结果
    Object.entries(summary.categories).forEach(([category, counts]) => {
      console.log(`${category}:`);
      console.log(`  ✅ 通过: ${counts.pass}`);
      console.log(`  ❌ 失败: ${counts.fail}`);
      console.log(`  ⚠️  警告: ${counts.warn}`);
      console.log('');
    });

    // 显示建议
    const recommendations = this.generateRecommendations();
    if (recommendations.length > 0) {
      console.log('💡 建议:');
      recommendations.forEach(rec => console.log(rec));
      console.log('');
    }

    console.log(`总计: ${summary.total} 项检查，✅ ${summary.passed} 通过，❌ ${summary.failed} 失败，⚠️  ${summary.warned} 警告`);

    return {
      success: summary.failed === 0,
      summary,
      results: this.results,
      recommendations,
      timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
    };
  }

  /**
   * 显示帮助信息
   */
  showHelp() {
    const helpText = `
🩺 系统健康检查脚本使用说明

可用命令:
  check         - 运行完整健康检查
  quick         - 运行快速健康检查
  services      - 仅检查应用服务
  database      - 仅检查数据库
  storage       - 仅检查存储系统
  config        - 仅检查配置
  dependencies  - 仅检查依赖
  network       - 仅检查网络连接
  stats         - 获取系统统计信息
  fix           - 尝试自动修复问题
  report        - 生成详细健康报告
  help          - 显示帮助信息

使用示例:
  npm run health                    # 完整健康检查
  npm run health quick              # 快速检查
  npm run health services           # 检查服务
  npm run health database           # 检查数据库
  npm run health stats              # 系统统计
  npm run health fix                # 自动修复
  npm run health report             # 生成报告
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
  const command = process.argv[2] || 'check';
  const args = process.argv.slice(3);

  const healthChecker = new SystemHealthChecker();
  const result = await healthChecker.execute(command, ...args);

  if (result.success) {
    logger.info(`健康检查命令执行成功: ${command}`);
    process.exit(0);
  } else {
    logger.error(`健康检查命令执行失败: ${command}`, result.error);
    process.exit(1);
  }
}

main().catch(error => {
  logger.error('健康检查脚本执行失败:', error);
  process.exit(1);
}); 
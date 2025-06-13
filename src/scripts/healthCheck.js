const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');
const moment = require('moment-timezone');

moment.tz.setDefault('Asia/Shanghai');

class HealthChecker {
  constructor() {
    this.basePath = path.join(process.cwd(), 'data');
    this.results = [];
  }

  async checkDirectoryStructure() {
    const requiredDirs = ['data/news', 'data/ohn', 'data/hns', 'data/overnight', 'data/hunts'];

    for (const dir of requiredDirs) {
      try {
        const fullPath = path.join(process.cwd(), dir);
        await fs.access(fullPath);
        this.results.push({ check: `目录结构: ${dir}`, status: 'PASS', message: '目录存在' });
      } catch (error) {
        this.results.push({ check: `目录结构: ${dir}`, status: 'FAIL', message: '目录不存在' });
      }
    }
  }

  async checkServices() {
    const services = [
      { name: 'OHN Service', module: '../services/ohnService' },
      { name: 'HNS Service', module: '../services/hnsService' },
      { name: 'Overnight Service', module: '../services/overnightService' },
      { name: 'Snake Tracking Service', module: '../services/snakeTrackingService' },
    ];

    for (const service of services) {
      try {
        require(service.module);
        this.results.push({
          check: `服务加载: ${service.name}`,
          status: 'PASS',
          message: '服务可正常加载',
        });
      } catch (error) {
        this.results.push({
          check: `服务加载: ${service.name}`,
          status: 'FAIL',
          message: error.message,
        });
      }
    }
  }

  async checkConfig() {
    try {
      const configPath = path.join(process.cwd(), 'src', 'config', 'config.js');
      await fs.access(configPath);
      this.results.push({
        check: '配置文件: config.js',
        status: 'PASS',
        message: '配置文件存在',
      });
    } catch (error) {
      this.results.push({
        check: '配置文件: config.js',
        status: 'FAIL',
        message: '配置文件不存在',
      });
    }
  }

  async checkDependencies() {
    const requiredDeps = ['moment-timezone', 'node-cron', 'axios', 'winston', '@ai-sdk/deepseek'];

    for (const dep of requiredDeps) {
      try {
        require(dep);
        this.results.push({ check: `依赖检查: ${dep}`, status: 'PASS', message: '依赖可用' });
      } catch (error) {
        this.results.push({ check: `依赖检查: ${dep}`, status: 'FAIL', message: '依赖缺失' });
      }
    }
  }

  async checkEnvironmentVariables() {
    const envVars = ['AI_API_KEY', 'WEBHOOK_URL'];

    for (const envVar of envVars) {
      if (process.env[envVar]) {
        this.results.push({ check: `环境变量: ${envVar}`, status: 'PASS', message: '已配置' });
      } else {
        this.results.push({ check: `环境变量: ${envVar}`, status: 'WARN', message: '未配置' });
      }
    }
  }

  generateReport() {
    console.log('\n=== 新闻系统健康检查报告 ===');
    console.log(`检查时间: ${moment().format('YYYY-MM-DD HH:mm:ss')}`);
    console.log('');

    let passCount = 0;
    let failCount = 0;
    let warnCount = 0;

    this.results.forEach(result => {
      const status = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
      console.log(`${status} ${result.check}: ${result.message}`);

      if (result.status === 'PASS') passCount++;
      else if (result.status === 'FAIL') failCount++;
      else warnCount++;
    });

    console.log('');
    console.log(`总检查项: ${this.results.length}`);
    console.log(`✅ 通过: ${passCount}`);
    console.log(`❌ 失败: ${failCount}`);
    console.log(`⚠️ 警告: ${warnCount}`);

    if (failCount === 0) {
      console.log('\n🎉 系统健康检查通过！所有功能可正常使用。');
    } else {
      console.log('\n⚠️ 发现问题，请检查失败项目。');
    }

    return { pass: passCount, fail: failCount, warn: warnCount };
  }

  async run() {
    console.log('开始系统健康检查...');

    await this.checkDirectoryStructure();
    await this.checkServices();
    await this.checkConfig();
    await this.checkDependencies();
    await this.checkEnvironmentVariables();

    return this.generateReport();
  }
}

async function main() {
  try {
    const checker = new HealthChecker();
    const results = await checker.run();

    // 如果有失败项，退出码为1
    process.exit(results.fail > 0 ? 1 : 0);
  } catch (error) {
    logger.error('健康检查失败:', error);
    console.error('健康检查执行失败:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = HealthChecker;

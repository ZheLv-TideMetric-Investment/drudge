// @ts-nocheck
import logger from '../../../shared/utils/logger';
import moment from 'moment-timezone';
import config from '../../../shared/config/config';
import newsApiService from '../../../infrastructure/external/NewsApiService';
import fileStorage from '../../../infrastructure/storage/FileStorage';
import knowledgeGraphServiceV2 from '../KnowledgeGraphServiceV2';
import notificationService from '../business/NotificationService';
import webhookService from '../../../infrastructure/external/WebhookService';

/**
 * 系统健康检查服务
 * 负责整个系统的健康状态检查和故障诊断
 */
class SystemHealthService {
  private results: any[] = [];
  private services: any;

  constructor() {
    this.services = {
      newsApi: newsApiService,
      storage: fileStorage,
      knowledgeGraph: knowledgeGraphServiceV2,
      notification: notificationService,
      webhook: webhookService
    };
  }

  /**
   * 运行完整健康检查
   */
  async runFullHealthCheck() {
    try {
      logger.info('🩺 开始完整系统健康检查...');
      this.results = [];

      // 按顺序执行各项检查
      await this.checkConfiguration();
      await this.checkDependencies();
      await this.checkNetwork();
      await this.checkDatabase();
      await this.checkStorage();
      await this.checkServices();

      return this.generateReport();
    } catch (error) {
      logger.error('健康检查失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 运行快速检查
   */
  async runQuickCheck() {
    try {
      logger.info('⚡ 开始快速健康检查...');
      this.results = [];

      // 只检查关键组件
      await this.checkConfiguration();
      await this.checkDatabase();
      await this.checkServices();

      return this.generateReport();
    } catch (error) {
      logger.error('快速检查失败:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * 检查配置
   */
  async checkConfiguration() {
    // 检查配置文件
    try {
      if (config) {
        this.addResult('配置', '配置文件加载', 'PASS', '配置文件加载成功');
      }
    } catch (error) {
      this.addResult('配置', '配置文件加载', 'FAIL', `配置文件加载失败: ${error.message}`);
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
        this.addResult('配置', `环境变量: ${envVar.name}`, 'PASS', '已配置');
      } else {
        this.addResult('配置', `环境变量: ${envVar.name}`, 
          envVar.required ? 'FAIL' : 'WARN', 
          envVar.required ? '必需环境变量未配置' : '可选环境变量未配置'
        );
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
          this.addResult('配置', check.name, 'PASS', `配置正常: ${value}`);
        } else {
          this.addResult('配置', check.name, 'WARN', '配置项未设置');
        }
      } catch (error) {
        this.addResult('配置', check.name, 'FAIL', `配置检查失败: ${error.message}`);
      }
    });
  }

  /**
   * 检查依赖
   */
  async checkDependencies() {
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
        require.resolve(dep);
        this.addResult('依赖', `模块: ${dep}`, 'PASS', '已安装');
      } catch (error) {
        this.addResult('依赖', `模块: ${dep}`, 'FAIL', '未安装或无法找到');
      }
    }
  }

  /**
   * 检查网络连接
   */
  async checkNetwork() {
    try {
      // 检查新闻API连接
      await this.services.newsApi.testConnection();
      this.addResult('网络', '新闻API连接', 'PASS', '连接正常');
    } catch (error) {
      this.addResult('网络', '新闻API连接', 'FAIL', `连接失败: ${error.message}`);
    }

    try {
      // 检查Webhook连接
      await this.services.webhook.testConnection();
      this.addResult('网络', 'Webhook连接', 'PASS', '连接正常');
    } catch (error) {
      this.addResult('网络', 'Webhook连接', 'WARN', `连接失败: ${error.message}`);
    }
  }

  /**
   * 检查数据库
   */
  async checkDatabase() {
    try {
      const healthCheck = await this.services.knowledgeGraph.healthCheck();
      if (healthCheck.status === 'healthy') {
        this.addResult('数据库', 'Neo4j连接', 'PASS', '连接正常');
      } else {
        this.addResult('数据库', 'Neo4j连接', 'FAIL', healthCheck.error || '连接异常');
      }

      // 检查数据库统计
      const stats = await this.services.knowledgeGraph.getStats();
      this.addResult('数据库', '数据统计', 'INFO', 
        `节点: ${stats.nodes}, 关系: ${stats.relationships}, 新闻: ${stats.news}`
      );
    } catch (error) {
      this.addResult('数据库', 'Neo4j检查', 'FAIL', `检查失败: ${error.message}`);
    }
  }

  /**
   * 检查存储
   */
  async checkStorage() {
    try {
      // 检查文件存储
      const allNews = await this.services.storage.getAll();
      this.addResult('存储', '文件存储', 'PASS', `存储了 ${allNews.length} 条新闻`);

      // 检查存储空间（简单检查）
      if (allNews.length > 10000) {
        this.addResult('存储', '存储容量', 'WARN', '新闻数量较多，建议清理旧数据');
      } else {
        this.addResult('存储', '存储容量', 'PASS', '存储容量正常');
      }
    } catch (error) {
      this.addResult('存储', '文件存储', 'FAIL', `存储检查失败: ${error.message}`);
    }
  }

  /**
   * 检查服务
   */
  async checkServices() {
    // 检查知识图谱服务
    try {
      await this.services.knowledgeGraph.initialize();
      this.addResult('服务', '知识图谱服务', 'PASS', '服务正常');
    } catch (error) {
      this.addResult('服务', '知识图谱服务', 'FAIL', `服务异常: ${error.message}`);
    }

    // 检查新闻级别服务
    try {
      await this.services.newsLevel.initialize();
      this.addResult('服务', '新闻级别服务', 'PASS', '服务正常');
    } catch (error) {
      this.addResult('服务', '新闻级别服务', 'FAIL', `服务异常: ${error.message}`);
    }
  }

  /**
   * 获取系统统计信息
   */
  async getSystemStats() {
    try {
      const stats = {
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        node_version: process.version,
        services: {}
      };

      // 获取各服务统计
      try {
        stats.services.knowledge_graph = await this.services.knowledgeGraph.getStats();
      } catch (error) {
        stats.services.knowledge_graph = { error: error.message };
      }

      try {
        stats.services.news_level = this.services.newsLevel.getCacheStats();
      } catch (error) {
        stats.services.news_level = { error: error.message };
      }

      try {
        const allNews = await this.services.storage.getAll();
        stats.services.storage = { total_news: allNews.length };
      } catch (error) {
        stats.services.storage = { error: error.message };
      }

      return { success: true, stats };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 尝试自动修复
   */
  async attemptAutoFix() {
    const fixes = [];

    // 尝试重新连接数据库
    try {
      await this.services.knowledgeGraph.initialize();
      fixes.push({ component: '知识图谱服务', action: '重新初始化', status: 'success' });
    } catch (error) {
      fixes.push({ component: '知识图谱服务', action: '重新初始化', status: 'failed', error: error.message });
    }

    // 尝试重新初始化新闻级别服务
    try {
      await this.services.newsLevel.initialize();
      fixes.push({ component: '新闻级别服务', action: '重新初始化', status: 'success' });
    } catch (error) {
      fixes.push({ component: '新闻级别服务', action: '重新初始化', status: 'failed', error: error.message });
    }

    return { success: true, fixes };
  }

  /**
   * 生成健康报告
   */
  generateHealthReport() {
    const report = {
      timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
      summary: this.generateSummary(),
      details: this.results,
      recommendations: this.generateRecommendations()
    };

    return { success: true, report };
  }

  /**
   * 私有辅助方法
   */
  private addResult(category: string, check: string, status: string, message: string) {
    this.results.push({ category, check, status, message });
  }

  private generateSummary() {
    const total = this.results.length;
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const warnings = this.results.filter(r => r.status === 'WARN').length;

    return {
      total,
      passed,
      failed,
      warnings,
      health_score: Math.round((passed / total) * 100)
    };
  }

  private generateRecommendations() {
    const recommendations = [];
    const failedChecks = this.results.filter(r => r.status === 'FAIL');
    const warningChecks = this.results.filter(r => r.status === 'WARN');

    if (failedChecks.length > 0) {
      recommendations.push({
        priority: 'HIGH',
        message: `有 ${failedChecks.length} 项关键检查失败，需要立即处理`,
        actions: failedChecks.map(check => `修复 ${check.category} - ${check.check}`)
      });
    }

    if (warningChecks.length > 0) {
      recommendations.push({
        priority: 'MEDIUM',
        message: `有 ${warningChecks.length} 项检查有警告，建议关注`,
        actions: warningChecks.map(check => `检查 ${check.category} - ${check.check}`)
      });
    }

    return recommendations;
  }

  private generateReport() {
    const summary = this.generateSummary();
    return {
      success: summary.failed === 0,
      timestamp: moment().format('YYYY-MM-DD HH:mm:ss'),
      summary,
      results: this.results,
      recommendations: this.generateRecommendations()
    };
  }
}

export default new SystemHealthService(); 
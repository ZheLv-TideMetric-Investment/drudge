import cron from 'node-cron';
import axios from 'axios';
import { logger } from '../utils/logger.js';
import { JobConfig, JobStatus } from '../types/index.js';

export class SchedulerService {
  private jobs: Map<string, { task: cron.ScheduledTask; config: JobConfig }> = new Map();
  private ingestWorkerUrl: string;
  private graphWorkerUrl: string;
  
  constructor() {
    this.ingestWorkerUrl = process.env.INGEST_WORKER_URL || 'http://localhost:3003';
    this.graphWorkerUrl = process.env.GRAPH_WORKER_URL || 'http://localhost:3004';
  }

  async initialize() {
    logger.info('📋 初始化调度服务...');
    
    // 配置所有定时任务
    const jobConfigs: JobConfig[] = [
      {
        name: 'news-fetch',
        schedule: process.env.CRON_NEWS_FETCH || '0 * * * * *', // 每分钟
        description: '新闻获取任务',
        enabled: true,
        action: () => this.triggerNewsFetch()
      },
      {
        name: 'high-level-scan',
        schedule: process.env.CRON_HIGH_LEVEL_SCAN || '0 */5 * * * *', // 每5分钟
        description: '高级别新闻扫描',
        enabled: true,
        action: () => this.triggerHighLevelScan()
      },
      {
        name: 'hourly-summary',
        schedule: process.env.CRON_HOURLY_SUMMARY || '0 0 11-22 * * *', // 每小时11-22点
        description: '小时总结生成',
        enabled: true,
        action: () => this.triggerHourlySummary()
      },
      {
        name: 'daily-summary',
        schedule: process.env.CRON_DAILY_SUMMARY || '0 0 10 * * *', // 每日10点
        description: '每日总结生成',
        enabled: true,
        action: () => this.triggerDailySummary()
      },
      {
        name: 'graph-maintenance',
        schedule: process.env.CRON_GRAPH_MAINTENANCE || '0 0 2 * * *', // 每日2点
        description: '图谱维护任务',
        enabled: true,
        action: () => this.triggerGraphMaintenance()
      }
    ];

    // 创建定时任务
    for (const config of jobConfigs) {
      if (config.enabled) {
        const task = cron.schedule(config.schedule, config.action, {
          scheduled: false,
          timezone: 'Asia/Shanghai'
        });
        
        this.jobs.set(config.name, { task, config });
        logger.info(`📅 创建定时任务: ${config.name} (${config.schedule})`);
      }
    }
    
    logger.info(`✅ 调度服务初始化完成，共创建 ${this.jobs.size} 个定时任务`);
  }

  startAllJobs() {
    for (const [name, { task }] of this.jobs) {
      task.start();
      logger.info(`▶️ 启动定时任务: ${name}`);
    }
  }

  stopAllJobs() {
    for (const [name, { task }] of this.jobs) {
      task.stop();
      logger.info(`⏹️ 停止定时任务: ${name}`);
    }
  }

  getJobStatus(): JobStatus[] {
    const status: JobStatus[] = [];
    for (const [name, { task, config }] of this.jobs) {
      status.push({
        name,
        schedule: config.schedule,
        description: config.description,
        enabled: config.enabled,
        running: task.running || false
      });
    }
    return status;
  }

  private async triggerNewsFetch() {
    try {
      logger.info('🔄 触发新闻获取任务...');
      const response = await axios.post(`${this.ingestWorkerUrl}/api/trigger/news-fetch`, {
        limit: 100
      });
      logger.info('✅ 新闻获取任务完成:', response.data);
    } catch (error) {
      logger.error('❌ 新闻获取任务失败:', error);
    }
  }

  private async triggerHighLevelScan() {
    try {
      logger.info('🔍 触发高级别新闻扫描...');
      const response = await axios.post(`${this.graphWorkerUrl}/api/trigger/high-level-scan`, {
        minutes: 30
      });
      logger.info('✅ 高级别新闻扫描完成:', response.data);
    } catch (error) {
      logger.error('❌ 高级别新闻扫描失败:', error);
    }
  }

  private async triggerHourlySummary() {
    try {
      logger.info('📊 触发小时总结生成...');
      const response = await axios.post(`${this.graphWorkerUrl}/api/trigger/hourly-summary`);
      logger.info('✅ 小时总结生成完成:', response.data);
    } catch (error) {
      logger.error('❌ 小时总结生成失败:', error);
    }
  }

  private async triggerDailySummary() {
    try {
      logger.info('📈 触发每日总结生成...');
      const response = await axios.post(`${this.graphWorkerUrl}/api/trigger/daily-summary`);
      logger.info('✅ 每日总结生成完成:', response.data);
    } catch (error) {
      logger.error('❌ 每日总结生成失败:', error);
    }
  }

  private async triggerGraphMaintenance() {
    try {
      logger.info('🔧 触发图谱维护任务...');
      const response = await axios.post(`${this.graphWorkerUrl}/api/trigger/maintenance`);
      logger.info('✅ 图谱维护任务完成:', response.data);
    } catch (error) {
      logger.error('❌ 图谱维护任务失败:', error);
    }
  }
} 
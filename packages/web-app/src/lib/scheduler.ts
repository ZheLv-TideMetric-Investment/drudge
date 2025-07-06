import cron from 'node-cron';
import { config } from './config';
import { highLevelNewsScanner } from './services/high-level-scanner';
import { summaryService } from './services/summary';
import { neo4jService } from './services/neo4j';
import { notificationService } from './services/notification';
import { JobConfig, JobStatus, CallSource } from '../types/scheduler';

/**
 * 定时任务调度器
 * 在 Next.js 应用中管理定时任务
 */
class Scheduler {
  private jobs: Map<string, cron.ScheduledTask> = new Map();
  private jobConfigs: Map<string, JobConfig> = new Map();
  private running: boolean = false;

  constructor() {
    this.setupJobConfigs();
  }

  /**
   * 设置任务配置
   */
  private setupJobConfigs(): void {
    // 高级别新闻扫描任务 - 每5分钟执行一次
    this.jobConfigs.set('high-level-scan', {
      name: 'high-level-scan',
      schedule: config.cron.highLevelScan,
      description: '扫描高级别新闻并发送通知',
      enabled: true,
      action: async () => {
        await this.runHighLevelScan();
      }
    });

    // 小时总结任务 - 工作时间(11-22点)每小时执行一次
    this.jobConfigs.set('hourly-summary', {
      name: 'hourly-summary',
      schedule: config.cron.hourlySummary,
      description: '生成每小时新闻总结',
      enabled: true,
      action: async () => {
        await this.runHourlySummary();
      }
    });

    // 每日总结任务 - 每天10点执行一次
    this.jobConfigs.set('daily-summary', {
      name: 'daily-summary',
      schedule: config.cron.dailySummary,
      description: '生成每日新闻总结',
      enabled: true,
      action: async () => {
        await this.runDailySummary();
      }
    });
  }

  /**
   * 启动调度器
   */
  async start(): Promise<void> {
    if (this.running) {
      console.log('定时任务调度器已经在运行');
      return;
    }

    try {
      // 初始化服务
      await this.initializeServices();

      // 启动所有任务
      for (const [jobName, jobConfig] of this.jobConfigs) {
        if (jobConfig.enabled) {
          await this.startJob(jobName);
        }
      }

      this.running = true;
      console.log('✅ 定时任务调度器启动成功');
    } catch (error) {
      console.error('❌ 定时任务调度器启动失败:', error);
      throw error;
    }
  }

  /**
   * 停止调度器
   */
  async stop(): Promise<void> {
    if (!this.running) {
      console.log('定时任务调度器未在运行');
      return;
    }

    try {
      // 停止所有任务
      for (const [jobName] of this.jobs) {
        await this.stopJob(jobName);
      }

      this.running = false;
      console.log('✅ 定时任务调度器已停止');
    } catch (error) {
      console.error('❌ 定时任务调度器停止失败:', error);
      throw error;
    }
  }

  /**
   * 启动指定任务
   */
  async startJob(jobName: string): Promise<boolean> {
    const jobConfig = this.jobConfigs.get(jobName);
    if (!jobConfig) {
      console.error(`任务配置不存在: ${jobName}`);
      return false;
    }

    if (this.jobs.has(jobName)) {
      console.log(`任务 ${jobName} 已经在运行`);
      return true;
    }

    try {
      const task = cron.schedule(jobConfig.schedule, async () => {
        console.log(`执行定时任务: ${jobName}`);
        try {
          await jobConfig.action();
        } catch (error) {
          console.error(`定时任务执行失败: ${jobName}`, error);
        }
      }, {
        scheduled: true,
        timezone: 'Asia/Shanghai'
      });

      this.jobs.set(jobName, task);
      console.log(`✅ 定时任务 ${jobName} 启动成功 (${jobConfig.schedule})`);
      return true;
    } catch (error) {
      console.error(`❌ 定时任务 ${jobName} 启动失败:`, error);
      return false;
    }
  }

  /**
   * 停止指定任务
   */
  async stopJob(jobName: string): Promise<boolean> {
    const task = this.jobs.get(jobName);
    if (!task) {
      console.log(`任务 ${jobName} 不存在或未运行`);
      return false;
    }

    try {
      task.stop();
      this.jobs.delete(jobName);
      console.log(`✅ 定时任务 ${jobName} 已停止`);
      return true;
    } catch (error) {
      console.error(`❌ 定时任务 ${jobName} 停止失败:`, error);
      return false;
    }
  }

  /**
   * 手动触发任务
   */
  async triggerJob(jobName: string): Promise<boolean> {
    const jobConfig = this.jobConfigs.get(jobName);
    if (!jobConfig) {
      console.error(`任务配置不存在: ${jobName}`);
      return false;
    }

    try {
      console.log(`手动触发任务: ${jobName}`);
      await jobConfig.action();
      console.log(`✅ 任务 ${jobName} 手动执行成功`);
      return true;
    } catch (error) {
      console.error(`❌ 任务 ${jobName} 手动执行失败:`, error);
      return false;
    }
  }

  /**
   * 获取任务状态
   */
  getJobStatus(): JobStatus[] {
    return Array.from(this.jobConfigs.entries()).map(([jobName, jobConfig]) => {
      const isRunning = this.jobs.has(jobName);
      return {
        name: jobName,
        schedule: jobConfig.schedule,
        description: jobConfig.description,
        enabled: jobConfig.enabled,
        running: isRunning,
        lastRun: undefined, // 可以在实际执行时记录
        nextRun: isRunning ? this.getNextRunTime(jobConfig.schedule) : undefined
      };
    });
  }

  /**
   * 获取调度器状态
   */
  getStatus(): any {
    return {
      running: this.running,
      jobs: this.getJobStatus(),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 初始化服务
   */
  private async initializeServices(): Promise<void> {
    try {
      // 连接Neo4j
      await neo4jService.connect();

      // 初始化通知服务
      await notificationService.initialize();

      console.log('✅ 所有服务初始化完成');
    } catch (error) {
      console.error('❌ 服务初始化失败:', error);
      throw error;
    }
  }

  /**
   * 执行高级别新闻扫描
   */
  private async runHighLevelScan(): Promise<void> {
    try {
      const result = await highLevelNewsScanner.scanHighLevelNews(CallSource.SCHEDULER);
      console.log(`高级别新闻扫描完成: ${result.message}`);
    } catch (error) {
      console.error('高级别新闻扫描失败:', error);
    }
  }

  /**
   * 执行小时总结
   */
  private async runHourlySummary(): Promise<void> {
    try {
      const result = await summaryService.generateHourlySummary(undefined, CallSource.SCHEDULER);
      console.log(`小时总结完成: ${result.message}`);
    } catch (error) {
      console.error('小时总结失败:', error);
    }
  }

  /**
   * 执行每日总结
   */
  private async runDailySummary(): Promise<void> {
    try {
      const result = await summaryService.generateDailySummary(CallSource.SCHEDULER);
      console.log(`每日总结完成: ${result.message}`);
    } catch (error) {
      console.error('每日总结失败:', error);
    }
  }

  /**
   * 获取下次运行时间
   */
  private getNextRunTime(schedule: string): string {
    try {
      // 这里应该解析cron表达式来计算下次运行时间
      // 简单实现，返回当前时间+1分钟
      const nextRun = new Date();
      nextRun.setMinutes(nextRun.getMinutes() + 1);
      return nextRun.toISOString();
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * 优雅关闭
   */
  async gracefulShutdown(): Promise<void> {
    console.log('开始优雅关闭定时任务调度器...');
    
    try {
      await this.stop();
      await neo4jService.disconnect();
      console.log('✅ 定时任务调度器优雅关闭完成');
    } catch (error) {
      console.error('❌ 定时任务调度器关闭失败:', error);
    }
  }
}

// 导出全局实例
export const scheduler = new Scheduler();

// 在服务器端启动时自动初始化
if (typeof window === 'undefined') {
  // 延迟启动，避免在构建时执行
  setTimeout(() => {
    scheduler.start().catch(console.error);
  }, 1000);

  // 处理程序终止信号
  process.on('SIGINT', async () => {
    console.log('\n收到 SIGINT 信号，开始优雅关闭...');
    await scheduler.gracefulShutdown();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n收到 SIGTERM 信号，开始优雅关闭...');
    await scheduler.gracefulShutdown();
    process.exit(0);
  });
} 
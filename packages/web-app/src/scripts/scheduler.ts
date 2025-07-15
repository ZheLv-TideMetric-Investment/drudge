#!/usr/bin/env node
import cron from 'node-cron';
import axios from 'axios';
import moment from 'moment-timezone';
import { config } from '../lib/config';
import { 
  SchedulerTrigger, 
  SCHEDULER_CRON_CONFIG, 
  SchedulerApiRequest,
  SchedulerApiResponse 
} from '../types/scheduler';

/**
 * 轻量级定时器调度器
 * 使用node-cron设置触发器，调用Next.js API接口执行实际业务逻辑
 */
class CronScheduler {
  private tasks: Map<SchedulerTrigger, cron.ScheduledTask> = new Map();
  private taskStatus: Map<SchedulerTrigger, boolean> = new Map();
  private apiBaseUrl: string;
  
  constructor() {
    // 构建API基础URL
    const port = process.env.PORT || 39112;
    this.apiBaseUrl = `http://localhost:${port}/api`;
    
    console.log(`[CronScheduler] 初始化定时器调度器，API地址: ${this.apiBaseUrl}`);
  }

  /**
   * 启动所有定时器
   */
  start(): void {
    console.log('[CronScheduler] 启动定时器调度器...');
    
    // 设置每分钟触发器
    this.setupTrigger(SchedulerTrigger.EVERY_MINUTE, '系统健康检查');
    
    // 设置每5分钟触发器
    this.setupTrigger(SchedulerTrigger.EVERY_5_MINUTES, '高级别新闻扫描');
    
    // 设置每半小时触发器
    this.setupTrigger(SchedulerTrigger.EVERY_30_MINUTES, '数据缓存更新');
    
    // 设置每小时触发器（工作时间11-22点）
    this.setupTrigger(SchedulerTrigger.EVERY_HOUR, '小时总结生成');
    
    // 设置隔夜触发器（22点）
    this.setupTrigger(SchedulerTrigger.OVERNIGHT, '每日总结生成');
    
    console.log(`[CronScheduler] 所有定时器已启动，共 ${this.tasks.size} 个任务`);
    
    // 显示定时器状态
    this.printStatus();
    
    // 优雅关闭处理
    this.setupGracefulShutdown();
  }

  /**
   * 设置单个触发器
   */
  private setupTrigger(trigger: SchedulerTrigger, description: string): void {
    const cronExpression = SCHEDULER_CRON_CONFIG[trigger];
    
    const task = cron.schedule(cronExpression, async () => {
      await this.executeTrigger(trigger, description);
    }, {
      scheduled: false, // 先不启动，等所有设置完成后一起启动
      timezone: 'Asia/Shanghai'
    });
    
    this.tasks.set(trigger, task);
    console.log(`[CronScheduler] 设置触发器: ${trigger} (${description}) - ${cronExpression}`);
  }

  /**
   * 执行触发器 - 调用API接口
   */
  private async executeTrigger(trigger: SchedulerTrigger, description: string): Promise<void> {
    const timestamp = moment().toISOString();
    
    console.log(`[CronScheduler] 触发器执行: ${trigger} (${description}) at ${timestamp}`);
    
    try {
      const requestData: SchedulerApiRequest = {
        trigger,
        timestamp,
        metadata: {
          source: 'cron_scheduler',
          description,
          executedAt: timestamp
        }
      };
      
      const response = await axios.post(
        `${this.apiBaseUrl}/scheduler`,
        requestData,
        {
          timeout: 300000, // 5分钟超时
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'CronScheduler/1.0'
          }
        }
      );
      
      const result: SchedulerApiResponse = response.data;
      
      if (result.success) {
        console.log(`[CronScheduler] ✅ ${trigger} 执行成功: ${result.message}`);
      } else {
        console.error(`[CronScheduler] ❌ ${trigger} 执行失败: ${result.message}`);
        if (result.error) {
          console.error(`[CronScheduler] 错误详情: ${result.error}`);
        }
      }
      
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const status = error.response?.status || 'UNKNOWN';
        const message = error.response?.data?.message || error.message;
        console.error(`[CronScheduler] ❌ ${trigger} API调用失败 (${status}): ${message}`);
      } else {
        console.error(`[CronScheduler] ❌ ${trigger} 执行出错:`, error);
      }
    }
  }

  /**
   * 启动所有任务
   */
  private startAllTasks(): void {
    for (const [trigger, task] of this.tasks) {
      task.start();
      this.taskStatus.set(trigger, true);
      console.log(`[CronScheduler] ✅ 启动任务: ${trigger}`);
    }
  }

  /**
   * 停止所有任务
   */
  stop(): void {
    console.log('[CronScheduler] 停止所有定时器...');
    
    for (const [trigger, task] of this.tasks) {
      task.stop();
      this.taskStatus.set(trigger, false);
      console.log(`[CronScheduler] ⏹️  停止任务: ${trigger}`);
    }
    
    this.tasks.clear();
    this.taskStatus.clear();
    console.log('[CronScheduler] 所有定时器已停止');
  }

  /**
   * 打印定时器状态
   */
  private printStatus(): void {
    console.log('\n[CronScheduler] 定时器状态:');
    console.log('================================');
    
    for (const [trigger] of this.tasks) {
      const cronExpression = SCHEDULER_CRON_CONFIG[trigger];
      const isRunning = this.taskStatus.get(trigger) || false;
      const status = isRunning ? '运行中' : '已停止';
      console.log(`${trigger}: ${cronExpression} (${status})`);
    }
    
    console.log('================================\n');
  }

  /**
   * 设置优雅关闭
   */
  private setupGracefulShutdown(): void {
    const gracefulShutdown = () => {
      console.log('\n[CronScheduler] 收到关闭信号，优雅关闭中...');
      this.stop();
      process.exit(0);
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
    process.on('SIGHUP', gracefulShutdown);
  }

  /**
   * 获取运行状态
   */
  getStatus(): Record<string, unknown> {
    const status: Record<string, unknown> = {};
    
    for (const [trigger] of this.tasks) {
      status[trigger] = {
        running: this.taskStatus.get(trigger) || false,
        cronExpression: SCHEDULER_CRON_CONFIG[trigger]
      };
    }
    
    return {
      totalTasks: this.tasks.size,
      apiBaseUrl: this.apiBaseUrl,
      tasks: status,
      startedAt: new Date().toISOString()
    };
  }
}

// 主程序入口
async function main() {
  console.log('[CronScheduler] 启动轻量级定时器调度器');
  console.log(`[CronScheduler] Node.js 版本: ${process.version}`);
  console.log(`[CronScheduler] 时区: ${moment.tz.guess()}`);
  console.log(`[CronScheduler] 当前时间: ${moment().format('YYYY-MM-DD HH:mm:ss')}`);
  
  const scheduler = new CronScheduler();
  
  try {
    // 等待一小段时间确保Next.js服务已启动
    console.log('[CronScheduler] 等待Next.js服务启动...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // 启动定时器
    scheduler.start();
    scheduler['startAllTasks'](); // 调用私有方法启动所有任务
    
    console.log('[CronScheduler] 定时器调度器启动完成，按 Ctrl+C 退出');
    
    // 保持进程运行
    setInterval(() => {
      // 每10分钟输出一次状态
      const now = moment();
      if (now.minute() % 10 === 0 && now.second() === 0) {
        console.log(`[CronScheduler] 心跳检查 - ${now.format('YYYY-MM-DD HH:mm:ss')}`);
      }
    }, 1000);
    
  } catch (error) {
    console.error('[CronScheduler] 启动失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本，则启动主程序
if (require.main === module) {
  main().catch(error => {
    console.error('[CronScheduler] 程序异常退出:', error);
    process.exit(1);
  });
}

export default CronScheduler; 
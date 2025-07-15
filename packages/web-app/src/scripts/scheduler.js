#!/usr/bin/env node
const cron = require('node-cron');
const axios = require('axios');
const moment = require('moment-timezone');

/**
 * 定时器触发器类型枚举
 */
const SchedulerTrigger = {
  EVERY_MINUTE: 'every_minute',
  EVERY_5_MINUTES: 'every_5_minutes',
  EVERY_30_MINUTES: 'every_30_minutes',
  EVERY_HOUR: 'every_hour',
  OVERNIGHT: 'overnight'
};

/**
 * 定时器配置映射
 */
const SCHEDULER_CRON_CONFIG = {
  [SchedulerTrigger.EVERY_MINUTE]: '* * * * *',           // 每分钟
  [SchedulerTrigger.EVERY_5_MINUTES]: '*/5 * * * *',      // 每5分钟
  [SchedulerTrigger.EVERY_30_MINUTES]: '*/30 * * * *',    // 每半小时
  [SchedulerTrigger.EVERY_HOUR]: '0 11-22 * * *',         // 每小时（11-22点）
  [SchedulerTrigger.OVERNIGHT]: '0 22 * * *'              // 隔夜（22点）
};

/**
 * 轻量级定时器调度器
 */
class CronScheduler {
  constructor() {
    this.tasks = new Map();
    this.taskStatus = new Map();
    
    // 构建API基础URL
    const port = process.env.PORT || 39112;
    this.apiBaseUrl = `http://localhost:${port}/api`;
    
    console.log(`[CronScheduler] 初始化定时器调度器，API地址: ${this.apiBaseUrl}`);
  }

  /**
   * 启动所有定时器
   */
  start() {
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
  setupTrigger(trigger, description) {
    const cronExpression = SCHEDULER_CRON_CONFIG[trigger];
    
    const task = cron.schedule(cronExpression, async () => {
      await this.executeTrigger(trigger, description);
    }, {
      scheduled: false, // 先不启动，等所有设置完成后一起启动
      timezone: 'Asia/Shanghai'
    });
    
    this.tasks.set(trigger, task);
    this.taskStatus.set(trigger, false);
    console.log(`[CronScheduler] 设置触发器: ${trigger} (${description}) - ${cronExpression}`);
  }

  /**
   * 执行触发器 - 调用API接口
   */
  async executeTrigger(trigger, description) {
    const timestamp = moment().toISOString();
    
    console.log(`[CronScheduler] 触发器执行: ${trigger} (${description}) at ${timestamp}`);
    
    try {
      const requestData = {
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
      
      const result = response.data;
      
      if (result.success) {
        console.log(`[CronScheduler] ✅ ${trigger} 执行成功: ${result.message}`);
      } else {
        console.error(`[CronScheduler] ❌ ${trigger} 执行失败: ${result.message}`);
        if (result.error) {
          console.error(`[CronScheduler] 错误详情: ${result.error}`);
        }
      }
      
    } catch (error) {
      if (error.response) {
        const status = error.response.status || 'UNKNOWN';
        const message = error.response.data?.message || error.message;
        console.error(`[CronScheduler] ❌ ${trigger} API调用失败 (${status}): ${message}`);
      } else {
        console.error(`[CronScheduler] ❌ ${trigger} 执行出错:`, error.message);
      }
    }
  }

  /**
   * 启动所有任务
   */
  startAllTasks() {
    for (const [trigger, task] of this.tasks) {
      task.start();
      this.taskStatus.set(trigger, true);
      console.log(`[CronScheduler] ✅ 启动任务: ${trigger}`);
    }
  }

  /**
   * 停止所有任务
   */
  stop() {
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
  printStatus() {
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
  setupGracefulShutdown() {
    const gracefulShutdown = () => {
      console.log('\n[CronScheduler] 收到关闭信号，优雅关闭中...');
      this.stop();
      process.exit(0);
    };

    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
    process.on('SIGHUP', gracefulShutdown);
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
    scheduler.startAllTasks();
    
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

module.exports = CronScheduler; 
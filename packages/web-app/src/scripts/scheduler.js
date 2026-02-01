#!/usr/bin/env node
const cron = require('node-cron');
const axios = require('axios');
const { BEIJING_TIMEZONE } = require('@drudge/common');
const beijingFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: BEIJING_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

const getBeijingParts = (date = new Date()) => {
  const parts = beijingFormatter.formatToParts(date);
  const partMap = {};
  for (const part of parts) {
    partMap[part.type] = part.value;
  }
  return partMap;
};

const formatBeijingDateTime = (date = new Date()) => {
  const { year, month, day, hour, minute, second } = getBeijingParts(date);
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
};

const getNowISOString = () => new Date().toISOString();

/**
 * 定时器触发器类型枚举
 */
const SchedulerTrigger = {
  EVERY_MINUTE: 'every_minute', // 每分钟
  EVERY_5_MINUTES: 'every_5_minutes', // 每5分钟
  EVERY_30_MINUTES: 'every_30_minutes', // 每半小时
  EVERY_HOUR: 'every_hour', // 每小时（全天24小时）
  EVERY_HOUR_05: 'every_hour_05', // 每小时05分（全天24小时）
  DAYTIME: 'daytime', // 白天（11-22点）
  DAYTIME_05: 'daytime_05', // 白天05分（11-22点）
  OVERNIGHT: 'overnight', // 隔夜（10点）
  OVERNIGHT_05: 'overnight_05', // 隔夜（10点05分）
  WEEKLY_FRIDAY_1605: 'weekly_friday_1605', // 每周五16:05分
};

/**
 * 定时器配置映射 - Cron表达式格式：分 时 日 月 周
 *
 * 任务频率分类：
 * 1. 高频监控（分钟级）：系统状态、新闻扫描
 * 2. 定期维护（小时级）：数据同步、报告生成
 * 3. 业务时间（白天）：工作时间11-22点的业务处理
 * 4. 夜间批处理：总结报告、数据清理
 * 5. 特殊周期：周报、月报等定期任务
 */
const SCHEDULER_CRON_CONFIG = {
  [SchedulerTrigger.EVERY_MINUTE]: '* * * * *', // 每分钟：系统监控
  [SchedulerTrigger.EVERY_5_MINUTES]: '*/5 * * * *', // 每5分钟：新闻扫描
  [SchedulerTrigger.EVERY_30_MINUTES]: '*/30 * * * *', // 每30分钟：缓存更新
  [SchedulerTrigger.EVERY_HOUR]: '0 * * * *', // 每小时整点（全天）：系统维护
  [SchedulerTrigger.EVERY_HOUR_05]: '5 * * * *', // 每小时05分（全天）：数据同步
  [SchedulerTrigger.DAYTIME]: '0 11-22 * * *', // 白天整点（11-22点）：业务报告
  [SchedulerTrigger.DAYTIME_05]: '5 11-22 * * *', // 白天05分（11-22点）：摘要处理
  [SchedulerTrigger.OVERNIGHT]: '0 10 * * *', // 隔夜（10点）：日报生成
  [SchedulerTrigger.OVERNIGHT_05]: '5 10 * * *', // 隔夜（10点05分）：数据备份
  [SchedulerTrigger.WEEKLY_FRIDAY_1605]: '5 16 * * 5', // 每周五16:05：周报处理
};

/**
 * 轻量级定时器调度器
 *
 * 任务分类：
 * - 高频监控：每分钟、每5分钟、每30分钟
 * - 全天定时：每小时整点、每小时05分（24小时运行）
 * - 工作时间：白天11-22点的定时任务
 * - 隔夜任务：早上10点和10点05分的总结和维护任务
 * - 周期特殊：每周五的定期报告
 */
class CronScheduler {
  constructor() {
    this.tasks = new Map();
    this.taskStatus = new Map();

    // 构建API基础URL
    const port = process.env.PORT || 39112;
    this.apiBaseUrl = `http://localhost:${port}/api`;

    console.log(`[CronScheduler] 初始化定时器调度器，API地址: ${this.apiBaseUrl}`);
    console.log(`[CronScheduler] 支持触发器类型: ${Object.keys(SchedulerTrigger).length} 种`);
  }

  /**
   * 启动所有定时器
   */
  start() {
    console.log('[CronScheduler] 启动定时器调度器...');

    // 高频监控任务
    this.setupTrigger(SchedulerTrigger.EVERY_MINUTE, '每分钟定时器');
    this.setupTrigger(SchedulerTrigger.EVERY_5_MINUTES, '每5分钟定时器');
    this.setupTrigger(SchedulerTrigger.EVERY_30_MINUTES, '每30分钟定时器');

    // 全天定时任务
    this.setupTrigger(SchedulerTrigger.EVERY_HOUR, '每小时定时器');
    this.setupTrigger(SchedulerTrigger.EVERY_HOUR_05, '每小时05分定时器');

    // 工作时间任务（11-22点）
    this.setupTrigger(SchedulerTrigger.DAYTIME, '白天定时器');
    this.setupTrigger(SchedulerTrigger.DAYTIME_05, '白天05分定时器');

    // 夜间任务
    this.setupTrigger(SchedulerTrigger.OVERNIGHT, '隔夜定时器（10点）');
    this.setupTrigger(SchedulerTrigger.OVERNIGHT_05, '隔夜05分定时器（10点05分）');

    // 周期性特殊任务
    this.setupTrigger(SchedulerTrigger.WEEKLY_FRIDAY_1605, '每周五16:05定时器');

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

    const task = cron.schedule(
      cronExpression,
      async () => {
        await this.executeTrigger(trigger, description);
      },
      {
        scheduled: false, // 先不启动，等所有设置完成后一起启动
        timezone: BEIJING_TIMEZONE,
      }
    );

    this.tasks.set(trigger, task);
    this.taskStatus.set(trigger, false);
    console.log(`[CronScheduler] 设置触发器: ${trigger} (${description}) - ${cronExpression}`);
  }

  /**
   * 执行触发器 - 调用API接口
   */
  async executeTrigger(trigger, description) {
    const timestamp = getNowISOString();

    console.log(`[CronScheduler] 触发器执行: ${trigger} (${description}) at ${timestamp}`);

    try {
      const requestData = {
        trigger,
        timestamp,
        metadata: {
          source: 'cron_scheduler',
          description,
          executedAt: timestamp,
          timezone: BEIJING_TIMEZONE,
        },
      };

      const response = await axios.post(`${this.apiBaseUrl}/scheduler`, requestData, {
        timeout: 300000, // 5分钟超时
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'CronScheduler/1.0',
        },
      });

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
  console.log(`[CronScheduler] 时区: ${BEIJING_TIMEZONE} (北京时间)`);
  console.log(
    `[CronScheduler] 当前时间: ${formatBeijingDateTime()}`
  );

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
      const nowParts = getBeijingParts();
      const minute = Number(nowParts.minute || 0);
      const second = Number(nowParts.second || 0);
      if (minute % 10 === 0 && second === 0) {
        console.log(`[CronScheduler] 心跳检查 - ${formatBeijingDateTime()}`);
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

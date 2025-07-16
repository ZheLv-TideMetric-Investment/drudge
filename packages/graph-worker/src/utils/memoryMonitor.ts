import { logger } from './logger';
import config from '../config/config';

export interface MemoryStats {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  usagePercentage: number;
  timestamp: Date;
}

export class MemoryMonitor {
  private monitoringInterval: NodeJS.Timeout | null = null;
  private readonly WARNING_THRESHOLD: number;
  private readonly DANGER_THRESHOLD: number;
  private readonly MAX_HEAP_SIZE: number;
  
  constructor() {
    // 从配置文件读取阈值
    this.WARNING_THRESHOLD = config.processing.memory.warningThreshold;
    this.DANGER_THRESHOLD = config.processing.memory.dangerThreshold;
    this.MAX_HEAP_SIZE = config.processing.memory.maxHeapSizeMB * 1024 * 1024; // 转换为字节
  }
  
  /**
   * 开始内存监控
   */
  startMonitoring(intervalMs?: number): void {
    if (this.monitoringInterval) {
      return; // 已经在监控中
    }
    
    // 使用配置文件中的间隔时间
    const interval = intervalMs || config.processing.memory.monitoringIntervalMs;
    
    logger.info(`🔍 开始内存监控... (间隔: ${interval}ms, 警告阈值: ${this.WARNING_THRESHOLD * 100}%, 危险阈值: ${this.DANGER_THRESHOLD * 100}%)`);
    
    this.monitoringInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, interval);
    
    // 立即检查一次
    this.checkMemoryUsage();
  }
  
  /**
   * 停止内存监控
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      logger.info('⏹️ 内存监控已停止');
    }
  }
  
  /**
   * 获取当前内存使用情况
   */
  getMemoryStats(): MemoryStats {
    const memUsage = process.memoryUsage();
    
    return {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      usagePercentage: memUsage.heapUsed / this.MAX_HEAP_SIZE,
      timestamp: new Date()
    };
  }
  
  /**
   * 检查内存使用情况并采取必要措施
   */
  private checkMemoryUsage(): void {
    const stats = this.getMemoryStats();
    const usedMB = Math.round(stats.heapUsed / 1024 / 1024);
    const totalMB = Math.round(stats.heapTotal / 1024 / 1024);
    const maxMB = Math.round(this.MAX_HEAP_SIZE / 1024 / 1024);
    const usagePercent = Math.round(stats.usagePercentage * 100);
    
    // 根据使用情况采取不同措施
    if (stats.usagePercentage >= this.DANGER_THRESHOLD) {
      logger.error(`🚨 内存使用达到危险水平: ${usedMB}MB/${maxMB}MB (${usagePercent}%)`);
      if (config.processing.memory.enableAutoGC) {
        this.forceGarbageCollection();
      }
      
      // 发送内存告警通知
      this.sendMemoryAlert('danger', stats);
      
    } else if (stats.usagePercentage >= this.WARNING_THRESHOLD) {
      logger.warn(`⚠️ 内存使用较高: ${usedMB}MB/${maxMB}MB (${usagePercent}%)`);
      if (config.processing.memory.enableAutoGC) {
        this.forceGarbageCollection();
      }
      
    } else {
      logger.debug(`💚 内存使用正常: ${usedMB}MB/${maxMB}MB (${usagePercent}%)`);
    }
  }
  
  /**
   * 强制执行垃圾回收
   */
  forceGarbageCollection(): void {
    if (!config.processing.memory.enableAutoGC) {
      logger.debug('⚠️ 自动垃圾回收已禁用');
      return;
    }
    
    if (global.gc) {
      const beforeGC = process.memoryUsage().heapUsed;
      global.gc();
      const afterGC = process.memoryUsage().heapUsed;
      const freedMB = Math.round((beforeGC - afterGC) / 1024 / 1024);
      
      logger.info(`🗑️ 垃圾回收完成，释放内存: ${freedMB}MB`);
    } else {
      logger.warn('⚠️ 垃圾回收功能未启用，请使用 --expose-gc 启动参数');
    }
  }
  
  /**
   * 发送内存告警通知
   */
  private async sendMemoryAlert(level: 'warning' | 'danger', stats: MemoryStats): Promise<void> {
    try {
      // 这里可以集成通知服务
      const usedMB = Math.round(stats.heapUsed / 1024 / 1024);
      const maxMB = Math.round(this.MAX_HEAP_SIZE / 1024 / 1024);
      const usagePercent = Math.round(stats.usagePercentage * 100);
      
      const message = `Graph Worker 内存使用${level === 'danger' ? '危险' : '警告'}:\n` +
                     `当前使用: ${usedMB}MB/${maxMB}MB (${usagePercent}%)\n` +
                     `时间: ${stats.timestamp.toISOString()}`;
      
      logger.info(`📧 内存告警通知: ${message}`);
      
      // 这里可以调用通知服务发送告警
      // await notificationService.sendMemoryAlert(level, message);
      
    } catch (error) {
      logger.error('发送内存告警失败:', error);
    }
  }
  
  /**
   * 获取内存使用报告
   */
  getMemoryReport(): string {
    const stats = this.getMemoryStats();
    const usedMB = Math.round(stats.heapUsed / 1024 / 1024);
    const totalMB = Math.round(stats.heapTotal / 1024 / 1024);
    const externalMB = Math.round(stats.external / 1024 / 1024);
    const rssMB = Math.round(stats.rss / 1024 / 1024);
    const maxMB = Math.round(this.MAX_HEAP_SIZE / 1024 / 1024);
    const usagePercent = Math.round(stats.usagePercentage * 100);
    
    return `
📊 内存使用报告 (${stats.timestamp.toISOString()})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔹 堆内存使用: ${usedMB}MB / ${maxMB}MB (${usagePercent}%)
🔹 堆内存总计: ${totalMB}MB
🔹 外部内存: ${externalMB}MB  
🔹 物理内存: ${rssMB}MB
🔹 警告阈值: ${this.WARNING_THRESHOLD * 100}% (${Math.round(maxMB * this.WARNING_THRESHOLD)}MB)
🔹 危险阈值: ${this.DANGER_THRESHOLD * 100}% (${Math.round(maxMB * this.DANGER_THRESHOLD)}MB)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 状态: ${usagePercent >= this.DANGER_THRESHOLD * 100 ? '🚨 危险' : usagePercent >= this.WARNING_THRESHOLD * 100 ? '⚠️ 警告' : '💚 正常'}
🗑️ 自动垃圾回收: ${config.processing.memory.enableAutoGC ? '✅ 启用' : '❌ 禁用'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `;
  }
}

// 导出单例实例
export const memoryMonitor = new MemoryMonitor(); 
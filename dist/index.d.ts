import { SystemStatus } from './shared/types/common';
/**
 * 新闻处理系统主控制器
 * 使用调度器工作线程执行所有定时任务，主线程只负责管理和监控
 */
declare class NewsProcessingSystem {
    private initialized;
    private started;
    /**
     * 初始化系统
     */
    initialize(): Promise<void>;
    /**
     * 设置调度器消息监听
     */
    private setupSchedulerMessageListening;
    /**
     * 处理触发新闻处理请求
     */
    private handleTriggerNewsProcessing;
    /**
     * 启动定时任务
     */
    startScheduledTasks(): Promise<void>;
    /**
     * 停止定时任务
     */
    stopScheduledTasks(): Promise<void>;
    /**
     * 错误通知
     */
    sendErrorNotification(error: Error | string, context: string): Promise<void>;
    /**
     * 获取系统状态
     */
    getSystemStatus(): Promise<SystemStatus>;
}
declare const system: NewsProcessingSystem;
export { system };

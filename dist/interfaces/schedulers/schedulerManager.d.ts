/**
 * 调度器管理器
 * 管理调度器工作线程，将所有定时任务移到工作线程中执行
 */
declare class SchedulerManager {
    constructor();
    /**
     * 初始化调度器管理器
     */
    initialize(): Promise<void>;
    /**
     * 创建调度器工作线程
     */
    createSchedulerWorker(): Promise<unknown>;
    /**
     * 处理工作线程消息
     */
    handleWorkerMessage(message: any): void;
    /**
     * 处理任务结果
     */
    handleTaskResult(taskId: any, result: any): void;
    /**
     * 处理任务错误
     */
    handleTaskError(taskId: any, error: any): void;
    /**
     * 处理新闻获取完成事件
     */
    handleNewsFetched(data: any): void;
    /**
     * 通知新闻处理工作线程
     */
    notifyNewsProcessor(): void;
    /**
     * 处理总结生成完成事件
     */
    handleSummaryGenerated(data: any): void;
    /**
     * 处理定时任务错误
     */
    handleScheduledTaskError(data: any): void;
    /**
     * 处理工作线程错误
     */
    handleWorkerError(error: any): void;
    /**
     * 处理工作线程退出
     */
    handleWorkerExit(): void;
    /**
     * 重启调度器
     */
    restartScheduler(): Promise<void>;
    /**
     * 执行工作线程任务
     */
    executeTask(type: any, data?: any): Promise<unknown>;
    /**
     * 初始化调度器工作线程
     */
    initializeScheduler(): Promise<unknown>;
    /**
     * 启动定时任务
     */
    startScheduledTasks(): Promise<unknown>;
    /**
     * 停止定时任务
     */
    stopScheduledTasks(): Promise<unknown>;
    /**
     * 获取调度器状态
     */
    getSchedulerStatus(): Promise<{
        initialized: boolean;
        started: boolean;
        scheduler?: undefined;
        stats?: undefined;
        pendingTasks?: undefined;
        error?: undefined;
    } | {
        initialized: any;
        started: any;
        scheduler: unknown;
        stats: any;
        pendingTasks: any;
        error?: undefined;
    } | {
        initialized: any;
        started: any;
        error: any;
        stats: any;
        scheduler?: undefined;
        pendingTasks?: undefined;
    }>;
    /**
     * 健康检查
     */
    healthCheck(): Promise<{
        healthy: boolean;
        responseTime: number;
        initialized: any;
        started: any;
        stats: any;
        error?: undefined;
    } | {
        healthy: boolean;
        error: any;
        responseTime?: undefined;
        initialized?: undefined;
        started?: undefined;
        stats?: undefined;
    }>;
    /**
     * 关闭调度器管理器
     */
    shutdown(): Promise<void>;
}
declare const _default: SchedulerManager;
export default _default;

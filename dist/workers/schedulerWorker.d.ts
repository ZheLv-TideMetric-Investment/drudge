/**
 * 调度器工作线程
 * 专门负责执行定时任务，将数据获取与处理完全分离
 */
declare class SchedulerWorker {
    constructor();
    initialize(): Promise<void>;
    /**
     * 启动所有定时任务
     */
    startScheduledTasks(): void;
    /**
     * 停止所有定时任务
     */
    stopScheduledTasks(): void;
    /**
     * 通知主线程
     */
    notifyMainThread(type: any, data: any): void;
    /**
     * 获取当前状态
     */
    getStatus(): {
        initialized: any;
        activeCronJobs: any;
        timestamp: number;
    };
}
export default SchedulerWorker;

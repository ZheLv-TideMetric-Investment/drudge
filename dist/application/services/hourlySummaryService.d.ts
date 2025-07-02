import { HourlySummary } from '../../domain/entities/index';
/**
 * 按小时总结服务
 * 每小时对新闻进行聚合总结和分析
 */
declare class HourlySummaryService {
    constructor();
    /**
     * 初始化服务
     */
    initialize(): Promise<void>;
    /**
     * 执行按小时总结
     * @param {Date} hourStart - 开始时间
     * @param {Date} hourEnd - 结束时间（可选，默认为开始时间+1小时）
     */
    runHourlySummary(hourStart: any, hourEnd?: any): Promise<{
        success: boolean;
        message: string;
        summary?: undefined;
        error?: undefined;
    } | {
        success: boolean;
        summary: HourlySummary;
        message: string;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        message?: undefined;
        summary?: undefined;
    }>;
    /**
     * 使用AI生成总结文本
     * @param {HourlySummary} summary - 小时总结数据
     * @returns {string} - 生成的总结文本
     */
    generateSummaryText(summary: any): Promise<any>;
    /**
     * 生成回退总结（当AI失败时使用）
     * @param {HourlySummary} summary - 小时总结数据
     * @returns {string} - 模板总结文本
     */
    generateFallbackSummary(summary: any): string;
    /**
     * 发送按小时总结通知
     * @param {HourlySummary} summary - 小时总结
     */
    sendHourlySummaryNotification(summary: any): Promise<void>;
    /**
     * 构建按小时总结消息
     * @param {HourlySummary} summary - 小时总结
     * @returns {string} - 格式化的消息
     */
    buildHourlySummaryMessage(summary: any): string;
    /**
     * 获取重要性对应的emoji
     */
    getSignificanceEmoji(significance: any): "🔴" | "🟠" | "🟡" | "🟢" | "⚪";
    /**
     * 生成市场分析
     * @param {HourlySummary} summary - 小时总结
     * @returns {string} - 市场分析文本
     */
    generateMarketAnalysis(summary: any): string;
    /**
     * 获取历史按小时总结
     * @param {Date} startDate - 开始日期
     * @param {Date} endDate - 结束日期
     * @param {number} limit - 限制数量
     */
    getHistoricalSummaries(startDate: any, endDate: any, limit?: number): Promise<any[]>;
    /**
     * 获取今日总结统计
     */
    getTodaySummaryStats(): Promise<{
        date: string;
        total_hours_with_news: number;
        total_news_count: any;
        total_critical_news_count: any;
        most_active_hour: {
            time: string;
            news_count: any;
        };
        total_companies_mentioned: number;
        hourly_summaries: number;
    }>;
    /**
     * 执行上一小时总结
     */
    runLastHourSummary(): Promise<{
        success: boolean;
        message: string;
        summary?: undefined;
        error?: undefined;
    } | {
        success: boolean;
        summary: HourlySummary;
        message: string;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        message?: undefined;
        summary?: undefined;
    }>;
    /**
     * 生成小时总结（用于定时任务调用）
     * @param {Date} hourStart - 开始时间
     * @param {Date} hourEnd - 结束时间
     */
    generateHourlySummary(hourStart: any, hourEnd: any): Promise<{
        success: boolean;
        message: string;
        summary?: undefined;
        error?: undefined;
    } | {
        success: boolean;
        summary: HourlySummary;
        message: string;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        message?: undefined;
        summary?: undefined;
    }>;
}
declare const _default: HourlySummaryService;
export default _default;

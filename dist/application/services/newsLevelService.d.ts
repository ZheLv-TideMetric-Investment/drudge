import { NewsLevel } from '../../shared/types/enums';
/**
 * 新闻级别处理服务
 * 基于News Level对新闻进行分级处理和推送
 */
declare class NewsLevelService {
    constructor();
    /**
     * 初始化服务
     */
    initialize(): Promise<void>;
    /**
     * 检查并处理新闻级别
     * @param {Object} newsItem - 新闻对象
     * @param {Object} extractionResult - 提取结果
     * @param {boolean} forceUpdate - 是否强制更新
     * @returns {Object} - 处理结果
     */
    checkAndHandleNewsLevel(newsItem: any, extractionResult: any, forceUpdate?: boolean): Promise<{
        newsLevel: any;
        alreadyProcessed: boolean;
        shouldPush: any;
        isHighLevel: boolean;
        isBreakNews: boolean;
        updated: boolean;
        error?: undefined;
    } | {
        newsLevel: NewsLevel;
        alreadyProcessed: boolean;
        shouldPush: boolean;
        isHighLevel: boolean;
        isBreakNews: boolean;
        updated: boolean;
        error: any;
    }>;
    /**
     * 判断是否需要推送新闻
     * @param {string} newsLevel - 新闻级别
     * @returns {boolean} - 是否需要推送
     */
    shouldPushNews(newsLevel: any): any;
    /**
     * 发送新闻级别通知
     * @param {Object} newsItem - 新闻对象
     * @param {Object} extractionResult - 提取结果
     */
    sendNewsLevelNotification(newsItem: any, extractionResult: any): Promise<void>;
    /**
     * 扫描并推送高级别新闻
     * @param {number} limit - 限制数量
     * @returns {Object} - 扫描结果
     */
    scanForHighLevelNews(limit?: number): Promise<{
        success: boolean;
        totalFound: number;
        newPushed: number;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        totalFound: number;
        newPushed: number;
    }>;
    /**
     * 从数据库获取指定级别的新闻
     * @param {string} level - 新闻级别
     * @param {number} limit - 限制数量
     * @returns {Array} - 新闻列表
     */
    getNewsItemsByLevel(level: any, limit?: number): Promise<{
        newsId: any;
        title: any;
        content: any;
        timestamp: any;
        level: any;
        events: any;
        companies: any;
    }[]>;
    /**
     * 获取新闻级别统计
     * @param {Date} startDate - 开始日期
     * @param {Date} endDate - 结束日期
     * @returns {Object} - 统计结果
     */
    getNewsLevelStats(startDate: any, endDate: any): Promise<{
        total: number;
        byLevel: {};
    }>;
    /**
     * 更新推送配置
     * @param {string} level - 新闻级别
     * @param {Object} config - 配置选项
     */
    updatePushConfig(level: any, config: any): void;
    /**
     * 清理过期缓存
     */
    cleanupCache(): void;
    /**
     * 获取缓存统计
     */
    getCacheStats(): {
        size: any;
        levels: {};
    };
    /**
     * 判断是否为高级别新闻
     * @param {string} newsLevel - 新闻级别
     * @returns {boolean} - 是否为高级别
     */
    isHighLevel(newsLevel: any): boolean;
    /**
     * 判断是否为Break News
     * @param {string} newsLevel - 新闻级别
     * @returns {boolean} - 是否为Break News
     */
    isBreakNews(newsLevel: any): boolean;
    /**
     * 获取指定时间范围内的Break News
     * @param {moment} startTime - 开始时间
     * @param {moment} endTime - 结束时间
     * @returns {Array} - Break News列表
     */
    getBreakNewsByTimeRange(startTime: any, endTime: any): Promise<{
        newsId: any;
        title: any;
        detectedAt: any;
        level: any;
        impactScore: any;
        reason: any;
        companies: any;
        isBreakNews: boolean;
    }[]>;
    /**
     * 获取指定时间范围内的高级别新闻
     * @param {moment} startTime - 开始时间
     * @param {moment} endTime - 结束时间
     * @returns {Array} - 高级别新闻列表
     */
    getHighLevelNewsByTimeRange(startTime: any, endTime: any): Promise<{
        newsId: any;
        title: any;
        detectedAt: any;
        level: any;
        impactScore: any;
        reason: any;
        companies: any;
        isBreakNews: boolean;
        isHighLevel: boolean;
    }[]>;
    /**
     * 获取级别统计信息
     * @param {moment} startTime - 开始时间
     * @param {moment} endTime - 结束时间
     * @returns {Object} - 统计信息
     */
    getLevelStatistics(startTime: any, endTime: any): Promise<{
        total: any;
        highLevel: any;
        breakNews: any;
        avgImpactScore: any;
        levelDistribution: {};
    }>;
    /**
     * 获取Break News历史
     * @param {moment} startTime - 开始时间
     * @param {moment} endTime - 结束时间
     * @returns {Array} - Break News历史列表
     */
    getBreakNewsHistory(startTime: any, endTime: any): Promise<{
        newsId: any;
        title: any;
        detectedAt: any;
        level: any;
        impactScore: any;
        reason: any;
        companies: any;
    }[]>;
    /**
     * 健康检查
     * @returns {Object} - 健康状态
     */
    healthCheck(): Promise<{
        status: string;
        initialized: any;
        cacheSize: any;
        timestamp: string;
        error?: undefined;
    } | {
        status: string;
        error: any;
        timestamp: string;
        initialized?: undefined;
        cacheSize?: undefined;
    }>;
}
declare const _default: NewsLevelService;
export default _default;

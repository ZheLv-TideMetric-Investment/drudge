import { TimeZoneUtils, buildTimeRange, formatTimeFields } from '../utils/timezone';
import { neo4jNewsService, neo4jGraphService, neo4jAnalyticsService, neo4jEntitiesService } from './index';

/**
 * Neo4j服务的时区感知包装器
 * 自动处理北京时间与UTC时间的转换，让业务代码无需关心时区问题
 */
export class Neo4jTimezoneWrapper {
  
  /**
   * 新闻服务包装器
   */
  static news = {
    /**
     * 获取新闻列表（时区感知版本）
     * @param conditions 查询条件，时间参数将自动转换为UTC
     */
         async getNewsWithPagination(conditions: {
       page?: number;
       limit?: number;
       startTime?: string;  // 北京时间
       endTime?: string;    // 北京时间
       keyword?: string;
       level?: string;
       sortBy?: 'timestamp' | 'processedAt';
       sortOrder?: 'asc' | 'desc';
     }) {
      // 自动转换时间参数为UTC
      const utcConditions = {
        ...conditions,
        ...buildTimeRange(conditions.startTime, conditions.endTime)
      };

      const result = await neo4jNewsService.getNewsWithPagination(utcConditions);
      
      // 自动格式化返回的时间字段为北京时间
      const enhancedNews = formatTimeFields(
        result.news, 
        ['timestamp', 'processedAt'], 
        'YYYY-MM-DD HH:mm:ss'
      );

      return {
        ...result,
        news: enhancedNews
      };
    },

    /**
     * 搜索新闻（时区感知版本）
     * @param params 搜索参数，时间参数将自动转换为UTC
     */
    async searchNews(params: {
      keyword: string;
      page?: number;
      limit?: number;
      startTime?: string;  // 北京时间
      endTime?: string;    // 北京时间
      level?: string;
      searchFields?: 'title' | 'content' | 'both';
      sortBy?: 'relevance' | 'timestamp' | 'processedAt';
    }) {
      // 自动转换时间参数为UTC
      const utcParams = {
        ...params,
        ...buildTimeRange(params.startTime, params.endTime)
      };

      const result = await neo4jNewsService.searchNews(utcParams);
      
      // 自动格式化返回的时间字段为北京时间
      const enhancedNews = formatTimeFields(
        result.news, 
        ['timestamp', 'processedAt'], 
        'YYYY-MM-DD HH:mm:ss'
      );

      return {
        ...result,
        news: enhancedNews
      };
    },

    /**
     * 获取时间范围内的新闻数据（时区感知版本）
     * @param startTime 开始时间（北京时间）
     * @param endTime 结束时间（北京时间）
     */
    async getNewsInTimeRange(startTime: string, endTime: string) {
      const timeRange = buildTimeRange(startTime, endTime);
      const result = await neo4jNewsService.getNewsInTimeRange(
        timeRange.startTime!, 
        timeRange.endTime!
      );
      
      // 格式化新闻项目中的时间字段
      if (result.news_items) {
        result.news_items = formatTimeFields(
          result.news_items, 
          ['timestamp'], 
          'YYYY-MM-DD HH:mm:ss'
        );
      }

      return result;
    },

    /**
     * 获取高级别新闻（时区感知版本）
     * @param startTime 开始时间（北京时间）
     * @param endTime 结束时间（北京时间）
     */
    async getHighLevelNews(startTime: string, endTime: string) {
      const timeRange = buildTimeRange(startTime, endTime);
      const result = await neo4jNewsService.getHighLevelNews(
        timeRange.startTime!, 
        timeRange.endTime!
      );
      
      // 自动格式化返回的时间字段为北京时间
      return formatTimeFields(
        result, 
        ['timestamp'], 
        'YYYY-MM-DD HH:mm:ss'
      );
    }
  };

  /**
   * 图数据服务包装器
   */
  static graph = {
    /**
     * 获取热门排行数据（时区感知版本）
     * @param days 天数（基于北京时间计算）
     * @param limit 限制数量
     */
    async getHotRankData(days: number = 7, limit: number = 20) {
      const result = await neo4jGraphService.getHotRankData(days, limit);
      
      // 格式化时间统计数据
      if (result.timeStats) {
        result.timeStats = result.timeStats.map((stat: any) => ({
          ...stat,
          date_display: TimeZoneUtils.formatBeijingTime(stat.newsDate || stat.date, 'YYYY-MM-DD')
        }));
      }

      // 格式化热门新闻的时间字段
      if (result.hotNews) {
        result.hotNews = formatTimeFields(
          result.hotNews, 
          ['timestamp'], 
          'YYYY-MM-DD HH:mm:ss'
        );
      }

      return result;
    },

         /**
      * 获取图谱统计数据（时区感知版本）
      */
     async getGraphStats() {
       const result = await neo4jGraphService.getGraphData();
      
      // 添加当前北京时间戳
      return {
        ...result,
        generated_at: TimeZoneUtils.nowBeijing().format('YYYY-MM-DD HH:mm:ss'),
        generated_at_utc: TimeZoneUtils.nowUTC()
      };
    }
  };

  /**
   * 分析服务包装器
   */
  static analytics = {
    /**
     * 获取时间统计数据（时区感知版本）
     * 所有时间计算都基于北京时间
     */
    async getTimeStats() {
      const result = await neo4jAnalyticsService.getTimeStats();
      
      // 格式化每日统计的时间显示
      if (result.daily) {
        result.daily = result.daily.map((day: any) => ({
          ...day,
          date_display: TimeZoneUtils.formatBeijingTime(day.date, 'MM月DD日')
        }));
      }

      // 格式化小时统计的时间显示
      if (result.todayHourly) {
        result.todayHourly = result.todayHourly.map((hour: any) => ({
          ...hour,
          time_display: `${hour.hour.toString().padStart(2, '0')}:00`
        }));
      }

      // 添加北京时间的元数据
      return {
        ...result,
        metadata: {
          ...result.metadata,
          beijing_now: TimeZoneUtils.nowBeijing().format('YYYY-MM-DD HH:mm:ss'),
          timezone: 'Asia/Shanghai'
        }
      };
    },

         /**
      * 获取今日统计（时区感知版本）
      */
     async getTodayStats() {
       const todayRange = TimeZoneUtils.getTodayRange();
       
       const result = await neo4jAnalyticsService.getDatabaseStats();
       
       return {
         ...result,
         period: {
           start: TimeZoneUtils.formatBeijingTime(todayRange.startTime, 'YYYY-MM-DD HH:mm:ss'),
           end: TimeZoneUtils.formatBeijingTime(todayRange.endTime, 'YYYY-MM-DD HH:mm:ss'),
           timezone: 'Asia/Shanghai'
         }
       };
     },

     /**
      * 获取最近N天统计（时区感知版本）
      * @param days 天数
      */
     async getRecentDaysStats(days: number = 7) {
       const timeRange = TimeZoneUtils.getRecentDaysRange(days);
       
       const result = await neo4jAnalyticsService.getDatabaseStats();
       
       return {
         ...result,
         period: {
           start: TimeZoneUtils.formatBeijingTime(timeRange.startTime, 'YYYY-MM-DD HH:mm:ss'),
           end: TimeZoneUtils.formatBeijingTime(timeRange.endTime, 'YYYY-MM-DD HH:mm:ss'),
           days,
           timezone: 'Asia/Shanghai'
         }
       };
     }
  };

  /**
   * 实体服务包装器
   */
  static entities = {
    /**
     * 搜索实体（时区感知版本）
     * @param searchTerm 搜索词
     * @param nodeType 节点类型
     * @param limit 限制数量
     */
    async searchEntities(searchTerm: string, nodeType?: string, limit: number = 20) {
      const result = await neo4jEntitiesService.searchEntities(searchTerm, nodeType, limit);
      
      // 如果结果包含时间字段，自动格式化
      return formatTimeFields(result, ['timestamp', 'createdAt', 'updatedAt'], 'YYYY-MM-DD HH:mm:ss');
    }
  };

  /**
   * 通用工具方法
   */
  static utils = {
    /**
     * 获取当前北京时间
     */
    getCurrentBeijingTime(): string {
      return TimeZoneUtils.nowBeijing().format('YYYY-MM-DD HH:mm:ss');
    },

    /**
     * 获取今日时间范围（北京时间）
     */
    getTodayRange() {
      const range = TimeZoneUtils.getTodayRange();
      return {
        start: TimeZoneUtils.formatBeijingTime(range.startTime, 'YYYY-MM-DD HH:mm:ss'),
        end: TimeZoneUtils.formatBeijingTime(range.endTime, 'YYYY-MM-DD HH:mm:ss'),
        startUtc: range.startTime,
        endUtc: range.endTime
      };
    },

    /**
     * 获取最近N天时间范围（北京时间）
     */
    getRecentDaysRange(days: number) {
      const range = TimeZoneUtils.getRecentDaysRange(days);
      return {
        start: TimeZoneUtils.formatBeijingTime(range.startTime, 'YYYY-MM-DD HH:mm:ss'),
        end: TimeZoneUtils.formatBeijingTime(range.endTime, 'YYYY-MM-DD HH:mm:ss'),
        startUtc: range.startTime,
        endUtc: range.endTime,
        days
      };
    },

    /**
     * 转换时间参数（从北京时间到UTC）
     */
    convertTimeParams(params: Record<string, any>, timeFields: string[] = ['startTime', 'endTime']) {
      const converted = { ...params };
      
      timeFields.forEach(field => {
        if (params[field]) {
          converted[field] = TimeZoneUtils.toUTC(params[field]);
        }
      });
      
      return converted;
    },

         /**
      * 格式化API响应中的时间字段
      */
     formatApiResponse<T extends Record<string, any> | Record<string, any>[]>(data: T, timeFields: string[] = ['timestamp', 'createdAt', 'updatedAt'], format?: string): T {
       return formatTimeFields(data, timeFields, format) as T;
     }
  };
}

// 导出便捷的访问方式
export const tzNeo4j = Neo4jTimezoneWrapper;

// 导出各个服务的时区感知版本
export const tzNews = Neo4jTimezoneWrapper.news;
export const tzGraph = Neo4jTimezoneWrapper.graph;
export const tzAnalytics = Neo4jTimezoneWrapper.analytics;
export const tzEntities = Neo4jTimezoneWrapper.entities;
export const tzUtils = Neo4jTimezoneWrapper.utils; 
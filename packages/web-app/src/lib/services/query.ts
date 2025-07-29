import { tzNews, tzEntities, tzGraph } from '../neo4j/timezone-wrapper';
import { TimeZoneUtils } from '../utils/timezone';

/**
 * 查询服务 - 使用时区感知的Neo4j服务
 * 提供高级查询功能，自动处理时区转换
 */
class QueryService {
  /**
   * 获取时间段总结数据
   * @param startTime 开始时间（北京时间）
   * @param endTime 结束时间（北京时间）
   */
  async getHourlySummary(startTime: string, endTime: string): Promise<any> {
    return await tzNews.getNewsInTimeRange(startTime, endTime);
  }

  /**
   * 获取高级别新闻
   * @param startTime 开始时间（北京时间）
   * @param endTime 结束时间（北京时间）
   */
  async getHighLevelNews(startTime: string, endTime: string): Promise<any[]> {
    return await tzNews.getHighLevelNews(startTime, endTime);
  }

  /**
   * 搜索实体
   * @param searchTerm 搜索词
   * @param nodeType 节点类型
   * @param limit 限制数量
   */
  async searchEntities(searchTerm: string, nodeType?: string, limit: number = 20): Promise<any[]> {
    return await tzEntities.searchEntities(searchTerm, nodeType, limit);
  }

  /**
   * 获取图谱数据
   * @param query 查询条件
   * @param limit 限制数量
   */
  async getGraphData(query?: string, limit: number = 100): Promise<any> {
    return await tzGraph.getGraphStats();
  }
}

/**
 * 时间转换工具函数（使用新的TimeZoneUtils）
 * @deprecated 建议直接使用 TimeZoneUtils 中的方法
 */
export function convertBeijingToUTC(beijingTimeStr: string): string {
  return TimeZoneUtils.toUTC(beijingTimeStr);
}

/**
 * @deprecated 建议直接使用 TimeZoneUtils 中的方法
 */
export function convertUTCToBeijing(utcTimeStr: string): string {
  return TimeZoneUtils.toBeijing(utcTimeStr).toISOString();
}

export const queryService = new QueryService();
export { QueryService }; 
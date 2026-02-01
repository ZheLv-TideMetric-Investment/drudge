import { NextRequest, NextResponse } from 'next/server';
import { BEIJING_TIMEZONE } from '@drudge/common';
import { TimeZoneUtils, buildTimeRange, formatTimeFields, TIME_FORMATS } from './timezone';

/**
 * API时间处理辅助函数
 * 提供统一的API请求和响应时间处理方法
 */
export class ApiTimeHelpers {
  
  /**
   * 解析URL搜索参数中的时间字段
   * @param searchParams URL搜索参数
   * @param timeFields 需要解析的时间字段名数组
   * @returns 解析后的时间参数对象
   */
  static parseTimeParams(
    searchParams: URLSearchParams, 
    timeFields: string[] = ['startTime', 'endTime']
  ): Record<string, string | undefined> {
    const result: Record<string, string | undefined> = {};
    
    timeFields.forEach(field => {
      const value = searchParams.get(field);
      if (value) {
        result[field] = value;
      }
    });
    
    return result;
  }

  /**
   * 构建时区感知的查询条件
   * 自动将北京时间转换为UTC时间用于数据库查询
   * @param params 原始参数对象
   * @param timeFields 需要转换的时间字段
   * @returns 包含UTC时间的查询条件
   */
  static buildTimezoneAwareQuery<T extends Record<string, any>>(
    params: T, 
    timeFields: string[] = ['startTime', 'endTime']
  ): T {
    const result = { ...params } as any;
    
    timeFields.forEach(field => {
      if (params[field]) {
        try {
          result[field] = TimeZoneUtils.toUTC(params[field]);
        } catch (error) {
          console.warn(`时间转换失败 ${field}: ${params[field]}`, error);
          // 保留原值，让后续验证处理
        }
      }
    });
    
    return result as T;
  }

  /**
   * 构建标准的API成功响应
   * 自动添加北京时间戳，并格式化数据中的时间字段
   * @param data 响应数据
   * @param options 格式化选项
   */
  static buildSuccessResponse<T extends Record<string, any> | Record<string, any>[]>(
    data: T, 
    options: {
      timeFields?: string[];
      timeFormat?: string;
      message?: string;
      status?: number;
    } = {}
  ): NextResponse {
    const {
      timeFields = ['timestamp', 'createdAt', 'updatedAt', 'processedAt'],
      timeFormat = 'YYYY-MM-DD HH:mm:ss',
      message,
      status = 200
    } = options;

    // 格式化数据中的时间字段
    const formattedData = formatTimeFields(data, timeFields, timeFormat);

    const response = {
      success: true,
      data: formattedData,
      ...(message && { message }),
      timestamp: TimeZoneUtils.now(TIME_FORMATS.FULL),
      timezone: BEIJING_TIMEZONE
    };

    return NextResponse.json(response, { status });
  }

  /**
   * 构建标准的API错误响应
   * @param error 错误信息
   * @param status HTTP状态码
   */
  static buildErrorResponse(
    error: string | Error, 
    status: number = 500
  ): NextResponse {
    const errorMessage = error instanceof Error ? error.message : error;
    
    const response = {
      success: false,
      error: errorMessage,
      timestamp: TimeZoneUtils.now(TIME_FORMATS.FULL),
      timezone: BEIJING_TIMEZONE
    };

    return NextResponse.json(response, { status });
  }

  /**
   * 解析分页参数
   * @param searchParams URL搜索参数
   * @returns 标准化的分页参数
   */
  static parsePaginationParams(searchParams: URLSearchParams): {
    page: number;
    limit: number;
    offset: number;
  } {
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const offset = (page - 1) * limit;

    return { page, limit, offset };
  }

  /**
   * 构建分页响应数据
   * @param data 数据数组
   * @param total 总数量
   * @param page 当前页码
   * @param limit 每页数量
   */
  static buildPaginationResponse<T>(
    data: T[], 
    total: number, 
    page: number, 
    limit: number
  ) {
    const totalPages = Math.ceil(total / limit);
    
    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };
  }

  /**
   * 时间范围验证
   * @param startTime 开始时间
   * @param endTime 结束时间
   * @param maxDays 最大天数限制
   */
  static validateTimeRange(
    startTime?: string, 
    endTime?: string, 
    maxDays: number = 90
  ): { isValid: boolean; error?: string } {
    if (!startTime && !endTime) {
      return { isValid: true };
    }

    if (startTime && !TimeZoneUtils.isValidTime(startTime)) {
      return { isValid: false, error: '开始时间格式无效' };
    }

    if (endTime && !TimeZoneUtils.isValidTime(endTime)) {
      return { isValid: false, error: '结束时间格式无效' };
    }

    if (startTime && endTime) {
      const daysDiff = TimeZoneUtils.diff(startTime, endTime, 'days');
      
      if (daysDiff < 0) {
        return { isValid: false, error: '开始时间不能晚于结束时间' };
      }

      if (daysDiff > maxDays) {
        return { isValid: false, error: `时间范围不能超过${maxDays}天` };
      }
    }

    return { isValid: true };
  }

  /**
   * 创建带有时间处理的API处理器装饰器
   * @param handler 原始处理器函数
   * @param options 时间处理选项
   */
  static withTimeHandling<T extends (...args: any[]) => Promise<NextResponse>>(
    handler: T,
    options: {
      parseTimeParams?: boolean;
      validateTimeRange?: boolean;
      maxDays?: number;
    } = {}
  ): T {
    const { 
      parseTimeParams = true, 
      validateTimeRange = true, 
      maxDays = 90 
    } = options;

    return (async (request: NextRequest, ...args: any[]) => {
      try {
        if (parseTimeParams || validateTimeRange) {
          const { searchParams } = new URL(request.url);
          const startTime = searchParams.get('startTime');
          const endTime = searchParams.get('endTime');

          if (validateTimeRange) {
            const validation = ApiTimeHelpers.validateTimeRange(
              startTime || undefined, 
              endTime || undefined, 
              maxDays
            );
            
            if (!validation.isValid) {
              return ApiTimeHelpers.buildErrorResponse(validation.error!, 400);
            }
          }
        }

        return await handler(request, ...args);
      } catch (error) {
        console.error('API处理器错误:', error);
        return ApiTimeHelpers.buildErrorResponse(error as Error);
      }
    }) as T;
  }

  /**
   * 快速构建时间查询条件
   * 支持今日、昨日、最近N天等预设
   * @param preset 预设类型
   * @param customStart 自定义开始时间
   * @param customEnd 自定义结束时间
   */
  static buildTimeRangePreset(
    preset: 'today' | 'yesterday' | 'week' | 'month' | 'custom',
    customStart?: string,
    customEnd?: string
  ): { startTime: string; endTime: string } {
    switch (preset) {
      case 'today':
        return TimeZoneUtils.getTodayRange();
      
      case 'yesterday': {
        const todayRange = TimeZoneUtils.getTodayRange();
        const start = new Date(todayRange.startTime);
        const end = new Date(todayRange.endTime);
        const offset = 24 * 60 * 60 * 1000;
        const startTime = new Date(start.getTime() - offset);
        const endTime = new Date(end.getTime() - offset);
        return {
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString()
        };
      }
      
      case 'week':
        return TimeZoneUtils.getRecentDaysRange(7);
      
      case 'month':
        return TimeZoneUtils.getRecentDaysRange(30);
      
      case 'custom':
        if (!customStart || !customEnd) {
          throw new Error('自定义时间范围需要提供开始和结束时间');
        }
        const range = buildTimeRange(customStart, customEnd);
        return {
          startTime: range.startTime!,
          endTime: range.endTime!
        };
      
      default:
        throw new Error(`不支持的时间预设: ${preset}`);
    }
  }
}

// 导出便捷函数
export const parseTimeParams = ApiTimeHelpers.parseTimeParams.bind(ApiTimeHelpers);
export const buildTimezoneAwareQuery = ApiTimeHelpers.buildTimezoneAwareQuery.bind(ApiTimeHelpers);
export const buildSuccessResponse = ApiTimeHelpers.buildSuccessResponse.bind(ApiTimeHelpers);
export const buildErrorResponse = ApiTimeHelpers.buildErrorResponse.bind(ApiTimeHelpers);
export const parsePaginationParams = ApiTimeHelpers.parsePaginationParams.bind(ApiTimeHelpers);
export const buildPaginationResponse = ApiTimeHelpers.buildPaginationResponse.bind(ApiTimeHelpers);
export const validateTimeRange = ApiTimeHelpers.validateTimeRange.bind(ApiTimeHelpers);
export const withTimeHandling = ApiTimeHelpers.withTimeHandling.bind(ApiTimeHelpers);
export const buildTimeRangePreset = ApiTimeHelpers.buildTimeRangePreset.bind(ApiTimeHelpers); 

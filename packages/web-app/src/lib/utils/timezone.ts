import moment from 'moment-timezone';

/**
 * 时区转换工具类
 * 统一处理数据库UTC时间与用户界面北京时间的转换
 */
export class TimeZoneUtils {
  // 应用默认时区：北京时间
  static readonly DEFAULT_TIMEZONE = 'Asia/Shanghai';
  
  // 数据库时区：UTC
  static readonly DATABASE_TIMEZONE = 'UTC';

  /**
   * 将用户输入的北京时间转换为数据库UTC时间
   * @param beijingTime 北京时间（字符串、Date对象或moment对象）
   * @returns UTC时间的ISO字符串
   */
  static toUTC(beijingTime: string | Date | moment.Moment): string {
    if (!beijingTime) {
      throw new Error('时间参数不能为空');
    }

    let momentTime: moment.Moment;
    
    if (moment.isMoment(beijingTime)) {
      momentTime = beijingTime.clone();
    } else {
      momentTime = moment(beijingTime);
    }

    // 如果没有时区信息，默认为北京时间
    if (!momentTime.tz()) {
      momentTime = momentTime.tz(this.DEFAULT_TIMEZONE);
    }

    return momentTime.utc().toISOString();
  }

  /**
   * 将数据库UTC时间转换为北京时间
   * @param utcTime UTC时间（字符串、Date对象或moment对象）
   * @returns 北京时间的moment对象
   */
  static toBeijing(utcTime: string | Date | moment.Moment): moment.Moment {
    if (!utcTime) {
      throw new Error('时间参数不能为空');
    }

    let momentTime: moment.Moment;
    
    if (moment.isMoment(utcTime)) {
      momentTime = utcTime.clone();
    } else {
      momentTime = moment.utc(utcTime);
    }

    return momentTime.tz(this.DEFAULT_TIMEZONE);
  }

  /**
   * 格式化北京时间为显示字符串
   * @param time 时间（字符串、Date对象或moment对象）
   * @param format 格式化模板，默认为 'YYYY-MM-DD HH:mm:ss'
   * @returns 格式化后的时间字符串
   */
  static formatBeijingTime(
    time: string | Date | moment.Moment, 
    format: string = 'YYYY-MM-DD HH:mm:ss'
  ): string {
    if (!time) {
      return '';
    }

    const beijingTime = this.toBeijing(time);
    return beijingTime.format(format);
  }

  /**
   * 获取当前北京时间
   * @returns 当前北京时间的moment对象
   */
  static nowBeijing(): moment.Moment {
    return moment.tz(this.DEFAULT_TIMEZONE);
  }

  /**
   * 获取当前UTC时间
   * @returns 当前UTC时间的ISO字符串
   */
  static nowUTC(): string {
    return moment.utc().toISOString();
  }

  /**
   * 构建时间范围查询参数（自动转换为UTC）
   * @param startTime 开始时间（北京时间）
   * @param endTime 结束时间（北京时间）
   * @returns 包含UTC时间的查询参数对象
   */
  static buildTimeRange(
    startTime?: string | Date | moment.Moment, 
    endTime?: string | Date | moment.Moment
  ): { startTime?: string; endTime?: string } {
    const result: { startTime?: string; endTime?: string } = {};

    if (startTime) {
      result.startTime = this.toUTC(startTime);
    }

    if (endTime) {
      result.endTime = this.toUTC(endTime);
    }

    return result;
  }

  /**
   * 获取今日时间范围（北京时间的今日00:00到23:59）
   * @returns UTC时间范围
   */
  static getTodayRange(): { startTime: string; endTime: string } {
    const todayStart = this.nowBeijing().startOf('day');
    const todayEnd = this.nowBeijing().endOf('day');
    
    return {
      startTime: this.toUTC(todayStart),
      endTime: this.toUTC(todayEnd)
    };
  }

  /**
   * 获取最近N天的时间范围（北京时间）
   * @param days 天数
   * @returns UTC时间范围
   */
  static getRecentDaysRange(days: number): { startTime: string; endTime: string } {
    const endTime = this.nowBeijing().endOf('day');
    const startTime = endTime.clone().subtract(days - 1, 'days').startOf('day');
    
    return {
      startTime: this.toUTC(startTime),
      endTime: this.toUTC(endTime)
    };
  }

  /**
   * 获取本小时时间范围（北京时间的当前小时00分到59分）
   * @returns UTC时间范围
   */
  static getCurrentHourRange(): { startTime: string; endTime: string } {
    const hourStart = this.nowBeijing().startOf('hour');
    const hourEnd = this.nowBeijing().endOf('hour');
    
    return {
      startTime: this.toUTC(hourStart),
      endTime: this.toUTC(hourEnd)
    };
  }

  /**
   * 批量格式化时间字段（用于API响应）
   * @param data 包含时间字段的数据对象或数组
   * @param timeFields 需要格式化的时间字段名数组
   * @param format 格式化模板
   * @returns 添加了格式化时间字段的新对象
   */
  static formatTimeFields<T extends Record<string, any>>(
    data: T | T[], 
    timeFields: string[], 
    format: string = 'YYYY-MM-DD HH:mm:ss'
  ): T | T[] {
    const formatSingle = (item: T): T => {
      const formatted = { ...item } as any;
      
      timeFields.forEach(field => {
        if (item[field]) {
          // 添加格式化的显示字段
          const displayField = field.replace(/([A-Z])/g, '_$1').toLowerCase() + '_display';
          formatted[displayField] = this.formatBeijingTime(item[field], format);
        }
      });
      
      return formatted as T;
    };

    if (Array.isArray(data)) {
      return data.map(formatSingle);
    } else {
      return formatSingle(data);
    }
  }

  /**
   * 验证时间字符串格式
   * @param timeString 时间字符串
   * @returns 是否为有效时间
   */
  static isValidTime(timeString: string): boolean {
    return moment(timeString).isValid();
  }

  /**
   * 计算两个时间之间的差值
   * @param startTime 开始时间
   * @param endTime 结束时间
   * @param unit 时间单位 ('days', 'hours', 'minutes', 'seconds')
   * @returns 时间差值
   */
  static diff(
    startTime: string | Date | moment.Moment,
    endTime: string | Date | moment.Moment,
    unit: moment.unitOfTime.Diff = 'milliseconds'
  ): number {
    const start = moment(startTime);
    const end = moment(endTime);
    return end.diff(start, unit);
  }
}

/**
 * 便捷的导出函数，用于常见操作
 */

// 时间转换
export const toUTC = TimeZoneUtils.toUTC.bind(TimeZoneUtils);
export const toBeijing = TimeZoneUtils.toBeijing.bind(TimeZoneUtils);

// 时间格式化
export const formatBeijingTime = TimeZoneUtils.formatBeijingTime.bind(TimeZoneUtils);

// 当前时间
export const nowBeijing = TimeZoneUtils.nowBeijing.bind(TimeZoneUtils);
export const nowUTC = TimeZoneUtils.nowUTC.bind(TimeZoneUtils);

// 时间范围
export const buildTimeRange = TimeZoneUtils.buildTimeRange.bind(TimeZoneUtils);
export const getTodayRange = TimeZoneUtils.getTodayRange.bind(TimeZoneUtils);
export const getRecentDaysRange = TimeZoneUtils.getRecentDaysRange.bind(TimeZoneUtils);

// 格式化工具
export const formatTimeFields = TimeZoneUtils.formatTimeFields.bind(TimeZoneUtils); 
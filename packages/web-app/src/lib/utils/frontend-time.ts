import moment, { Moment } from 'moment-timezone';

/**
 * 前端时间处理工具类
 * 专门用于前端组件的时间格式化和显示
 */
export class FrontendTimeUtils {
  // 默认时区：北京时间
  static readonly TIMEZONE = 'Asia/Shanghai';

  /**
   * 通用时间格式
   */
  static readonly FORMATS = {
    // 完整日期时间
    FULL: 'YYYY-MM-DD HH:mm:ss',
    // 日期
    DATE: 'YYYY-MM-DD',
    // 时间
    TIME: 'HH:mm:ss',
    // 短时间
    TIME_SHORT: 'HH:mm',
    // 中文日期时间
    CHINESE_FULL: 'YYYY年MM月DD日 HH:mm:ss',
    // 中文日期
    CHINESE_DATE: 'YYYY年MM月DD日',
    // 相对时间友好格式
    RELATIVE_FRIENDLY: 'MM-DD HH:mm',
    // 新闻时间格式
    NEWS_TIME: 'MM-DD HH:mm',
    // 统计图表格式
    CHART_DATE: 'MM/DD',
    // 小时格式
    HOUR_FORMAT: 'HH:00'
  };

  /**
   * 将任意时间转换为北京时间的moment对象
   * @param time 时间（字符串、Date对象或moment对象）
   * @returns 北京时间的moment对象
   */
  static toBeijingMoment(time: string | Date | Moment): Moment {
    if (!time) {
      return moment.tz(this.TIMEZONE);
    }

    if (moment.isMoment(time)) {
      return time.tz(this.TIMEZONE);
    }

    // 假设输入的时间是UTC时间（来自数据库）
    return moment.utc(time).tz(this.TIMEZONE);
  }

  /**
   * 格式化时间为指定格式
   * @param time 时间
   * @param format 格式化模板
   * @returns 格式化后的时间字符串
   */
  static format(time: string | Date | Moment, format: string = this.FORMATS.FULL): string {
    if (!time) return '';
    
    try {
      const beijingTime = this.toBeijingMoment(time);
      return beijingTime.format(format);
    } catch (error) {
      console.warn('时间格式化失败:', time, error);
      return String(time);
    }
  }

  /**
   * 格式化为相对时间（如：刚刚、5分钟前、2小时前）
   * @param time 时间
   * @returns 相对时间字符串
   */
  static formatRelative(time: string | Date | Moment): string {
    if (!time) return '';

    try {
      const beijingTime = this.toBeijingMoment(time);
      const now = moment.tz(this.TIMEZONE);
      const diffMinutes = now.diff(beijingTime, 'minutes');
      const diffHours = now.diff(beijingTime, 'hours');
      const diffDays = now.diff(beijingTime, 'days');

      if (diffMinutes < 1) {
        return '刚刚';
      } else if (diffMinutes < 60) {
        return `${diffMinutes}分钟前`;
      } else if (diffHours < 24) {
        return `${diffHours}小时前`;
      } else if (diffDays < 7) {
        return `${diffDays}天前`;
      } else {
        // 超过7天显示具体日期
        return beijingTime.format(this.FORMATS.RELATIVE_FRIENDLY);
      }
    } catch (error) {
      console.warn('相对时间格式化失败:', time, error);
      return String(time);
    }
  }

  /**
   * 格式化新闻时间（显示月-日 时:分，今天的显示"今天 时:分"）
   * @param time 时间
   * @returns 新闻时间字符串
   */
  static formatNewsTime(time: string | Date | Moment): string {
    if (!time) return '';

    try {
      const beijingTime = this.toBeijingMoment(time);
      const now = moment.tz(this.TIMEZONE);

      if (beijingTime.isSame(now, 'day')) {
        return `今天 ${beijingTime.format('HH:mm')}`;
      } else if (beijingTime.isSame(now.clone().subtract(1, 'day'), 'day')) {
        return `昨天 ${beijingTime.format('HH:mm')}`;
      } else {
        return beijingTime.format(this.FORMATS.NEWS_TIME);
      }
    } catch (error) {
      console.warn('新闻时间格式化失败:', time, error);
      return String(time);
    }
  }

  /**
   * 格式化为智能时间显示
   * 根据时间距离现在的长短自动选择合适的显示格式
   * @param time 时间
   * @returns 智能格式化的时间字符串
   */
  static formatSmart(time: string | Date | Moment): string {
    if (!time) return '';

    try {
      const beijingTime = this.toBeijingMoment(time);
      const now = moment.tz(this.TIMEZONE);
      const diffHours = now.diff(beijingTime, 'hours');

      if (diffHours < 24) {
        // 24小时内显示相对时间
        return this.formatRelative(time);
      } else if (diffHours < 7 * 24) {
        // 7天内显示"X天前"
        const diffDays = now.diff(beijingTime, 'days');
        return `${diffDays}天前`;
      } else {
        // 超过7天显示具体日期
        return beijingTime.format(this.FORMATS.DATE);
      }
    } catch (error) {
      console.warn('智能时间格式化失败:', time, error);
      return String(time);
    }
  }

  /**
   * 获取当前北京时间
   * @param format 格式化模板
   * @returns 当前北京时间字符串
   */
  static now(format: string = this.FORMATS.FULL): string {
    return moment.tz(this.TIMEZONE).format(format);
  }

  /**
   * 判断时间是否为今天
   * @param time 时间
   * @returns 是否为今天
   */
  static isToday(time: string | Date | Moment): boolean {
    if (!time) return false;

    try {
      const beijingTime = this.toBeijingMoment(time);
      const now = moment.tz(this.TIMEZONE);
      return beijingTime.isSame(now, 'day');
    } catch (error) {
      return false;
    }
  }

  /**
   * 判断时间是否为昨天
   * @param time 时间
   * @returns 是否为昨天
   */
  static isYesterday(time: string | Date | Moment): boolean {
    if (!time) return false;

    try {
      const beijingTime = this.toBeijingMoment(time);
      const yesterday = moment.tz(this.TIMEZONE).subtract(1, 'day');
      return beijingTime.isSame(yesterday, 'day');
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取时间的小时数（0-23）
   * @param time 时间
   * @returns 小时数
   */
  static getHour(time: string | Date | Moment): number {
    if (!time) return 0;

    try {
      const beijingTime = this.toBeijingMoment(time);
      return beijingTime.hour();
    } catch (error) {
      return 0;
    }
  }

  /**
   * 创建时间范围显示文本
   * @param startTime 开始时间
   * @param endTime 结束时间
   * @returns 时间范围字符串
   */
  static formatTimeRange(
    startTime: string | Date | Moment, 
    endTime: string | Date | Moment,
    format: string = this.FORMATS.FULL
  ): string {
    if (!startTime || !endTime) return '';

    try {
      const start = this.toBeijingMoment(startTime);
      const end = this.toBeijingMoment(endTime);

      if (start.isSame(end, 'day')) {
        // 同一天：显示"日期 开始时间-结束时间"
        return `${start.format('YYYY-MM-DD')} ${start.format('HH:mm')}-${end.format('HH:mm')}`;
      } else {
        // 不同天：显示完整范围
        return `${start.format(format)} ~ ${end.format(format)}`;
      }
    } catch (error) {
      console.warn('时间范围格式化失败:', startTime, endTime, error);
      return `${startTime} ~ ${endTime}`;
    }
  }

  /**
   * 为Antd DatePicker组件准备时间值
   * @param time 时间
   * @returns Moment对象或null
   */
  static toAntdValue(time?: string | Date | Moment): Moment | null {
    if (!time) return null;

    try {
      return this.toBeijingMoment(time);
    } catch (error) {
      console.warn('Antd时间值转换失败:', time, error);
      return null;
    }
  }

  /**
   * 从Antd DatePicker组件获取时间值
   * @param momentValue Moment对象
   * @returns ISO字符串（北京时间）
   */
  static fromAntdValue(momentValue: Moment | null): string | undefined {
    if (!momentValue) return undefined;

    try {
      // 确保是北京时间，然后转换为ISO字符串
      const beijingTime = momentValue.tz(this.TIMEZONE);
      return beijingTime.toISOString();
    } catch (error) {
      console.warn('Antd时间值获取失败:', momentValue, error);
      return undefined;
    }
  }

  /**
   * 批量格式化对象数组中的时间字段
   * @param data 数据数组
   * @param timeFields 时间字段名数组
   * @param formatter 格式化函数
   */
  static formatDataArray<T extends Record<string, any>>(
    data: T[],
    timeFields: string[],
    formatter: (time: any) => string = (time) => this.format(time)
  ): T[] {
    return data.map(item => {
      const formatted = { ...item } as any;
      
      timeFields.forEach(field => {
        if (item[field]) {
          // 添加格式化的显示字段
          const displayField = `${field}_display`;
          formatted[displayField] = formatter(item[field]);
        }
      });
      
      return formatted as T;
    });
  }

  /**
   * 获取时间的友好显示文本（用于tooltip等）
   * @param time 时间
   * @returns 友好显示文本
   */
  static getFriendlyText(time: string | Date | Moment): string {
    if (!time) return '';

    const formatted = this.format(time, this.FORMATS.CHINESE_FULL);
    const relative = this.formatRelative(time);
    
    return `${formatted} (${relative})`;
  }
}

// 便捷的导出函数
export const formatTime = FrontendTimeUtils.format.bind(FrontendTimeUtils);
export const formatRelativeTime = FrontendTimeUtils.formatRelative.bind(FrontendTimeUtils);
export const formatNewsTime = FrontendTimeUtils.formatNewsTime.bind(FrontendTimeUtils);
export const formatSmartTime = FrontendTimeUtils.formatSmart.bind(FrontendTimeUtils);
export const formatTimeRange = FrontendTimeUtils.formatTimeRange.bind(FrontendTimeUtils);
export const getCurrentTime = FrontendTimeUtils.now.bind(FrontendTimeUtils);
export const toAntdValue = FrontendTimeUtils.toAntdValue.bind(FrontendTimeUtils);
export const fromAntdValue = FrontendTimeUtils.fromAntdValue.bind(FrontendTimeUtils);
export const formatDataArray = FrontendTimeUtils.formatDataArray.bind(FrontendTimeUtils);

// 常用格式常量
export const TIME_FORMATS = FrontendTimeUtils.FORMATS; 
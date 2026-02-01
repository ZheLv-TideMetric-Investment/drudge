import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { BEIJING_TIMEZONE, UTC_TIMEZONE, normalizeTimestampMs } from '@drudge/common';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault(BEIJING_TIMEZONE);

type TimeInput = string | Date | number | Dayjs;

/**
 * 时区转换工具类
 * 统一处理数据库UTC时间与用户界面北京时间的转换
 */
export class TimeZoneUtils {
  // 应用默认时区：北京时间
  static readonly DEFAULT_TIMEZONE = BEIJING_TIMEZONE;
  
  // 数据库时区：UTC
  static readonly DATABASE_TIMEZONE = UTC_TIMEZONE;

  /**
   * 通用时间格式
   */
  static readonly FORMATS = {
    FULL: 'YYYY-MM-DD HH:mm:ss',
    DATE: 'YYYY-MM-DD',
    TIME: 'HH:mm:ss',
    TIME_SHORT: 'HH:mm',
    CHINESE_FULL: 'YYYY年MM月DD日 HH:mm:ss',
    CHINESE_DATE: 'YYYY年MM月DD日',
    RELATIVE_FRIENDLY: 'MM-DD HH:mm',
    NEWS_TIME: 'MM-DD HH:mm',
    CHART_DATE: 'MM/DD',
    HOUR_FORMAT: 'HH:00'
  };

  private static readonly BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;

  private static normalizeInputString(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return '';
    const normalized = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T');
    if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      return `${normalized}T00:00:00`;
    }
    return normalized;
  }

  private static hasTimezoneInfo(value: string): boolean {
    return /[zZ]|[+-]\d{2}:?\d{2}$/.test(value);
  }

  private static parseBeijingDateParts(value: string): {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
    millisecond: number;
  } | null {
    const match = value.match(
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/
    );

    if (!match) return null;

    const [, year, month, day, hour, minute, second, ms] = match;
    const millisecond = ms ? Number(ms.padEnd(3, '0')) : 0;

    return {
      year: Number(year),
      month: Number(month),
      day: Number(day),
      hour: Number(hour),
      minute: Number(minute),
      second: Number(second ?? 0),
      millisecond,
    };
  }

  private static parseInputToDate(input: TimeInput): Date {
    if (dayjs.isDayjs(input)) {
      return input.toDate();
    }

    if (input instanceof Date) {
      return new Date(input.getTime());
    }

    if (typeof input === 'number') {
      const normalized = normalizeTimestampMs(input) ?? input;
      const numericDate = new Date(normalized);
      if (Number.isNaN(numericDate.getTime())) {
        throw new Error('无效的时间格式');
      }
      return numericDate;
    }

    const normalized = this.normalizeInputString(String(input));
    if (!normalized) {
      throw new Error('时间参数不能为空');
    }

    if (/^\d+$/.test(normalized)) {
      const normalizedNumeric = normalizeTimestampMs(normalized);
      if (normalizedNumeric !== null) {
        const numericDate = new Date(normalizedNumeric);
        if (!Number.isNaN(numericDate.getTime())) {
          return numericDate;
        }
      }
    }

    if (this.hasTimezoneInfo(normalized)) {
      const date = new Date(normalized);
      if (Number.isNaN(date.getTime())) {
        throw new Error('无效的时间格式');
      }
      return date;
    }

    const parts = this.parseBeijingDateParts(normalized);
    if (!parts) {
      throw new Error('无效的时间格式');
    }

    return this.buildUtcDateFromBeijingParts(parts);
  }

  private static parseUtcInputToDate(input: TimeInput): Date {
    if (dayjs.isDayjs(input)) {
      return input.toDate();
    }

    if (input instanceof Date) {
      return new Date(input.getTime());
    }

    if (typeof input === 'number') {
      const normalized = normalizeTimestampMs(input) ?? input;
      const numericDate = new Date(normalized);
      if (Number.isNaN(numericDate.getTime())) {
        throw new Error('无效的时间格式');
      }
      return numericDate;
    }

    const normalized = this.normalizeInputString(String(input));
    if (!normalized) {
      throw new Error('时间参数不能为空');
    }

    if (/^\d+$/.test(normalized)) {
      const normalizedNumeric = normalizeTimestampMs(normalized);
      if (normalizedNumeric !== null) {
        const numericDate = new Date(normalizedNumeric);
        if (!Number.isNaN(numericDate.getTime())) {
          return numericDate;
        }
      }
    }

    const value = this.hasTimezoneInfo(normalized) ? normalized : `${normalized}Z`;
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      throw new Error('无效的时间格式');
    }

    return date;
  }

  private static parseInputToDateOrNull(input: TimeInput): Date | null {
    try {
      return this.parseInputToDate(input);
    } catch {
      return null;
    }
  }

  private static getBeijingParts(date: Date): {
    year: string;
    month: string;
    day: string;
    hour: string;
    minute: string;
    second: string;
  } {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: this.DEFAULT_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });

    const parts = formatter.formatToParts(date);
    const mapped = {
      year: '',
      month: '',
      day: '',
      hour: '',
      minute: '',
      second: '',
    };

    parts.forEach(part => {
      if (part.type in mapped) {
        mapped[part.type as keyof typeof mapped] = part.value;
      }
    });

    if (mapped.hour === '24') {
      mapped.hour = '00';
    }

    return mapped;
  }

  private static getBeijingNumericParts(date: Date): {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
  } {
    const parts = this.getBeijingParts(date);
    return {
      year: Number(parts.year),
      month: Number(parts.month),
      day: Number(parts.day),
      hour: Number(parts.hour),
      minute: Number(parts.minute),
      second: Number(parts.second),
    };
  }

  private static formatWithParts(format: string, parts: ReturnType<typeof TimeZoneUtils.getBeijingParts>): string {
    const tokenMap: Record<'YYYY' | 'MM' | 'DD' | 'HH' | 'mm' | 'ss', string> = {
      YYYY: parts.year,
      MM: parts.month,
      DD: parts.day,
      HH: parts.hour,
      mm: parts.minute,
      ss: parts.second,
    };

    return format.replace(/YYYY|MM|DD|HH|mm|ss/g, token => tokenMap[token as keyof typeof tokenMap]);
  }

  private static formatInBeijing(date: Date, format: string): string {
    const parts = this.getBeijingParts(date);
    return this.formatWithParts(format, parts);
  }

  private static isSameBeijingDay(left: Date, right: Date): boolean {
    const leftParts = this.getBeijingParts(left);
    const rightParts = this.getBeijingParts(right);
    return (
      leftParts.year === rightParts.year &&
      leftParts.month === rightParts.month &&
      leftParts.day === rightParts.day
    );
  }

  private static buildUtcDateFromBeijingParts(parts: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
    millisecond: number;
  }): Date {
    const utcMillis =
      Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hour,
        parts.minute,
        parts.second,
        parts.millisecond
      ) - this.BEIJING_OFFSET_MS;

    return new Date(utcMillis);
  }

  /**
   * 将任意时间转换为北京时间的 Dayjs 对象
   */
  static toBeijingDayjs(time: TimeInput): Dayjs {
    if (!time) {
      return dayjs().tz(this.DEFAULT_TIMEZONE);
    }

    if (dayjs.isDayjs(time)) {
      return time.tz(this.DEFAULT_TIMEZONE);
    }

    const date = this.parseInputToDate(time);
    return dayjs(date).tz(this.DEFAULT_TIMEZONE);
  }


  /**
   * 将用户输入的北京时间转换为数据库UTC时间
   * @param beijingTime 北京时间（字符串、Date对象或时间戳）
   * @returns UTC时间的ISO字符串
   */
  static toUTC(beijingTime: TimeInput): string {
    if (!beijingTime) {
      throw new Error('时间参数不能为空');
    }

    const date = this.parseInputToDate(beijingTime);
    return date.toISOString();
  }

  /**
   * 将数据库UTC时间转换为北京时间
   * @param utcTime UTC时间（字符串、Date对象或时间戳）
   * @returns 对应时间的Date对象
   */
  static toBeijing(utcTime: TimeInput): Date {
    if (!utcTime) {
      throw new Error('时间参数不能为空');
    }

    return this.parseUtcInputToDate(utcTime);
  }

  /**
   * 格式化北京时间为显示字符串
   * @param time 时间（字符串、Date对象或时间戳）
   * @param format 格式化模板，默认为 'YYYY-MM-DD HH:mm:ss'
   * @returns 格式化后的时间字符串
   */
  static formatBeijingTime(
    time: TimeInput,
    format: string = 'YYYY-MM-DD HH:mm:ss'
  ): string {
    if (!time) {
      return '';
    }

    const date = this.parseInputToDateOrNull(time);
    if (!date) {
      return 'Invalid date';
    }
    return this.formatInBeijing(date, format);
  }

  /**
   * 获取当前北京时间
   * @returns 当前时间的Date对象
   */
  static nowBeijing(): Date {
    return new Date();
  }

  /**
   * 格式化时间为指定格式
   */
  static format(time: TimeInput, format: string = this.FORMATS.FULL): string {
    if (!time) return '';

    try {
      return this.formatBeijingTime(time, format);
    } catch (error) {
      console.warn('时间格式化失败:', time, error);
      return String(time);
    }
  }

  /**
   * 格式化为相对时间（如：刚刚、5分钟前、2小时前）
   */
  static formatRelative(time: TimeInput): string {
    if (!time) return '';

    try {
      const target = this.parseInputToDate(time);
      const now = new Date();
      const diffMs = now.getTime() - target.getTime();
      const diffMinutes = Math.trunc(diffMs / (60 * 1000));
      const diffHours = Math.trunc(diffMs / (60 * 60 * 1000));
      const diffDays = Math.trunc(diffMs / (24 * 60 * 60 * 1000));

      if (diffMinutes < 1) {
        return '刚刚';
      } else if (diffMinutes < 60) {
        return `${diffMinutes}分钟前`;
      } else if (diffHours < 24) {
        return `${diffHours}小时前`;
      } else if (diffDays < 7) {
        return `${diffDays}天前`;
      } else {
        return this.formatInBeijing(target, this.FORMATS.RELATIVE_FRIENDLY);
      }
    } catch (error) {
      console.warn('相对时间格式化失败:', time, error);
      return String(time);
    }
  }

  /**
   * 格式化新闻时间
   */
  static formatNewsTime(time: TimeInput): string {
    if (!time) return '';

    try {
      const target = this.parseInputToDate(time);
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      if (this.isSameBeijingDay(target, now)) {
        return `今天 ${this.formatInBeijing(target, this.FORMATS.TIME_SHORT)}`;
      } else if (this.isSameBeijingDay(target, yesterday)) {
        return `昨天 ${this.formatInBeijing(target, this.FORMATS.TIME_SHORT)}`;
      } else {
        return this.formatInBeijing(target, this.FORMATS.NEWS_TIME);
      }
    } catch (error) {
      console.warn('新闻时间格式化失败:', time, error);
      return String(time);
    }
  }

  /**
   * 格式化为智能时间显示
   */
  static formatSmart(time: TimeInput): string {
    if (!time) return '';

    try {
      const target = this.parseInputToDate(time);
      const now = new Date();
      const diffHours = Math.trunc((now.getTime() - target.getTime()) / (60 * 60 * 1000));

      if (diffHours < 24) {
        return this.formatRelative(time);
      } else if (diffHours < 7 * 24) {
        const diffDays = Math.trunc((now.getTime() - target.getTime()) / (24 * 60 * 60 * 1000));
        return `${diffDays}天前`;
      } else {
        return this.formatInBeijing(target, this.FORMATS.DATE);
      }
    } catch (error) {
      console.warn('智能时间格式化失败:', time, error);
      return String(time);
    }
  }

  /**
   * 获取当前UTC时间
   * @returns 当前UTC时间的ISO字符串
   */
  static nowUTC(): string {
    return new Date().toISOString();
  }

  /**
   * 获取当前北京时间字符串
   */
  static now(format: string = this.FORMATS.FULL): string {
    return this.formatInBeijing(new Date(), format);
  }

  /**
   * 构建时间范围查询参数（自动转换为UTC）
   * @param startTime 开始时间（北京时间）
   * @param endTime 结束时间（北京时间）
   * @returns 包含UTC时间的查询参数对象
   */
  static buildTimeRange(
    startTime?: TimeInput,
    endTime?: TimeInput
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
    const nowParts = this.getBeijingNumericParts(new Date());
    const startUtc = this.buildUtcDateFromBeijingParts({
      year: nowParts.year,
      month: nowParts.month,
      day: nowParts.day,
      hour: 0,
      minute: 0,
      second: 0,
      millisecond: 0,
    });
    const endUtc = this.buildUtcDateFromBeijingParts({
      year: nowParts.year,
      month: nowParts.month,
      day: nowParts.day,
      hour: 23,
      minute: 59,
      second: 59,
      millisecond: 999,
    });

    return {
      startTime: startUtc.toISOString(),
      endTime: endUtc.toISOString(),
    };
  }

  /**
   * 获取最近N天的时间范围（北京时间）
   * @param days 天数
   * @returns UTC时间范围
   */
  static getRecentDaysRange(days: number): { startTime: string; endTime: string } {
    const todayRange = this.getTodayRange();
    const endUtc = new Date(todayRange.endTime);
    const startUtc = new Date(
      new Date(todayRange.startTime).getTime() - Math.max(0, days - 1) * 24 * 60 * 60 * 1000
    );

    return {
      startTime: startUtc.toISOString(),
      endTime: endUtc.toISOString(),
    };
  }

  /**
   * 获取本小时时间范围（北京时间的当前小时00分到59分）
   * @returns UTC时间范围
   */
  static getCurrentHourRange(): { startTime: string; endTime: string } {
    const nowParts = this.getBeijingNumericParts(new Date());
    const startUtc = this.buildUtcDateFromBeijingParts({
      year: nowParts.year,
      month: nowParts.month,
      day: nowParts.day,
      hour: nowParts.hour,
      minute: 0,
      second: 0,
      millisecond: 0,
    });
    const endUtc = this.buildUtcDateFromBeijingParts({
      year: nowParts.year,
      month: nowParts.month,
      day: nowParts.day,
      hour: nowParts.hour,
      minute: 59,
      second: 59,
      millisecond: 999,
    });

    return {
      startTime: startUtc.toISOString(),
      endTime: endUtc.toISOString(),
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
    try {
      return Boolean(this.parseInputToDate(timeString));
    } catch {
      return false;
    }
  }

  /**
   * 判断时间是否为今天
   */
  static isToday(time: TimeInput): boolean {
    if (!time) return false;

    try {
      const target = this.parseInputToDate(time);
      const now = new Date();
      return this.isSameBeijingDay(target, now);
    } catch (error) {
      return false;
    }
  }

  /**
   * 判断时间是否为昨天
   */
  static isYesterday(time: TimeInput): boolean {
    if (!time) return false;

    try {
      const target = this.parseInputToDate(time);
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      return this.isSameBeijingDay(target, yesterday);
    } catch (error) {
      return false;
    }
  }

  /**
   * 获取时间的小时数（0-23）
   */
  static getHour(time: TimeInput): number {
    if (!time) return 0;

    try {
      const target = this.parseInputToDate(time);
      const parts = this.getBeijingParts(target);
      return Number(parts.hour);
    } catch (error) {
      return 0;
    }
  }

  /**
   * 计算两个时间之间的差值
   * @param startTime 开始时间
   * @param endTime 结束时间
   * @param unit 时间单位 ('days', 'hours', 'minutes', 'seconds')
   * @returns 时间差值
   */
  static diff(
    startTime: TimeInput,
    endTime: TimeInput,
    unit: 'milliseconds' | 'seconds' | 'minutes' | 'hours' | 'days' = 'milliseconds'
  ): number {
    const start = this.parseInputToDate(startTime);
    const end = this.parseInputToDate(endTime);
    const diffMs = end.getTime() - start.getTime();

    switch (unit) {
      case 'seconds':
        return Math.trunc(diffMs / 1000);
      case 'minutes':
        return Math.trunc(diffMs / (60 * 1000));
      case 'hours':
        return Math.trunc(diffMs / (60 * 60 * 1000));
      case 'days':
        return Math.trunc(diffMs / (24 * 60 * 60 * 1000));
      case 'milliseconds':
      default:
        return diffMs;
    }
  }

  /**
   * 创建时间范围显示文本
   */
  static formatTimeRange(
    startTime: TimeInput,
    endTime: TimeInput,
    format: string = this.FORMATS.FULL
  ): string {
    if (!startTime || !endTime) return '';

    try {
      const start = this.parseInputToDate(startTime);
      const end = this.parseInputToDate(endTime);

      if (this.isSameBeijingDay(start, end)) {
        return `${this.formatInBeijing(start, this.FORMATS.DATE)} ${this.formatInBeijing(
          start,
          this.FORMATS.TIME_SHORT
        )}-${this.formatInBeijing(end, this.FORMATS.TIME_SHORT)}`;
      } else {
        return `${this.formatInBeijing(start, format)} ~ ${this.formatInBeijing(end, format)}`;
      }
    } catch (error) {
      console.warn('时间范围格式化失败:', startTime, endTime, error);
      return `${startTime} ~ ${endTime}`;
    }
  }

  /**
   * 为Antd DatePicker组件准备时间值
   */
  static toAntdValue(time?: TimeInput): Dayjs | null {
    if (!time) return null;

    try {
      return this.toBeijingDayjs(time);
    } catch (error) {
      console.warn('Antd时间值转换失败:', time, error);
      return null;
    }
  }

  /**
   * 从Antd DatePicker组件获取时间值
   */
  static fromAntdValue(dateValue: Dayjs | null): string | undefined {
    if (!dateValue) return undefined;

    try {
      const beijingTime = dateValue.tz(this.DEFAULT_TIMEZONE);
      return beijingTime.toISOString();
    } catch (error) {
      console.warn('Antd时间值获取失败:', dateValue, error);
      return undefined;
    }
  }

  /**
   * 批量格式化对象数组中的时间字段
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
          const displayField = `${field}_display`;
          formatted[displayField] = formatter(item[field]);
        }
      });

      return formatted as T;
    });
  }

  /**
   * 获取时间的友好显示文本
   */
  static getFriendlyText(time: TimeInput): string {
    if (!time) return '';

    const formatted = this.format(time, this.FORMATS.CHINESE_FULL);
    const relative = this.formatRelative(time);

    return `${formatted} (${relative})`;
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
export const formatTime = TimeZoneUtils.format.bind(TimeZoneUtils);
export const formatRelativeTime = TimeZoneUtils.formatRelative.bind(TimeZoneUtils);
export const formatNewsTime = TimeZoneUtils.formatNewsTime.bind(TimeZoneUtils);
export const formatSmartTime = TimeZoneUtils.formatSmart.bind(TimeZoneUtils);
export const formatTimeRange = TimeZoneUtils.formatTimeRange.bind(TimeZoneUtils);

// 当前时间
export const nowBeijing = TimeZoneUtils.nowBeijing.bind(TimeZoneUtils);
export const nowUTC = TimeZoneUtils.nowUTC.bind(TimeZoneUtils);
export const getCurrentTime = TimeZoneUtils.now.bind(TimeZoneUtils);

// 时间范围
export const buildTimeRange = TimeZoneUtils.buildTimeRange.bind(TimeZoneUtils);
export const getTodayRange = TimeZoneUtils.getTodayRange.bind(TimeZoneUtils);
export const getRecentDaysRange = TimeZoneUtils.getRecentDaysRange.bind(TimeZoneUtils);
export const getCurrentHourRange = TimeZoneUtils.getCurrentHourRange.bind(TimeZoneUtils);

// 格式化工具
export const formatTimeFields = TimeZoneUtils.formatTimeFields.bind(TimeZoneUtils);
export const formatDataArray = TimeZoneUtils.formatDataArray.bind(TimeZoneUtils);

// Antd 时间值转换
export const toAntdValue = TimeZoneUtils.toAntdValue.bind(TimeZoneUtils);
export const fromAntdValue = TimeZoneUtils.fromAntdValue.bind(TimeZoneUtils);

// 其他辅助
export const getFriendlyText = TimeZoneUtils.getFriendlyText.bind(TimeZoneUtils);
export const isToday = TimeZoneUtils.isToday.bind(TimeZoneUtils);
export const isYesterday = TimeZoneUtils.isYesterday.bind(TimeZoneUtils);
export const getHour = TimeZoneUtils.getHour.bind(TimeZoneUtils);

// 常用格式常量
export const TIME_FORMATS = TimeZoneUtils.FORMATS;

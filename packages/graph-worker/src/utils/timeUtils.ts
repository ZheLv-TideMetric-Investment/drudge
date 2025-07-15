import moment from 'moment-timezone';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import * as chrono from 'chrono-node';

// 扩展 dayjs
dayjs.extend(utc);
dayjs.extend(timezone);

// 北京时区
const BEIJING_TIMEZONE = 'Asia/Shanghai';

/**
 * 智能时间解析器
 * 支持多种时间格式并统一转换为北京时间
 */
export class TimeParser {
  /**
   * 解析各种格式的时间并转换为北京时间的 ISO 字符串
   * @param timeInput 各种格式的时间输入
   * @returns 北京时间的 ISO 字符串
   */
  static parseToBeijingTime(timeInput: any): string {
    if (!timeInput) {
      return dayjs().tz(BEIJING_TIMEZONE).toISOString();
    }

    let parsedTime: dayjs.Dayjs | null = null;

    try {
      // 1. 处理数字类型的 timestamp
      if (typeof timeInput === 'number') {
        // 判断是秒级还是毫秒级时间戳
        const timestamp = timeInput;
        if (timestamp < 10000000000) {
          // 秒级时间戳
          parsedTime = dayjs.unix(timestamp);
        } else {
          // 毫秒级时间戳
          parsedTime = dayjs(timestamp);
        }
      }
      // 2. 处理字符串类型
      else if (typeof timeInput === 'string') {
        // 尝试直接解析 ISO 格式
        if (timeInput.includes('T') || timeInput.includes('Z') || timeInput.match(/\d{4}-\d{2}-\d{2}/)) {
          parsedTime = dayjs(timeInput);
        }
        // 尝试使用 chrono-node 解析自然语言时间
        else {
          const chronoResult = chrono.parseDate(timeInput);
          if (chronoResult) {
            parsedTime = dayjs(chronoResult);
          }
        }
        
        // 如果还没解析成功，尝试解析纯数字字符串
        if (!parsedTime || !parsedTime.isValid()) {
          const numericTime = parseInt(timeInput);
          if (!isNaN(numericTime)) {
            return this.parseToBeijingTime(numericTime);
          }
        }
      }
      // 3. 处理 Date 对象
      else if (timeInput instanceof Date) {
        parsedTime = dayjs(timeInput);
      }

      // 验证解析结果
      if (!parsedTime || !parsedTime.isValid()) {
        console.warn(`时间解析失败，使用当前时间: ${timeInput}`);
        return dayjs().tz(BEIJING_TIMEZONE).toISOString();
      }

      // 转换为北京时间
      return parsedTime.tz(BEIJING_TIMEZONE).toISOString();

    } catch (error) {
      console.error(`时间解析错误: ${timeInput}`, error);
      return dayjs().tz(BEIJING_TIMEZONE).toISOString();
    }
  }

  /**
   * 解析时间并返回北京时间的格式化字符串
   * @param timeInput 时间输入
   * @param format 格式化模式，默认 'YYYY-MM-DD HH:mm:ss'
   * @returns 格式化的北京时间字符串
   */
  static formatBeijingTime(timeInput: any, format: string = 'YYYY-MM-DD HH:mm:ss'): string {
    const isoTime = this.parseToBeijingTime(timeInput);
    return dayjs(isoTime).tz(BEIJING_TIMEZONE).format(format);
  }

  /**
   * 获取北京时间的时间戳（秒级）
   * @param timeInput 时间输入
   * @returns 秒级时间戳
   */
  static getBeijingTimestamp(timeInput: any): number {
    const isoTime = this.parseToBeijingTime(timeInput);
    return dayjs(isoTime).unix();
  }

  /**
   * 获取北京时间的时间戳（毫秒级）
   * @param timeInput 时间输入
   * @returns 毫秒级时间戳
   */
  static getBeijingTimestampMs(timeInput: any): number {
    const isoTime = this.parseToBeijingTime(timeInput);
    return dayjs(isoTime).valueOf();
  }

  /**
   * 检查输入时间是否有效
   * @param timeInput 时间输入
   * @returns 是否为有效时间
   */
  static isValidTime(timeInput: any): boolean {
    try {
      const parsed = this.parseToBeijingTime(timeInput);
      return dayjs(parsed).isValid() && dayjs(parsed).year() > 1970;
    } catch {
      return false;
    }
  }

  /**
   * 获取当前北京时间
   * @returns 北京时间的 ISO 字符串
   */
  static getCurrentBeijingTime(): string {
    return dayjs().tz(BEIJING_TIMEZONE).toISOString();
  }
}

/**
 * 便捷函数：解析时间为北京时间 ISO 字符串
 */
export function parseTimeToBeijing(timeInput: any): string {
  return TimeParser.parseToBeijingTime(timeInput);
}

/**
 * 便捷函数：格式化为北京时间字符串
 */
export function formatBeijingTime(timeInput: any, format?: string): string {
  return TimeParser.formatBeijingTime(timeInput, format);
}

/**
 * 便捷函数：获取当前北京时间
 */
export function getCurrentBeijingTime(): string {
  return TimeParser.getCurrentBeijingTime();
} 
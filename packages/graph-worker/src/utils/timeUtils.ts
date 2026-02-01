import * as chrono from 'chrono-node';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { normalizeTimestampMs } from '@drudge/common';
import { logger } from './logger';

// 扩展 dayjs
dayjs.extend(utc);

/**
 * 核心时间解析函数 - 将任意时间输入转换为UTC Date对象
 * @param timeInput 时间输入（数字、字符串、Date对象）
 * @returns UTC Date对象
 */
function parseTimeToDate(timeInput: any): Date {
  if (!timeInput) {
    throw new Error('时间输入不能为空');
  }

  // 如果已经是Date对象，直接返回
  if (timeInput instanceof Date) {
    return timeInput;
  }

  try {
    // 1. 处理数字类型的 timestamp
    if (typeof timeInput === 'number') {
      const normalized = normalizeTimestampMs(timeInput);
      if (normalized === null) {
        throw new Error(`时间解析失败: ${timeInput}`);
      }
      return dayjs(normalized).utc().toDate();
    }

    // 2. 处理字符串类型
    if (typeof timeInput === 'string') {
      // 首先检查是否为纯数字字符串（时间戳）
      const trimmed = timeInput.trim();
      if (/^\d+$/.test(trimmed)) {
        const normalized = normalizeTimestampMs(trimmed);
        if (normalized !== null) {
          return dayjs(normalized).utc().toDate();
        }
      }

      // 尝试使用 dayjs 解析标准日期格式，转换为UTC
      let parsed = dayjs(timeInput);
      if (parsed.isValid()) {
        return parsed.utc().toDate();
      }

      // 尝试使用 chrono-node 解析自然语言时间
      const chronoResult = chrono.parseDate(timeInput);
      if (chronoResult) {
        return dayjs(chronoResult).utc().toDate();
      }
    }

    // 如果所有解析都失败，抛出错误
    throw new Error(`时间解析失败: ${timeInput}`);
  } catch (error) {
    logger.error(`时间解析错误: ${timeInput}`, error);
    throw new Error('时间解析错误');
  }
}

/**
 * 解析时间并返回UTC ISO字符串
 * @param timeInput 时间输入
 * @returns UTC ISO时间字符串 (YYYY-MM-DDTHH:mm:ss.sssZ)
 */
export function parseTime(timeInput: any): string {
  const date = parseTimeToDate(timeInput);
  return dayjs(date).utc().toISOString();
}

/**
 * 获取当前UTC时间的ISO字符串
 * @returns 当前UTC时间的ISO字符串
 */
export function getCurrentTime(): string {
  return dayjs().utc().toISOString();
}

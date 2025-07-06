import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

// 扩展dayjs插件
dayjs.extend(utc);
dayjs.extend(timezone);

// 设置默认时区为北京时间
dayjs.tz.setDefault('Asia/Shanghai');

/**
 * 获取当前北京时间
 */
export const now = () => dayjs().tz('Asia/Shanghai');

/**
 * 解析时间并转换为北京时间
 */
export const parseTime = (time: string | number | Date) => {
  return dayjs(time).tz('Asia/Shanghai');
};

/**
 * 格式化时间为文件名格式 (YYYY_MM_DD_HH_mm_ss_SSS)
 */
export const formatForFilename = (time?: dayjs.Dayjs) => {
  const t = time || now();
  return t.format('YYYY_MM_DD_HH_mm_ss_SSS');
};

/**
 * 格式化时间为ISO字符串
 */
export const formatISO = (time?: dayjs.Dayjs) => {
  const t = time || now();
  return t.toISOString();
};

/**
 * 格式化时间为可读字符串
 */
export const formatReadable = (time?: dayjs.Dayjs) => {
  const t = time || now();
  return t.format('YYYY-MM-DD HH:mm:ss');
};

/**
 * 获取时间戳（秒）
 */
export const getTimestamp = (time?: dayjs.Dayjs) => {
  const t = time || now();
  return t.unix();
};

/**
 * 获取今天开始时间
 */
export const startOfToday = () => {
  return now().startOf('day');
};

/**
 * 获取N天前的时间
 */
export const daysAgo = (days: number) => {
  return now().subtract(days, 'day');
}; 
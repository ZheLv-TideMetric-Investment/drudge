/**
 * 时间实体（When）
 */
export class Time {
  constructor({
    timestamp,           // 精确时间戳
    date = null,        // 日期
    hour = null,        // 小时
    time_of_day = null, // 时间段（上午/下午/晚上）
    properties = {},    // 其他属性
  }) {
    this.timestamp = timestamp;
    this.date = date;
    this.hour = hour;
    this.time_of_day = time_of_day;
    this.properties = properties;
    this.created_at = new Date().toISOString();
    this.updated_at = new Date().toISOString();
  }

  // 更新时间戳
  touch() {
    this.updated_at = new Date().toISOString();
  }

  // 转换为纯对象
  toPlainObject() {
    return {
      timestamp: this.timestamp,
      date: this.date,
      hour: this.hour,
      time_of_day: this.time_of_day,
      properties: this.properties,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
} 
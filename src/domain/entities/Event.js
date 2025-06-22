import { EventTypes, SignificanceLevel, NewsLevel, NewsLevelDescription } from '../../shared/types/enums.js';

/**
 * 事件实体（What + How）
 * 表示新闻中的核心事件
 */
export class Event {
  constructor({
    id = null,
    event_name,                    // 事件名称
    event_description,             // 事件描述
    event_date,                    // 事件发生日期
    event_type = EventTypes.OTHER, // 事件类型
    significance = SignificanceLevel.MEDIUM, // 重要性
    sentiment = 'neutral',         // 情感倾向 positive/negative/neutral
    magnitude = 0.0,              // 影响程度 -1.0 到 1.0
    event_level = NewsLevel.LEVEL_4, // 新闻级别
    properties = {},              // 其他属性
  }) {
    this.id = id || this.generateId(event_name, event_date);
    this.event_name = event_name;
    this.event_description = event_description;
    this.event_date = event_date;
    this.event_type = event_type;
    this.significance = significance;
    this.sentiment = sentiment;
    this.magnitude = magnitude;
    this.event_level = event_level;
    this.properties = properties;
    this.created_at = new Date().toISOString();
    this.updated_at = new Date().toISOString();
  }

  generateId(eventName, eventDate) {
    const content = `${eventName}_${eventDate}_${Date.now()}`;
    return content.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  }

  // 获取新闻级别信息
  getLevelInfo() {
    return NewsLevelDescription[this.event_level] || NewsLevelDescription[NewsLevel.LEVEL_4];
  }

  // 是否需要立即推送
  needsImmediatePush() {
    return this.event_level === NewsLevel.LEVEL_1;
  }

  // 是否需要重要推送
  needsImportantPush() {
    return this.event_level === NewsLevel.LEVEL_1 || this.event_level === NewsLevel.LEVEL_2;
  }

  // 更新时间戳
  touch() {
    this.updated_at = new Date().toISOString();
  }

  // 转换为纯对象
  toPlainObject() {
    return {
      id: this.id,
      event_name: this.event_name,
      event_description: this.event_description,
      event_date: this.event_date,
      event_type: this.event_type,
      significance: this.significance,
      sentiment: this.sentiment,
      magnitude: this.magnitude,
      event_level: this.event_level,
      properties: this.properties,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
} 
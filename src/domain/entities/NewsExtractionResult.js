import { NewsLevel, NewsLevelDescription } from '../../shared/types/enums.js';

/**
 * 新闻提取结果实体
 */
export class NewsExtractionResult {
  constructor({
    news_id,
    events = [],
    companies = [],
    persons = [],
    organizations = [],
    locations = [],
    times = [],
    relationships = [],
    confidence = 1.0,
    processing_time = 0,
    news_level = NewsLevel.LEVEL_4, // 整体新闻级别
  }) {
    this.news_id = news_id;
    this.events = events;
    this.companies = companies;
    this.persons = persons;
    this.organizations = organizations;
    this.locations = locations;
    this.times = times;
    this.relationships = relationships;
    this.confidence = confidence;
    this.processing_time = processing_time;
    this.news_level = news_level;
    this.timestamp = new Date().toISOString();
  }

  // 添加事件
  addEvent(event) {
    this.events.push(event);
  }

  // 添加公司
  addCompany(company) {
    this.companies.push(company);
  }

  // 添加人物
  addPerson(person) {
    this.persons.push(person);
  }

  // 添加机构
  addOrganization(organization) {
    this.organizations.push(organization);
  }

  // 添加地点
  addLocation(location) {
    this.locations.push(location);
  }

  // 添加时间
  addTime(time) {
    this.times.push(time);
  }

  // 添加关系
  addRelationship(relationship) {
    this.relationships.push(relationship);
  }

  // 获取统计信息
  getStats() {
    return {
      news_id: this.news_id,
      event_count: this.events.length,
      company_count: this.companies.length,
      person_count: this.persons.length,
      organization_count: this.organizations.length,
      location_count: this.locations.length,
      time_count: this.times.length,
      relationship_count: this.relationships.length,
      confidence: this.confidence,
      processing_time: this.processing_time,
      news_level: this.news_level,
    };
  }

  // 判断是否为紧急新闻（Level 1）
  isCriticalNews() {
    return this.news_level === NewsLevel.LEVEL_1;
  }

  // 获取新闻级别
  getNewsLevel() {
    return this.news_level;
  }

  // 获取新闻级别信息
  getNewsLevelInfo() {
    return NewsLevelDescription[this.news_level] || NewsLevelDescription[NewsLevel.LEVEL_4];
  }

  // 根据事件级别计算整体新闻级别
  calculateNewsLevel() {
    if (this.events.length === 0) {
      return NewsLevel.LEVEL_5;
    }

    // 找出最高级别的事件
    const highestEventLevel = this.events.reduce((highest, event) => {
      const eventLevelValue = this.getLevelValue(event.event_level);
      const currentHighest = this.getLevelValue(highest);
      return eventLevelValue < currentHighest ? event.event_level : highest;
    }, NewsLevel.LEVEL_5);

    return highestEventLevel;
  }

  // 获取级别数值（用于比较，数值越小级别越高）
  getLevelValue(level) {
    const levelMap = {
      [NewsLevel.LEVEL_1]: 1,
      [NewsLevel.LEVEL_2]: 2,
      [NewsLevel.LEVEL_3]: 3,
      [NewsLevel.LEVEL_4]: 4,
      [NewsLevel.LEVEL_5]: 5,
    };
    return levelMap[level] || 5;
  }

  // 是否需要立即推送
  needsImmediatePush() {
    return this.news_level === NewsLevel.LEVEL_1;
  }

  // 是否需要重要推送
  needsImportantPush() {
    return this.news_level === NewsLevel.LEVEL_1 || this.news_level === NewsLevel.LEVEL_2;
  }

  // 转换为纯对象
  toPlainObject() {
    return {
      news_id: this.news_id,
      events: this.events.map(e => e.toPlainObject ? e.toPlainObject() : e),
      companies: this.companies.map(c => c.toPlainObject ? c.toPlainObject() : c),
      persons: this.persons.map(p => p.toPlainObject ? p.toPlainObject() : p),
      organizations: this.organizations.map(o => o.toPlainObject ? o.toPlainObject() : o),
      locations: this.locations.map(l => l.toPlainObject ? l.toPlainObject() : l),
      times: this.times.map(t => t.toPlainObject ? t.toPlainObject() : t),
      relationships: this.relationships.map(r => r.toPlainObject ? r.toPlainObject() : r),
      confidence: this.confidence,
      processing_time: this.processing_time,
      news_level: this.news_level,
      timestamp: this.timestamp,
    };
  }
} 
// 导出所有领域实体
export { Event } from './Event.js';
export { Company } from './Company.js';
export { Person } from './Person.js';
export { Location } from './Location.js';
export { Time } from './Time.js';
export { NewsExtractionResult } from './NewsExtractionResult.js';

/**
 * 机构实体（Who - 机构）
 */
export class Organization {
  constructor({
    organization_name,     // 机构名称
    type = null,          // 机构类型
    country = null,       // 所属国家
    properties = {},      // 其他属性
  }) {
    this.organization_name = organization_name;
    this.type = type;
    this.country = country;
    this.properties = properties;
    this.created_at = new Date().toISOString();
    this.updated_at = new Date().toISOString();
  }

  touch() {
    this.updated_at = new Date().toISOString();
  }

  toPlainObject() {
    return {
      organization_name: this.organization_name,
      type: this.type,
      country: this.country,
      properties: this.properties,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}



/**
 * 新闻实体
 */
export class News {
  constructor({
    id,
    title,
    content,
    timestamp,
    source = '',
    url = '',
    level = 0,
    processed = false,
    fingerprint = null,     // 新闻指纹（用于去重）
  }) {
    this.id = id;
    this.title = title;
    this.content = content;
    this.timestamp = timestamp;
    this.source = source;
    this.url = url;
    this.level = level;
    this.processed = processed;
    this.fingerprint = fingerprint;
    this.created_at = new Date().toISOString();
  }

  markAsProcessed() {
    this.processed = true;
  }

  toPlainObject() {
    return {
      id: this.id,
      title: this.title,
      content: this.content,
      timestamp: this.timestamp,
      source: this.source,
      url: this.url,
      level: this.level,
      processed: this.processed,
      fingerprint: this.fingerprint,
      created_at: this.created_at,
    };
  }
}

/**
 * 关系实体
 */
export class Relationship {
  constructor({
    type,                 // 关系类型
    from_node,           // 源节点
    to_node,             // 目标节点
    properties = {},     // 关系属性
    confidence = 1.0,    // 置信度
    source = '',         // 关系来源
  }) {
    this.type = type;
    this.from_node = from_node;
    this.to_node = to_node;
    this.properties = properties;
    this.confidence = confidence;
    this.source = source;
    this.created_at = new Date().toISOString();
  }

  toPlainObject() {
    return {
      type: this.type,
      from_node: this.from_node,
      to_node: this.to_node,
      properties: this.properties,
      confidence: this.confidence,
      source: this.source,
      created_at: this.created_at,
    };
  }
}

/**
 * 小时总结实体
 */
export class HourlySummary {
  constructor({
    hour_start,
    hour_end,
    total_news_count = 0,
    critical_news_count = 0,
    top_events = [],
    top_companies = [],
    summary_text = '',
  }) {
    this.hour_start = hour_start;
    this.hour_end = hour_end;
    this.total_news_count = total_news_count;
    this.critical_news_count = critical_news_count;
    this.top_events = top_events;
    this.top_companies = top_companies;
    this.summary_text = summary_text;
    this.created_at = new Date().toISOString();
  }

  toPlainObject() {
    return {
      hour_start: this.hour_start,
      hour_end: this.hour_end,
      total_news_count: this.total_news_count,
      critical_news_count: this.critical_news_count,
      top_events: this.top_events,
      top_companies: this.top_companies,
      summary_text: this.summary_text,
      created_at: this.created_at,
    };
  }
}

/**
 * 草蛇灰线查询参数实体
 */
export class SnakeTrackingQuery {
  constructor({
    keywords = [],       // 关键词
    entities = [],       // 实体
    date_range = null,   // 日期范围
    event_types = [],    // 关注的事件类型
    significance_level = 2, // 最低重要性级别
    depth = 2,           // 查询深度
  }) {
    this.keywords = keywords;
    this.entities = entities;
    this.date_range = date_range;
    this.event_types = event_types;
    this.significance_level = significance_level;
    this.depth = depth;
  }

  toPlainObject() {
    return {
      keywords: this.keywords,
      entities: this.entities,
      date_range: this.date_range,
      event_types: this.event_types,
      significance_level: this.significance_level,
      depth: this.depth,
    };
  }
}

/**
 * 图查询结果实体
 */
export class GraphQueryResult {
  constructor({ 
    nodes = [], 
    relationships = [], 
    metadata = {} 
  }) {
    this.nodes = nodes;
    this.relationships = relationships;
    this.metadata = metadata;
    this.timestamp = new Date().toISOString();
  }

  addNode(node) {
    if (!this.nodes.find(n => n.id === node.id)) {
      this.nodes.push(node);
    }
  }

  addRelationship(relationship) {
    this.relationships.push(relationship);
  }

  getNodeCount() {
    return this.nodes.length;
  }

  getRelationshipCount() {
    return this.relationships.length;
  }

  toPlainObject() {
    return {
      nodes: this.nodes,
      relationships: this.relationships,
      metadata: this.metadata,
      timestamp: this.timestamp,
    };
  }
} 
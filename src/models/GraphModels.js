/**
 * 知识图谱数据模型定义
 * 定义节点类型、关系类型和数据结构
 */

// 节点类型枚举
export const NodeTypes = {
  ENTITY: 'Entity',
  EVENT: 'Event',
  NEWS: 'News',
};

// 实体类型枚举
export const EntityTypes = {
  PERSON: 'Person', // 人物
  ORGANIZATION: 'Organization', // 组织/机构
  LOCATION: 'Location', // 地点
  COMPANY: 'Company', // 公司
  PRODUCT: 'Product', // 产品
  CURRENCY: 'Currency', // 货币
  STOCK: 'Stock', // 股票
  COMMODITY: 'Commodity', // 商品
  CONCEPT: 'Concept', // 概念
  OTHER: 'Other', // 其他
};

// 事件类型枚举
export const EventTypes = {
  PRICE_CHANGE: 'PriceChange', // 价格变动
  ACQUISITION: 'Acquisition', // 收购/并购
  PARTNERSHIP: 'Partnership', // 合作
  CONFLICT: 'Conflict', // 冲突/争议
  ANNOUNCEMENT: 'Announcement', // 公告/发布
  POLICY_CHANGE: 'PolicyChange', // 政策变化
  FINANCIAL_RESULT: 'FinancialResult', // 财务业绩
  MARKET_MOVE: 'MarketMove', // 市场动向
  LEADERSHIP_CHANGE: 'LeadershipChange', // 人事变动
  PRODUCT_LAUNCH: 'ProductLaunch', // 产品发布
  ECONOMIC_INDICATOR: 'EconomicIndicator', // 经济指标
  OTHER: 'Other', // 其他事件
};

// 关系类型枚举
export const RelationshipTypes = {
  // 实体与事件的关系
  PARTICIPATED_IN: 'PARTICIPATED_IN', // 参与事件
  AFFECTED_BY: 'AFFECTED_BY', // 受事件影响
  CAUSED: 'CAUSED', // 造成事件

  // 实体与实体的关系
  CEO_OF: 'CEO_OF', // CEO关系
  OWNS: 'OWNS', // 拥有关系
  SUBSIDIARY_OF: 'SUBSIDIARY_OF', // 子公司关系
  PARTNER_OF: 'PARTNER_OF', // 合作关系
  COMPETITOR_OF: 'COMPETITOR_OF', // 竞争关系
  LOCATED_IN: 'LOCATED_IN', // 位于
  WORKS_FOR: 'WORKS_FOR', // 工作于
  LEADS: 'LEADS', // 领导
  RELATED_TO: 'RELATED_TO', // 相关

  // 事件与新闻的关系
  REPORTED_IN: 'REPORTED_IN', // 在新闻中报道

  // 实体与新闻的关系
  MENTIONED_IN: 'MENTIONED_IN', // 在新闻中提及
};

// 实体节点模型
export class EntityNode {
  constructor({
    name,
    type = EntityTypes.OTHER,
    aliases = [],
    description = '',
    properties = {},
    confidence = 1.0,
  }) {
    this.name = name;
    this.type = type;
    this.aliases = aliases; // 实体的不同表达方式
    this.description = description;
    this.properties = properties; // 扩展属性
    this.confidence = confidence; // 识别置信度
    this.createdAt = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
  }

  // 规范化实体名称
  static normalizeName(name) {
    return name.trim().replace(/\s+/g, ' ');
  }

  // 检查是否为同一实体的不同表达
  isSameEntity(otherName) {
    const normalizedThis = EntityNode.normalizeName(this.name.toLowerCase());
    const normalizedOther = EntityNode.normalizeName(otherName.toLowerCase());

    // 完全匹配
    if (normalizedThis === normalizedOther) return true;

    // 检查别名
    const allNames = [this.name, ...this.aliases].map(n =>
      EntityNode.normalizeName(n.toLowerCase())
    );

    return allNames.includes(normalizedOther);
  }

  // 添加别名
  addAlias(alias) {
    const normalizedAlias = EntityNode.normalizeName(alias);
    if (!this.aliases.includes(normalizedAlias) && normalizedAlias !== this.name) {
      this.aliases.push(normalizedAlias);
      this.updatedAt = new Date().toISOString();
    }
  }
}

// 事件节点模型
export class EventNode {
  constructor({
    type = EventTypes.OTHER,
    description = '',
    sentiment = 'neutral', // positive, negative, neutral
    magnitude = 0, // 事件影响程度 -1 到 1
    timestamp,
    location = '',
    properties = {},
  }) {
    this.type = type;
    this.description = description;
    this.sentiment = sentiment;
    this.magnitude = magnitude;
    this.timestamp = timestamp || new Date().toISOString();
    this.location = location;
    this.properties = properties;
    this.createdAt = new Date().toISOString();
  }

  // 生成事件的唯一标识
  generateId() {
    const content = `${this.type}_${this.description}_${this.timestamp}`;
    return content.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  }
}

// 新闻节点模型
export class NewsNode {
  constructor({
    id,
    title,
    content,
    timestamp,
    source = '',
    url = '',
    level = 0,
    processed = false,
  }) {
    this.id = id;
    this.title = title;
    this.content = content;
    this.timestamp = timestamp;
    this.source = source;
    this.url = url;
    this.level = level;
    this.processed = processed;
    this.createdAt = new Date().toISOString();
  }
}

// 关系模型
export class Relationship {
  constructor({
    type,
    fromNode,
    toNode,
    properties = {},
    confidence = 1.0,
    source = '', // 关系来源（如新闻ID）
  }) {
    this.type = type;
    this.fromNode = fromNode;
    this.toNode = toNode;
    this.properties = properties;
    this.confidence = confidence;
    this.source = source;
    this.createdAt = new Date().toISOString();
  }
}

// 图谱查询结果模型
export class GraphQueryResult {
  constructor({ nodes = [], relationships = [], metadata = {} }) {
    this.nodes = nodes;
    this.relationships = relationships;
    this.metadata = metadata;
    this.timestamp = new Date().toISOString();
  }

  // 添加节点
  addNode(node) {
    if (!this.nodes.find(n => n.id === node.id)) {
      this.nodes.push(node);
    }
  }

  // 添加关系
  addRelationship(relationship) {
    this.relationships.push(relationship);
  }

  // 获取节点数量
  getNodeCount() {
    return this.nodes.length;
  }

  // 获取关系数量
  getRelationshipCount() {
    return this.relationships.length;
  }
}

// 实体提取结果模型
export class EntityExtractionResult {
  constructor({
    entities = [],
    events = [],
    relationships = [],
    confidence = 1.0,
    processingTime = 0,
  }) {
    this.entities = entities;
    this.events = events;
    this.relationships = relationships;
    this.confidence = confidence;
    this.processingTime = processingTime;
    this.timestamp = new Date().toISOString();
  }

  // 添加实体
  addEntity(entity) {
    this.entities.push(entity);
  }

  // 添加事件
  addEvent(event) {
    this.events.push(event);
  }

  // 添加关系
  addRelationship(relationship) {
    this.relationships.push(relationship);
  }

  // 获取统计信息
  getStats() {
    return {
      entityCount: this.entities.length,
      eventCount: this.events.length,
      relationshipCount: this.relationships.length,
      confidence: this.confidence,
      processingTime: this.processingTime,
    };
  }
}

export default {
  NodeTypes,
  EntityTypes,
  EventTypes,
  RelationshipTypes,
  EntityNode,
  EventNode,
  NewsNode,
  Relationship,
  GraphQueryResult,
  EntityExtractionResult,
};

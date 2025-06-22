/**
 * 新闻处理与图数据库存储系统 - 数据模型定义
 * 基于新闻六要素（5W1H）的图数据库设计
 */

// 节点类型枚举
export const NodeTypes = {
  EVENT: 'Event',           // 事件节点（What + How）
  COMPANY: 'Company',       // 公司节点（Who - 企业）
  PERSON: 'Person',         // 人物节点（Who - 个人）
  ORGANIZATION: 'Organization', // 机构节点（Who - 机构）
  LOCATION: 'Location',     // 地点节点（Where）
  TIME: 'Time',            // 时间节点（When）
  NEWS: 'News',            // 新闻节点（原始数据）
};

// 事件类型枚举
export const EventTypes = {
  FINANCIAL: '财经事件',
  POLICY: '政策事件', 
  MARKET: '市场事件',
  CORPORATE: '企业事件',
  ECONOMIC: '经济事件',
  POLITICAL: '政治事件',
  SOCIAL: '社会事件',
  TECHNOLOGY: '科技事件',
  OTHER: '其他事件',
};

// 关系类型枚举
export const RelationshipTypes = {
  // 事件与其他实体的关系
  OCCURRED_IN: 'OCCURRED_IN',        // 事件发生在某个公司
  INVOLVES: 'INVOLVES',              // 事件涉及某个人物
  OCCURRED_AT: 'OCCURRED_AT',        // 事件发生在某地点
  HAPPENED_AT: 'HAPPENED_AT',        // 事件发生在特定时间

  // 自然关系
  BELONGS_TO: 'BELONGS_TO',          // 地点属于某个国家
  CEO_OF: 'CEO_OF',                  // 人物是某公司的CEO
  WORKS_FOR: 'WORKS_FOR',            // 人物在某公司工作
  OPERATES_IN: 'OPERATES_IN',        // 公司在某行业运营
  SUBSIDIARY_OF: 'SUBSIDIARY_OF',    // 子公司关系
  PARTNER_OF: 'PARTNER_OF',          // 合作关系
  COMPETITOR_OF: 'COMPETITOR_OF',    // 竞争关系

  // 新闻与实体的关系
  REPORTED_IN: 'REPORTED_IN',        // 事件在新闻中报道
  MENTIONED_IN: 'MENTIONED_IN',      // 实体在新闻中提及
};

// 重要性级别枚举
export const SignificanceLevel = {
  LOW: 1,      // 低重要性
  MEDIUM: 2,   // 中等重要性
  HIGH: 3,     // 高重要性
  CRITICAL: 4, // 极高重要性
};

/**
 * News Level枚举 - 新闻级别分类
 */
export const NewsLevel = {
  LEVEL_5: 'Level 5', // Informational News (信息性新闻)
  LEVEL_4: 'Level 4', // Low Priority News (低优先级新闻)
  LEVEL_3: 'Level 3', // Medium Priority News (中等优先级新闻)
  LEVEL_2: 'Level 2', // High Priority News (高优先级新闻)
  LEVEL_1: 'Level 1', // Critical News (紧急新闻)
};

/**
 * News Level描述映射
 */
export const NewsLevelDescription = {
  [NewsLevel.LEVEL_1]: {
    name: 'Critical News',
    nameCn: '紧急新闻',
    description: '对全球金融市场、经济体系或政治环境有极大冲击性的新闻，通常不可预见且引起市场强烈反应',
    examples: ['全球经济危机', '国际冲突或战争爆发', '全球流行病', '重要政府领导人突然去世或辞职', '国家级金融政策重大变动'],
    pushType: 'immediate',
    significance: SignificanceLevel.CRITICAL,
    impact: '全球或多个国家，影响金融市场、政治稳定、全球供应链'
  },
  [NewsLevel.LEVEL_2]: {
    name: 'High Priority News', 
    nameCn: '高优先级新闻',
    description: '具有高度重要性但不如Level 1紧急，通常影响重大经济体或企业决策、股市等',
    examples: ['央行政策调整', '国际贸易政策变动', '重大企业并购或破产', '国家级财政政策改革', '股市大幅波动'],
    pushType: 'important',
    significance: SignificanceLevel.HIGH,
    impact: '主要影响经济体、金融市场、特定行业或大公司'
  },
  [NewsLevel.LEVEL_3]: {
    name: 'Medium Priority News',
    nameCn: '中等优先级新闻',
    description: '对某些行业、公司或地区具有较高重要性，但对全球或宏观经济影响较小',
    examples: ['行业重要事件', '重要公司财报发布', '经济数据发布', '政治选举结果', '重大公司高层变动'],
    pushType: 'optional',
    significance: SignificanceLevel.MEDIUM,
    impact: '对行业或特定公司有较大影响，可能引起短期市场波动'
  },
  [NewsLevel.LEVEL_4]: {
    name: 'Low Priority News',
    nameCn: '低优先级新闻',
    description: '对市场、行业或公司产生较小影响，更多是背景性信息或单一事件',
    examples: ['公司新产品发布', '市场分析报告', '地方性政治变化', '公司内部变动', '小型行业会议'],
    pushType: 'subscription',
    significance: SignificanceLevel.LOW,
    impact: '通常是局部影响，对宏观经济或全球市场几乎无影响'
  },
  [NewsLevel.LEVEL_5]: {
    name: 'Informational News',
    nameCn: '信息性新闻',
    description: '对当前事件的补充性说明或没有直接市场影响，主要用于增加对特定话题的了解',
    examples: ['新闻更新', '行业内日常运营新闻', '消费者数据', '宏观经济报告细节更新'],
    pushType: 'background',
    significance: SignificanceLevel.LOW,
    impact: '仅提供信息更新，一般不会对市场或投资者产生直接影响'
  }
};

/**
 * 事件节点模型（What + How）
 */
export class EventNode {
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
}

/**
 * 公司节点模型（Who - 企业）
 */
export class CompanyNode {
  constructor({
    company_name,           // 公司名称
    ticker = null,         // 股票代码
    industry = null,       // 行业分类
    market_cap = null,     // 市值
    properties = {},       // 其他属性
  }) {
    this.company_name = company_name;
    this.ticker = ticker;
    this.industry = industry;
    this.market_cap = market_cap;
    this.properties = properties;
    this.created_at = new Date().toISOString();
    this.updated_at = new Date().toISOString();
  }
}

/**
 * 人物节点模型（Who - 个人）
 */
export class PersonNode {
  constructor({
    person_name,           // 人物名称
    role = null,          // 角色/职位
    company = null,       // 所在公司
    properties = {},      // 其他属性
  }) {
    this.person_name = person_name;
    this.role = role;
    this.company = company;
    this.properties = properties;
    this.created_at = new Date().toISOString();
    this.updated_at = new Date().toISOString();
  }
}

/**
 * 机构节点模型（Who - 机构）
 */
export class OrganizationNode {
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
}

/**
 * 地点节点模型（Where）
 */
export class LocationNode {
  constructor({
    location_name,        // 地点名称
    country = null,       // 所属国家
    region = null,        // 地区
    coordinates = null,   // 坐标
    properties = {},      // 其他属性
  }) {
    this.location_name = location_name;
    this.country = country;
    this.region = region;
    this.coordinates = coordinates;
    this.properties = properties;
    this.created_at = new Date().toISOString();
    this.updated_at = new Date().toISOString();
  }
}

/**
 * 时间节点模型（When）
 */
export class TimeNode {
  constructor({
    timestamp,            // 时间戳
    date,                // 日期
    hour = null,         // 小时
    time_of_day = null,  // 时间段
    properties = {},     // 其他属性
  }) {
    this.timestamp = timestamp;
    this.date = date;
    this.hour = hour;
    this.time_of_day = time_of_day;
    this.properties = properties;
    this.created_at = new Date().toISOString();
  }
}

/**
 * 新闻节点模型
 */
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
}

/**
 * 关系模型
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
}

/**
 * 新闻提取结果模型
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
}

/**
 * 图查询结果模型
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
}

/**
 * 草蛇灰线查询参数模型
 */
export class SnakeTrackingQuery {
  constructor({
    companies = [],       // 查询的公司列表
    date_range = null,   // 日期范围
    event_types = [],    // 关注的事件类型
    significance_level = SignificanceLevel.MEDIUM, // 最低重要性级别
    depth = 2,           // 查询深度
  }) {
    this.companies = companies;
    this.date_range = date_range;
    this.event_types = event_types;
    this.significance_level = significance_level;
    this.depth = depth;
  }
}

/**
 * 按小时总结模型
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
}

export default {
  NodeTypes,
  EventTypes,
  RelationshipTypes,
  SignificanceLevel,
  NewsLevel,
  NewsLevelDescription,
  EventNode,
  CompanyNode,
  PersonNode,
  OrganizationNode,
  LocationNode,
  TimeNode,
  NewsNode,
  Relationship,
  NewsExtractionResult,
  GraphQueryResult,
  SnakeTrackingQuery,
  HourlySummary,
};

/**
 * 统一的枚举常量定义
 * 使用 TypeScript 枚举和 ts-enum-util 库
 */

import { $enum } from 'ts-enum-util';

// ====================== 事件相关枚举 ======================

/**
 * 事件类型枚举
 */
export enum EventType {
  MACRO = 'macro',
  POLICY = 'policy', 
  MARKET = 'market',
  CORPORATE = 'corporate',
  INDUSTRY = 'industry',
  TECH = 'tech',
  GEOPOLITICS = 'geopolitics',
  OTHER = 'other'
}

/**
 * 情感倾向枚举
 */
export enum Sentiment {
  POSITIVE = 'positive',
  NEGATIVE = 'negative', 
  NEUTRAL = 'neutral'
}

/**
 * 事件级别枚举
 */
export enum EventLevel {
  LEVEL_1 = 'Level 1',
  LEVEL_2 = 'Level 2',
  LEVEL_3 = 'Level 3', 
  LEVEL_4 = 'Level 4',
  LEVEL_5 = 'Level 5'
}

/**
 * 紧急程度枚举
 */
export enum UrgencyLevel {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

// ====================== 机构相关枚举 ======================

/**
 * 机构类型枚举
 */
export enum OrganizationType {
  GOVERNMENT = 'government',
  REGULATOR = 'regulator',
  INTL_ORG = 'intl_org',
  FIN_INST = 'fin_inst', 
  INDUSTRY_ASSOC = 'industry_assoc',
  OTHER = 'other'
}

// ====================== 地点相关枚举 ======================

/**
 * 地点类型枚举
 */
export enum LocationType {
  COUNTRY = 'country',
  REGION = 'region',
  CITY = 'city',
  FACILITY = 'facility',
  OTHER = 'other'
}

// ====================== 节点类型枚举 ======================

/**
 * 图数据库节点类型枚举
 */
export enum NodeType {
  NEWS = 'News',
  EVENT = 'Event', 
  COMPANY = 'Company',
  PERSON = 'Person',
  ORGANIZATION = 'Organization',
  LOCATION = 'Location'
}

// ====================== 关系类型枚举 ======================

/**
 * 关系类型枚举
 */
export enum RelationshipType {
  LOCATED_IN = 'LOCATED_IN',
  WORKS_FOR = 'WORKS_FOR', 
  OWNS = 'OWNS',
  PARTICIPATES_IN = 'PARTICIPATES_IN',
  MERGES_WITH = 'MERGES_WITH',
  ACQUIRES = 'ACQUIRES',
  SUPPLIES = 'SUPPLIES',
  PARTNERS_WITH = 'PARTNERS_WITH',
  SUED_BY = 'SUED_BY',
  REGULATED_BY = 'REGULATED_BY',
  INVESTS_IN = 'INVESTS_IN',
  OTHER = 'OTHER'
}

/**
 * 系统生成的关系类型
 */
export enum SystemRelationshipType {
  DESCRIBES = 'DESCRIBES',      // 新闻描述事件
  INVOLVES = 'INVOLVES',        // 新闻涉及公司/机构
  MENTIONS = 'MENTIONS',        // 新闻提及人物
  LOCATED_AT = 'LOCATED_AT'     // 新闻/事件发生地点
}

// ====================== 使用 ts-enum-util 的工具函数 ======================

/**
 * 枚举工具对象 - 使用 ts-enum-util 提供强大的枚举操作
 */
export const EventTypeEnum = $enum(EventType);
export const SentimentEnum = $enum(Sentiment);
export const EventLevelEnum = $enum(EventLevel);
export const UrgencyLevelEnum = $enum(UrgencyLevel);
export const OrganizationTypeEnum = $enum(OrganizationType);
export const LocationTypeEnum = $enum(LocationType);
export const NodeTypeEnum = $enum(NodeType);
export const RelationshipTypeEnum = $enum(RelationshipType);
export const SystemRelationshipTypeEnum = $enum(SystemRelationshipType);

/**
 * 所有枚举值的数组形式（用于验证）
 */
export const EVENT_TYPE_VALUES = EventTypeEnum.getValues();
export const SENTIMENT_VALUES = SentimentEnum.getValues();
export const EVENT_LEVEL_VALUES = EventLevelEnum.getValues();
export const URGENCY_LEVEL_VALUES = UrgencyLevelEnum.getValues();
export const ORGANIZATION_TYPE_VALUES = OrganizationTypeEnum.getValues();
export const LOCATION_TYPE_VALUES = LocationTypeEnum.getValues();
export const NODE_TYPE_VALUES = NodeTypeEnum.getValues();
export const RELATIONSHIP_TYPE_VALUES = RelationshipTypeEnum.getValues();
export const SYSTEM_RELATIONSHIP_TYPE_VALUES = SystemRelationshipTypeEnum.getValues();

/**
 * 枚举键的数组形式
 */
export const EVENT_TYPE_KEYS = EventTypeEnum.getKeys();
export const SENTIMENT_KEYS = SentimentEnum.getKeys();
export const EVENT_LEVEL_KEYS = EventLevelEnum.getKeys();
export const URGENCY_LEVEL_KEYS = UrgencyLevelEnum.getKeys();
export const ORGANIZATION_TYPE_KEYS = OrganizationTypeEnum.getKeys();
export const LOCATION_TYPE_KEYS = LocationTypeEnum.getKeys();
export const NODE_TYPE_KEYS = NodeTypeEnum.getKeys();
export const RELATIONSHIP_TYPE_KEYS = RelationshipTypeEnum.getKeys();
export const SYSTEM_RELATIONSHIP_TYPE_KEYS = SystemRelationshipTypeEnum.getKeys();

/**
 * 验证枚举值的工具函数
 */
export const isValidEventType = (value: string | null | undefined): value is EventType => 
  EventTypeEnum.isValue(value);

export const isValidSentiment = (value: string | null | undefined): value is Sentiment => 
  SentimentEnum.isValue(value);

export const isValidEventLevel = (value: string | null | undefined): value is EventLevel => 
  EventLevelEnum.isValue(value);

export const isValidUrgencyLevel = (value: string | null | undefined): value is UrgencyLevel => 
  UrgencyLevelEnum.isValue(value);

export const isValidOrganizationType = (value: string | null | undefined): value is OrganizationType => 
  OrganizationTypeEnum.isValue(value);

export const isValidLocationType = (value: string | null | undefined): value is LocationType => 
  LocationTypeEnum.isValue(value);

export const isValidNodeType = (value: string | null | undefined): value is NodeType => 
  NodeTypeEnum.isValue(value);

export const isValidRelationshipType = (value: string | null | undefined): value is RelationshipType => 
  RelationshipTypeEnum.isValue(value);

export const isValidSystemRelationshipType = (value: string | null | undefined): value is SystemRelationshipType => 
  SystemRelationshipTypeEnum.isValue(value);

/**
 * 枚举映射工具函数
 */
export const mapEventType = <T>(mapper: (type: EventType) => T): T[] => 
  EventTypeEnum.getValues().map(mapper);

export const mapSentiment = <T>(mapper: (sentiment: Sentiment) => T): T[] => 
  SentimentEnum.getValues().map(mapper);

export const mapEventLevel = <T>(mapper: (level: EventLevel) => T): T[] => 
  EventLevelEnum.getValues().map(mapper);

export const mapNodeType = <T>(mapper: (nodeType: NodeType) => T): T[] => 
  NodeTypeEnum.getValues().map(mapper);

/**
 * 枚举描述映射（用于文档和UI显示）
 */
export const EVENT_TYPE_DESCRIPTIONS: Record<EventType, string> = {
  [EventType.MACRO]: '宏观经济事件',
  [EventType.POLICY]: '政策变化',
  [EventType.MARKET]: '市场动态', 
  [EventType.CORPORATE]: '企业事件',
  [EventType.INDUSTRY]: '行业事件',
  [EventType.TECH]: '技术事件',
  [EventType.GEOPOLITICS]: '地缘政治',
  [EventType.OTHER]: '其他事件'
};

export const SENTIMENT_DESCRIPTIONS: Record<Sentiment, string> = {
  [Sentiment.POSITIVE]: '积极',
  [Sentiment.NEGATIVE]: '消极',
  [Sentiment.NEUTRAL]: '中性'
};

export const URGENCY_LEVEL_DESCRIPTIONS: Record<UrgencyLevel, string> = {
  [UrgencyLevel.CRITICAL]: '紧急',
  [UrgencyLevel.HIGH]: '高',
  [UrgencyLevel.MEDIUM]: '中',
  [UrgencyLevel.LOW]: '低'
};

export const ORGANIZATION_TYPE_DESCRIPTIONS: Record<OrganizationType, string> = {
  [OrganizationType.GOVERNMENT]: '政府机构',
  [OrganizationType.REGULATOR]: '监管机构',
  [OrganizationType.INTL_ORG]: '国际组织',
  [OrganizationType.FIN_INST]: '金融机构',
  [OrganizationType.INDUSTRY_ASSOC]: '行业协会',
  [OrganizationType.OTHER]: '其他'
};

export const LOCATION_TYPE_DESCRIPTIONS: Record<LocationType, string> = {
  [LocationType.COUNTRY]: '国家',
  [LocationType.REGION]: '地区',
  [LocationType.CITY]: '城市',
  [LocationType.FACILITY]: '设施',
  [LocationType.OTHER]: '其他'
};

export const NODE_TYPE_DESCRIPTIONS: Record<NodeType, string> = {
  [NodeType.NEWS]: '新闻',
  [NodeType.EVENT]: '事件',
  [NodeType.COMPANY]: '公司',
  [NodeType.PERSON]: '人物',
  [NodeType.ORGANIZATION]: '机构',
  [NodeType.LOCATION]: '地点'
};

export const RELATIONSHIP_TYPE_DESCRIPTIONS: Record<RelationshipType, string> = {
  [RelationshipType.LOCATED_IN]: '位于',
  [RelationshipType.WORKS_FOR]: '供职于',
  [RelationshipType.OWNS]: '拥有',
  [RelationshipType.PARTICIPATES_IN]: '参与',
  [RelationshipType.MERGES_WITH]: '合并',
  [RelationshipType.ACQUIRES]: '收购',
  [RelationshipType.SUPPLIES]: '供应',
  [RelationshipType.PARTNERS_WITH]: '合作',
  [RelationshipType.SUED_BY]: '被起诉',
  [RelationshipType.REGULATED_BY]: '被监管',
  [RelationshipType.INVESTS_IN]: '投资',
  [RelationshipType.OTHER]: '其他'
};

/**
 * 枚举转换工具函数
 */
export const getEventTypeByKey = (key: string): EventType | undefined => 
  EventTypeEnum.isKey(key) ? EventTypeEnum.getValueOrThrow(key) : undefined;

export const getSentimentByKey = (key: string): Sentiment | undefined => 
  SentimentEnum.isKey(key) ? SentimentEnum.getValueOrThrow(key) : undefined;

export const getEventLevelByKey = (key: string): EventLevel | undefined => 
  EventLevelEnum.isKey(key) ? EventLevelEnum.getValueOrThrow(key) : undefined;

/**
 * 枚举默认值
 */
export const DEFAULT_EVENT_TYPE = EventType.OTHER;
export const DEFAULT_SENTIMENT = Sentiment.NEUTRAL;
export const DEFAULT_EVENT_LEVEL = EventLevel.LEVEL_5;
export const DEFAULT_URGENCY_LEVEL = UrgencyLevel.LOW;
export const DEFAULT_ORGANIZATION_TYPE = OrganizationType.OTHER;
export const DEFAULT_LOCATION_TYPE = LocationType.OTHER;
export const DEFAULT_NODE_TYPE = NodeType.NEWS;
export const DEFAULT_RELATIONSHIP_TYPE = RelationshipType.OTHER;

/**
 * 向后兼容的常量对象（保持与现有代码的兼容性）
 */
export const EVENT_TYPES = EventType;
export const SENTIMENTS = Sentiment;
export const EVENT_LEVELS = EventLevel;
export const ORGANIZATION_TYPES = OrganizationType;
export const LOCATION_TYPES = LocationType;
export const NODE_TYPES = NodeType;
export const RELATIONSHIP_TYPES = RelationshipType;
export const SYSTEM_RELATIONSHIP_TYPES = SystemRelationshipType; 
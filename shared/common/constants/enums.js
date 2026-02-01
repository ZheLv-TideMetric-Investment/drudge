const { $enum } = require('ts-enum-util');

const EventType = Object.freeze({
  MACRO: 'macro',
  POLICY: 'policy',
  MARKET: 'market',
  CORPORATE: 'corporate',
  INDUSTRY: 'industry',
  TECH: 'tech',
  GEOPOLITICS: 'geopolitics',
  OTHER: 'other'
});

const Sentiment = Object.freeze({
  POSITIVE: 'positive',
  NEGATIVE: 'negative',
  NEUTRAL: 'neutral'
});

const EventLevel = Object.freeze({
  LEVEL_1: 'Level 1',
  LEVEL_2: 'Level 2',
  LEVEL_3: 'Level 3',
  LEVEL_4: 'Level 4',
  LEVEL_5: 'Level 5'
});

const UrgencyLevel = Object.freeze({
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
});

const OrganizationType = Object.freeze({
  GOVERNMENT: 'government',
  REGULATOR: 'regulator',
  INTL_ORG: 'intl_org',
  FIN_INST: 'fin_inst',
  INDUSTRY_ASSOC: 'industry_assoc',
  OTHER: 'other'
});

const LocationType = Object.freeze({
  COUNTRY: 'country',
  REGION: 'region',
  CITY: 'city',
  FACILITY: 'facility',
  OTHER: 'other'
});

const NodeType = Object.freeze({
  NEWS: 'News',
  EVENT: 'Event',
  COMPANY: 'Company',
  PERSON: 'Person',
  ORGANIZATION: 'Organization',
  LOCATION: 'Location'
});

const RelationshipType = Object.freeze({
  LOCATED_IN: 'LOCATED_IN',
  WORKS_FOR: 'WORKS_FOR',
  OWNS: 'OWNS',
  PARTICIPATES_IN: 'PARTICIPATES_IN',
  MERGES_WITH: 'MERGES_WITH',
  ACQUIRES: 'ACQUIRES',
  SUPPLIES: 'SUPPLIES',
  PARTNERS_WITH: 'PARTNERS_WITH',
  SUED_BY: 'SUED_BY',
  REGULATED_BY: 'REGULATED_BY',
  INVESTS_IN: 'INVESTS_IN',
  OTHER: 'OTHER'
});

const SystemRelationshipType = Object.freeze({
  DESCRIBES: 'DESCRIBES',
  INVOLVES: 'INVOLVES',
  MENTIONS: 'MENTIONS',
  LOCATED_AT: 'LOCATED_AT'
});

const EventTypeEnum = $enum(EventType);
const SentimentEnum = $enum(Sentiment);
const EventLevelEnum = $enum(EventLevel);
const UrgencyLevelEnum = $enum(UrgencyLevel);
const OrganizationTypeEnum = $enum(OrganizationType);
const LocationTypeEnum = $enum(LocationType);
const NodeTypeEnum = $enum(NodeType);
const RelationshipTypeEnum = $enum(RelationshipType);
const SystemRelationshipTypeEnum = $enum(SystemRelationshipType);

const EVENT_TYPE_VALUES = EventTypeEnum.getValues();
const SENTIMENT_VALUES = SentimentEnum.getValues();
const EVENT_LEVEL_VALUES = EventLevelEnum.getValues();
const URGENCY_LEVEL_VALUES = UrgencyLevelEnum.getValues();
const ORGANIZATION_TYPE_VALUES = OrganizationTypeEnum.getValues();
const LOCATION_TYPE_VALUES = LocationTypeEnum.getValues();
const NODE_TYPE_VALUES = NodeTypeEnum.getValues();
const RELATIONSHIP_TYPE_VALUES = RelationshipTypeEnum.getValues();
const SYSTEM_RELATIONSHIP_TYPE_VALUES = SystemRelationshipTypeEnum.getValues();

const EVENT_TYPE_KEYS = EventTypeEnum.getKeys();
const SENTIMENT_KEYS = SentimentEnum.getKeys();
const EVENT_LEVEL_KEYS = EventLevelEnum.getKeys();
const URGENCY_LEVEL_KEYS = UrgencyLevelEnum.getKeys();
const ORGANIZATION_TYPE_KEYS = OrganizationTypeEnum.getKeys();
const LOCATION_TYPE_KEYS = LocationTypeEnum.getKeys();
const NODE_TYPE_KEYS = NodeTypeEnum.getKeys();
const RELATIONSHIP_TYPE_KEYS = RelationshipTypeEnum.getKeys();
const SYSTEM_RELATIONSHIP_TYPE_KEYS = SystemRelationshipTypeEnum.getKeys();

const isValidEventType = (value) => EventTypeEnum.isValue(value);
const isValidSentiment = (value) => SentimentEnum.isValue(value);
const isValidEventLevel = (value) => EventLevelEnum.isValue(value);
const isValidUrgencyLevel = (value) => UrgencyLevelEnum.isValue(value);
const isValidOrganizationType = (value) => OrganizationTypeEnum.isValue(value);
const isValidLocationType = (value) => LocationTypeEnum.isValue(value);
const isValidNodeType = (value) => NodeTypeEnum.isValue(value);
const isValidRelationshipType = (value) => RelationshipTypeEnum.isValue(value);
const isValidSystemRelationshipType = (value) => SystemRelationshipTypeEnum.isValue(value);

const mapEventType = (mapper) => EventTypeEnum.getValues().map(mapper);
const mapSentiment = (mapper) => SentimentEnum.getValues().map(mapper);
const mapEventLevel = (mapper) => EventLevelEnum.getValues().map(mapper);
const mapNodeType = (mapper) => NodeTypeEnum.getValues().map(mapper);

const EVENT_TYPE_DESCRIPTIONS = {
  [EventType.MACRO]: '宏观经济事件',
  [EventType.POLICY]: '政策变化',
  [EventType.MARKET]: '市场动态',
  [EventType.CORPORATE]: '企业事件',
  [EventType.INDUSTRY]: '行业事件',
  [EventType.TECH]: '技术事件',
  [EventType.GEOPOLITICS]: '地缘政治',
  [EventType.OTHER]: '其他事件'
};

const SENTIMENT_DESCRIPTIONS = {
  [Sentiment.POSITIVE]: '积极',
  [Sentiment.NEGATIVE]: '消极',
  [Sentiment.NEUTRAL]: '中性'
};

const URGENCY_LEVEL_DESCRIPTIONS = {
  [UrgencyLevel.CRITICAL]: '紧急',
  [UrgencyLevel.HIGH]: '高',
  [UrgencyLevel.MEDIUM]: '中',
  [UrgencyLevel.LOW]: '低'
};

const ORGANIZATION_TYPE_DESCRIPTIONS = {
  [OrganizationType.GOVERNMENT]: '政府机构',
  [OrganizationType.REGULATOR]: '监管机构',
  [OrganizationType.INTL_ORG]: '国际组织',
  [OrganizationType.FIN_INST]: '金融机构',
  [OrganizationType.INDUSTRY_ASSOC]: '行业协会',
  [OrganizationType.OTHER]: '其他'
};

const LOCATION_TYPE_DESCRIPTIONS = {
  [LocationType.COUNTRY]: '国家',
  [LocationType.REGION]: '地区',
  [LocationType.CITY]: '城市',
  [LocationType.FACILITY]: '设施',
  [LocationType.OTHER]: '其他'
};

const NODE_TYPE_DESCRIPTIONS = {
  [NodeType.NEWS]: '新闻',
  [NodeType.EVENT]: '事件',
  [NodeType.COMPANY]: '公司',
  [NodeType.PERSON]: '人物',
  [NodeType.ORGANIZATION]: '机构',
  [NodeType.LOCATION]: '地点'
};

const RELATIONSHIP_TYPE_DESCRIPTIONS = {
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

const getEventTypeByKey = (key) =>
  EventTypeEnum.isKey(key) ? EventTypeEnum.getValueOrThrow(key) : undefined;

const getSentimentByKey = (key) =>
  SentimentEnum.isKey(key) ? SentimentEnum.getValueOrThrow(key) : undefined;

const getEventLevelByKey = (key) =>
  EventLevelEnum.isKey(key) ? EventLevelEnum.getValueOrThrow(key) : undefined;

const DEFAULT_EVENT_TYPE = EventType.OTHER;
const DEFAULT_SENTIMENT = Sentiment.NEUTRAL;
const DEFAULT_EVENT_LEVEL = EventLevel.LEVEL_5;
const DEFAULT_URGENCY_LEVEL = UrgencyLevel.LOW;
const DEFAULT_ORGANIZATION_TYPE = OrganizationType.OTHER;
const DEFAULT_LOCATION_TYPE = LocationType.OTHER;
const DEFAULT_NODE_TYPE = NodeType.NEWS;
const DEFAULT_RELATIONSHIP_TYPE = RelationshipType.OTHER;

const EVENT_TYPES = EventType;
const SENTIMENTS = Sentiment;
const EVENT_LEVELS = EventLevel;
const ORGANIZATION_TYPES = OrganizationType;
const LOCATION_TYPES = LocationType;
const NODE_TYPES = NodeType;
const RELATIONSHIP_TYPES = RelationshipType;
const SYSTEM_RELATIONSHIP_TYPES = SystemRelationshipType;

module.exports = {
  EventType,
  Sentiment,
  EventLevel,
  UrgencyLevel,
  OrganizationType,
  LocationType,
  NodeType,
  RelationshipType,
  SystemRelationshipType,
  EventTypeEnum,
  SentimentEnum,
  EventLevelEnum,
  UrgencyLevelEnum,
  OrganizationTypeEnum,
  LocationTypeEnum,
  NodeTypeEnum,
  RelationshipTypeEnum,
  SystemRelationshipTypeEnum,
  EVENT_TYPE_VALUES,
  SENTIMENT_VALUES,
  EVENT_LEVEL_VALUES,
  URGENCY_LEVEL_VALUES,
  ORGANIZATION_TYPE_VALUES,
  LOCATION_TYPE_VALUES,
  NODE_TYPE_VALUES,
  RELATIONSHIP_TYPE_VALUES,
  SYSTEM_RELATIONSHIP_TYPE_VALUES,
  EVENT_TYPE_KEYS,
  SENTIMENT_KEYS,
  EVENT_LEVEL_KEYS,
  URGENCY_LEVEL_KEYS,
  ORGANIZATION_TYPE_KEYS,
  LOCATION_TYPE_KEYS,
  NODE_TYPE_KEYS,
  RELATIONSHIP_TYPE_KEYS,
  SYSTEM_RELATIONSHIP_TYPE_KEYS,
  isValidEventType,
  isValidSentiment,
  isValidEventLevel,
  isValidUrgencyLevel,
  isValidOrganizationType,
  isValidLocationType,
  isValidNodeType,
  isValidRelationshipType,
  isValidSystemRelationshipType,
  mapEventType,
  mapSentiment,
  mapEventLevel,
  mapNodeType,
  EVENT_TYPE_DESCRIPTIONS,
  SENTIMENT_DESCRIPTIONS,
  URGENCY_LEVEL_DESCRIPTIONS,
  ORGANIZATION_TYPE_DESCRIPTIONS,
  LOCATION_TYPE_DESCRIPTIONS,
  NODE_TYPE_DESCRIPTIONS,
  RELATIONSHIP_TYPE_DESCRIPTIONS,
  getEventTypeByKey,
  getSentimentByKey,
  getEventLevelByKey,
  DEFAULT_EVENT_TYPE,
  DEFAULT_SENTIMENT,
  DEFAULT_EVENT_LEVEL,
  DEFAULT_URGENCY_LEVEL,
  DEFAULT_ORGANIZATION_TYPE,
  DEFAULT_LOCATION_TYPE,
  DEFAULT_NODE_TYPE,
  DEFAULT_RELATIONSHIP_TYPE,
  EVENT_TYPES,
  SENTIMENTS,
  EVENT_LEVELS,
  ORGANIZATION_TYPES,
  LOCATION_TYPES,
  NODE_TYPES,
  RELATIONSHIP_TYPES,
  SYSTEM_RELATIONSHIP_TYPES
};

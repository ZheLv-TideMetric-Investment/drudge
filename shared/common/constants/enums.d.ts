import type { EnumWrapper } from 'ts-enum-util';

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

export enum Sentiment {
  POSITIVE = 'positive',
  NEGATIVE = 'negative',
  NEUTRAL = 'neutral'
}

export enum EventLevel {
  LEVEL_1 = 'Level 1',
  LEVEL_2 = 'Level 2',
  LEVEL_3 = 'Level 3',
  LEVEL_4 = 'Level 4',
  LEVEL_5 = 'Level 5'
}

export enum UrgencyLevel {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

export enum OrganizationType {
  GOVERNMENT = 'government',
  REGULATOR = 'regulator',
  INTL_ORG = 'intl_org',
  FIN_INST = 'fin_inst',
  INDUSTRY_ASSOC = 'industry_assoc',
  OTHER = 'other'
}

export enum LocationType {
  COUNTRY = 'country',
  REGION = 'region',
  CITY = 'city',
  FACILITY = 'facility',
  OTHER = 'other'
}

export enum NodeType {
  NEWS = 'News',
  EVENT = 'Event',
  COMPANY = 'Company',
  PERSON = 'Person',
  ORGANIZATION = 'Organization',
  LOCATION = 'Location'
}

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

export enum SystemRelationshipType {
  DESCRIBES = 'DESCRIBES',
  INVOLVES = 'INVOLVES',
  MENTIONS = 'MENTIONS',
  LOCATED_AT = 'LOCATED_AT'
}

export const EventTypeEnum: EnumWrapper<EventType>;
export const SentimentEnum: EnumWrapper<Sentiment>;
export const EventLevelEnum: EnumWrapper<EventLevel>;
export const UrgencyLevelEnum: EnumWrapper<UrgencyLevel>;
export const OrganizationTypeEnum: EnumWrapper<OrganizationType>;
export const LocationTypeEnum: EnumWrapper<LocationType>;
export const NodeTypeEnum: EnumWrapper<NodeType>;
export const RelationshipTypeEnum: EnumWrapper<RelationshipType>;
export const SystemRelationshipTypeEnum: EnumWrapper<SystemRelationshipType>;

export const EVENT_TYPE_VALUES: EventType[];
export const SENTIMENT_VALUES: Sentiment[];
export const EVENT_LEVEL_VALUES: EventLevel[];
export const URGENCY_LEVEL_VALUES: UrgencyLevel[];
export const ORGANIZATION_TYPE_VALUES: OrganizationType[];
export const LOCATION_TYPE_VALUES: LocationType[];
export const NODE_TYPE_VALUES: NodeType[];
export const RELATIONSHIP_TYPE_VALUES: RelationshipType[];
export const SYSTEM_RELATIONSHIP_TYPE_VALUES: SystemRelationshipType[];

export const EVENT_TYPE_KEYS: Array<keyof typeof EventType>;
export const SENTIMENT_KEYS: Array<keyof typeof Sentiment>;
export const EVENT_LEVEL_KEYS: Array<keyof typeof EventLevel>;
export const URGENCY_LEVEL_KEYS: Array<keyof typeof UrgencyLevel>;
export const ORGANIZATION_TYPE_KEYS: Array<keyof typeof OrganizationType>;
export const LOCATION_TYPE_KEYS: Array<keyof typeof LocationType>;
export const NODE_TYPE_KEYS: Array<keyof typeof NodeType>;
export const RELATIONSHIP_TYPE_KEYS: Array<keyof typeof RelationshipType>;
export const SYSTEM_RELATIONSHIP_TYPE_KEYS: Array<keyof typeof SystemRelationshipType>;

export const isValidEventType: (value: string | null | undefined) => value is EventType;
export const isValidSentiment: (value: string | null | undefined) => value is Sentiment;
export const isValidEventLevel: (value: string | null | undefined) => value is EventLevel;
export const isValidUrgencyLevel: (value: string | null | undefined) => value is UrgencyLevel;
export const isValidOrganizationType: (value: string | null | undefined) => value is OrganizationType;
export const isValidLocationType: (value: string | null | undefined) => value is LocationType;
export const isValidNodeType: (value: string | null | undefined) => value is NodeType;
export const isValidRelationshipType: (value: string | null | undefined) => value is RelationshipType;
export const isValidSystemRelationshipType: (value: string | null | undefined) => value is SystemRelationshipType;

export const mapEventType: <T>(mapper: (type: EventType) => T) => T[];
export const mapSentiment: <T>(mapper: (sentiment: Sentiment) => T) => T[];
export const mapEventLevel: <T>(mapper: (level: EventLevel) => T) => T[];
export const mapNodeType: <T>(mapper: (nodeType: NodeType) => T) => T[];

export const EVENT_TYPE_DESCRIPTIONS: Record<EventType, string>;
export const SENTIMENT_DESCRIPTIONS: Record<Sentiment, string>;
export const URGENCY_LEVEL_DESCRIPTIONS: Record<UrgencyLevel, string>;
export const ORGANIZATION_TYPE_DESCRIPTIONS: Record<OrganizationType, string>;
export const LOCATION_TYPE_DESCRIPTIONS: Record<LocationType, string>;
export const NODE_TYPE_DESCRIPTIONS: Record<NodeType, string>;
export const RELATIONSHIP_TYPE_DESCRIPTIONS: Record<RelationshipType, string>;

export const getEventTypeByKey: (key: string) => EventType | undefined;
export const getSentimentByKey: (key: string) => Sentiment | undefined;
export const getEventLevelByKey: (key: string) => EventLevel | undefined;

export const DEFAULT_EVENT_TYPE: EventType;
export const DEFAULT_SENTIMENT: Sentiment;
export const DEFAULT_EVENT_LEVEL: EventLevel;
export const DEFAULT_URGENCY_LEVEL: UrgencyLevel;
export const DEFAULT_ORGANIZATION_TYPE: OrganizationType;
export const DEFAULT_LOCATION_TYPE: LocationType;
export const DEFAULT_NODE_TYPE: NodeType;
export const DEFAULT_RELATIONSHIP_TYPE: RelationshipType;

export const EVENT_TYPES: typeof EventType;
export const SENTIMENTS: typeof Sentiment;
export const EVENT_LEVELS: typeof EventLevel;
export const ORGANIZATION_TYPES: typeof OrganizationType;
export const LOCATION_TYPES: typeof LocationType;
export const NODE_TYPES: typeof NodeType;
export const RELATIONSHIP_TYPES: typeof RelationshipType;
export const SYSTEM_RELATIONSHIP_TYPES: typeof SystemRelationshipType;

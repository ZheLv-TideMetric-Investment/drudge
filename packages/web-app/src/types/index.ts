// 新闻相关类型
export interface NewsItem {
  id: string;
  title: string;
  content: string;
  source: string;
  url?: string;
  timestamp: string;
  news_level: string;
  level: number;
  processed: boolean;
  created_at: string;
  updated_at: string;
}

// 基础实体类型
export interface Entity {
  id: string;
  name: string;
  type: 'Company' | 'Person' | 'Location' | 'Event' | 'Time' | 'Organization';
  properties: Record<string, string | number | boolean>;
}

// 公司节点
export interface Company extends Entity {
  type: 'Company';
  company_name: string;
  ticker?: string;
  industry?: string;
  market?: string;
  country?: string;
  aliases?: string[];
  created_at: string;
  updated_at: string;
}

// 人物节点
export interface Person extends Entity {
  type: 'Person';
  person_name: string;
  title?: string;
  company?: string;
  nationality?: string;
  created_at: string;
  updated_at: string;
}

// 机构节点
export interface Organization extends Entity {
  type: 'Organization';
  organization_name: string;
  type_detail?: 'government' | 'regulator' | 'intl_org' | 'fin_inst' | 'industry_assoc' | 'other';
  country?: string;
  created_at: string;
  updated_at: string;
}

// 地点节点
export interface Location extends Entity {
  type: 'Location';
  location_name: string;
  location_type?: 'country' | 'region' | 'city' | 'facility' | 'other';
  country?: string;
  region?: string;
  created_at: string;
  updated_at: string;
}

// 事件节点
export interface Event extends Entity {
  type: 'Event';
  event_id: string;
  event_name: string;
  event_description: string;
  event_type: 'macro' | 'policy' | 'market' | 'corporate' | 'industry' | 'tech' | 'geopolitics' | 'other';
  significance: number;
  sentiment: 'positive' | 'negative' | 'neutral';
  magnitude: number;
  event_level: string;
  event_date: string;
  raw_event_date?: string;
  parsed_event_date?: string;
  created_at: string;
  updated_at: string;
}

// 时间节点
export interface Time extends Entity {
  type: 'Time';
  time_value: string;
  time_type?: 'DATETIME' | 'DATE' | 'TIME' | 'PERIOD' | 'OTHER';
  precision?: 'YEAR' | 'MONTH' | 'DAY' | 'HOUR' | 'MINUTE' | 'SECOND';
  timezone?: string;
  raw_value?: string;
  parsed_iso?: string;
  created_at: string;
  updated_at: string;
}

// 关系类型
export interface Relationship {
  id: string;
  source: string;
  target: string;
  type: 'LOCATED_IN' | 'WORKS_FOR' | 'OWNS' | 'PARTICIPATES_IN' | 'MERGES_WITH' | 'ACQUIRES' | 'SUPPLIES' | 'PARTNERS_WITH' | 'SUED_BY' | 'REGULATED_BY' | 'INVESTS_IN' | 'DESCRIBES' | 'LOCATED_AT' | 'OCCURRED_AT' | 'OTHER';
  description?: string;
  confidence?: number;
  inferred?: boolean;
  newsId?: string;
  source_news?: string;
  created_at: string;
  updated_at: string;
  properties?: Record<string, string | number | boolean>;
}

// 图数据结构
export interface GraphData {
  nodes: Entity[];
  edges: Relationship[];
}

// 扫描服务类型
export interface ScanResult {
  success: boolean;
  message: string;
  processedCount?: number;
  timestamp?: string;
}

// 统计类型
export interface NewsStats {
  total_news: number;
  level_1_count: number;
  level_2_count: number;
  level_3_count: number;
  level_4_count: number;
  level_5_count: number;
  today_count?: number;
  recent_24h_count?: number;
}

export interface GraphStats {
  total_nodes: number;
  total_relationships: number;
  companies: number;
  persons: number;
  organizations: number;
  locations: number;
  events: number;
  times: number;
  news: number;
}

// API响应类型
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp?: string;
}

export interface PaginatedResponse<T = unknown> extends ApiResponse<T[]> {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// 搜索参数
export interface SearchParams {
  query?: string;
  type?: string;
  limit?: number;
  offset?: number;
  startDate?: string;
  endDate?: string;
}

// 监控和报警
export interface MonitorAlert {
  id: string;
  type: 'high_level_news' | 'system_error' | 'processing_delay';
  message: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  timestamp: string;
}

// 图配置
export interface GraphConfig {
  maxNodes?: number;
  maxEdges?: number;
  layout?: 'force' | 'hierarchical' | 'circular';
  showLabels?: boolean;
  nodeSize?: number;
  edgeWidth?: number;
}

// 图查询结果
export interface GraphQueryResult {
  nodes: Entity[];
  relationships: Relationship[];
  stats: {
    nodeCount: number;
    relationshipCount: number;
    queryTime: number;
  };
}

// 实体搜索结果
export interface EntitySearchResult {
  entity: Entity;
  relevanceScore: number;
  matchedProperties: string[];
} 
// 新闻相关类型
export interface NewsItem {
  id: string; // 更新：从newsId改为id以匹配数据库schema
  title: string;
  content: string;
  source: string;
  url?: string;
  timestamp: string; // DateTime类型，北京时间
  news_level: string; // Level 1-5
  level: number; // 数值级别 (0-4)
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
  significance: number; // 1-4
  sentiment: 'positive' | 'negative' | 'neutral';
  magnitude: number; // -1.0 到 1.0
  event_level: string; // Level 1-5
  event_date: string;
  raw_event_date?: string;
  parsed_event_date?: string;
  created_at: string;
  updated_at: string;
}

// 时间节点
export interface Time extends Entity {
  type: 'Time';
  time_value: string; // ISO 8601格式，北京时间
  time_type?: 'DATETIME' | 'DATE' | 'TIME' | 'PERIOD' | 'OTHER';
  precision?: 'YEAR' | 'MONTH' | 'DAY' | 'HOUR' | 'MINUTE' | 'SECOND';
  timezone?: string; // 统一为 Asia/Shanghai
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
  confidence?: number; // 0.0-1.0
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

// 总结类型（保持不变，因为这些是应用层面的）
export interface HourlySummary {
  id: string;
  hour_start: string;
  hour_end: string;
  overall_summary: string;
  key_highlights: string[];
  market_impact: string;
  focus_areas: string[];
  severity_assessment: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  news_count: number;
  high_level_count: number;
  created_at: string;
}

export interface DailySummary {
  id: string;
  period_start: string;
  period_end: string;
  date: string;
  overnight_overview: string;
  key_trends: string[];
  market_risk_assessment: string;
  today_focus: string[];
  overall_severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  news_count: number;
  high_level_count: number;
  critical_count: number;
  created_at: string;
}

// 统计类型
export interface NewsStats {
  total: number;
  highLevel: number;
  breakNews: number;
  levelDistribution: Record<string, number>;
  timeDistribution: Record<string, number>;
}

export interface GraphStats {
  nodes: number;
  relationships: number;
  news: number;
  companies: number;
  persons: number;
  events: number;
  locations: number;
  times: number;
  organizations: number; // 新增：机构统计
}

// API响应类型
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp?: string;
}

// 分页类型
export interface PaginatedResponse<T = unknown> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// 搜索和过滤
export interface SearchParams {
  query?: string;
  level?: string;
  startDate?: string;
  endDate?: string;
  source?: string;
  page?: number;
  pageSize?: number;
  nodeType?: 'Company' | 'Person' | 'Organization' | 'Location' | 'Event' | 'Time'; // 新增：节点类型过滤
}

// 实时监控
export interface MonitorAlert {
  id: string;
  type: 'high_level_news' | 'system_error' | 'processing_complete';
  title: string;
  message: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  timestamp: string;
  data?: Record<string, string | number | boolean>;
}

// 图可视化配置
export interface GraphConfig {
  layout: 'hierarchical' | 'force' | 'circular';
  showLabels: boolean;
  nodeSize: 'fixed' | 'byConnections' | 'byImportance';
  edgeWidth: 'fixed' | 'byWeight';
  colorScheme: 'default' | 'byType' | 'byLevel';
}

// 新增：图谱查询结果类型
export interface GraphQueryResult {
  nodes: Entity[];
  relationships: Relationship[];
  summary: {
    nodeCount: number;
    relationshipCount: number;
    nodeTypes: Record<string, number>;
    relationshipTypes: Record<string, number>;
  };
}

// 新增：实体搜索结果类型
export interface EntitySearchResult {
  entity: Entity;
  score: number; // 搜索相关性评分
  connections: number; // 连接数量
} 
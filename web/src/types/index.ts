// 新闻相关类型
export interface NewsItem {
  newsId: string;
  title: string;
  content: string;
  timestamp: string;
  source: string;
  url?: string;
  news_level: string;
  processed: boolean;
  created_at: string;
  updated_at: string;
}

// 实体类型
export interface Entity {
  id: string;
  name: string;
  type: 'Company' | 'Person' | 'Location' | 'Event' | 'Time';
  properties: Record<string, string | number | boolean>;
}

export interface Company extends Entity {
  type: 'Company';
  company_name: string;
  industry?: string;
  market?: string;
  country?: string;
}

export interface Person extends Entity {
  type: 'Person';
  person_name: string;
  title?: string;
  nationality?: string;
}

export interface Location extends Entity {
  type: 'Location';
  location_name: string;
  location_type?: string;
  coordinates?: string;
}

export interface Event extends Entity {
  type: 'Event';
  event_name: string;
  event_description?: string;
  event_type?: string;
  event_level?: string;
  sentiment?: string;
  magnitude?: number;
}

// 关系类型
export interface Relationship {
  id: string;
  source: string;
  target: string;
  type: string;
  properties?: Record<string, string | number | boolean>;
}

// 图数据结构
export interface GraphData {
  nodes: Entity[];
  edges: Relationship[];
}

// 总结类型
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
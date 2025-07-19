import { 
  EventType, 
  Sentiment, 
  EventLevel, 
  OrganizationType, 
  LocationType, 
  RelationshipType 
} from '../constants/enums';

// 基础新闻接口
export interface NewsItem {
  id: string;
  title: string;
  description?: string;
  content?: string;
  source: string;
  url?: string;
  timestamp: string; // UTC ISO 8601 格式时间字符串
  raw_time?: any; // 保存原始时间数据（任意格式）
  level?: number;
  processed?: boolean;
}

// 新闻提取结果
export interface NewsExtractionResult {
  id?: string;
  newsId?: string;
  title: string;
  content?: string;
  timestamp: Date | string;
  raw_time?: any; // 保存原始时间数据（任意格式）
  source?: string;
  url?: string;
  news_level?: string;
  processing_time?: number;
  confidence?: number;
  events: Event[];
  companies: Company[];
  persons?: Person[];
  organizations: Organization[];
  locations: Location[];
  relationships: Relationship[];
}

// 事件实体 - 完全重构
export interface Event {
  event_id: string;
  event_name: string;
  event_description: string;
  event_type: EventType;
  significance: number; // 1-4
  sentiment: Sentiment;
  magnitude: number; // -1.0 to 1.0
  event_level: EventLevel;
  timestamp: string; // UTC ISO 8601 格式时间字符串
  raw_time?: any; // 保存原始时间数据（任意格式）
  created_at?: string;
  updated_at?: string;
}

// 公司实体 - 优化结构
export interface Company {
  company_name: string;
  ticker?: string;
  industry?: string;
  market?: string;
  country?: string;
  aliases: string[];
  created_at?: string;
  updated_at?: string;
}

// 人物实体 - 简化结构
export interface Person {
  person_name: string;
  title?: string;
  company?: string;
  nationality?: string;
  created_at?: string;
  updated_at?: string;
}

// 机构实体 - 使用标准枚举
export interface Organization {
  organization_name: string;
  type?: OrganizationType;
  country?: string;
  created_at?: string;
  updated_at?: string;
}

// 地点实体 - 使用标准枚举
export interface Location {
  location_name: string;
  type?: LocationType;
  country?: string;
  region?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  created_at?: string;
  updated_at?: string;
}



// 关系实体 - 使用标准关系类型
export interface Relationship {
  type: RelationshipType;
  from: string;
  to: string;
  description?: string;
  confidence?: number;
}

// LLM 相关接口
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMCallOptions {
  temperature?: number;
  timeout?: number;
  schema?: any;
}

export interface LLMResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

// 处理结果接口
export interface ProcessResult {
  success: boolean;
  newsId?: string;
  message?: string;
  error?: string;
  processed_at?: string;
  stats?: {
    events: number;
    companies: number;
    persons: number;
    organizations: number;
    locations: number;
    relationships: number;
  };
  processingTime?: number;
}

// 批量处理摘要
export interface BatchSummary {
  total: number;
  successful: number;
  failed: number;
  processingTime: number;
  timestamp: string;
} 
export interface NewsItem {
  id: string;
  title: string;
  description?: string;
  content?: string;
  url: string;
  source: string;
  publishedAt: Date;
  imageUrl?: string;
  author?: string;
  category: string;
  language: string;
  level: number;
  processed: boolean;
}

export interface GraphNode {
  id: string;
  labels: string[];
  properties: Record<string, any>;
}

export interface GraphRelationship {
  type: string;
  fromId: string;
  toId: string;
  properties?: Record<string, any>;
}

export interface GraphStats {
  totalNodes: number;
  totalRelationships: number;
  nodeTypes: Array<{ label: string; count: number }>;
  relationshipTypes: Array<{ type: string; count: number }>;
  lastUpdated: Date;
}

export enum EntityType {
  PERSON = 'PERSON',
  COMPANY = 'COMPANY',
  LOCATION = 'LOCATION',
  EVENT = 'EVENT',
  TIME = 'TIME'
}

export interface ExtractedEntity {
  type: EntityType;
  name: string;
  properties: Record<string, any>;
  confidence: number;
}

export enum SummaryType {
  HOURLY = 'HOURLY',
  DAILY = 'DAILY',
  CUSTOM = 'CUSTOM'
}

export interface SummaryResult {
  type: SummaryType;
  period: string;
  summary: string;
  highlights: string[];
  trends?: string;
  newsCount: number;
  generatedAt: Date;
}

export interface ProcessingJob {
  id: string;
  type: 'entity_extraction' | 'graph_building' | 'summary_generation';
  status: 'pending' | 'running' | 'completed' | 'failed';
  newsItems: string[];
  progress: number;
  createdAt: Date;
  completedAt?: Date;
  error?: string;
} 
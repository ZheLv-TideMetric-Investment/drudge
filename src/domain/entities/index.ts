// 导出所有领域实体
export { Event } from './Event';
export { Company } from './Company';
export { Person } from './Person';
export { Location } from './Location';
export { Time } from './Time';
export { NewsExtractionResult } from './NewsExtractionResult';

import { BaseEntity, NewsItem } from '../../shared/types/common';
import { RelationshipTypes } from '../../shared/types/enums';

export interface OrganizationConstructorParams {
  organization_name: string;
  type?: string;
  country?: string;
  properties?: Record<string, any>;
}

/**
 * 机构实体（Who - 机构）
 */
export class Organization implements BaseEntity {
  public organization_name: string;
  public type?: string;
  public country?: string;
  public properties: Record<string, any>;
  public created_at: string;
  public updated_at: string;

  constructor({
    organization_name,
    type,
    country,
    properties = {},
  }: OrganizationConstructorParams) {
    this.organization_name = organization_name;
    this.type = type;
    this.country = country;
    this.properties = properties;
    this.created_at = new Date().toISOString();
    this.updated_at = new Date().toISOString();
  }

  public touch(): void {
    this.updated_at = new Date().toISOString();
  }

  public toPlainObject(): Record<string, any> {
    return {
      organization_name: this.organization_name,
      type: this.type,
      country: this.country,
      properties: this.properties,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}

export interface NewsConstructorParams {
  id: string;
  title: string;
  content: string;
  timestamp: string;
  source?: string;
  url?: string;
  level?: number;
  processed?: boolean;
  fingerprint?: string;
}

/**
 * 新闻实体
 */
export class News implements BaseEntity {
  public id: string;
  public title: string;
  public content: string;
  public timestamp: string;
  public source: string;
  public url: string;
  public level: number;
  public processed: boolean;
  public fingerprint?: string;
  public created_at: string;

  constructor({
    id,
    title,
    content,
    timestamp,
    source = '',
    url = '',
    level = 0,
    processed = false,
    fingerprint,
  }: NewsConstructorParams) {
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

  public markAsProcessed(): void {
    this.processed = true;
  }

  public toPlainObject(): Record<string, any> {
    return {
      id: this.id,
      title: this.title,
      content: this.content,
      timestamp: this.timestamp,
      source: this.source,
      url: this.url,
      level: this.level,
      processed: this.processed,
      fingerprint: this.fingerprint,
      created_at: this.created_at,
    };
  }
}

export interface RelationshipConstructorParams {
  type: RelationshipTypes;
  from_node: any;
  to_node: any;
  properties?: Record<string, any>;
  confidence?: number;
  source?: string;
}

/**
 * 关系实体
 */
export class Relationship implements BaseEntity {
  public type: RelationshipTypes;
  public from_node: any;
  public to_node: any;
  public properties: Record<string, any>;
  public confidence: number;
  public source: string;
  public created_at: string;

  constructor({
    type,
    from_node,
    to_node,
    properties = {},
    confidence = 1.0,
    source = '',
  }: RelationshipConstructorParams) {
    this.type = type;
    this.from_node = from_node;
    this.to_node = to_node;
    this.properties = properties;
    this.confidence = confidence;
    this.source = source;
    this.created_at = new Date().toISOString();
  }

  public toPlainObject(): Record<string, any> {
    return {
      type: this.type,
      from_node: this.from_node,
      to_node: this.to_node,
      properties: this.properties,
      confidence: this.confidence,
      source: this.source,
      created_at: this.created_at,
    };
  }
}

export interface HourlySummaryConstructorParams {
  hour_start: string;
  hour_end: string;
  total_news_count?: number;
  critical_news_count?: number;
  top_events?: any[];
  top_companies?: any[];
  summary_text?: string;
}

/**
 * 小时总结实体
 */
export class HourlySummary implements BaseEntity {
  public hour_start: string;
  public hour_end: string;
  public total_news_count: number;
  public critical_news_count: number;
  public top_events: any[];
  public top_companies: any[];
  public summary_text: string;
  public created_at: string;

  constructor({
    hour_start,
    hour_end,
    total_news_count = 0,
    critical_news_count = 0,
    top_events = [],
    top_companies = [],
    summary_text = '',
  }: HourlySummaryConstructorParams) {
    this.hour_start = hour_start;
    this.hour_end = hour_end;
    this.total_news_count = total_news_count;
    this.critical_news_count = critical_news_count;
    this.top_events = top_events;
    this.top_companies = top_companies;
    this.summary_text = summary_text;
    this.created_at = new Date().toISOString();
  }

  public toPlainObject(): Record<string, any> {
    return {
      hour_start: this.hour_start,
      hour_end: this.hour_end,
      total_news_count: this.total_news_count,
      critical_news_count: this.critical_news_count,
      top_events: this.top_events,
      top_companies: this.top_companies,
      summary_text: this.summary_text,
      created_at: this.created_at,
    };
  }
}

export interface GraphQueryResultConstructorParams {
  nodes?: any[];
  relationships?: any[];
  metadata?: Record<string, any>;
}

/**
 * 图查询结果实体
 */
export class GraphQueryResult {
  public nodes: any[];
  public relationships: any[];
  public metadata: Record<string, any>;
  public timestamp: string;

  constructor({ 
    nodes = [], 
    relationships = [], 
    metadata = {} 
  }: GraphQueryResultConstructorParams) {
    this.nodes = nodes;
    this.relationships = relationships;
    this.metadata = metadata;
    this.timestamp = new Date().toISOString();
  }

  public addNode(node: any): void {
    if (!this.nodes.find(n => n.id === node.id)) {
      this.nodes.push(node);
    }
  }

  public addRelationship(relationship: any): void {
    this.relationships.push(relationship);
  }

  public getNodeCount(): number {
    return this.nodes.length;
  }

  public getRelationshipCount(): number {
    return this.relationships.length;
  }

  public toPlainObject(): Record<string, any> {
    return {
      nodes: this.nodes,
      relationships: this.relationships,
      metadata: this.metadata,
      timestamp: this.timestamp,
    };
  }
} 
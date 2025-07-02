export { Event } from './Event';
export { Company } from './Company';
export { Person } from './Person';
export { Location } from './Location';
export { Time } from './Time';
export { NewsExtractionResult } from './NewsExtractionResult';
import { BaseEntity } from '../../shared/types/common';
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
export declare class Organization implements BaseEntity {
    organization_name: string;
    type?: string;
    country?: string;
    properties: Record<string, any>;
    created_at: string;
    updated_at: string;
    constructor({ organization_name, type, country, properties, }: OrganizationConstructorParams);
    touch(): void;
    toPlainObject(): Record<string, any>;
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
export declare class News implements BaseEntity {
    id: string;
    title: string;
    content: string;
    timestamp: string;
    source: string;
    url: string;
    level: number;
    processed: boolean;
    fingerprint?: string;
    created_at: string;
    constructor({ id, title, content, timestamp, source, url, level, processed, fingerprint, }: NewsConstructorParams);
    markAsProcessed(): void;
    toPlainObject(): Record<string, any>;
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
export declare class Relationship implements BaseEntity {
    type: RelationshipTypes;
    from_node: any;
    to_node: any;
    properties: Record<string, any>;
    confidence: number;
    source: string;
    created_at: string;
    constructor({ type, from_node, to_node, properties, confidence, source, }: RelationshipConstructorParams);
    toPlainObject(): Record<string, any>;
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
export declare class HourlySummary implements BaseEntity {
    hour_start: string;
    hour_end: string;
    total_news_count: number;
    critical_news_count: number;
    top_events: any[];
    top_companies: any[];
    summary_text: string;
    created_at: string;
    constructor({ hour_start, hour_end, total_news_count, critical_news_count, top_events, top_companies, summary_text, }: HourlySummaryConstructorParams);
    toPlainObject(): Record<string, any>;
}
export interface GraphQueryResultConstructorParams {
    nodes?: any[];
    relationships?: any[];
    metadata?: Record<string, any>;
}
/**
 * 图查询结果实体
 */
export declare class GraphQueryResult {
    nodes: any[];
    relationships: any[];
    metadata: Record<string, any>;
    timestamp: string;
    constructor({ nodes, relationships, metadata }: GraphQueryResultConstructorParams);
    addNode(node: any): void;
    addRelationship(relationship: any): void;
    getNodeCount(): number;
    getRelationshipCount(): number;
    toPlainObject(): Record<string, any>;
}

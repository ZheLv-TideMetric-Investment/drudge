import { BaseEntity, EntityExtractionResult } from '../../shared/types/common';
import { Event } from './Event';
import { Company } from './Company';
import { Person } from './Person';
import { Location } from './Location';
import { Time } from './Time';
export interface NewsExtractionResultConstructorParams {
    newsId: string;
    events?: Event[];
    companies?: Company[];
    persons?: Person[];
    organizations?: any[];
    locations?: Location[];
    times?: Time[];
    relationships?: any[];
    summary?: string;
    confidence?: number;
}
/**
 * 新闻实体提取结果
 * 包含从单条新闻中提取的所有实体和关系
 */
export declare class NewsExtractionResult implements BaseEntity, EntityExtractionResult {
    newsId: string;
    events: Event[];
    companies: Company[];
    persons: Person[];
    organizations: any[];
    locations: Location[];
    times: Time[];
    relationships: any[];
    summary?: string;
    confidence: number;
    created_at: string;
    updated_at: string;
    constructor({ newsId, events, companies, persons, organizations, locations, times, relationships, summary, confidence, }: NewsExtractionResultConstructorParams);
    touch(): void;
    addEvent(event: Event): void;
    addCompany(company: Company): void;
    addPerson(person: Person): void;
    addLocation(location: Location): void;
    addTime(time: Time): void;
    addRelationship(relationship: any): void;
    getEntityCount(): number;
    getRelationshipCount(): number;
    isEmpty(): boolean;
    toPlainObject(): Record<string, any>;
}

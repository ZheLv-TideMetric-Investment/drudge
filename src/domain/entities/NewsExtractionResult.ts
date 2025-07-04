// @ts-nocheck
import { BaseEntity, EntityExtractionResult, NewsItem } from '../../shared/types/common';
import { Event } from './Event';
import { Company } from './Company';
import { Person } from './Person';
import { Location } from './Location';
import { Time } from './Time';

export interface NewsExtractionResultConstructorParams {
  newsId: string;
  title?: string;
  content?: string;
  timestamp?: string;
  source?: string;
  url?: string;
  level?: number;
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
export class NewsExtractionResult implements BaseEntity, EntityExtractionResult {
  public newsId: string;
  public title?: string;
  public content?: string;
  public timestamp?: string;
  public source?: string;
  public url?: string;
  public level?: number;
  public events: Event[];
  public companies: Company[];
  public persons: Person[];
  public organizations: any[];
  public locations: Location[];
  public times: Time[];
  public relationships: any[];
  public summary?: string;
  public confidence: number;
  public created_at: string;
  public updated_at: string;

  constructor({
    newsId,
    title,
    content,
    timestamp,
    source,
    url,
    level,
    events = [],
    companies = [],
    persons = [],
    organizations = [],
    locations = [],
    times = [],
    relationships = [],
    summary,
    confidence = 0.0,
  }: NewsExtractionResultConstructorParams) {
    this.newsId = newsId;
    this.title = title;
    this.content = content;
    this.timestamp = timestamp;
    this.source = source;
    this.url = url;
    this.level = level;
    this.events = events;
    this.companies = companies;
    this.persons = persons;
    this.organizations = organizations;
    this.locations = locations;
    this.times = times;
    this.relationships = relationships;
    this.summary = summary;
    this.confidence = confidence;
    this.created_at = new Date().toISOString();
    this.updated_at = new Date().toISOString();
  }

  public touch(): void {
    this.updated_at = new Date().toISOString();
  }

  public addEvent(event: Event): void {
    this.events.push(event);
    this.touch();
  }

  public addCompany(company: Company): void {
    this.companies.push(company);
    this.touch();
  }

  public addPerson(person: Person): void {
    this.persons.push(person);
    this.touch();
  }

  public addLocation(location: Location): void {
    this.locations.push(location);
    this.touch();
  }

  public addTime(time: Time): void {
    this.times.push(time);
    this.touch();
  }

  public addRelationship(relationship: any): void {
    this.relationships.push(relationship);
    this.touch();
  }

  public getEntityCount(): number {
    return this.events.length + 
           this.companies.length + 
           this.persons.length + 
           this.organizations.length + 
           this.locations.length + 
           this.times.length;
  }

  public getRelationshipCount(): number {
    return this.relationships.length;
  }

  public isEmpty(): boolean {
    return this.getEntityCount() === 0 && this.getRelationshipCount() === 0;
  }

  public toPlainObject(): Record<string, any> {
    return {
      newsId: this.newsId,
      title: this.title,
      content: this.content,
      timestamp: this.timestamp,
      source: this.source,
      url: this.url,
      level: this.level,
      events: this.events.map(e => e.toPlainObject()),
      companies: this.companies.map(c => c.toPlainObject()),
      persons: this.persons.map(p => p.toPlainObject()),
      organizations: this.organizations,
      locations: this.locations.map(l => l.toPlainObject()),
      times: this.times.map(t => t.toPlainObject()),
      relationships: this.relationships,
      summary: this.summary,
      confidence: this.confidence,
      created_at: this.created_at,
      updated_at: this.updated_at,
    }
  }
} 
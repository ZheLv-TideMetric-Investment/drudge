// @ts-nocheck
import { EventTypes, SignificanceLevel } from '../../shared/types/enums';
import { BaseEntity } from '../../shared/types/common';

export interface EventConstructorParams {
  event_id?: string;
  event_name: string;
  type?: EventTypes;
  description?: string;
  impact?: string;
  significance?: SignificanceLevel;
  keywords?: string[];
  properties?: Record<string, any>;
}

/**
 * 事件实体（What + How）
 */
export class Event implements BaseEntity {
  public event_id: string;
  public event_name: string;
  public type: EventTypes;
  public description: string;
  public impact: string;
  public significance: SignificanceLevel;
  public keywords: string[];
  public properties: Record<string, any>;
  public created_at: string;
  public updated_at: string;

  constructor({
    event_id,
    event_name,
    type = EventTypes.OTHER,
    description = '',
    impact = '',
    significance = SignificanceLevel.LOW,
    keywords = [],
    properties = {},
  }: EventConstructorParams) {
    this.event_id = event_id || this.generateId();
    this.event_name = event_name;
    this.type = type;
    this.description = description;
    this.impact = impact;
    this.significance = significance;
    this.keywords = keywords;
    this.properties = properties;
    this.created_at = new Date().toISOString();
    this.updated_at = new Date().toISOString();
  }

  private generateId(): string {
    return `event_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  public touch(): void {
    this.updated_at = new Date().toISOString();
  }

  public addKeyword(keyword: string): void {
    if (!this.keywords.includes(keyword)) {
      this.keywords.push(keyword);
      this.touch();
    }
  }

  public setProperty(key: string, value: any): void {
    this.properties[key] = value;
    this.touch();
  }

  public toPlainObject(): Record<string, any> {
    return {
      event_id: this.event_id,
      event_name: this.event_name,
      type: this.type,
      description: this.description,
      impact: this.impact,
      significance: this.significance,
      keywords: this.keywords,
      properties: this.properties,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
} 
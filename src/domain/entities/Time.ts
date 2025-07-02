// @ts-nocheck
import { BaseEntity } from '../../shared/types/common';

export interface TimeConstructorParams {
  time_value: string;
  type?: string;
  precision?: 'YEAR' | 'MONTH' | 'DAY' | 'HOUR' | 'MINUTE' | 'SECOND';
  timezone?: string;
  properties?: Record<string, any>;
}

/**
 * 时间实体（When）
 */
export class Time implements BaseEntity {
  public time_value: string;
  public type?: string;
  public precision: 'YEAR' | 'MONTH' | 'DAY' | 'HOUR' | 'MINUTE' | 'SECOND';
  public timezone?: string;
  public properties: Record<string, any>;
  public created_at: string;
  public updated_at: string;

  constructor({
    time_value,
    type,
    precision = 'DAY',
    timezone,
    properties = {},
  }: TimeConstructorParams) {
    this.time_value = time_value;
    this.type = type;
    this.precision = precision;
    this.timezone = timezone;
    this.properties = properties;
    this.created_at = new Date().toISOString();
    this.updated_at = new Date().toISOString();
  }

  public touch(): void {
    this.updated_at = new Date().toISOString();
  }

  public setProperty(key: string, value: any): void {
    this.properties[key] = value;
    this.touch();
  }

  public toPlainObject(): Record<string, any> {
    return {
      time_value: this.time_value,
      type: this.type,
      precision: this.precision,
      timezone: this.timezone,
      properties: this.properties,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
} 
// @ts-nocheck
import { BaseEntity } from '../../shared/types/common';

export interface PersonConstructorParams {
  person_name: string;
  title?: string;
  company?: string;
  nationality?: string;
  properties?: Record<string, any>;
}

/**
 * 人物实体（Who - 个人）
 */
export class Person implements BaseEntity {
  public person_name: string;
  public title?: string;
  public company?: string;
  public nationality?: string;
  public properties: Record<string, any>;
  public created_at: string;
  public updated_at: string;

  constructor({
    person_name,
    title,
    company,
    nationality,
    properties = {},
  }: PersonConstructorParams) {
    this.person_name = person_name;
    this.title = title;
    this.company = company;
    this.nationality = nationality;
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
      person_name: this.person_name,
      title: this.title,
      company: this.company,
      nationality: this.nationality,
      properties: this.properties,
      created_at: this.created_at,
      updated_at: this.updated_at,  }
  }
} 
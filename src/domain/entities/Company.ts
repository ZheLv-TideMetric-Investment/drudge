// @ts-nocheck
import { BaseEntity } from '../../shared/types/common';

export interface CompanyConstructorParams {
  company_name: string;
  ticker?: string;
  industry?: string;
  market?: string;
  country?: string;
  properties?: Record<string, any>;
}

/**
 * 公司实体（Who - 企业）
 */
export class Company implements BaseEntity {
  public company_name: string;
  public ticker?: string;
  public industry?: string;
  public market?: string;
  public country?: string;
  public properties: Record<string, any>;
  public created_at: string;
  public updated_at: string;

  constructor({
    company_name,
    ticker,
    industry,
    market,
    country,
    properties = {},
  }: CompanyConstructorParams) {
    this.company_name = company_name;
    this.ticker = ticker;
    this.industry = industry;
    this.market = market;
    this.country = country;
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
      company_name: this.company_name,
      ticker: this.ticker,
      industry: this.industry,
      market: this.market,
      country: this.country,
      properties: this.properties,
      created_at: this.created_at,
      updated_at: this.updated_at,  }
  }
} 
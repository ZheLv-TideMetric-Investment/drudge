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
export declare class Company implements BaseEntity {
    company_name: string;
    ticker?: string;
    industry?: string;
    market?: string;
    country?: string;
    properties: Record<string, any>;
    created_at: string;
    updated_at: string;
    constructor({ company_name, ticker, industry, market, country, properties, }: CompanyConstructorParams);
    touch(): void;
    setProperty(key: string, value: any): void;
    toPlainObject(): Record<string, any>;
}

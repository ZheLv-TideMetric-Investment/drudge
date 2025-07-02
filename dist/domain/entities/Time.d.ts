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
export declare class Time implements BaseEntity {
    time_value: string;
    type?: string;
    precision: 'YEAR' | 'MONTH' | 'DAY' | 'HOUR' | 'MINUTE' | 'SECOND';
    timezone?: string;
    properties: Record<string, any>;
    created_at: string;
    updated_at: string;
    constructor({ time_value, type, precision, timezone, properties, }: TimeConstructorParams);
    touch(): void;
    setProperty(key: string, value: any): void;
    toPlainObject(): Record<string, any>;
}

import { BaseEntity } from '../../shared/types/common';
export interface LocationConstructorParams {
    location_name: string;
    type?: string;
    country?: string;
    region?: string;
    coordinates?: {
        latitude: number;
        longitude: number;
    };
    properties?: Record<string, any>;
}
/**
 * 地点实体（Where）
 */
export declare class Location implements BaseEntity {
    location_name: string;
    type?: string;
    country?: string;
    region?: string;
    coordinates?: {
        latitude: number;
        longitude: number;
    };
    properties: Record<string, any>;
    created_at: string;
    updated_at: string;
    constructor({ location_name, type, country, region, coordinates, properties, }: LocationConstructorParams);
    touch(): void;
    setProperty(key: string, value: any): void;
    toPlainObject(): Record<string, any>;
}

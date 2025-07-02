// @ts-nocheck
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
export class Location implements BaseEntity {
  public location_name: string;
  public type?: string;
  public country?: string;
  public region?: string;
  public coordinates?: {
    latitude: number;
    longitude: number;
  };
  public properties: Record<string, any>;
  public created_at: string;
  public updated_at: string;

  constructor({
    location_name,
    type,
    country,
    region,
    coordinates,
    properties = {},
  }: LocationConstructorParams) {
    this.location_name = location_name;
    this.type = type;
    this.country = country;
    this.region = region;
    this.coordinates = coordinates;
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
      location_name: this.location_name,
      type: this.type,
      country: this.country,
      region: this.region,
      coordinates: this.coordinates,
      properties: this.properties,
      created_at: this.created_at,
      updated_at: this.updated_at,  }
  }
} 
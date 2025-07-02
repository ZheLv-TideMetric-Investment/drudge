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
export declare class Event implements BaseEntity {
    event_id: string;
    event_name: string;
    type: EventTypes;
    description: string;
    impact: string;
    significance: SignificanceLevel;
    keywords: string[];
    properties: Record<string, any>;
    created_at: string;
    updated_at: string;
    constructor({ event_id, event_name, type, description, impact, significance, keywords, properties, }: EventConstructorParams);
    private generateId;
    touch(): void;
    addKeyword(keyword: string): void;
    setProperty(key: string, value: any): void;
    toPlainObject(): Record<string, any>;
}

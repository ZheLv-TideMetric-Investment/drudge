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
export declare class Person implements BaseEntity {
    person_name: string;
    title?: string;
    company?: string;
    nationality?: string;
    properties: Record<string, any>;
    created_at: string;
    updated_at: string;
    constructor({ person_name, title, company, nationality, properties, }: PersonConstructorParams);
    touch(): void;
    setProperty(key: string, value: any): void;
    toPlainObject(): Record<string, any>;
}

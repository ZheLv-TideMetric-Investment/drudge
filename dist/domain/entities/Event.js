// @ts-nocheck
import { EventTypes, SignificanceLevel } from '../../shared/types/enums.js';
/**
 * 事件实体（What + How）
 */
export class Event {
    event_id;
    event_name;
    type;
    description;
    impact;
    significance;
    keywords;
    properties;
    created_at;
    updated_at;
    constructor({ event_id, event_name, type = EventTypes.OTHER, description = '', impact = '', significance = SignificanceLevel.LOW, keywords = [], properties = {}, }) {
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
    generateId() {
        return `event_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }
    touch() {
        this.updated_at = new Date().toISOString();
    }
    addKeyword(keyword) {
        if (!this.keywords.includes(keyword)) {
            this.keywords.push(keyword);
            this.touch();
        }
    }
    setProperty(key, value) {
        this.properties[key] = value;
        this.touch();
    }
    toPlainObject() {
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

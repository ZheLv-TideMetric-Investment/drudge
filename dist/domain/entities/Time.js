/**
 * 时间实体（When）
 */
export class Time {
    time_value;
    type;
    precision;
    timezone;
    properties;
    created_at;
    updated_at;
    constructor({ time_value, type, precision = 'DAY', timezone, properties = {}, }) {
        this.time_value = time_value;
        this.type = type;
        this.precision = precision;
        this.timezone = timezone;
        this.properties = properties;
        this.created_at = new Date().toISOString();
        this.updated_at = new Date().toISOString();
    }
    touch() {
        this.updated_at = new Date().toISOString();
    }
    setProperty(key, value) {
        this.properties[key] = value;
        this.touch();
    }
    toPlainObject() {
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

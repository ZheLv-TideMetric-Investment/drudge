/**
 * 地点实体（Where）
 */
export class Location {
    location_name;
    type;
    country;
    region;
    coordinates;
    properties;
    created_at;
    updated_at;
    constructor({ location_name, type, country, region, coordinates, properties = {}, }) {
        this.location_name = location_name;
        this.type = type;
        this.country = country;
        this.region = region;
        this.coordinates = coordinates;
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
            location_name: this.location_name,
            type: this.type,
            country: this.country,
            region: this.region,
            coordinates: this.coordinates,
            properties: this.properties,
            created_at: this.created_at,
            updated_at: this.updated_at,
        };
    }
}

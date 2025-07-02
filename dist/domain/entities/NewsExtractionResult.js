/**
 * 新闻实体提取结果
 * 包含从单条新闻中提取的所有实体和关系
 */
export class NewsExtractionResult {
    newsId;
    events;
    companies;
    persons;
    organizations;
    locations;
    times;
    relationships;
    summary;
    confidence;
    created_at;
    updated_at;
    constructor({ newsId, events = [], companies = [], persons = [], organizations = [], locations = [], times = [], relationships = [], summary, confidence = 0.0, }) {
        this.newsId = newsId;
        this.events = events;
        this.companies = companies;
        this.persons = persons;
        this.organizations = organizations;
        this.locations = locations;
        this.times = times;
        this.relationships = relationships;
        this.summary = summary;
        this.confidence = confidence;
        this.created_at = new Date().toISOString();
        this.updated_at = new Date().toISOString();
    }
    touch() {
        this.updated_at = new Date().toISOString();
    }
    addEvent(event) {
        this.events.push(event);
        this.touch();
    }
    addCompany(company) {
        this.companies.push(company);
        this.touch();
    }
    addPerson(person) {
        this.persons.push(person);
        this.touch();
    }
    addLocation(location) {
        this.locations.push(location);
        this.touch();
    }
    addTime(time) {
        this.times.push(time);
        this.touch();
    }
    addRelationship(relationship) {
        this.relationships.push(relationship);
        this.touch();
    }
    getEntityCount() {
        return this.events.length +
            this.companies.length +
            this.persons.length +
            this.organizations.length +
            this.locations.length +
            this.times.length;
    }
    getRelationshipCount() {
        return this.relationships.length;
    }
    isEmpty() {
        return this.getEntityCount() === 0 && this.getRelationshipCount() === 0;
    }
    toPlainObject() {
        return {
            newsId: this.newsId,
            events: this.events.map(e => e.toPlainObject()),
            companies: this.companies.map(c => c.toPlainObject()),
            persons: this.persons.map(p => p.toPlainObject()),
            organizations: this.organizations,
            locations: this.locations.map(l => l.toPlainObject()),
            times: this.times.map(t => t.toPlainObject()),
            relationships: this.relationships,
            summary: this.summary,
            confidence: this.confidence,
            created_at: this.created_at,
            updated_at: this.updated_at,
        };
    }
}

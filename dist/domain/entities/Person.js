/**
 * 人物实体（Who - 个人）
 */
export class Person {
    person_name;
    title;
    company;
    nationality;
    properties;
    created_at;
    updated_at;
    constructor({ person_name, title, company, nationality, properties = {}, }) {
        this.person_name = person_name;
        this.title = title;
        this.company = company;
        this.nationality = nationality;
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
            person_name: this.person_name,
            title: this.title,
            company: this.company,
            nationality: this.nationality,
            properties: this.properties,
            created_at: this.created_at,
            updated_at: this.updated_at,
        };
    }
}

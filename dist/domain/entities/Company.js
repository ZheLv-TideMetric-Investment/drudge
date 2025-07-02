/**
 * 公司实体（Who - 企业）
 */
export class Company {
    company_name;
    ticker;
    industry;
    market;
    country;
    properties;
    created_at;
    updated_at;
    constructor({ company_name, ticker, industry, market, country, properties = {}, }) {
        this.company_name = company_name;
        this.ticker = ticker;
        this.industry = industry;
        this.market = market;
        this.country = country;
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
            company_name: this.company_name,
            ticker: this.ticker,
            industry: this.industry,
            market: this.market,
            country: this.country,
            properties: this.properties,
            created_at: this.created_at,
            updated_at: this.updated_at,
        };
    }
}

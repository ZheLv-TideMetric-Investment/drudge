/**
 * 公司实体（Who - 企业）
 */
export class Company {
  constructor({
    company_name,           // 公司名称
    ticker = null,         // 股票代码
    industry = null,       // 行业分类
    market_cap = null,     // 市值
    properties = {},       // 其他属性
  }) {
    this.company_name = company_name;
    this.ticker = ticker;
    this.industry = industry;
    this.market_cap = market_cap;
    this.properties = properties;
    this.created_at = new Date().toISOString();
    this.updated_at = new Date().toISOString();
  }

  // 更新时间戳
  touch() {
    this.updated_at = new Date().toISOString();
  }

  // 转换为纯对象
  toPlainObject() {
    return {
      company_name: this.company_name,
      ticker: this.ticker,
      industry: this.industry,
      market_cap: this.market_cap,
      properties: this.properties,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
} 
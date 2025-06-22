/**
 * 地点实体（Where）
 */
export class Location {
  constructor({
    location_name,     // 地点名称
    country = null,    // 所属国家
    region = null,     // 地区
    properties = {},   // 其他属性
  }) {
    this.location_name = location_name;
    this.country = country;
    this.region = region;
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
      location_name: this.location_name,
      country: this.country,
      region: this.region,
      properties: this.properties,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
} 
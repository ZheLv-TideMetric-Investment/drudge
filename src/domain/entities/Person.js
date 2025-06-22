/**
 * 人物实体（Who - 个人）
 */
export class Person {
  constructor({
    person_name,           // 人物名称
    role = null,          // 角色/职位
    company = null,       // 所在公司
    properties = {},      // 其他属性
  }) {
    this.person_name = person_name;
    this.role = role;
    this.company = company;
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
      person_name: this.person_name,
      role: this.role,
      company: this.company,
      properties: this.properties,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
} 
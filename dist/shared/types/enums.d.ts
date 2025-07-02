/**
 * 共享枚举类型定义
 */
export declare enum NodeTypes {
    EVENT = "Event",// 事件节点（What + How）
    COMPANY = "Company",// 公司节点（Who - 企业）
    PERSON = "Person",// 人物节点（Who - 个人）
    ORGANIZATION = "Organization",// 机构节点（Who - 机构）
    LOCATION = "Location",// 地点节点（Where）
    TIME = "Time",// 时间节点（When）
    NEWS = "News"
}
export declare enum EventTypes {
    FINANCIAL = "\u8D22\u7ECF\u4E8B\u4EF6",
    POLICY = "\u653F\u7B56\u4E8B\u4EF6",
    MARKET = "\u5E02\u573A\u4E8B\u4EF6",
    CORPORATE = "\u4F01\u4E1A\u4E8B\u4EF6",
    ECONOMIC = "\u7ECF\u6D4E\u4E8B\u4EF6",
    POLITICAL = "\u653F\u6CBB\u4E8B\u4EF6",
    SOCIAL = "\u793E\u4F1A\u4E8B\u4EF6",
    TECHNOLOGY = "\u79D1\u6280\u4E8B\u4EF6",
    OTHER = "\u5176\u4ED6\u4E8B\u4EF6"
}
export declare enum RelationshipTypes {
    OCCURRED_IN = "OCCURRED_IN",// 事件发生在某个公司
    INVOLVES = "INVOLVES",// 事件涉及某个人物
    OCCURRED_AT = "OCCURRED_AT",// 事件发生在某地点
    HAPPENED_AT = "HAPPENED_AT",// 事件发生在特定时间
    BELONGS_TO = "BELONGS_TO",// 地点属于某个国家
    CEO_OF = "CEO_OF",// 人物是某公司的CEO
    WORKS_FOR = "WORKS_FOR",// 人物在某公司工作
    OPERATES_IN = "OPERATES_IN",// 公司在某行业运营
    SUBSIDIARY_OF = "SUBSIDIARY_OF",// 子公司关系
    PARTNER_OF = "PARTNER_OF",// 合作关系
    COMPETITOR_OF = "COMPETITOR_OF",// 竞争关系
    REPORTED_IN = "REPORTED_IN",// 事件在新闻中报道
    MENTIONED_IN = "MENTIONED_IN"
}
export declare enum SignificanceLevel {
    LOW = 1,// 低重要性
    MEDIUM = 2,// 中等重要性
    HIGH = 3,// 高重要性
    CRITICAL = 4
}
/**
 * News Level枚举 - 新闻级别分类
 */
export declare enum NewsLevel {
    LEVEL_5 = "Level 5",// Informational News (信息性新闻)
    LEVEL_4 = "Level 4",// Low Priority News (低优先级新闻)
    LEVEL_3 = "Level 3",// Medium Priority News (中等优先级新闻)
    LEVEL_2 = "Level 2",// High Priority News (高优先级新闻)
    LEVEL_1 = "Level 1"
}
/**
 * News Level描述类型
 */
export interface NewsLevelDescriptionType {
    name: string;
    nameCn: string;
    description: string;
    examples: string[];
    pushType: 'immediate' | 'important' | 'optional' | 'subscription' | 'background';
    significance: SignificanceLevel;
    impact: string;
}
/**
 * News Level描述映射
 */
export declare const NewsLevelDescription: Record<NewsLevel, NewsLevelDescriptionType>;

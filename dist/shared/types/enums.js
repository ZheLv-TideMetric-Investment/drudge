// @ts-nocheck
// @ts-nocheck
/**
 * 共享枚举类型定义
 */
// 节点类型枚举
export var NodeTypes;
(function (NodeTypes) {
    NodeTypes["EVENT"] = "Event";
    NodeTypes["COMPANY"] = "Company";
    NodeTypes["PERSON"] = "Person";
    NodeTypes["ORGANIZATION"] = "Organization";
    NodeTypes["LOCATION"] = "Location";
    NodeTypes["TIME"] = "Time";
    NodeTypes["NEWS"] = "News";
})(NodeTypes || (NodeTypes = {}));
// 事件类型枚举
export var EventTypes;
(function (EventTypes) {
    EventTypes["FINANCIAL"] = "\u8D22\u7ECF\u4E8B\u4EF6";
    EventTypes["POLICY"] = "\u653F\u7B56\u4E8B\u4EF6";
    EventTypes["MARKET"] = "\u5E02\u573A\u4E8B\u4EF6";
    EventTypes["CORPORATE"] = "\u4F01\u4E1A\u4E8B\u4EF6";
    EventTypes["ECONOMIC"] = "\u7ECF\u6D4E\u4E8B\u4EF6";
    EventTypes["POLITICAL"] = "\u653F\u6CBB\u4E8B\u4EF6";
    EventTypes["SOCIAL"] = "\u793E\u4F1A\u4E8B\u4EF6";
    EventTypes["TECHNOLOGY"] = "\u79D1\u6280\u4E8B\u4EF6";
    EventTypes["OTHER"] = "\u5176\u4ED6\u4E8B\u4EF6";
})(EventTypes || (EventTypes = {}));
// 关系类型枚举
export var RelationshipTypes;
(function (RelationshipTypes) {
    // 事件与其他实体的关系
    RelationshipTypes["OCCURRED_IN"] = "OCCURRED_IN";
    RelationshipTypes["INVOLVES"] = "INVOLVES";
    RelationshipTypes["OCCURRED_AT"] = "OCCURRED_AT";
    RelationshipTypes["HAPPENED_AT"] = "HAPPENED_AT";
    // 自然关系
    RelationshipTypes["BELONGS_TO"] = "BELONGS_TO";
    RelationshipTypes["CEO_OF"] = "CEO_OF";
    RelationshipTypes["WORKS_FOR"] = "WORKS_FOR";
    RelationshipTypes["OPERATES_IN"] = "OPERATES_IN";
    RelationshipTypes["SUBSIDIARY_OF"] = "SUBSIDIARY_OF";
    RelationshipTypes["PARTNER_OF"] = "PARTNER_OF";
    RelationshipTypes["COMPETITOR_OF"] = "COMPETITOR_OF";
    // 新闻与实体的关系
    RelationshipTypes["REPORTED_IN"] = "REPORTED_IN";
    RelationshipTypes["MENTIONED_IN"] = "MENTIONED_IN";
})(RelationshipTypes || (RelationshipTypes = {}));
// 重要性级别枚举
export var SignificanceLevel;
(function (SignificanceLevel) {
    SignificanceLevel[SignificanceLevel["LOW"] = 1] = "LOW";
    SignificanceLevel[SignificanceLevel["MEDIUM"] = 2] = "MEDIUM";
    SignificanceLevel[SignificanceLevel["HIGH"] = 3] = "HIGH";
    SignificanceLevel[SignificanceLevel["CRITICAL"] = 4] = "CRITICAL";
})(SignificanceLevel || (SignificanceLevel = {}));
/**
 * News Level枚举 - 新闻级别分类
 */
export var NewsLevel;
(function (NewsLevel) {
    NewsLevel["LEVEL_5"] = "Level 5";
    NewsLevel["LEVEL_4"] = "Level 4";
    NewsLevel["LEVEL_3"] = "Level 3";
    NewsLevel["LEVEL_2"] = "Level 2";
    NewsLevel["LEVEL_1"] = "Level 1";
})(NewsLevel || (NewsLevel = {}));
/**
 * News Level描述映射
 */
export const NewsLevelDescription = {
    [NewsLevel.LEVEL_1]: {
        name: 'Critical News',
        nameCn: '紧急新闻',
        description: '对全球金融市场、经济体系或政治环境有极大冲击性的新闻，通常不可预见且引起市场强烈反应',
        examples: ['全球经济危机', '国际冲突或战争爆发', '全球流行病', '重要政府领导人突然去世或辞职', '国家级金融政策重大变动'],
        pushType: 'immediate',
        significance: SignificanceLevel.CRITICAL,
        impact: '全球或多个国家，影响金融市场、政治稳定、全球供应链'
    },
    [NewsLevel.LEVEL_2]: {
        name: 'High Priority News',
        nameCn: '高优先级新闻',
        description: '具有高度重要性但不如Level 1紧急，通常影响重大经济体或企业决策、股市等',
        examples: ['央行政策调整', '国际贸易政策变动', '重大企业并购或破产', '国家级财政政策改革', '股市大幅波动'],
        pushType: 'important',
        significance: SignificanceLevel.HIGH,
        impact: '主要影响经济体、金融市场、特定行业或大公司'
    },
    [NewsLevel.LEVEL_3]: {
        name: 'Medium Priority News',
        nameCn: '中等优先级新闻',
        description: '对某些行业、公司或地区具有较高重要性，但对全球或宏观经济影响较小',
        examples: ['行业重要事件', '重要公司财报发布', '经济数据发布', '政治选举结果', '重大公司高层变动'],
        pushType: 'optional',
        significance: SignificanceLevel.MEDIUM,
        impact: '对行业或特定公司有较大影响，可能引起短期市场波动'
    },
    [NewsLevel.LEVEL_4]: {
        name: 'Low Priority News',
        nameCn: '低优先级新闻',
        description: '对市场、行业或公司产生较小影响，更多是背景性信息或单一事件',
        examples: ['公司新产品发布', '市场分析报告', '地方性政治变化', '公司内部变动', '小型行业会议'],
        pushType: 'subscription',
        significance: SignificanceLevel.LOW,
        impact: '通常是局部影响，对宏观经济或全球市场几乎无影响'
    },
    [NewsLevel.LEVEL_5]: {
        name: 'Informational News',
        nameCn: '信息性新闻',
        description: '对当前事件的补充性说明或没有直接市场影响，主要用于增加对特定话题的了解',
        examples: ['新闻更新', '行业内日常运营新闻', '消费者数据', '宏观经济报告细节更新'],
        pushType: 'background',
        significance: SignificanceLevel.LOW,
        impact: '仅提供信息更新，一般不会对市场或投资者产生直接影响'
    }
};

/**
 * 共享枚举类型定义
 */

// 节点类型枚举
export const NodeTypes = {
  EVENT: 'Event',           // 事件节点（What + How）
  COMPANY: 'Company',       // 公司节点（Who - 企业）
  PERSON: 'Person',         // 人物节点（Who - 个人）
  ORGANIZATION: 'Organization', // 机构节点（Who - 机构）
  LOCATION: 'Location',     // 地点节点（Where）
  TIME: 'Time',            // 时间节点（When）
  NEWS: 'News',            // 新闻节点（原始数据）
};

// 事件类型枚举
export const EventTypes = {
  FINANCIAL: '财经事件',
  POLICY: '政策事件', 
  MARKET: '市场事件',
  CORPORATE: '企业事件',
  ECONOMIC: '经济事件',
  POLITICAL: '政治事件',
  SOCIAL: '社会事件',
  TECHNOLOGY: '科技事件',
  OTHER: '其他事件',
};

// 关系类型枚举
export const RelationshipTypes = {
  // 事件与其他实体的关系
  OCCURRED_IN: 'OCCURRED_IN',        // 事件发生在某个公司
  INVOLVES: 'INVOLVES',              // 事件涉及某个人物
  OCCURRED_AT: 'OCCURRED_AT',        // 事件发生在某地点
  HAPPENED_AT: 'HAPPENED_AT',        // 事件发生在特定时间

  // 自然关系
  BELONGS_TO: 'BELONGS_TO',          // 地点属于某个国家
  CEO_OF: 'CEO_OF',                  // 人物是某公司的CEO
  WORKS_FOR: 'WORKS_FOR',            // 人物在某公司工作
  OPERATES_IN: 'OPERATES_IN',        // 公司在某行业运营
  SUBSIDIARY_OF: 'SUBSIDIARY_OF',    // 子公司关系
  PARTNER_OF: 'PARTNER_OF',          // 合作关系
  COMPETITOR_OF: 'COMPETITOR_OF',    // 竞争关系

  // 新闻与实体的关系
  REPORTED_IN: 'REPORTED_IN',        // 事件在新闻中报道
  MENTIONED_IN: 'MENTIONED_IN',      // 实体在新闻中提及
};

// 重要性级别枚举
export const SignificanceLevel = {
  LOW: 1,      // 低重要性
  MEDIUM: 2,   // 中等重要性
  HIGH: 3,     // 高重要性
  CRITICAL: 4, // 极高重要性
};

/**
 * News Level枚举 - 新闻级别分类
 */
export const NewsLevel = {
  LEVEL_5: 'Level 5', // Informational News (信息性新闻)
  LEVEL_4: 'Level 4', // Low Priority News (低优先级新闻)
  LEVEL_3: 'Level 3', // Medium Priority News (中等优先级新闻)
  LEVEL_2: 'Level 2', // High Priority News (高优先级新闻)
  LEVEL_1: 'Level 1', // Critical News (紧急新闻)
};

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
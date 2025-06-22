# News Level功能升级说明

## 升级概述

将原有的**Break News**功能升级为更精细的**News Level**功能，实现基于4级分类的新闻分级处理和推送系统。

## 功能对比

### 升级前 - Break News
- **二分法判断**：只区分是否为突发新闻（Break News）
- **单一推送**：只推送Break News级别的新闻
- **简单统计**：只统计Break News数量

### 升级后 - News Level
- **四级分类**：Level 1-4的精细化新闻级别
- **分级推送**：根据级别智能推送，可配置
- **详细统计**：按级别统计，更全面的数据分析

## News Level级别定义

### Level 1 - Critical News (紧急新闻) 🚨
- **描述**：极具影响力和紧急性的新闻，通常涉及全球范围的金融危机、政治变动、大规模灾难等
- **示例**：全球股市崩盘、重要政府机构变动、国际冲突、重大突发事件
- **推送设置**：立即推送
- **处理建议**：立即关注，可能对市场产生重大影响

### Level 2 - High Priority News (高优先级新闻) ⚠️
- **描述**：重要的新闻事件，通常对金融市场、企业、政府政策等有较大影响
- **示例**：央行加息、著名企业财报发布、主要政策变动、重大企业并购
- **推送设置**：重要推送
- **处理建议**：重点关注，评估对相关业务的影响

### Level 3 - Regular News (常规新闻) 📰
- **描述**：对市场或行业有一定影响的常规新闻，影响较小
- **示例**：某公司发布新产品、地方政策更新、行业报告、市场分析
- **推送设置**：可选推送（默认关闭）
- **处理建议**：定期关注

### Level 4 - Low Priority News (低优先级新闻) 📋
- **描述**：信息较为基础，影响力有限的新闻
- **示例**：公司内部人事变动、市场分析、行业趋势观察、一般性企业动态
- **推送设置**：订阅推送（默认关闭）
- **处理建议**：按需了解

## 核心改进

### 1. 数据模型升级

**EventNode模型增强：**
```javascript
class EventNode {
  constructor({
    // ... 原有字段
    event_level = NewsLevel.LEVEL_3, // 新增：新闻级别
  }) {
    // ...
    this.event_level = event_level;
  }
  
  // 新增方法
  getLevelInfo()           // 获取级别信息
  needsImmediatePush()     // 是否需要立即推送
  needsImportantPush()     // 是否需要重要推送
}
```

**NewsExtractionResult模型增强：**
```javascript
class NewsExtractionResult {
  constructor({
    // ... 原有字段
    news_level = NewsLevel.LEVEL_3, // 新增：整体新闻级别
  }) {
    // ...
    this.news_level = news_level;
  }
  
  // 新增方法
  calculateNewsLevel()     // 根据事件级别计算整体新闻级别
  needsImmediatePush()     // 是否需要立即推送
  needsImportantPush()     // 是否需要重要推送
}
```

### 2. 智能级别判断

**多维度判断标准：**
1. **事件重要性级别**：基于significance自动映射到News Level
2. **关键词分析**：不同级别的关键词库精准识别
3. **公司影响力**：重要公司参与的事件自动提级
4. **情感分析**：负面情感 + 重要公司 = 高级别

**关键词分类示例：**
```javascript
newsLevelKeywords = {
  [NewsLevel.LEVEL_1]: ['崩盘', '危机', '突发', '史上最大'],
  [NewsLevel.LEVEL_2]: ['重大', '收购', '合并', '加息'],
  [NewsLevel.LEVEL_3]: ['发布', '推出', '宣布', '计划'],
  [NewsLevel.LEVEL_4]: ['人事', '任命', '调研', '分析']
}
```

### 3. 分级推送系统

**推送配置：**
```javascript
pushConfig = {
  [NewsLevel.LEVEL_1]: {
    enabled: true,      // 启用推送
    immediate: true,    // 立即推送
    emoji: '🚨'
  },
  [NewsLevel.LEVEL_2]: {
    enabled: true,      // 启用推送
    immediate: false,   // 非立即推送
    emoji: '⚠️'
  },
  [NewsLevel.LEVEL_3]: {
    enabled: false,     // 默认关闭
    emoji: '📰'
  },
  [NewsLevel.LEVEL_4]: {
    enabled: false,     // 默认关闭
    emoji: '📋'
  }
}
```

**消息格式增强：**
- 包含级别信息和描述
- 显示涉及的公司和事件
- 提供处理建议
- 使用级别对应的emoji

### 4. 批量处理优化

**与批量处理的完美结合：**
- 批量AI调用时同时判断News Level
- 批量数据库操作时存储event_level字段
- 批量推送时按级别分组处理

### 5. 统计分析升级

**更丰富的统计维度：**
- 按新闻级别统计
- 级别分布趋势分析
- 紧急新闻专项统计
- 推送效果统计

## 主要修改文件

### 1. 数据模型文件
**`src/models/GraphModels.js`**
- 新增NewsLevel枚举和NewsLevelDescription
- 增强EventNode和NewsExtractionResult类
- 添加级别相关的方法

### 2. 实体提取服务
**`src/services/entityExtractionService.js`**
- 新增determineNewsLevel方法
- 更新关键词分类系统
- 增强AI提取prompt

### 3. 新闻级别服务
**`src/services/newsLevelService.js`** (新建)
- 替代原breakNewsService
- 实现分级处理和推送
- 提供兼容性接口

### 4. 知识图谱服务
**`src/services/knowledgeGraphService.js`**
- 存储event_level字段
- 更新批量处理逻辑

### 5. 主处理流程
**`src/index.js`**
- 更新服务引用
- 调整定时任务
- 增强统计报告

### 6. 数据库Schema
**`neo4j/schema.cypher`**
- 添加event_level索引

## 兼容性处理

### 向后兼容
- 保留所有Break News相关的接口
- Level 1 等同于 Break News
- 统计数据自动转换

### 平滑迁移
- 原有数据自动映射到Level 3
- 渐进式推送配置调整
- 无需停机升级

## 使用指南

### 1. 推送配置调整

**启用Level 3推送：**
```javascript
newsLevelService.updatePushConfig(NewsLevel.LEVEL_3, { enabled: true });
```

**调整推送emoji：**
```javascript
newsLevelService.updatePushConfig(NewsLevel.LEVEL_2, { emoji: '📢' });
```

### 2. 查询指定级别新闻

```cypher
-- 查询Level 1紧急新闻
MATCH (e:Event {event_level: 'Level 1'})
RETURN e
ORDER BY e.event_date DESC

-- 查询高级别新闻统计
MATCH (e:Event)
WHERE e.event_level IN ['Level 1', 'Level 2']
RETURN e.event_level, count(e) as count
```

### 3. 监控级别分布

```javascript
// 获取今日新闻级别统计
const today = new Date();
const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
const stats = await newsLevelService.getNewsLevelStats(today, tomorrow);
console.log('今日新闻级别分布:', stats.byLevel);
```

## 效果预期

### 1. 推送精准度提升
- **减少噪音**：Level 3/4默认不推送，避免信息过载
- **突出重点**：Level 1/2精准推送，确保重要信息不遗漏
- **分级处理**：不同级别采用不同的处理策略

### 2. 运营效率提升
- **智能分流**：自动按级别分配处理优先级
- **数据洞察**：丰富的统计维度支持决策
- **配置灵活**：推送策略可动态调整

### 3. 系统可扩展性增强
- **级别扩展**：可轻松添加新的级别定义
- **规则优化**：判断规则可持续优化
- **业务适配**：不同业务场景可定制级别标准

## 监控和调优

### 1. 级别分布监控
定期检查各级别新闻的数量分布，确保分级合理：
- Level 1: 应该很少，通常<5%
- Level 2: 重要新闻，通常10-20%
- Level 3: 常规新闻，通常60-70%
- Level 4: 低优先级，通常10-20%

### 2. 推送效果分析
监控推送的点击率和用户反馈，优化推送策略：
- Level 1推送的响应时间
- Level 2推送的关注度
- 误判新闻的反馈和调整

### 3. 关键词优化
根据实际运行情况，不断优化各级别的关键词库：
- 新增高频关键词
- 移除低效关键词
- 调整关键词权重

## 总结

News Level功能升级实现了从粗粒度的Break News识别到精细化的4级新闻分类系统，显著提升了新闻处理的智能化水平：

✅ **精准分级**：4级分类覆盖所有新闻类型
✅ **智能推送**：分级推送策略减少噪音
✅ **数据洞察**：丰富的统计分析维度  
✅ **系统高效**：与批量处理完美结合
✅ **完全兼容**：保持向后兼容性
✅ **灵活配置**：推送策略可动态调整

这次升级为新闻处理系统带来了质的提升，为后续的智能化发展奠定了坚实基础。 
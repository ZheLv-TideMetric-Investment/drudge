# Graph Worker 数据库结构文档

## 概述

本文档描述了 Graph Worker 系统在 Neo4j 数据库中存储的知识图谱数据结构。该系统从新闻数据中提取实体和关系，构建投资领域的知识图谱。

### 数据库信息
- **数据库类型**: Neo4j 图数据库
- **连接信息**: 请参考 `env.example` 文件中的 Neo4j 配置
- **版本**: Neo4j 5.x+
- **编码**: UTF-8

### 系统特性
- **时间处理**: 所有时间数据统一使用北京时间 (Asia/Shanghai 时区)
- **数据质量**: 严格的数据验证，不允许兜底数据，确保数据准确性
- **失败处理**: 处理失败的新闻数据会保存到 `data/news/failed` 目录便于后续分析

---

## 节点类型 (Node Types)

### 1. News (新闻节点)
存储原始新闻数据和处理状态。

**标签**: `News`

**属性**:
| 属性名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `id` | String | ✓ | 新闻唯一标识符 |
| `title` | String | ✓ | 新闻标题 |
| `content` | String | ✓ | 新闻内容 |
| `source` | String | ✓ | 数据源 (如 "futu_live") |
| `url` | String | ✗ | 新闻链接 |
| `timestamp` | DateTime | ✓ | 新闻时间戳 |
| `news_level` | String | ✓ | 新闻级别 (Level 1-5) |
| `level` | Integer | ✓ | 数值级别 (0-4) |
| `processed` | Boolean | ✓ | 是否已处理 |
| `created_at` | DateTime | ✓ | 创建时间 |
| `updated_at` | DateTime | ✓ | 更新时间 |

**示例**:
```json
{
  "id": "19046732",
  "title": "天气炎热导致原料减产 日本抹茶价格飙升",
  "content": "受去年夏天创纪录的高温天气影响，日本制作抹茶的原料茶碾茶今年减产...",
  "source": "futu_live",
  "news_level": "Level 3",
  "level": 0,
  "processed": true,
  "timestamp": "2025-01-01T00:00:00.000Z"
}
```

### 2. Event (事件节点)
表示从新闻中提取的重要事件。

**标签**: `Event`

**属性**:
| 属性名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `event_id` | String | ✓ | 事件唯一标识符 |
| `event_name` | String | ✓ | 事件名称 |
| `event_description` | String | ✓ | 事件描述 |
| `event_type` | String | ✓ | 事件类型 (见枚举值) |
| `significance` | Integer | ✓ | 重要性评分 (1-4) |
| `sentiment` | String | ✓ | 情感倾向 (positive/negative/neutral) |
| `magnitude` | Float | ✓ | 影响程度 (-1.0 到 1.0) |
| `event_level` | String | ✓ | 事件级别 (Level 1-5) |
| `event_date` | DateTime | ✓ | 事件发生日期 |
| `raw_event_date` | String | ✗ | 原始日期字符串 |
| `parsed_event_date` | DateTime | ✗ | 解析后的日期 |
| `created_at` | DateTime | ✓ | 创建时间 |
| `updated_at` | DateTime | ✓ | 更新时间 |

**事件类型枚举**:
- `macro`: 宏观经济事件
- `policy`: 政策变化
- `market`: 市场动态
- `corporate`: 企业事件
- `industry`: 行业事件
- `tech`: 技术事件
- `geopolitics`: 地缘政治
- `other`: 其他事件

**示例**:
```json
{
  "event_id": "19046732_event_0",
  "event_name": "日本抹茶价格飙升",
  "event_description": "受去年夏天高温天气影响，原料茶碾茶减产导致交易价格创纪录",
  "event_type": "industry",
  "significance": 3,
  "sentiment": "negative",
  "magnitude": -0.7,
  "event_level": "Level 3"
}
```

### 3. Company (公司节点)
表示企业实体。

**标签**: `Company`

**属性**:
| 属性名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `company_name` | String | ✓ | 公司名称 (唯一约束) |
| `ticker` | String | ✗ | 股票代码 |
| `industry` | String | ✗ | 所属行业 |
| `market` | String | ✗ | 交易市场 |
| `country` | String | ✗ | 注册国家 |
| `aliases` | String[] | ✗ | 别名列表 |
| `created_at` | DateTime | ✓ | 创建时间 |
| `updated_at` | DateTime | ✓ | 更新时间 |

### 4. Person (人物节点)
表示个人实体。

**标签**: `Person`

**属性**:
| 属性名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `person_name` | String | ✓ | 姓名 (唯一约束) |
| `title` | String | ✗ | 职位 |
| `company` | String | ✗ | 所属公司 |
| `nationality` | String | ✗ | 国籍 |
| `created_at` | DateTime | ✓ | 创建时间 |
| `updated_at` | DateTime | ✓ | 更新时间 |

### 5. Organization (机构节点)
表示组织机构实体。

**标签**: `Organization`

**属性**:
| 属性名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `organization_name` | String | ✓ | 机构名称 (唯一约束) |
| `type` | String | ✗ | 机构类型 (见枚举值) |
| `country` | String | ✗ | 所在国家 |
| `created_at` | DateTime | ✓ | 创建时间 |
| `updated_at` | DateTime | ✓ | 更新时间 |

**机构类型枚举**:
- `government`: 政府机构
- `regulator`: 监管机构
- `intl_org`: 国际组织
- `fin_inst`: 金融机构
- `industry_assoc`: 行业协会
- `other`: 其他

### 6. Location (地点节点)
表示地理位置实体。

**标签**: `Location`

**属性**:
| 属性名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `location_name` | String | ✓ | 地点名称 (唯一约束) |
| `type` | String | ✗ | 地点类型 (见枚举值) |
| `country` | String | ✗ | 国家代码 |
| `region` | String | ✗ | 地区 |
| `created_at` | DateTime | ✓ | 创建时间 |
| `updated_at` | DateTime | ✓ | 更新时间 |

**地点类型枚举**:
- `country`: 国家
- `region`: 地区
- `city`: 城市
- `facility`: 设施
- `other`: 其他

> **注意**: 坐标信息(coordinates)字段已移除，后续将通过专门的地理定位服务来处理坐标数据。

### 7. Time (时间节点)
表示时间实体。

**标签**: `Time`

**属性**:
| 属性名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `time_value` | String | ✓ | 时间值 (ISO 8601格式，北京时间) |
| `type` | String | ✗ | 时间类型 (见枚举值) |
| `precision` | String | ✗ | 时间精度 (见枚举值) |
| `timezone` | String | ✗ | 时区 (统一为 Asia/Shanghai) |
| `raw_value` | String | ✗ | 原始时间字符串 |
| `parsed_iso` | String | ✗ | 解析后的ISO时间 |
| `created_at` | DateTime | ✓ | 创建时间 |
| `updated_at` | DateTime | ✓ | 更新时间 |

> **时间处理说明**: 系统使用智能时间解析器，支持多种时间格式输入（秒级/毫秒级时间戳、ISO字符串、自然语言时间等），统一转换为北京时间存储。

**时间类型枚举**:
- `DATETIME`: 日期时间
- `DATE`: 日期
- `TIME`: 时间
- `PERIOD`: 时间段
- `OTHER`: 其他

**时间精度枚举**:
- `YEAR`: 年
- `MONTH`: 月
- `DAY`: 日
- `HOUR`: 小时
- `MINUTE`: 分钟
- `SECOND`: 秒

---

## 关系类型 (Relationship Types)

### 标准关系类型

| 关系类型 | 含义 | 示例 |
|----------|------|------|
| `LOCATED_IN` | 位于 | 公司位于某地 |
| `WORKS_FOR` | 工作于 | 人物在公司工作 |
| `OWNS` | 拥有 | 公司拥有子公司 |
| `PARTICIPATES_IN` | 参与 | 参与某个事件 |
| `MERGES_WITH` | 合并 | 公司合并 |
| `ACQUIRES` | 收购 | 公司收购 |
| `SUPPLIES` | 供应 | 供应商关系 |
| `PARTNERS_WITH` | 合作 | 合作伙伴关系 |
| `SUED_BY` | 被起诉 | 法律诉讼 |
| `REGULATED_BY` | 被监管 | 监管关系 |
| `INVESTS_IN` | 投资 | 投资关系 |
| `OTHER` | 其他 | 其他关系类型 |

### 系统生成的关系类型

| 关系类型 | 含义 | 说明 |
|----------|------|------|
| `DESCRIBES` | 描述 | 新闻描述事件 |
| `LOCATED_AT` | 位于 | 事件发生地点 |
| `OCCURRED_AT` | 发生于 | 事件发生时间 |

### 关系属性

所有关系都包含以下通用属性：

| 属性名 | 类型 | 说明 |
|--------|------|------|
| `description` | String | 关系描述 |
| `confidence` | Float | 置信度 (0.0-1.0) |
| `inferred` | Boolean | 是否为推断关系 |
| `newsId` | String | 来源新闻ID |
| `source_news` | String | 源新闻ID (推断关系) |
| `created_at` | DateTime | 创建时间 |
| `updated_at` | DateTime | 更新时间 |

---

## 数据处理机制

### 智能时间处理

系统内置智能时间解析器 (`TimeParser`)，具备以下特性：

- **多格式支持**: 自动识别并处理秒级时间戳、毫秒级时间戳、ISO字符串、自然语言时间等
- **时区统一**: 所有时间数据统一转换为北京时间 (Asia/Shanghai)
- **兜底机制**: 无效时间输入自动使用当前北京时间
- **智能识别**: 自动判断时间戳的精度级别

**支持的时间格式示例**:
```javascript
// 秒级时间戳
1703175600 → "2023-12-22T00:20:00.000+08:00"

// 毫秒级时间戳  
1703175600000 → "2023-12-22T00:20:00.000+08:00"

// ISO字符串
"2023-12-21T13:00:00Z" → "2023-12-21T21:00:00.000+08:00"

// 自然语言
"今天下午3点" → 当前日期下午15:00北京时间
```

### 严格数据验证

系统采用严格的数据验证策略：

- **无兜底数据**: 不允许创建空白或默认的兜底数据
- **必须成功**: 每条新闻数据必须成功解析所有实体和关系
- **5次重试**: AI提取失败时最多重试5次
- **智能修复**: 内置JSON格式错误修复机制

### 失败新闻处理机制

对于无法成功处理的新闻数据，系统采用以下策略：

#### 失败数据存储位置
```
data/news/failed/failed_{newsId}_{timestamp}.json
```

#### 失败数据结构
```json
{
  "newsItem": {
    "id": "news_123",
    "title": "新闻标题",
    "content": "新闻内容",
    "source": "数据源",
    "url": "新闻链接",
    "time": 1721030018
  },
  "error": {
    "message": "具体错误信息",
    "stack": "错误堆栈信息",
    "timestamp": "2025-07-15T09:33:38.456Z",
    "service": "EntityExtractionService"
  },
  "metadata": {
    "failedAt": "2025-07-15T09:33:38.456Z",
    "originalId": "news_123",
    "source": "数据源",
    "title": "新闻标题"
  }
}
```

#### 失败处理流程

1. **检测失败**: AI提取或数据解析过程中发生异常
2. **保存数据**: 将完整的新闻数据和错误信息保存到失败目录
3. **发送通知**: 通过Webhook发送失败通知
4. **继续处理**: 不中断批处理，继续处理其他新闻
5. **统计报告**: 提供详细的成功/失败统计信息

#### 批处理统计示例
```
✅ 批量六要素提取完成: 成功 8 条，失败 2 条，总计 10 条新闻
⚠️ 2 条新闻处理失败，已保存到 data/news/failed 目录
```

### JSON修复机制

系统内置智能JSON修复功能，能够处理AI返回的常见格式错误：

- **空键修复**: 处理 `{"company_name":"测试","","industry":""}` 类型错误
- **分号修复**: 修复错误的分号分隔符
- **逗号修复**: 处理缺失或多余的逗号
- **引号修复**: 修复不匹配的引号
- **尾随逗号**: 清理JSON尾部的多余逗号

---

## 数据库索引和约束

### 唯一约束 (Unique Constraints)

```cypher
-- 公司名称唯一约束
CREATE CONSTRAINT company_name_unique IF NOT EXISTS 
FOR (c:Company) REQUIRE c.company_name IS UNIQUE;

-- 人物姓名唯一约束  
CREATE CONSTRAINT person_name_unique IF NOT EXISTS 
FOR (p:Person) REQUIRE p.person_name IS UNIQUE;

-- 机构名称唯一约束
CREATE CONSTRAINT organization_name_unique IF NOT EXISTS 
FOR (o:Organization) REQUIRE o.organization_name IS UNIQUE;

-- 地点名称唯一约束
CREATE CONSTRAINT location_name_unique IF NOT EXISTS 
FOR (l:Location) REQUIRE l.location_name IS UNIQUE;
```

### 数据库索引

```cypher
-- 新闻相关索引
CREATE INDEX news_id_idx IF NOT EXISTS FOR (n:News) ON (n.id);
CREATE INDEX news_timestamp_idx IF NOT EXISTS FOR (n:News) ON (n.timestamp);

-- 事件相关索引
CREATE INDEX event_id_idx IF NOT EXISTS FOR (e:Event) ON (e.event_id);
CREATE INDEX event_date_idx IF NOT EXISTS FOR (e:Event) ON (e.event_date);

-- 时间相关索引
CREATE INDEX time_value_idx IF NOT EXISTS FOR (t:Time) ON (t.time_value);
```

---

## 查询示例

### 1. 基础查询

#### 获取所有新闻
```cypher
MATCH (n:News) 
RETURN n 
ORDER BY n.timestamp DESC 
LIMIT 10;
```

#### 查找特定公司
```cypher
MATCH (c:Company {company_name: "小米集团"}) 
RETURN c;
```

#### 获取最新事件
```cypher
MATCH (e:Event) 
RETURN e 
ORDER BY e.event_date DESC 
LIMIT 5;
```

### 2. 关系查询

#### 查找公司相关的所有关系
```cypher
MATCH (c:Company {company_name: "小米集团"})-[r]-(related)
RETURN c, r, related;
```

#### 获取新闻描述的所有事件
```cypher
MATCH (n:News)-[:DESCRIBES]->(e:Event)
WHERE n.id = "19046732"
RETURN n, e;
```

#### 查找某地区的所有公司
```cypher
MATCH (c:Company)-[:LOCATED_IN]->(l:Location)
WHERE l.location_name CONTAINS "北京"
RETURN c, l;
```

### 3. 复杂分析查询

#### 按事件类型统计
```cypher
MATCH (e:Event)
RETURN e.event_type as eventType, 
       count(e) as eventCount,
       avg(e.significance) as avgSignificance
ORDER BY eventCount DESC;
```

#### 查找最活跃的公司 (出现在最多新闻中)
```cypher
MATCH (c:Company)-[:PARTICIPATES_IN|OWNS|MERGES_WITH]-(e:Event)<-[:DESCRIBES]-(n:News)
RETURN c.company_name as company, 
       count(DISTINCT n) as newsCount
ORDER BY newsCount DESC 
LIMIT 10;
```

#### 查找某时间段内的事件
```cypher
MATCH (e:Event)
WHERE e.event_date >= "2024-01-01T00:00:00.000Z" 
  AND e.event_date <= "2024-12-31T23:59:59.999Z"
RETURN e
ORDER BY e.event_date DESC;
```

### 4. 情感分析查询

#### 负面事件统计
```cypher
MATCH (e:Event)
WHERE e.sentiment = "negative"
RETURN e.event_type as eventType,
       count(e) as negativeCount,
       avg(e.magnitude) as avgMagnitude
ORDER BY negativeCount DESC;
```

#### 公司相关的情感分析
```cypher
MATCH (c:Company)-[:PARTICIPATES_IN|OWNS]-(e:Event)
WHERE c.company_name = "小米集团"
RETURN c.company_name as company,
       e.sentiment as sentiment,
       count(e) as eventCount,
       avg(e.magnitude) as avgMagnitude
ORDER BY sentiment;
```

### 5. 网络分析查询

#### 查找公司合作网络
```cypher
MATCH (c1:Company)-[:PARTNERS_WITH|SUPPLIES|INVESTS_IN]-(c2:Company)
RETURN c1, c2
LIMIT 50;
```

#### 查找人物关系网络
```cypher
MATCH (p:Person)-[:WORKS_FOR]->(c:Company)<-[:WORKS_FOR]-(colleague:Person)
WHERE p.person_name = "雷军"
RETURN p, c, colleague;
```

#### 查找地理分布
```cypher
MATCH (c:Company)-[:LOCATED_IN]->(l:Location)
RETURN l.country as country,
       count(c) as companyCount
ORDER BY companyCount DESC;
```

### 6. 时间序列分析

#### 事件时间线
```cypher
MATCH (e:Event)
WHERE e.event_date >= "2024-01-01"
RETURN e.event_date as date,
       e.event_name as event,
       e.significance as importance
ORDER BY e.event_date;
```

#### 新闻发布频率（北京时间）
```cypher
MATCH (n:News)
RETURN date(datetime({epochMillis: apoc.date.parse(n.timestamp, 'ms'), timezone: 'Asia/Shanghai'})) as beijingDate,
       count(n) as newsCount
ORDER BY beijingDate;

// 简化版本
MATCH (n:News)
RETURN date(n.timestamp) as date,
       count(n) as newsCount
ORDER BY date;

// 按小时统计（北京时间）
MATCH (n:News)
WITH datetime({epochMillis: apoc.date.parse(n.timestamp, 'ms'), timezone: 'Asia/Shanghai'}) as beijingTime
RETURN date(beijingTime) as date,
       beijingTime.hour as hour,
       count(*) as newsCount
ORDER BY date, hour;
```

---

## 高级查询场景

### 1. 新闻总结分析

#### 获取某公司的新闻摘要
```cypher
MATCH (c:Company {company_name: "小米集团"})-[:PARTICIPATES_IN|OWNS]-(e:Event)<-[:DESCRIBES]-(n:News)
RETURN n.title as newsTitle,
       n.content as newsContent,
       e.event_name as eventName,
       e.sentiment as sentiment,
       n.timestamp as newsTime
ORDER BY n.timestamp DESC
LIMIT 10;
```

### 2. 新闻关联查询

#### 查找相关新闻 (通过共同实体)
```cypher
MATCH (n1:News)-[:DESCRIBES]->(e1:Event)-[:PARTICIPATES_IN]-(entity)-[:PARTICIPATES_IN]-(e2:Event)<-[:DESCRIBES]-(n2:News)
WHERE n1.id = "19046732" AND n1 <> n2
RETURN DISTINCT n2.title as relatedNews,
       n2.id as newsId,
       entity as commonEntity,
       n2.timestamp as newsTime
ORDER BY n2.timestamp DESC
LIMIT 10;
```

### 3. 新闻脉络分析

#### 追踪事件发展脉络
```cypher
MATCH (e:Event)
WHERE e.event_name CONTAINS "抹茶价格"
MATCH (e)<-[:DESCRIBES]-(n:News)
RETURN e.event_date as eventDate,
       n.timestamp as newsTime,
       n.title as newsTitle,
       e.significance as importance
ORDER BY e.event_date, n.timestamp;
```

#### 查找事件影响链
```cypher
MATCH path = (e1:Event)-[:CAUSES|INFLUENCES*1..3]-(e2:Event)
WHERE e1.event_name CONTAINS "价格飙升"
RETURN path;
```

### 4. 实体影响力分析

#### 计算公司影响力 (基于新闻数量和事件重要性)
```cypher
MATCH (c:Company)-[:PARTICIPATES_IN]-(e:Event)<-[:DESCRIBES]-(n:News)
RETURN c.company_name as company,
       count(DISTINCT n) as newsCount,
       count(DISTINCT e) as eventCount,
       avg(e.significance) as avgSignificance,
       sum(e.significance) as totalImpact
ORDER BY totalImpact DESC
LIMIT 20;
```

### 5. 异常检测查询

#### 查找异常活跃的实体
```cypher
MATCH (entity)-[:PARTICIPATES_IN]-(e:Event)<-[:DESCRIBES]-(n:News)
WHERE n.timestamp >= date() - duration('P7D')  // 最近7天
WITH entity, count(DISTINCT n) as recentNewsCount
WHERE recentNewsCount > 5  // 超过5条新闻
RETURN entity, recentNewsCount
ORDER BY recentNewsCount DESC;
```

---

## 数据质量和维护

### 数据完整性检查

#### 检查孤立节点
```cypher
MATCH (n)
WHERE NOT (n)--()
RETURN labels(n) as nodeType, count(n) as orphanCount;
```

#### 检查缺失属性
```cypher
MATCH (c:Company)
WHERE c.company_name IS NULL OR c.company_name = ""
RETURN count(c) as companiesWithoutName;
```

### 性能优化建议

1. **索引优化**: 为经常查询的属性创建索引
2. **查询优化**: 使用 `LIMIT` 限制结果集大小
3. **批量操作**: 大数据量操作时使用批量处理
4. **定期维护**: 定期清理孤立节点和重复数据

---

## 快速开始指南

### 1. 检查数据库连接

通过 Graph Worker CLI 检查数据库状态：
```bash
# 进入 graph-worker 目录
cd packages/graph-worker

# 检查数据库连接
npm run cli db-health

# 查看数据库统计信息
npm run cli stats
```

### 2. 基础查询入门

使用 Neo4j Browser 连接数据库：
- 打开浏览器访问：http://localhost:7474
- 使用配置文件中的用户名和密码登录

#### 快速查看数据结构
```cypher
// 查看所有节点类型
CALL db.labels();

// 查看所有关系类型
CALL db.relationshipTypes();

// 查看数据库统计信息
CALL db.stats.retrieve('GRAPH COUNTS');
```

#### 快速浏览数据
```cypher
// 查看最新的 10 条新闻
MATCH (n:News) 
RETURN n.title, n.timestamp, n.news_level 
ORDER BY n.timestamp DESC 
LIMIT 10;

// 查看所有事件类型的分布
MATCH (e:Event)
RETURN e.event_type, count(e) as count
ORDER BY count DESC;

// 查看实体网络概览
MATCH (n)-[r]-(m)
RETURN n, r, m
LIMIT 20;
```

### 3. 常用查询模板

#### 搜索相关内容
```cypher
// 模糊搜索 (替换 '关键词' 为实际搜索词)
MATCH (n)
WHERE ANY(prop IN keys(n) WHERE toString(n[prop]) CONTAINS '关键词')
RETURN labels(n) as nodeType, n
LIMIT 10;
```

#### 获取实体详情
```cypher
// 获取公司详情及其所有关系 (替换 '公司名' 为实际公司名)
MATCH (c:Company {company_name: '公司名'})-[r]-(related)
RETURN c, r, related;
```

#### 时间范围查询
```cypher
// 查找指定时间范围内的新闻和事件（北京时间）
MATCH (n:News)-[:DESCRIBES]->(e:Event)
WHERE n.timestamp >= '2024-01-01T00:00:00+08:00' AND n.timestamp <= '2024-12-31T23:59:59+08:00'
RETURN n.title, e.event_name, e.sentiment, n.timestamp
ORDER BY n.timestamp DESC;

// 查找今天的新闻（北京时间）
MATCH (n:News)
WHERE date(n.timestamp) = date(datetime({timezone: 'Asia/Shanghai'}))
RETURN n.title, n.timestamp
ORDER BY n.timestamp DESC;
```

### 4. 数据导出

#### 导出为 JSON 格式
```cypher
// 导出所有公司数据
MATCH (c:Company)
RETURN c
// 在 Neo4j Browser 中右键结果表格选择 "Export" -> "JSON"
```

#### 导出为 CSV 格式
```cypher
// 导出事件统计数据
MATCH (e:Event)
RETURN e.event_type, e.sentiment, count(e) as event_count
ORDER BY event_count DESC
// 在 Neo4j Browser 中右键结果表格选择 "Export" -> "CSV"
```

### 5. 集成到其他应用

#### Python 集成示例
```python
from neo4j import GraphDatabase

# 连接数据库
uri = "bolt://localhost:7687"
driver = GraphDatabase.driver(uri, auth=("neo4j", "password"))

def get_company_news(company_name):
    with driver.session() as session:
        result = session.run("""
            MATCH (c:Company {company_name: $company_name})-[:PARTICIPATES_IN]-(e:Event)<-[:DESCRIBES]-(n:News)
            RETURN n.title, n.content, e.event_name, e.sentiment
            ORDER BY n.timestamp DESC
            LIMIT 10
        """, company_name=company_name)
        return [record.data() for record in result]

# 使用示例
news_data = get_company_news("小米集团")
```

#### Node.js 集成示例
```javascript
const neo4j = require('neo4j-driver');

const driver = neo4j.driver('bolt://localhost:7687', 
  neo4j.auth.basic('neo4j', 'password'));

async function getEventsByType(eventType) {
  const session = driver.session();
  try {
    const result = await session.run(
      `MATCH (e:Event {event_type: $eventType})
       RETURN e.event_name, e.sentiment, e.significance
       ORDER BY e.significance DESC
       LIMIT 20`,
      { eventType }
    );
    return result.records.map(record => record.toObject());
  } finally {
    await session.close();
  }
}

// 使用示例
getEventsByType('industry').then(events => {
  console.log('行业事件:', events);
});
```

---

## 连接信息

### 数据库配置
```bash
# Neo4j 连接配置
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-password
NEO4J_DATABASE=neo4j
```

### 查询工具
- **Neo4j Browser**: http://localhost:7474
- **Neo4j Bloom**: 可视化图谱分析
- **Graph Worker CLI**: 本项目提供的命令行工具

### Graph Worker CLI 常用命令
```bash
# 查看帮助
npm run cli help

# 查看数据库状态
npm run cli db-health

# 查看统计信息
npm run cli stats

# 搜索实体
npm run cli query "关键词" 10

# 数据库维护
npm run cli db-clean-duplicates  # 清理重复数据
npm run cli db-clean-orphaned    # 清理孤立节点

# 失败新闻处理
ls -la ../../data/news/failed/   # 查看失败新闻文件
cat ../../data/news/failed/failed_*.json | jq '.error.message'  # 查看失败原因
```

### 失败新闻分析
```bash
# 统计失败新闻数量
find ../../data/news/failed/ -name "*.json" | wc -l

# 查看最近的失败新闻
ls -lt ../../data/news/failed/ | head -5

# 分析失败原因分布
grep -h '"message"' ../../data/news/failed/*.json | sort | uniq -c | sort -nr

# 清理旧的失败记录（谨慎操作）
find ../../data/news/failed/ -name "*.json" -mtime +30 -delete
```

---

## 常见问题和解决方案

### Q: 查询速度慢怎么办？
A: 
1. 检查是否创建了必要的索引
2. 在查询中使用 `LIMIT` 限制结果集大小
3. 避免使用 `MATCH (n)--(m)` 这种无条件的全图查询

### Q: 如何处理中文搜索？
A: 使用 `CONTAINS` 或 `STARTS WITH` 进行模糊匹配：
```cypher
MATCH (n)
WHERE ANY(prop IN keys(n) WHERE toString(n[prop]) CONTAINS '中文关键词')
RETURN n;
```

### Q: 如何批量更新数据？
A: 使用 `UNWIND` 进行批量操作：
```cypher
UNWIND $data AS item
MATCH (n:Company {company_name: item.name})
SET n.industry = item.industry, n.updated_at = timestamp()
```

### Q: 数据库占用空间过大怎么办？
A: 
1. 定期清理历史数据
2. 删除不必要的关系和节点
3. 使用 `CALL db.cleanup.compactStore()` 压缩存储

### Q: 新闻处理失败怎么办？
A: 
1. 检查 `data/news/failed/` 目录中的失败记录
2. 分析错误信息，常见原因包括：AI服务异常、网络超时、数据格式错误
3. 修复问题后可以重新处理失败的新闻数据
4. 系统会自动重试5次，大部分临时问题会自动恢复

### Q: 如何监控系统处理质量？
A: 
1. 查看批处理日志中的成功/失败统计
2. 定期检查失败新闻目录的文件数量
3. 分析失败原因的分布情况
4. 设置监控告警，当失败率超过阈值时通知

### Q: 时间数据显示不正确怎么办？
A: 
1. 确认所有时间数据都已转换为北京时间
2. 检查原始数据的时间格式是否正确
3. 系统支持多种时间格式，通常能自动识别和转换
4. 如有问题，查看 TimeParser 的处理日志

---

## 更新日志

- **v3.0.0**: 重大系统升级
  - 新增智能时间解析器，统一北京时区处理
  - 移除兜底数据机制，实施严格数据验证
  - 新增失败新闻处理机制，完善错误跟踪
  - 移除Location节点的coordinates字段
  - 增强JSON修复能力，提高数据解析成功率
  - AI重试次数增加到5次
- **v2.0.0**: 完整重构，优化数据结构，增加约束和索引
- **v1.0.0**: 初始版本，基础数据结构

---

## 联系方式

如有疑问或建议，请联系开发团队或参考项目 README 文档。 
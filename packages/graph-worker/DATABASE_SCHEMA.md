# Graph Worker 数据库结构文档

## 概述

本文档描述了 Graph Worker 系统在 Neo4j 数据库中存储的知识图谱数据结构。该系统从新闻数据中提取实体和关系，构建投资领域的知识图谱。

### 数据库信息
- **数据库类型**: Neo4j 图数据库
- **连接信息**: 请参考 `env.example` 文件中的 Neo4j 配置
- **版本**: Neo4j 5.x+
- **编码**: UTF-8

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
| `coordinates` | Object | ✗ | 坐标信息 |
| `created_at` | DateTime | ✓ | 创建时间 |
| `updated_at` | DateTime | ✓ | 更新时间 |

**地点类型枚举**:
- `country`: 国家
- `region`: 地区
- `city`: 城市
- `facility`: 设施
- `other`: 其他

**坐标格式**:
```json
{
  "coordinates": {
    "latitude": 35.6762,
    "longitude": 139.6503
  }
}
```

### 7. Time (时间节点)
表示时间实体。

**标签**: `Time`

**属性**:
| 属性名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `time_value` | String | ✓ | 时间值 (ISO 8601格式) |
| `type` | String | ✗ | 时间类型 (见枚举值) |
| `precision` | String | ✗ | 时间精度 (见枚举值) |
| `timezone` | String | ✗ | 时区 |
| `raw_value` | String | ✗ | 原始时间字符串 |
| `parsed_iso` | String | ✗ | 解析后的ISO时间 |
| `created_at` | DateTime | ✓ | 创建时间 |
| `updated_at` | DateTime | ✓ | 更新时间 |

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

#### 新闻发布频率
```cypher
MATCH (n:News)
RETURN date(n.timestamp) as date,
       count(n) as newsCount
ORDER BY date;
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
// 查找指定时间范围内的新闻和事件
MATCH (n:News)-[:DESCRIBES]->(e:Event)
WHERE n.timestamp >= '2024-01-01' AND n.timestamp <= '2024-12-31'
RETURN n.title, e.event_name, e.sentiment, n.timestamp
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

---

## 更新日志

- **v2.0.0**: 完整重构，优化数据结构，增加约束和索引
- **v1.0.0**: 初始版本，基础数据结构

---

## 联系方式

如有疑问或建议，请联系开发团队或参考项目 README 文档。 
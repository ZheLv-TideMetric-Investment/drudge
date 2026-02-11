# Graph Worker 数据库结构文档

## 概述

本文档描述了 Graph Worker 系统在 Neo4j 数据库中存储的知识图谱数据结构。该系统从新闻数据中提取实体和关系，构建投资领域的知识图谱。

### 数据库信息
- **数据库类型**: Neo4j 图数据库
- **连接信息**: 请参考仓库根目录 `env.example`（运行时为根目录 `.env`）中的 Neo4j 配置
- **版本**: Neo4j 5.x+
- **编码**: UTF-8

### 系统特性
- **时间处理**: 所有时间数据统一使用 UTC 时区的 ISO 8601 格式存储 (YYYY-MM-DDTHH:mm:ss.sssZ)
- **时间戳管理**: 所有实体和关系的时间戳由 Neo4j 数据库统一处理，确保一致性和准确性
- **数据质量**: 严格的数据验证，不允许兜底数据，确保数据准确性
- **失败处理**: 处理失败的新闻数据会保存到 `data/news/failed` 目录便于后续分析
- **枚举管理**: 使用 TypeScript 枚举和 `ts-enum-util` 库进行类型安全的枚举操作
- **类型安全**: 完整的 TypeScript 类型支持，确保编译时类型检查

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
| `timestamp` | String | ✓ | 新闻时间戳 (UTC ISO 8601 字符串) |
| `raw_time` | Any | ✗ | 原始时间数据（保存未转换的原始值） |
| `news_level` | String | ✓ | 新闻级别 (Level 1-5) |
| `level` | Integer | ✓ | 数值级别 (0-4) |
| `processed` | Boolean | ✓ | 是否已处理 |
| `processedAt` | DateTime | ✓ | 处理时间 (UTC) |
| `created_at` | DateTime | ✓ | 创建时间 (UTC) |
| `updated_at` | DateTime | ✓ | 更新时间 (UTC) |

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
  "processedAt": 1735689600000,
  "timestamp": "2025-01-01T00:00:00.000Z",
  "raw_time": 1735689600
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
| `timestamp` | String | ✓ | 事件发生时间 (UTC ISO 8601 字符串) |
| `raw_time` | Any | ✗ | 原始时间数据（保存未转换的原始值） |
| `created_at` | DateTime | ✓ | 创建时间 (UTC) |
| `updated_at` | DateTime | ✓ | 更新时间 (UTC) |

**事件类型枚举** (EventType):
- `macro`: 宏观经济事件
- `policy`: 政策变化
- `market`: 市场动态
- `corporate`: 企业事件
- `industry`: 行业事件
- `tech`: 技术事件
- `geopolitics`: 地缘政治
- `other`: 其他事件

> **类型安全**: 使用 TypeScript 枚举 `EventType`，支持编译时类型检查和 IDE 智能提示。

**事件级别详细定义** (EventLevel):

事件级别是评估新闻事件对资本市场影响程度的重要指标，分为5个等级：

- **Level 1 - 超级事件**: 对全球经济、市场、政治局势产生 **重大影响** 的突发性事件。通常会引发 **全球性的恐慌或波动**，具有 **系统性风险**，是资本市场的 **极端事件**。
  - **突发战争** 或 **战争的重要进展**（如战争爆发、重要的战役进展等）
  - **全球重要人物的发言**（例如：美联储主席、欧盟委员会主席、世界主要领导人的重大讲话）
  - **中、美、欧央行的主权政策变动**
  - **全球主要指数的异常涨幅或跌幅**（例如：美股标普500、纳斯达克等指数单日跌幅超过 10%）
  - **⚠️ 注意**：请谨慎评定为 Level 1，仅当事件具有 **全球性影响** 或 **对资本市场产生深远影响** 时使用

- **Level 2 - 重要国家事件**: 对某个国家、地区或全球市场产生 **重大影响** 的事件，通常局限于 **特定国家** 或 **重要企业**。不会导致全球性恐慌，但影响力较大。
  - **持续发生的战争冲突进展** 或 **其他重要的政治动荡**
  - **中、美、欧** 以外的 **央行/主权级政策变动**（如日本央行的货币政策调整或新兴市场国家的重大金融政策）
  - **中美全球型大型企业的重大事件**（例如：财报暴雷、并购收购、企业破产等）

- **Level 3 - 行业内重大事件**: 对某个行业或公司产生 **重要影响** 的事件，通常影响 **行业内的其他公司**，但不会产生较大范围的资本市场波动。
  - **行业龙头公司** 的 **并购、破产、财报发布等重大事件**
  - **其他地区或行业内的公司** 发生的 **重大并购、破产、融资等事件**

- **Level 4 - 一般商业事件**: 一般产品发布、地方性政策和金融新闻。这类事件通常不会引起 **重大市场波动**，对企业或特定行业产生较小影响。
  - **一般产品发布、技术发布**
  - **地方性政策变化**（如地方政府的税收优惠或经济发展政策等）
  - **金融新闻**（如：季度财报、股东大会决议、公司战略公告等）

- **Level 5 - 信息性报道**: 对市场 **影响微乎其微** 的常规信息，通常用于 **补充背景或提供数据**。
  - **日常信息性报道**（如：宏观经济数据、行业趋势报告、消费者信心指数等）
  - **例行统计数据**（例如：失业率、GDP增速等指标）

**特殊规则**:
- **非金融相关新闻**: 若新闻内容与 **金融市场无关**（如：娱乐、体育、科技、文化等），应根据事件的影响范围和重要性 **下调一级**（如：Level 2 → Level 3，Level 3 → Level 4）

> **重要提示**: 事件级别评估需要综合考虑事件的影响范围、持续时间、市场反应等多个因素，确保评级的准确性和一致性。

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
  "event_level": "Level 3",
  "timestamp": "2025-01-01T00:00:00.000Z",
  "raw_time": "2025-01-01"
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
| `created_at` | DateTime | ✓ | 创建时间 (UTC) |
| `updated_at` | DateTime | ✓ | 更新时间 (UTC) |

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
| `created_at` | DateTime | ✓ | 创建时间 (UTC) |
| `updated_at` | DateTime | ✓ | 更新时间 (UTC) |

### 5. Organization (机构节点)
表示组织机构实体。

**标签**: `Organization`

**属性**:
| 属性名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| `organization_name` | String | ✓ | 机构名称 (唯一约束) |
| `type` | String | ✗ | 机构类型 (见枚举值) |
| `country` | String | ✗ | 所在国家 |
| `created_at` | DateTime | ✓ | 创建时间 (UTC) |
| `updated_at` | DateTime | ✓ | 更新时间 (UTC) |

**机构类型枚举** (OrganizationType):
- `government`: 政府机构
- `regulator`: 监管机构
- `intl_org`: 国际组织
- `fin_inst`: 金融机构
- `industry_assoc`: 行业协会
- `other`: 其他

> **类型安全**: 使用 TypeScript 枚举 `OrganizationType`，支持编译时类型检查。

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
| `created_at` | DateTime | ✓ | 创建时间 (UTC) |
| `updated_at` | DateTime | ✓ | 更新时间 (UTC) |

**地点类型枚举** (LocationType):
- `country`: 国家
- `region`: 地区
- `city`: 城市
- `facility`: 设施
- `other`: 其他

> **类型安全**: 使用 TypeScript 枚举 `LocationType`，支持编译时类型检查。

> **注意**: 坐标信息(coordinates)字段已移除，后续将通过专门的地理定位服务来处理坐标数据。

---

## 枚举管理系统

### 概述

系统使用 TypeScript 枚举和 `ts-enum-util` 库进行统一的枚举管理，提供类型安全和强大的枚举操作功能。

### 核心枚举类型

| 枚举类型 | TypeScript 类型 | 用途 |
|----------|-----------------|------|
| 事件类型 | `EventType` | 事件分类 |
| 情感倾向 | `Sentiment` | 情感分析 |
| 事件级别 | `EventLevel` | 重要性级别 |
| 机构类型 | `OrganizationType` | 机构分类 |
| 地点类型 | `LocationType` | 地理位置分类 |
| 关系类型 | `RelationshipType` | 实体关系分类 |
| 系统关系 | `SystemRelationshipType` | 系统生成关系 |

### 枚举工具功能

#### 基础验证
```typescript
import { isValidEventType, isValidSentiment } from '../constants/enums';

// 类型安全验证
isValidEventType('macro')    // true
isValidEventType('invalid')  // false
isValidSentiment('positive') // true
```

#### 枚举遍历
```typescript
import { EventTypeEnum, EVENT_TYPE_VALUES, EVENT_TYPE_KEYS } from '../constants/enums';

// 获取所有值
EventTypeEnum.getValues()  // ['macro', 'policy', 'market', ...]

// 获取所有键
EventTypeEnum.getKeys()    // ['MACRO', 'POLICY', 'MARKET', ...]

// 数组形式 (向后兼容)
EVENT_TYPE_VALUES         // ['macro', 'policy', 'market', ...]
EVENT_TYPE_KEYS          // ['MACRO', 'POLICY', 'MARKET', ...]
```

#### 映射和转换
```typescript
import { mapEventType, EVENT_TYPE_DESCRIPTIONS } from '../constants/enums';

// 函数式映射
const descriptions = mapEventType(type => EVENT_TYPE_DESCRIPTIONS[type]);
// 输出: ['宏观经济事件', '政策变化', '市场动态', ...]

// 安全转换
const eventType = getEventTypeByKey('MACRO'); // EventType.MACRO
```

#### 默认值
```typescript
import { 
  DEFAULT_EVENT_TYPE, 
  DEFAULT_SENTIMENT, 
  DEFAULT_EVENT_LEVEL 
} from '../constants/enums';

// 使用默认值
const event = {
  event_type: data.event_type || DEFAULT_EVENT_TYPE,    // 'other'
  sentiment: data.sentiment || DEFAULT_SENTIMENT,       // 'neutral'
  event_level: data.event_level || DEFAULT_EVENT_LEVEL  // 'Level 5'
};
```

#### 向后兼容
```typescript
// 保持与现有代码的兼容性
import { EVENT_TYPES, SENTIMENTS, EVENT_LEVELS } from '../constants/enums';

EVENT_TYPES.MACRO     // 等同于 EventType.MACRO
SENTIMENTS.POSITIVE   // 等同于 Sentiment.POSITIVE
EVENT_LEVELS.LEVEL_1  // 等同于 EventLevel.LEVEL_1
```

### 描述映射

系统提供完整的中文描述映射：

```typescript
import { 
  EVENT_TYPE_DESCRIPTIONS,
  SENTIMENT_DESCRIPTIONS,
  ORGANIZATION_TYPE_DESCRIPTIONS,
  LOCATION_TYPE_DESCRIPTIONS,
  RELATIONSHIP_TYPE_DESCRIPTIONS
} from '../constants/enums';

// 使用示例
EVENT_TYPE_DESCRIPTIONS[EventType.MACRO]           // '宏观经济事件'
SENTIMENT_DESCRIPTIONS[Sentiment.POSITIVE]         // '积极'
ORGANIZATION_TYPE_DESCRIPTIONS[OrganizationType.GOVERNMENT] // '政府机构'
```

---

## 关系类型 (Relationship Types)

### 标准关系类型 (RelationshipType)

| 关系类型 | 中文描述 | 含义 | 示例 |
|----------|----------|------|------|
| `LOCATED_IN` | 位于 | 地理位置关系 | 公司位于某地 |
| `WORKS_FOR` | 供职于 | 工作关系 | 人物在公司工作 |
| `OWNS` | 拥有 | 所有权关系 | 公司拥有子公司 |
| `PARTICIPATES_IN` | 参与 | 参与关系 | 参与某个事件 |
| `MERGES_WITH` | 合并 | 企业合并 | 公司合并 |
| `ACQUIRES` | 收购 | 企业收购 | 公司收购 |
| `SUPPLIES` | 供应 | 供应商关系 | 供应商关系 |
| `PARTNERS_WITH` | 合作 | 合作伙伴关系 | 合作伙伴关系 |
| `SUED_BY` | 被起诉 | 法律诉讼 | 法律诉讼 |
| `REGULATED_BY` | 被监管 | 监管关系 | 监管关系 |
| `INVESTS_IN` | 投资 | 投资关系 | 投资关系 |
| `OTHER` | 其他 | 其他关系类型 | 其他关系类型 |

> **类型安全**: 使用 TypeScript 枚举 `RelationshipType`，支持编译时类型检查和完整的中文描述映射。

### 系统生成的关系类型 (SystemRelationshipType)

| 关系类型 | 含义 | 说明 |
|----------|------|------|
| `DESCRIBES` | 描述 | 新闻描述事件 |
| `INVOLVES` | 涉及 | 新闻涉及公司/机构 |
| `MENTIONS` | 提及 | 新闻提及人物 |
| `LOCATED_AT` | 位于 | 新闻/事件发生地点 |

> **说明**: 系统关系类型由系统自动生成，用于连接新闻节点与各种实体节点。

### 关系属性

所有关系都包含以下通用属性：

| 属性名 | 类型 | 说明 |
|--------|------|------|
| `description` | String | 关系描述 |
| `confidence` | Float | 置信度 (0.0-1.0) |
| `inferred` | Boolean | 是否为推断关系 |
| `newsId` | String | 来源新闻ID |
| `source_news` | String | 源新闻ID (推断关系) |
| `created_at` | DateTime | 创建时间 (UTC) |
| `updated_at` | DateTime | 更新时间 (UTC) |

---

## 数据处理机制

### 优化的时间处理

系统采用简化且统一的时间处理策略：

- **UTC 标准**: 所有时间数据统一存储为 UTC 时区的 ISO 8601 字符串格式
- **原始数据保留**: `raw_time` 字段保存未转换的原始时间数据，便于追踪和调试
- **多格式支持**: 自动识别秒级时间戳、毫秒级时间戳、ISO字符串、自然语言时间等
- **统一格式**: `timestamp` 字段统一为 `YYYY-MM-DDTHH:mm:ss.sssZ` 字符串格式
- **无兜底机制**: 时间解析失败时抛出错误，确保数据质量

### 时间戳管理策略

系统采用数据库级别的统一时间戳管理：

- **Neo4j 原生时间戳**: 所有 `created_at` 和 `updated_at` 字段使用 Neo4j 的 `timestamp()` 函数
- **智能创建时间**: 使用 `CASE WHEN created_at IS NULL THEN timestamp() ELSE created_at END` 确保只在首次创建时设置
- **自动更新时间**: 每次数据更新时自动设置 `updated_at = timestamp()`
- **整数精度**: 避免 JavaScript 浮点数时间戳，确保时间戳为整数毫秒值
- **批量操作优化**: 批量 MERGE 操作中统一处理时间戳，提高性能

**时间戳处理示例**:
```cypher
-- 实体创建/更新
MERGE (entity:EntityType {key: value})
  ON CREATE SET entity += properties, entity.created_at = timestamp(), entity.updated_at = timestamp()
  ON MATCH SET entity += properties, entity.updated_at = timestamp()

-- 关系创建/更新  
MERGE (from)-[r:RELATIONSHIP_TYPE]->(to)
  ON CREATE SET r += properties, r.created_at = timestamp(), r.updated_at = timestamp()
  ON MATCH SET r += properties, r.updated_at = timestamp()
```

**支持的时间格式示例**:
```javascript
// 秒级时间戳
1703175600 → "2023-12-21T16:20:00.000Z"

// 毫秒级时间戳  
1703175600000 → "2023-12-21T16:20:00.000Z"

// ISO字符串
"2023-12-21T13:00:00Z" → "2023-12-21T13:00:00.000Z"

// 自然语言 (转换为UTC)
"今天下午3点" → 当前日期下午15:00的UTC时间
```

### 严格数据验证

系统采用严格的数据验证策略：

- **无兜底数据**: 不允许创建空白或默认的兜底数据
- **必须成功**: 每条新闻数据必须成功解析所有实体和关系
- **5次重试**: AI提取失败时最多重试5次
- **智能修复**: 内置JSON格式错误修复机制
- **时间戳验证**: 确保所有实体和关系都有正确的时间戳字段

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

### 智能Prompt管理

系统采用动态生成的智能提示词（Prompt）来指导AI进行精准的实体提取：

#### 动态枚举值生成
- **统一数据源**: 所有提示词中的枚举值都从 `constants/enums.ts` 动态生成
- **自动同步**: 枚举值修改时，提示词自动更新，确保一致性
- **类型安全**: 避免硬编码带来的不一致问题

```typescript
// 动态生成枚举描述，避免硬编码
const eventTypeList = EVENT_TYPE_VALUES.join(' | ');
const sentimentList = SENTIMENT_VALUES.join(' / ');
const organizationTypeList = ORGANIZATION_TYPE_VALUES.join('/');

// 生成机构类型的详细描述，包含中文说明
const organizationTypeDescriptions = ORGANIZATION_TYPE_VALUES.map(
  type => `${type}(${ORGANIZATION_TYPE_DESCRIPTIONS[type as OrganizationType]})`
).join('、');
```

#### 智能提示词特性
- **专业化指导**: 针对投资领域优化的5W1H原则提取规范
- **严格枚举约束**: 确保AI只使用预定义的枚举值
- **中文描述支持**: 为每种枚举类型提供详细的中文说明
- **示例驱动**: 包含动态生成的标准示例，使用真实枚举值
- **质量控制**: 明确禁止兜底数据，确保提取质量

#### 枚举值验证机制
系统在多个层面确保枚举值的正确性：

1. **Schema验证**: Zod schema使用枚举值数组进行严格验证
2. **修复逻辑**: 无效枚举值自动替换为默认值
3. **类型检查**: TypeScript编译时检查枚举使用的正确性
4. **运行时验证**: 使用 `ts-enum-util` 提供的验证函数

```typescript
// 严格的枚举验证示例
if (!EVENT_TYPE_VALUES.includes(event.event_type)) {
  event.event_type = DEFAULT_EVENT_TYPE;
}

if (!isValidSentiment(event.sentiment)) {
  event.sentiment = DEFAULT_SENTIMENT;
}
```

#### 维护优势
- **集中管理**: 所有枚举定义集中在一处，易于维护
- **版本一致**: 代码、提示词、文档自动保持同步
- **类型提示**: IDE提供完整的智能提示和错误检查
- **国际化支持**: 完整的中英文描述映射系统

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
CREATE RANGE INDEX news_timestamp_range_index IF NOT EXISTS FOR (n:News) ON (n.timestamp);

-- 事件相关索引
CREATE INDEX event_id_idx IF NOT EXISTS FOR (e:Event) ON (e.event_id);
CREATE RANGE INDEX event_timestamp_range_index IF NOT EXISTS FOR (e:Event) ON (e.timestamp);
```

> **索引优化**: 使用范围索引 (RANGE INDEX) 优化时间范围查询性能，特别适用于日期时间范围过滤。

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
ORDER BY e.timestamp DESC 
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

#### 查找某时间段内的事件 (UTC时间)
```cypher
MATCH (e:Event)
WHERE e.timestamp >= "2024-01-01T00:00:00.000Z" 
  AND e.timestamp <= "2024-12-31T23:59:59.999Z"
RETURN e
ORDER BY e.timestamp DESC;
```

### 4. 枚举查询示例

这些查询展示了如何正确使用系统定义的枚举值进行查询：

#### 按特定事件类型查询
```cypher
// 查询宏观经济事件 (使用 EventType.MACRO)
MATCH (e:Event)
WHERE e.event_type = "macro"
RETURN e.event_name, e.significance, e.timestamp
ORDER BY e.significance DESC;

// 查询企业相关事件 (使用 EventType.CORPORATE)
MATCH (e:Event)
WHERE e.event_type = "corporate"
RETURN e.event_name, e.sentiment, e.magnitude
ORDER BY e.timestamp DESC;
```

#### 按情感倾向查询
```cypher
// 查询积极情感的事件 (使用 Sentiment.POSITIVE)
MATCH (e:Event)
WHERE e.sentiment = "positive"
RETURN e.event_type, count(e) as positiveCount
ORDER BY positiveCount DESC;

// 查询中性情感的政策事件
MATCH (e:Event)
WHERE e.event_type = "policy" AND e.sentiment = "neutral"
RETURN e.event_name, e.event_description, e.timestamp;
```

#### 按事件级别查询
```cypher
// 查询超级事件 (Level 1)
MATCH (e:Event)
WHERE e.event_level = "Level 1"
RETURN e.event_name, e.event_type, e.significance, e.timestamp
ORDER BY e.timestamp DESC;

// 查询行业重大事件 (Level 3)
MATCH (e:Event)
WHERE e.event_level = "Level 3" AND e.event_type = "industry"
RETURN e.event_name, e.sentiment, e.magnitude
ORDER BY e.magnitude ASC;
```

#### 按机构类型查询
```cypher
// 查询政府机构相关事件
MATCH (o:Organization)-[:PARTICIPATES_IN]-(e:Event)
WHERE o.type = "government"
RETURN o.organization_name, e.event_name, e.event_type
ORDER BY e.timestamp DESC;

// 查询金融机构
MATCH (o:Organization)
WHERE o.type = "fin_inst"
RETURN o.organization_name, o.country
ORDER BY o.organization_name;
```

#### 按地点类型查询
```cypher
// 查询城市相关的事件
MATCH (l:Location)-[:LOCATED_AT]-(e:Event)
WHERE l.type = "city"
RETURN l.location_name, l.country, count(e) as eventCount
ORDER BY eventCount DESC;

// 查询国家级事件
MATCH (l:Location)-[:LOCATED_AT]-(e:Event)
WHERE l.type = "country"
RETURN l.location_name, e.event_type, count(e) as eventCount
ORDER BY eventCount DESC;
```

#### 组合枚举查询
```cypher
// 查询负面的宏观经济超级事件
MATCH (e:Event)
WHERE e.event_type = "macro" 
  AND e.sentiment = "negative" 
  AND e.event_level = "Level 1"
RETURN e.event_name, e.magnitude, e.timestamp
ORDER BY e.magnitude ASC;

// 查询政策相关的Level 2事件，按重要性排序
MATCH (e:Event)
WHERE e.event_type = "policy" 
  AND e.event_level = "Level 2"
RETURN e.event_name, e.significance, e.sentiment
ORDER BY e.significance DESC;
```

> **最佳实践**: 在查询中使用枚举值时，建议使用参数化查询来避免硬编码：
> ```cypher
> // 推荐: 使用参数
> MATCH (e:Event) WHERE e.event_type = $eventType RETURN e;
> 
> // 在应用代码中传递枚举值
> session.run(query, { eventType: EventType.MACRO });
> ```

### 5. 情感分析查询

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

### 6. 网络分析查询

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

### 7. 时间序列分析 (UTC时间)

#### 事件时间线
```cypher
MATCH (e:Event)
WHERE e.timestamp >= "2024-01-01T00:00:00.000Z"
RETURN e.timestamp as date,
       e.event_name as event,
       e.significance as importance
ORDER BY e.timestamp;
```

#### 新闻发布频率 (UTC时间)
```cypher
MATCH (n:News)
RETURN date(n.timestamp) as date,
       count(n) as newsCount
ORDER BY date;
```

#### 按小时统计新闻分布 (UTC时间)
```cypher
MATCH (n:News)
RETURN date(n.timestamp) as date,
       n.timestamp.hour as hour,
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
RETURN e.timestamp as eventDate,
       n.timestamp as newsTime,
       n.title as newsTitle,
       e.significance as importance
ORDER BY e.timestamp, n.timestamp;
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

#### 查找异常活跃的实体 (最近7天)
```cypher
MATCH (entity)-[:PARTICIPATES_IN]-(e:Event)<-[:DESCRIBES]-(n:News)
WHERE n.timestamp >= datetime() - duration('P7D')  // 最近7天 (UTC)
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
2. **范围索引**: 使用 RANGE INDEX 优化时间范围查询
3. **查询优化**: 使用 `LIMIT` 限制结果集大小
4. **批量操作**: 大数据量操作时使用批量处理
5. **定期维护**: 定期清理孤立节点和重复数据
6. **枚举优化**: 使用枚举常量而非字符串字面量进行查询
   - ✅ 推荐: `WHERE e.event_type = $eventType` (使用 EventType.MACRO)
   - ❌ 避免: `WHERE e.event_type = 'macro'` (硬编码字符串)
7. **类型验证**: 在数据写入前使用枚举验证函数，避免无效数据
8. **时间戳优化**: 使用 Neo4j 原生 `timestamp()` 函数，避免 JavaScript 浮点数精度问题
   - ✅ 推荐: `SET entity.updated_at = timestamp()`
   - ❌ 避免: `SET entity.updated_at = $jsTimestamp` (JavaScript 时间戳)

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
// 查看最新的 10 条新闻 (UTC时间)
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

#### 时间范围查询 (UTC时间)
```cypher
// 查找指定时间范围内的新闻和事件
MATCH (n:News)-[:DESCRIBES]->(e:Event)
WHERE n.timestamp >= "2024-01-01T00:00:00.000Z" AND n.timestamp <= "2024-12-31T23:59:59.999Z"
RETURN n.title, e.event_name, e.sentiment, n.timestamp
ORDER BY n.timestamp DESC;

// 查找今天的新闻 (UTC时间)
MATCH (n:News)
WHERE date(n.timestamp) = date(datetime())
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

### 5. TypeScript 枚举集成示例

#### 使用枚举进行类型安全开发
```typescript
import { 
  EventType, 
  Sentiment, 
  EventLevel,
  RelationshipType,
  isValidEventType,
  EVENT_TYPE_DESCRIPTIONS 
} from '../constants/enums';

// 类型安全的事件创建
function createEvent(data: any) {
  return {
    event_id: data.id,
    event_name: data.name,
    event_type: isValidEventType(data.type) ? data.type : EventType.OTHER,
    sentiment: data.sentiment || Sentiment.NEUTRAL,
    event_level: data.level || EventLevel.LEVEL_5,
    // ... 其他属性
  };
}

// 枚举映射和描述
function getEventTypeDescription(type: EventType): string {
  return EVENT_TYPE_DESCRIPTIONS[type];
}

// 验证和过滤
function filterEventsByType(events: Event[], type: EventType) {
  return events.filter(event => event.event_type === type);
}
```

#### 查询构建器示例
```typescript
import { EventType, Sentiment, RelationshipType } from '../constants/enums';

class CypherQueryBuilder {
  // 类型安全的事件查询
  static getEventsByType(eventType: EventType): string {
    return `
      MATCH (e:Event {event_type: $eventType})
      RETURN e
      ORDER BY e.timestamp DESC
    `;
  }

  // 情感分析查询
  static getEventsBySentiment(sentiment: Sentiment): string {
    return `
      MATCH (e:Event {sentiment: $sentiment})
      RETURN e.event_type, count(e) as count
      ORDER BY count DESC
    `;
  }

  // 关系查询
  static getRelationshipsByType(relType: RelationshipType): string {
    return `
      MATCH ()-[r:${relType}]-()
      RETURN r, count(r) as count
    `;
  }
}
```

#### 数据验证示例
```typescript
import { 
  isValidEventType, 
  isValidSentiment, 
  isValidEventLevel,
  DEFAULT_EVENT_TYPE,
  DEFAULT_SENTIMENT 
} from '../constants/enums';

function validateAndNormalizeEvent(rawEvent: any) {
  const validated = {
    event_type: isValidEventType(rawEvent.event_type) 
      ? rawEvent.event_type 
      : DEFAULT_EVENT_TYPE,
    
    sentiment: isValidSentiment(rawEvent.sentiment) 
      ? rawEvent.sentiment 
      : DEFAULT_SENTIMENT,
      
    event_level: isValidEventLevel(rawEvent.event_level) 
      ? rawEvent.event_level 
      : EventLevel.LEVEL_5,
  };
  
  return validated;
}
```

#### 时间戳处理最佳实践
```typescript
// ✅ 推荐: 在 Neo4jService 中使用数据库原生时间戳
const cypher = `
  MERGE (entity:EntityType {key: value})
    ON CREATE SET entity += properties, entity.created_at = timestamp(), entity.updated_at = timestamp()
    ON MATCH SET entity += properties, entity.updated_at = timestamp()
`;

// ✅ 推荐: 在 EntityService 中使用智能创建时间逻辑
const cypher = `
  MERGE (entity:EntityType {key: value})
  SET entity.property = value,
      entity.created_at = CASE WHEN entity.created_at IS NULL THEN timestamp() ELSE entity.created_at END,
      entity.updated_at = timestamp()
`;

// ❌ 避免: 在 EntityExtractionService 中声明时间戳字段
// 不要这样做，让数据库统一处理时间戳
const entity = {
  name: 'entity_name',
  // created_at: getCurrentTimestamp(),  // 不要这样做
  // updated_at: getCurrentTimestamp(),  // 不要这样做
};
```

### 6. 集成到其他应用

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

# 枚举相关操作
npm run cli enum-stats           # 查看枚举使用统计
npm run cli validate-enums       # 验证数据库中的枚举值
npm run cli fix-invalid-enums    # 修复无效的枚举值

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
4. 使用范围索引优化时间查询

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
1. 确认所有时间数据都已转换为UTC时间
2. 检查原始数据的时间格式是否正确
3. 系统支持多种时间格式，通常能自动识别和转换
4. 如有问题，查看 TimeParser 的处理日志
5. 检查时间戳字段是否为整数毫秒值，避免浮点数精度问题

### Q: 如何进行时区转换？
A: 
所有时间都以UTC存储，如需本地时间可在查询时转换：
```cypher
// 转换为北京时间显示
MATCH (n:News)
RETURN n.title, 
       datetime(n.timestamp + duration('PT8H')) as beijing_time
ORDER BY n.timestamp DESC;
```

### Q: 实体缺少 updated_at 字段怎么办？
A: 
1. 检查是否使用了最新的时间戳处理逻辑
2. 确认 Neo4jService 中的 MERGE 操作正确设置了时间戳
3. 验证 EntityExtractionService 中没有重复声明时间戳字段
4. 确保所有实体类型都使用统一的 `ON CREATE` 和 `ON MATCH` 逻辑
5. 检查数据库中的时间戳字段是否为整数毫秒值

### Q: 如何正确使用新的枚举系统？
A: 
1. **TypeScript 开发**: 直接使用枚举类型，享受完整的类型检查
```typescript
import { EventType, Sentiment } from '../constants/enums';
const event = { event_type: EventType.MACRO, sentiment: Sentiment.POSITIVE };
```

2. **JavaScript 开发**: 使用枚举值字符串
```javascript
const { EventType, Sentiment } = require('../constants/enums');
const event = { event_type: EventType.MACRO, sentiment: Sentiment.POSITIVE };
```

3. **验证未知数据**: 使用验证函数
```typescript
import { isValidEventType, DEFAULT_EVENT_TYPE } from '../constants/enums';
const eventType = isValidEventType(data.type) ? data.type : DEFAULT_EVENT_TYPE;
```

### Q: 如何获取枚举的中文描述？
A: 
使用描述映射对象：
```typescript
import { EVENT_TYPE_DESCRIPTIONS, EventType } from '../constants/enums';
const description = EVENT_TYPE_DESCRIPTIONS[EventType.MACRO]; // '宏观经济事件'
```

### Q: 新枚举系统与旧代码兼容吗？
A: 
完全兼容。系统提供向后兼容的常量对象：
```typescript
// 旧代码仍然可以正常工作
import { EVENT_TYPES, SENTIMENTS } from '../constants/enums';
const type = EVENT_TYPES.MACRO;    // 等同于 EventType.MACRO
const sentiment = SENTIMENTS.POSITIVE; // 等同于 Sentiment.POSITIVE
```

### Q: 如何遍历所有枚举值？
A: 
使用 ts-enum-util 提供的方法：
```typescript
import { EventTypeEnum, EVENT_TYPE_VALUES } from '../constants/enums';

// 方法1: 使用枚举工具
EventTypeEnum.getValues().forEach(type => console.log(type));

// 方法2: 使用数组常量
EVENT_TYPE_VALUES.forEach(type => console.log(type));

// 方法3: 函数式映射
const descriptions = mapEventType(type => EVENT_TYPE_DESCRIPTIONS[type]);
```

### Q: 如何正确评估事件级别？
A: 
事件级别评估需要综合考虑多个维度：

1. **影响范围**: 
   - Level 1: 全球性影响
   - Level 2: 国家/地区级影响
   - Level 3: 行业级影响
   - Level 4: 企业/地方级影响
   - Level 5: 信息性影响

2. **市场反应强度**:
   - 是否引发恐慌或大幅波动
   - 是否具有系统性风险
   - 对投资决策的影响程度

3. **特殊规则**:
   - 战争相关事件通常为 Level 1
   - 中美欧央行政策为 Level 1，其他央行为 Level 2
   - 非金融新闻需要下调一级
   - 谨慎使用 Level 1，仅限全球重大事件

4. **实例参考**:
```typescript
// Level 1 示例
"美联储意外加息100基点" → Level 1 (全球央行政策)
"俄乌战争爆发" → Level 1 (突发战争)

// Level 2 示例  
"日本央行调整货币政策" → Level 2 (非中美欧央行)
"苹果公司财报暴雷" → Level 2 (全球大企业重大事件)

// Level 3 示例
"行业龙头并购案" → Level 3 (行业重大事件)
"某公司破产" → Level 3 (行业影响)
```

### Q: 智能Prompt如何确保提取质量？
A: 
系统通过多层机制确保数据质量：

1. **动态枚举同步**: 提示词中的枚举值从代码自动生成，避免不一致
2. **严格Schema验证**: 使用Zod严格验证AI返回的数据格式
3. **多重修复机制**: 自动修复常见JSON格式错误
4. **5次重试策略**: 失败时最多重试5次，提高成功率
5. **零兜底政策**: 不允许创建空白或默认数据，确保质量
6. **失败追踪**: 失败的新闻保存到专门目录，便于分析改进

---

## 更新日志

- **v5.2.0**: 时间戳管理优化
  - **统一时间戳处理**: 所有实体和关系的时间戳由 Neo4j 数据库统一处理
  - **Neo4j 原生时间戳**: 使用 `timestamp()` 函数替代 JavaScript 时间戳，避免浮点数精度问题
  - **智能创建时间**: 使用 `CASE WHEN created_at IS NULL THEN timestamp() ELSE created_at END` 确保只在首次创建时设置
  - **批量操作优化**: 优化批量 MERGE 操作的时间戳处理逻辑
  - **数据一致性**: 确保所有实体类型都有正确的 `created_at` 和 `updated_at` 字段
  - **性能提升**: 减少数据传输量，提高批量操作性能
  - **文档更新**: 新增时间戳管理策略章节和常见问题解答

- **v5.1.0**: 事件级别定义优化与文档完善
  - **事件级别体系**: 详细定义了5级事件分类体系，提供清晰的评估标准
  - **级别划分**: Level 1-5 每级都有具体的适用场景和判断标准
  - **特殊规则**: 新增非金融相关新闻的特殊处理规则
  - **影响分类**: 加强了对全球性事件、国家级事件、行业事件的区分
  - **智能Prompt**: 新增智能提示词管理章节，介绍动态枚举生成机制
  - **查询示例**: 新增枚举查询示例章节，展示正确的枚举使用方法
  - **常见问题**: 新增事件级别评估和智能Prompt的详细问答
  - **最佳实践**: 提供参数化查询和类型安全的开发建议
  - **文档结构**: 优化文档组织结构，提升可读性和实用性
- **v5.0.0**: 枚举系统重构
  - 使用 TypeScript 枚举替代常量对象
  - 集成 `ts-enum-util` 库提供强大的枚举操作
  - 新增类型安全的验证和转换函数
  - 完善的中文描述映射系统
  - 向后兼容的常量对象支持
  - 函数式枚举映射和遍历工具
  - 标准化的默认值常量
- **v4.2.0**: 全面时间字段统一
  - Event 节点也使用 `timestamp` 字段，取消 `event_date`
  - 所有实体节点时间字段完全统一
  - 优化事件时间索引，提升查询性能
  - 简化时间处理逻辑，降低系统复杂度
- **v4.1.0**: 时间字段优化
  - 合并 `timestamp` 和 `time` 字段，简化数据结构
  - 新增 `raw_time` 字段保存原始时间数据
  - `timestamp` 字段统一为 UTC ISO 8601 字符串格式
  - 提升数据可追溯性和调试能力
- **v4.0.0**: 时间处理优化
  - 移除冗余的Time节点，简化数据结构
  - 统一使用UTC时区存储所有时间数据
  - 优化时间索引，使用范围索引提升查询性能
  - 简化时间解析逻辑，提高系统稳定性
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

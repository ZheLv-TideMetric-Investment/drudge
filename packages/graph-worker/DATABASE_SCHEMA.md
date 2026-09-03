# Graph Worker Neo4j 数据结构

本文记录当前 Graph Worker 实际读写的 Neo4j 模型、约束、索引和变更边界。它不是独立设计稿；代码事实来源为：

- `src/types/index.ts`：节点和提取结果类型。
- `src/services/EntityService.ts`：新闻、实体和新闻归属关系。
- `src/services/RelationshipService.ts`：业务关系与推断关系。
- `src/services/Neo4jService.ts`：约束、索引和 MERGE 模板。
- `../../shared/common/constants/enums.js`：共享枚举值。

修改上述事实时必须同步本文和相关测试。

## 1. 模型概览

```text
(News)-[:DESCRIBES]->(Event)
   |
   +--[:INVOLVES]->(Company)
   +--[:MENTIONS]->(Person)
   +--[:INVOLVES]->(Organization)
   +--[:LOCATED_AT]->(Location)

(实体)-[:LLM 提取的业务关系]->(实体)
(Person)-[:WORKS_FOR {inferred: true}]->(Company)
(Company|Person|Organization)-[:LOCATED_IN {inferred: true}]->(Location)
```

当前共六类节点。`MERGE` 的键同时是逻辑主键和唯一约束字段。

## 2. 节点

### 2.1 `News`

主键：`id`。

| 属性          | 类型    | 说明                        |
| ------------- | ------- | --------------------------- |
| `id`          | string  | 来源新闻 ID                 |
| `title`       | string  | 标题                        |
| `content`     | string  | 正文                        |
| `timestamp`   | string  | 规范化 UTC ISO 时间         |
| `raw_time`    | unknown | 来源原始时间                |
| `source`      | string  | `futu_live` 或 `awtmt_live` |
| `url`         | string  | 原文链接，可能为空          |
| `level`       | number  | 从 `news_level` 解析的 1–5  |
| `news_level`  | string  | `Level 1`–`Level 5`         |
| `processed`   | boolean | 成功写入新闻节点时为 `true` |
| `processedAt` | integer | Neo4j `timestamp()`         |
| `created_at`  | integer | 首次写入时间                |
| `updated_at`  | integer | 最近写入时间                |

新闻节点在实体写入前创建。相同 `id` 再处理时更新业务字段但保留首次 `created_at`。

### 2.2 `Event`

主键：`event_id`。

| 属性                | 类型    | 说明                              |
| ------------------- | ------- | --------------------------------- |
| `event_id`          | string  | 事件 ID                           |
| `event_name`        | string  | 事件名称                          |
| `event_description` | string  | 事件描述                          |
| `event_type`        | enum    | 事件类型                          |
| `significance`      | number  | 当前提取契约为 1–4                |
| `sentiment`         | enum    | `positive`、`negative`、`neutral` |
| `magnitude`         | number  | 当前契约为 -1.0–1.0               |
| `event_level`       | enum    | `Level 1`–`Level 5`               |
| `timestamp`         | string  | UTC ISO 时间                      |
| `raw_time`          | unknown | 原始时间                          |
| `created_at`        | integer | 首次写入时间                      |
| `updated_at`        | integer | 最近写入时间                      |

### 2.3 `Company`

主键：`company_name`。

属性：`ticker`、`industry`、`market`、`country`、`aliases[]`、`created_at`、`updated_at`。

### 2.4 `Person`

主键：`person_name`。

属性：`title`、`company`、`nationality`、`created_at`、`updated_at`。

### 2.5 `Organization`

主键：`organization_name`。

属性：`type`、`country`、`created_at`、`updated_at`。

### 2.6 `Location`

主键：`location_name`。

属性：`type`、`country`、`region`、`coordinates`、`latitude`、`longitude`、`created_at`、`updated_at`。

批量写入会从 `coordinates.latitude` 和 `coordinates.longitude` 同步扁平字段，供查询使用。

### 2.7 更新语义

除 `News` 外的实体通过 `SET node += extraction` 合并。含义是：

- 模型返回的属性会写入或覆盖同名属性。
- 模型本次没有返回的旧属性通常继续保留。
- 显式返回的空值可能影响已有属性，调整提取规范时要做兼容测试。
- `created_at` 只在创建时设置，`updated_at` 每次匹配时更新。

实体名称是当前唯一键。名称规范化规则变化可能产生重复节点或错误合并，属于 schema 迁移。

## 3. 枚举

枚举唯一来源是 `@drudge/common`。

### 3.1 事件

`EventType`：

```text
macro, policy, market, corporate, industry, tech, geopolitics, other
```

`Sentiment`：

```text
positive, negative, neutral
```

`EventLevel`：

```text
Level 1, Level 2, Level 3, Level 4, Level 5
```

### 3.2 机构与地点

`OrganizationType`：

```text
government, regulator, intl_org, fin_inst, industry_assoc, other
```

`LocationType`：

```text
country, region, city, facility, other
```

### 3.3 业务关系

LLM 可返回：

```text
LOCATED_IN
WORKS_FOR
OWNS
PARTICIPATES_IN
MERGES_WITH
ACQUIRES
SUPPLIES
PARTNERS_WITH
SUED_BY
REGULATED_BY
INVESTS_IN
OTHER
```

关系类型会先转为大写，再按一组兼容映射转换；不在允许列表或映射中时回退为 `OTHER`。

## 4. 关系

### 4.1 新闻归属关系

| 起点   | 关系         | 终点           | 默认属性          |
| ------ | ------------ | -------------- | ----------------- |
| `News` | `DESCRIBES`  | `Event`        | `confidence: 0.9` |
| `News` | `INVOLVES`   | `Company`      | `confidence: 0.8` |
| `News` | `MENTIONS`   | `Person`       | `confidence: 0.8` |
| `News` | `INVOLVES`   | `Organization` | `confidence: 0.8` |
| `News` | `LOCATED_AT` | `Location`     | `confidence: 0.7` |

关系通过起止节点类型、键和值 `MERGE`。关系首次创建设置 `created_at`，再次匹配设置 `updated_at`。

### 4.2 LLM 业务关系

`RelationshipService` 根据实体名称定位任意实体，写入：

- `description`
- `confidence`，缺省 `0.8`
- `newsId`
- `created_at`、`updated_at`

单条业务关系失败当前只记录警告，批量路径会继续处理其他关系。

### 4.3 推断关系

同一新闻内共同出现的实体会产生：

| 起点           | 关系         | 终点       |
| -------------- | ------------ | ---------- |
| `Person`       | `WORKS_FOR`  | `Company`  |
| `Company`      | `LOCATED_IN` | `Location` |
| `Person`       | `LOCATED_IN` | `Location` |
| `Organization` | `LOCATED_IN` | `Location` |

推断关系属性为：

```text
inferred = true
confidence = 0.6
source_news = <news id>
created_at / updated_at
```

“同一新闻共同出现”不等于真实从属或所在地关系，因此消费者必须读取 `inferred`，不能把推断边当作来源直接陈述的事实。

## 5. 约束和索引

### 5.1 唯一约束

服务初始化时以 `IF NOT EXISTS` 创建：

| 节点           | 唯一字段            |
| -------------- | ------------------- |
| `News`         | `id`                |
| `Event`        | `event_id`          |
| `Company`      | `company_name`      |
| `Person`       | `person_name`       |
| `Organization` | `organization_name` |
| `Location`     | `location_name`     |

创建约束前，代码会尝试删除若干同名普通索引，以避免冲突。该过程属于当前运行时初始化行为，不应复制到其他脚本。

### 5.2 索引

知识图谱服务初始化时创建：

- `News.id`、`News.timestamp`（range）、`News.news_level`
- `Event.event_id`、`Event.event_type`、`Event.timestamp`（range）、`Event.event_level`
- `Company.company_name`
- `Person.person_name`
- `Organization.organization_name`
- `Location.location_name`

主键字段同时存在唯一约束语义。改变名称、字段或索引类型前必须在目标 Neo4j 版本上验证现存 schema，不能仅凭本文执行删除和重建。

## 6. 写入顺序与一致性

单条新闻的当前顺序：

1. 查询 `News.processed`，已处理则跳过。
2. LLM 提取结构化结果。
3. 写 `News`。
4. 批量 `MERGE` Event/Company/Person/Organization/Location。
5. 写新闻归属关系。
6. 写 LLM 业务关系。
7. 写共现推断关系。

这些步骤当前不是一个跨服务原子事务。尤其在批量路径中，实体写入成功但业务关系写入失败时，新闻仍可能被计为成功。修复该行为需要明确事务边界、重试与历史数据补全方案，不能只把 catch 改成 throw。

文件消费位点另由 `FileScanner` 管理，不存储在 Neo4j。

## 7. 检查方式与 CLI 副作用

先构建 CLI：

```bash
pnpm --filter @drudge/graph-worker run build
```

Graph CLI 的 `db-health`、`db-stats` 和 `stats` 名称看起来像只读命令，但它们会初始化 `KnowledgeGraphService`。初始化过程会确保约束和索引，因此可能写 schema，不是严格只读检查。未经 schema 操作授权，不要在生产环境运行这些 CLI 命令：

```bash
pnpm --filter @drudge/graph-worker run cli db-health
pnpm --filter @drudge/graph-worker run cli db-stats
pnpm --filter @drudge/graph-worker run cli stats
```

需要只读检查时，应通过已批准的 Neo4j Browser 或 `cypher-shell` 连接执行明确的只读 Cypher。常用查询：

```cypher
MATCH (n)
RETURN labels(n) AS labels, count(*) AS count
ORDER BY count DESC;
```

```cypher
MATCH ()-[r]->()
RETURN type(r) AS type, count(*) AS count
ORDER BY count DESC;
```

```cypher
SHOW CONSTRAINTS;
```

```cypher
SHOW INDEXES;
```

不要把 `db-clean*`、`clean-failed`、`setup-db`、`create-indexes` 或数据库重建命令当作健康检查。它们会写 schema 或删除数据，需要独立授权、备份与回滚。

## 8. Schema 变更流程

新增、删除、重命名节点标签、主键、属性、关系、约束或索引时：

1. 只读导出现有节点、关系、约束、索引和异常数据统计。
2. 写明旧读新写、双读或一次迁移的兼容策略。
3. 提供幂等的前滚迁移和验证查询。
4. 说明处理位点、失败新闻、Graph API 和 Web 查询的影响。
5. 增加 Neo4jService、EntityService、RelationshipService 和查询层相关测试。
6. 更新共享类型、枚举、提示词以及本文。
7. 在隔离 Neo4j 验证，再生成生产 CHANGE_ID。
8. 明确停止条件和可执行回滚；没有可恢复备份时不做破坏性迁移。

不允许用“删库后重新跑历史文件”替代迁移方案。

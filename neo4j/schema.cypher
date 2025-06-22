// ===== 新闻处理与图数据库存储系统 - Neo4j Schema =====
// 基于新闻六要素（5W1H）的图数据库设计

// ===== 节点约束 =====
// 事件节点约束
CREATE CONSTRAINT event_id IF NOT EXISTS FOR (e:Event) REQUIRE e.id IS UNIQUE;

// 公司节点约束
CREATE CONSTRAINT company_name IF NOT EXISTS FOR (c:Company) REQUIRE c.company_name IS UNIQUE;

// 人物节点约束
CREATE CONSTRAINT person_name IF NOT EXISTS FOR (p:Person) REQUIRE p.person_name IS UNIQUE;

// 机构节点约束
CREATE CONSTRAINT organization_name IF NOT EXISTS FOR (o:Organization) REQUIRE o.organization_name IS UNIQUE;

// 地点节点约束
CREATE CONSTRAINT location_name IF NOT EXISTS FOR (l:Location) REQUIRE l.location_name IS UNIQUE;

// 时间节点约束
CREATE CONSTRAINT time_timestamp IF NOT EXISTS FOR (t:Time) REQUIRE t.timestamp IS UNIQUE;

// 新闻节点约束
CREATE CONSTRAINT news_id IF NOT EXISTS FOR (n:News) REQUIRE n.id IS UNIQUE;

// ===== 节点索引 =====
// 事件节点索引
CREATE INDEX event_name IF NOT EXISTS FOR (e:Event) ON (e.event_name);
CREATE INDEX event_type IF NOT EXISTS FOR (e:Event) ON (e.event_type);
CREATE INDEX event_date IF NOT EXISTS FOR (e:Event) ON (e.event_date);
CREATE INDEX event_significance IF NOT EXISTS FOR (e:Event) ON (e.significance);
CREATE INDEX event_level IF NOT EXISTS FOR (e:Event) ON (e.event_level);

// 公司节点索引
CREATE INDEX company_ticker IF NOT EXISTS FOR (c:Company) ON (c.ticker);
CREATE INDEX company_industry IF NOT EXISTS FOR (c:Company) ON (c.industry);

// 人物节点索引
CREATE INDEX person_role IF NOT EXISTS FOR (p:Person) ON (p.role);

// 机构节点索引
CREATE INDEX organization_type IF NOT EXISTS FOR (o:Organization) ON (o.type);

// 地点节点索引
CREATE INDEX location_country IF NOT EXISTS FOR (l:Location) ON (l.country);

// 时间节点索引
CREATE INDEX time_date IF NOT EXISTS FOR (t:Time) ON (t.date);
CREATE INDEX time_hour IF NOT EXISTS FOR (t:Time) ON (t.hour);

// 新闻节点索引
CREATE INDEX news_timestamp IF NOT EXISTS FOR (n:News) ON (n.timestamp);
CREATE INDEX news_source IF NOT EXISTS FOR (n:News) ON (n.source);
CREATE INDEX news_level IF NOT EXISTS FOR (n:News) ON (n.news_level);

// ===== 关系索引 =====
CREATE INDEX occurred_in_date IF NOT EXISTS FOR ()-[r:OCCURRED_IN]->() ON (r.date);
CREATE INDEX involves_role IF NOT EXISTS FOR ()-[r:INVOLVES]->() ON (r.role);
CREATE INDEX occurred_at_location_type IF NOT EXISTS FOR ()-[r:OCCURRED_AT]->() ON (r.location_type);
CREATE INDEX happened_at_duration IF NOT EXISTS FOR ()-[r:HAPPENED_AT]->() ON (r.duration);

// ===== 全文搜索索引 =====
CALL db.index.fulltext.createNodeIndex("event_search", ["Event"], ["event_name", "event_description"]);
CALL db.index.fulltext.createNodeIndex("news_search", ["News"], ["title", "content"]);
CALL db.index.fulltext.createNodeIndex("company_search", ["Company"], ["company_name"]);
CALL db.index.fulltext.createNodeIndex("person_search", ["Person"], ["person_name"]);

// ===== 示例数据创建（用于测试） =====
// 创建示例时间节点
MERGE (time1:Time {
  timestamp: datetime('2025-01-19T10:00:00Z'),
  date: '2025-01-19',
  hour: 10,
  time_of_day: '上午'
});

// 创建示例地点节点
MERGE (china:Location {
  location_name: 'China',
  country: 'China'
});

MERGE (beijing:Location {
  location_name: 'Beijing',
  country: 'China'
});

// 创建地点关系
MERGE (beijing)-[:BELONGS_TO]->(china);

// 创建示例公司节点
MERGE (apple:Company {
  company_name: 'Apple Inc.',
  ticker: 'AAPL',
  industry: 'Technology'
});

// 创建示例人物节点
MERGE (cook:Person {
  person_name: 'Tim Cook',
  role: 'CEO'
});

// 创建人物与公司关系
MERGE (cook)-[:CEO_OF]->(apple);

// ===== 自定义存储过程 =====
// 查找相似事件的存储过程
CALL apoc.custom.asProcedure(
  'findSimilarEvents',
  'MATCH (e1:Event {event_name: $eventName})
   MATCH (e2:Event)
   WHERE e1 <> e2 AND (
     e2.event_name CONTAINS $eventName OR
     e2.event_description CONTAINS $eventName
   )
   RETURN e2 LIMIT $limit',
  'read',
  [['e2', 'NODE']],
  [['eventName', 'STRING'], ['limit', 'INTEGER']]
);

// 查找公司相关事件的存储过程
CALL apoc.custom.asProcedure(
  'getCompanyEvents',
  'MATCH (c:Company {company_name: $companyName})<-[:OCCURRED_IN]-(e:Event)
   RETURN e ORDER BY e.event_date DESC LIMIT $limit',
  'read',
  [['e', 'NODE']],
  [['companyName', 'STRING'], ['limit', 'INTEGER']]
);

// 查找某日期所有事件的存储过程
CALL apoc.custom.asProcedure(
  'getDayEvents',
  'MATCH (t:Time {date: $date})<-[:HAPPENED_AT]-(e:Event)
   RETURN e ORDER BY t.timestamp',
  'read',
  [['e', 'NODE']],
  [['date', 'STRING']]
);

// ===== 数据清理和维护 =====
// 清理重复实体的存储过程
CALL apoc.custom.asProcedure(
  'mergeDuplicateEntities',
  'MATCH (n1:Company), (n2:Company)
   WHERE n1.company_name = n2.company_name AND id(n1) < id(n2)
   WITH n1, n2
   CALL apoc.refactor.mergeNodes([n1, n2], {properties: "combine"})
   YIELD node
   RETURN node',
  'write',
  [['node', 'NODE']],
  []
);

// ===== 视图定义 =====
// 紧急新闻视图（Level 1）
CREATE OR REPLACE VIEW critical_news_events AS
MATCH (n:News {news_level: 'Level 1'})-[:REPORTED_IN]-(e:Event)
RETURN e, n
ORDER BY n.timestamp DESC;

// 热门公司视图
CREATE OR REPLACE VIEW popular_companies AS
MATCH (c:Company)<-[:OCCURRED_IN]-(e:Event)
WITH c, count(e) as event_count
WHERE event_count >= 5
RETURN c, event_count
ORDER BY event_count DESC;

// 最近事件视图
CREATE OR REPLACE VIEW recent_events AS
MATCH (e:Event)
WHERE e.event_date >= date() - duration('P7D')
RETURN e
ORDER BY e.event_date DESC; 
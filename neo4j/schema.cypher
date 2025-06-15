// 创建约束
CREATE CONSTRAINT article_id IF NOT EXISTS FOR (a:Article) REQUIRE a.id IS UNIQUE;
CREATE CONSTRAINT person_name IF NOT EXISTS FOR (p:Person) REQUIRE p.name IS UNIQUE;
CREATE CONSTRAINT location_name IF NOT EXISTS FOR (l:Location) REQUIRE l.name IS UNIQUE;
CREATE CONSTRAINT event_id IF NOT EXISTS FOR (e:Event) REQUIRE e.id IS UNIQUE;

// 创建索引
CREATE INDEX article_fingerprint IF NOT EXISTS FOR (a:Article) ON (a.fingerprint);
CREATE INDEX article_published_at IF NOT EXISTS FOR (a:Article) ON (a.publishedAt);
CREATE INDEX article_type IF NOT EXISTS FOR (a:Article) ON (a.type);
CREATE INDEX article_importance IF NOT EXISTS FOR (a:Article) ON (a.importance);
CREATE INDEX event_type IF NOT EXISTS FOR (e:Event) ON (e.type);
CREATE INDEX event_importance IF NOT EXISTS FOR (e:Event) ON (e.importance);

// 创建全文索引
CALL db.index.fulltext.createNodeIndex("article_content", ["Article"], ["title", "content"]);
CALL db.index.fulltext.createNodeIndex("event_content", ["Event"], ["what", "how"]);

// 创建关系索引
CREATE INDEX appears_in IF NOT EXISTS FOR ()-[r:APPEARS_IN]->() ON (r);
CREATE INDEX mentioned_in IF NOT EXISTS FOR ()-[r:MENTIONED_IN]->() ON (r);
CREATE INDEX reported_in IF NOT EXISTS FOR ()-[r:REPORTED_IN]->() ON (r);

// 创建触发器（用于自动生成事件ID）
CALL apoc.trigger.add('generate_event_id', 
    'UNWIND $createdNodes AS n
     WHERE labels(n)[0] = "Event" AND NOT EXISTS(n.id)
     SET n.id = apoc.create.uuid()',
    {phase: 'before'});

// 创建存储过程
CALL apoc.custom.asProcedure(
    'find_similar_articles',
    'MATCH (a:Article)
     WHERE a.fingerprint = $fingerprint
     RETURN a',
    'read',
    [['a', 'NODE']],
    [['fingerprint', 'STRING']]
);

CALL apoc.custom.asProcedure(
    'find_related_entities',
    'MATCH (e:Event)-[:REPORTED_IN]->(a:Article)
     WHERE a.id = $articleId
     MATCH (e)<-[:PARTICIPATED_IN]-(p:Person)
     MATCH (e)<-[:OCCURRED_IN]-(l:Location)
     RETURN p, l',
    'read',
    [['p', 'NODE'], ['l', 'NODE']],
    [['articleId', 'STRING']]
);

// 创建视图
CREATE OR REPLACE VIEW hot_articles AS
MATCH (a:Article)
WHERE a.importance >= 0.8
RETURN a;

CREATE OR REPLACE VIEW recent_events AS
MATCH (e:Event)
WHERE e.createdAt > datetime() - duration('P7D')
RETURN e; 
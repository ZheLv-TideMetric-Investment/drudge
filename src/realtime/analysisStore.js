const neo4j = require('neo4j-driver');
const config = require('./config');
const fingerprint = require('./fingerprint');

class AnalysisStore {
    constructor() {
        this.driver = neo4j.driver(
            config.neo4j.uri,
            neo4j.auth.basic(config.neo4j.user, config.neo4j.password),
            {
                maxConnectionPoolSize: config.neo4j.maxConnectionPoolSize,
                connectionTimeout: config.neo4j.connectionTimeout
            }
        );
    }

    async store(articles) {
        const session = this.driver.session();
        try {
            for (const article of articles) {
                await this.storeArticle(session, article);
            }
        } finally {
            await session.close();
        }
    }

    async storeArticle(session, article) {
        const { extracted, fingerprint: articleFingerprint } = article;

        // 检查是否已存在相似文章
        const existingArticle = await this.findSimilarArticle(session, articleFingerprint);
        if (existingArticle) {
            await this.updateExistingArticle(session, existingArticle, article);
            return;
        }

        // 创建新文章节点
        const articleNode = await this.createArticleNode(session, article);

        // 创建实体节点和关系
        await this.createEntityNodes(session, articleNode, extracted);

        // 创建事件节点和关系
        await this.createEventNode(session, articleNode, extracted);
    }

    async findSimilarArticle(session, fingerprint) {
        const result = await session.run(
            'MATCH (a:Article) WHERE a.fingerprint = $fingerprint RETURN a',
            { fingerprint }
        );
        return result.records[0]?.get('a');
    }

    async updateExistingArticle(session, existingArticle, newArticle) {
        await session.run(
            `
            MATCH (a:Article) WHERE id(a) = $id
            SET a.updatedAt = datetime(),
            a.importance = CASE 
                WHEN a.importance < $importance THEN $importance 
                ELSE a.importance 
            END
            `,
            {
                id: existingArticle.identity,
                importance: newArticle.extracted.importance
            }
        );
    }

    async createArticleNode(session, article) {
        const result = await session.run(
            `
            CREATE (a:Article {
                id: $id,
                title: $title,
                content: $content,
                url: $url,
                source: $source,
                publishedAt: datetime($publishedAt),
                createdAt: datetime(),
                fingerprint: $fingerprint,
                importance: $importance,
                type: $type,
                sentiment: $sentiment
            })
            RETURN a
            `,
            {
                id: article.id,
                title: article.title,
                content: article.content,
                url: article.url,
                source: article.source,
                publishedAt: article.publishedAt.toISOString(),
                fingerprint: article.fingerprint,
                importance: article.extracted.importance,
                type: article.extracted.type,
                sentiment: article.extracted.sentiment
            }
        );
        return result.records[0].get('a');
    }

    async createEntityNodes(session, articleNode, extracted) {
        // 批量创建实体节点和关系
        const entities = [
            ...extracted.who.map(name => ({ name, type: 'Person' })),
            ...extracted.where.map(name => ({ name, type: 'Location' }))
        ];

        if (entities.length > 0) {
            await session.run(
                `
                UNWIND $entities AS entity
                MERGE (e:Entity {name: entity.name})
                ON CREATE SET e.type = entity.type
                WITH e
                MATCH (a:Article) WHERE id(a) = $articleId
                MERGE (e)-[:MENTIONED_IN]->(a)
                `,
                {
                    entities,
                    articleId: articleNode.identity
                }
            );
        }
    }

    async createEventNode(session, articleNode, extracted) {
        await session.run(
            `
            CREATE (e:Event {
                what: $what,
                when: $when,
                how: $how,
                type: $type,
                importance: $importance,
                sentiment: $sentiment,
                createdAt: datetime()
            })
            WITH e
            MATCH (a:Article) WHERE id(a) = $articleId
            MERGE (e)-[:REPORTED_IN]->(a)
            `,
            {
                what: extracted.what,
                when: extracted.when,
                how: extracted.how,
                type: extracted.type,
                importance: extracted.importance,
                sentiment: extracted.sentiment,
                articleId: articleNode.identity
            }
        );
    }

    async close() {
        await this.driver.close();
    }
}

module.exports = new AnalysisStore(); 
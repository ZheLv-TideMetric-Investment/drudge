export const REALTIME_CONFIG = {
    // 系统配置
    system: {
        logLevel: 'info',
        isDev: process.env.NODE_ENV === 'development',
        batchSize: 10,
        maxRetries: 3,
        retryDelay: 1000,
    },

    // 队列配置
    queue: {
        maxSize: 1000,
        batchSize: 20,
        flushInterval: 60000, // 1分钟
    },

    // LLM配置
    llm: {
        apiKey: process.env.DEEPSEEK_API_KEY,
        model: 'deepseek-chat',
        maxTokens: 2000,
        temperature: 0.3,
        timeout: 30000,
    },

    // 爆点检测配置
    alert: {
        keywords: [
            '突发', '紧急', '重大', '危机', '冲突',
            '暴涨', '暴跌', '突破', '创新高', '创新低',
            '重大突破', '重大发现', '重大事故', '重大事件',
            '紧急会议', '紧急声明', '紧急措施', '紧急状态'
        ],
        threshold: 0.8,
        cooldown: 300000, // 5分钟
    },

    // 数据库配置
    neo4j: {
        uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
        user: process.env.NEO4J_USER || 'neo4j',
        password: process.env.NEO4J_PASSWORD,
        maxConnectionPoolSize: 50,
        connectionTimeout: 30000,
    },

    // 通知配置
    notification: {
        dingtalk: {
            webhook: process.env.DINGTALK_WEBHOOK_URL,
            secret: process.env.DINGTALK_SECRET,
        },
        slack: {
            webhook: process.env.SLACK_WEBHOOK_URL,
        },
        customWebhook: process.env.CUSTOM_WEBHOOK_URL,
    },

    // 数据源配置
    dataSource: {
        interval: 60000, // 1分钟
        maxItems: 100,
        timeout: 30000,
    },

    // 指纹配置
    fingerprint: {
        threshold: 0.88,
        minLength: 100,
    },

    // 实体配置
    entity: {
        minConfidence: 0.7,
        maxAliases: 10,
    }
}; 
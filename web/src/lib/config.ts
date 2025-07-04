export const config = {
  // 后端API配置
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
    endpoints: {
      news: '/api/news',
      graph: '/api/graph',
      summary: '/api/summary',
      monitor: '/api/monitor',
      analytics: '/api/analytics'
    }
  },
  
  // Neo4j配置（用于直接连接，如果需要）
  neo4j: {
    uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
    user: process.env.NEO4J_USER || 'neo4j',
    password: process.env.NEO4J_PASSWORD || 'password'
  },
  
  // 应用配置
  app: {
    name: 'News Knowledge Graph',
    version: '1.0.0',
    refreshInterval: 30000, // 30秒刷新间隔
    pageSize: 20, // 默认分页大小
    maxGraphNodes: 100 // 图谱最大节点数
  },
  
  // 新闻级别配置
  newsLevels: {
    'Level 1': { color: '#ef4444', label: '紧急', priority: 1 },
    'Level 2': { color: '#f97316', label: '重要', priority: 2 },
    'Level 3': { color: '#eab308', label: '中等', priority: 3 },
    'Level 4': { color: '#22c55e', label: '一般', priority: 4 },
    'Level 5': { color: '#6b7280', label: '低', priority: 5 }
  }
}; 
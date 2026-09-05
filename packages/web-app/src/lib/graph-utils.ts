// 简化的图数据处理工具

export interface Entity {
  id: string;
  name: string;
  type: string;
  properties: Record<string, any>;
}

export interface SimpleGraphData {
  incomplete?: boolean;
  nodes: Array<{
    id: string;
    name: string;
    type: string;
  }>;
  edges: Array<{
    source: string;
    target: string;
    type: string;
  }>;
}

// 高效的多实体数据处理
export async function loadMultiEntityGraph(entities: Entity[], maxNodes = 50): Promise<SimpleGraphData> {
  const startTime = performance.now();
  
  // 使用Set进行高效去重
  const nodeSet = new Set<string>();
  const edgeSet = new Set<string>();
  const nodes: SimpleGraphData['nodes'] = [];
  const edges: SimpleGraphData['edges'] = [];
  
  // 首先添加搜索的核心实体
  entities.forEach(entity => {
    if (!nodeSet.has(entity.id)) {
      nodeSet.add(entity.id);
      nodes.push({
        id: entity.id,
        name: entity.name,
        type: entity.type
      });
    }
  });

  // 并发获取关系数据 - 限制数量避免过载
  const maxEntities = Math.min(entities.length, 3); // 最多3个实体
  const promises = entities.slice(0, maxEntities).map(async (entity) => {
    try {
      const response = await fetch(`/api/graph/entities/${entity.id}/neighborhood?depth=1&limit=15`);
      const result = await response.json();
      
      if (result.success && result.data) {
        return result.data;
      }
      return null;
    } catch (error) {
      console.warn(`Failed to load data for entity ${entity.name}:`, error);
      return null;
    }
  });

  const results = await Promise.all(promises);
  if (results.length > 0 && results.every(result => !result)) {
    throw new Error('实体关联查询失败');
  }
  
  // 高效合并数据
  results.forEach(result => {
    if (!result) return;
    
    // 添加节点 - 严格控制数量
    if (result.nodes && Array.isArray(result.nodes)) {
      result.nodes.forEach((node: any) => {
        if (nodes.length >= maxNodes) return; // 硬性限制节点数量
        
        if (!nodeSet.has(node.id)) {
          nodeSet.add(node.id);
          nodes.push({
            id: node.id,
            name: node.name,
            type: node.type
          });
        }
      });
    }
    
    // 添加边 - 只保留有效连接
    if (result.edges && Array.isArray(result.edges)) {
      result.edges.forEach((edge: any) => {
        const edgeKey = `${edge.source}_${edge.target}`;
        if (!edgeSet.has(edgeKey) && nodeSet.has(edge.source) && nodeSet.has(edge.target)) {
          edgeSet.add(edgeKey);
          edges.push({
            source: edge.source,
            target: edge.target,
            type: edge.type || 'RELATED'
          });
        }
      });
    }
  });

  const endTime = performance.now();
  console.log(`🚀 Fast Graph Loading: ${nodes.length} nodes, ${edges.length} edges in ${Math.round(endTime - startTime)}ms`);

  return { nodes, edges, incomplete: results.some(result => !result) };
}

// 简单的实体搜索
export async function searchEntities(query: string, limit = 10): Promise<Entity[]> {
  if (!query.trim()) return [];
  
  try {
    const url = `/api/graph/entities/search?q=${encodeURIComponent(query)}&limit=${limit}`;
    const response = await fetch(url);
    const result = await response.json();
    
    if (result.success && result.data) {
      return result.data.map((item: any) => item.entity || item);
    }
    
    throw new Error(result.error || '实体搜索失败');
  } catch (error) {
    console.error('Search failed:', error);
    throw error;
  }
}

// 数据转换 - 将复杂数据结构转换为简单结构
export function convertToSimpleGraph(complexData: any): SimpleGraphData {
  const nodes = (complexData.nodes || []).map((node: any) => ({
    id: node.id,
    name: node.name,
    type: node.type
  }));
  
  const edges = (complexData.edges || []).map((edge: any) => ({
    source: typeof edge.source === 'object' ? edge.source.id : edge.source,
    target: typeof edge.target === 'object' ? edge.target.id : edge.target,
    type: edge.type
  }));
  
  return { nodes, edges };
}

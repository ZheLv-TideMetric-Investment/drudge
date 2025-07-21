'use client';

import { useState, useCallback } from 'react';
import { Card, Input, Space, Button, message, Typography } from 'antd';
import { SearchOutlined, ClearOutlined, ReloadOutlined } from '@ant-design/icons';
import { Layout } from '../../components/Layout';
import NetworkGraph from '../../components/graph/NetworkGraph';
import { searchEntities, loadMultiEntityGraph, Entity } from '../../lib/graph-utils';

const { Title, Text } = Typography;

interface GraphData {
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

const GraphPage = () => {
  // 状态管理
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], edges: [] });

  // 搜索实体
  const handleSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setEntities([]);
      setGraphData({ nodes: [], edges: [] });
      return;
    }

    setLoading(true);
    const hide = message.loading('搜索中...', 0);
    
    try {
      // 1. 搜索实体
      const searchResults = await searchEntities(searchQuery, 8);
      setEntities(searchResults);
      
      if (searchResults.length === 0) {
        message.warning('未找到相关实体');
        setGraphData({ nodes: [], edges: [] });
        return;
      }

      // 2. 加载图数据
      const graphResult = await loadMultiEntityGraph(searchResults, 50);
      setGraphData(graphResult);
      
      message.success(`找到 ${searchResults.length} 个实体，${graphResult.nodes.length} 个节点`);
      
    } catch (error) {
      console.error('搜索失败:', error);
      message.error('搜索失败，请重试');
    } finally {
      hide();
      setLoading(false);
    }
  }, []);

  // 清空搜索
  const handleClear = useCallback(() => {
    setQuery('');
    setEntities([]);
    setGraphData({ nodes: [], edges: [] });
    message.info('已清空');
  }, []);

  // 刷新图数据
  const handleRefresh = useCallback(async () => {
    if (entities.length === 0) return;
    
    setLoading(true);
    const hide = message.loading('刷新中...', 0);
    
    try {
      const graphResult = await loadMultiEntityGraph(entities, 50);
      setGraphData(graphResult);
      message.success('刷新成功');
    } catch (error) {
      message.error('刷新失败');
    } finally {
      hide();
      setLoading(false);
    }
  }, [entities]);

  // 节点点击处理
  const handleNodeClick = useCallback((node: any) => {
    message.info(`选中节点: ${node.name}`);
  }, []);

  // 节点双击处理
  const handleNodeDoubleClick = useCallback((node: any) => {
    message.info(`双击节点: ${node.name}，可以在这里添加更多操作`);
  }, []);

  return (
    <Layout>
      <div style={{ padding: '20px' }}>
        {/* 页面标题 */}
        <div style={{ marginBottom: '20px' }}>
          <Title level={2} style={{ margin: 0 }}>
            🌐 知识图谱
          </Title>
          <Text type="secondary">
            探索实体间的关联关系，发现隐藏的知识连接
          </Text>
        </div>

        {/* 搜索区域 */}
        <Card style={{ marginBottom: '20px' }}>
          <Space.Compact style={{ width: '100%' }}>
            <Input
              placeholder="搜索实体（如：特斯拉、马斯克、比亚迪）"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onPressEnter={() => handleSearch(query)}
              size="large"
            />
            <Button 
              type="primary" 
              icon={<SearchOutlined />}
              onClick={() => handleSearch(query)}
              loading={loading}
              size="large"
            >
              搜索
            </Button>
            <Button 
              icon={<ClearOutlined />}
              onClick={handleClear}
              size="large"
            >
              清空
            </Button>
            <Button 
              icon={<ReloadOutlined />}
              onClick={handleRefresh}
              disabled={entities.length === 0}
              size="large"
            >
              刷新
            </Button>
          </Space.Compact>
          
          {/* 快速搜索建议 */}
          <div style={{ marginTop: '10px' }}>
            <Text type="secondary">快速搜索: </Text>
            {['特斯拉', '马斯克', '比亚迪', '理想汽车', '小米'].map(keyword => (
              <Button 
                key={keyword}
                type="link" 
                size="small"
                onClick={() => {
                  setQuery(keyword);
                  handleSearch(keyword);
                }}
              >
                {keyword}
              </Button>
            ))}
          </div>
        </Card>

        {/* 图谱显示区域 */}
        <Card 
          title="关系图谱" 
          extra={
            graphData.nodes.length > 0 && (
              <Text type="secondary">
                {graphData.nodes.length} 节点 • {graphData.edges.length} 关系
              </Text>
            )
          }
        >
          {graphData.nodes.length > 0 ? (
            <NetworkGraph
              data={graphData}
              width={1200}
              height={700}
              onNodeClick={handleNodeClick}
              onNodeDoubleClick={handleNodeDoubleClick}
              highlightedNodeIds={entities.map(e => e.id)}
            />
          ) : (
            <div style={{ 
              height: '700px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#fafafa',
              border: '1px dashed #d9d9d9',
              borderRadius: '6px',
              color: '#999'
            }}>
              {loading ? '加载中...' : '请搜索实体以查看关系图谱'}
            </div>
          )}
        </Card>
      </div>
    </Layout>
  );
};

export default GraphPage; 
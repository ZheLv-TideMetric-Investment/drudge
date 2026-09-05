'use client';

import { useState, useCallback } from 'react';
import { Alert, Card, Input, Button, message, Typography } from 'antd';
import { SearchOutlined, ClearOutlined, ReloadOutlined } from '@ant-design/icons';
import { Layout } from '../../components/Layout';
import NetworkGraph from '../../components/graph/NetworkGraph';
import { searchEntities, loadMultiEntityGraph, Entity } from '../../lib/graph-utils';
import styles from '../workbench.module.css';

const { Title, Text } = Typography;

interface GraphData {
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

const GraphPage = () => {
  const [messageApi, contextHolder] = message.useMessage();
  const [error, setError] = useState('');
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
    setError('');
    
    try {
      // 1. 搜索实体
      const searchResults = await searchEntities(searchQuery, 8);
      setEntities(searchResults);
      
      if (searchResults.length === 0) {
        messageApi.warning('未找到相关实体');
        setGraphData({ nodes: [], edges: [] });
        return;
      }

      // 2. 加载图数据
      const graphResult = await loadMultiEntityGraph(searchResults, 50);
      setGraphData(graphResult);
      
      messageApi.success(`找到 ${searchResults.length} 个实体，${graphResult.nodes.length} 个节点`);
      
    } catch (error) {
      console.error('搜索失败:', error);
      setError('搜索失败，请重试');
    } finally {
      setLoading(false);
    }
  }, [messageApi]);

  // 清空搜索
  const handleClear = useCallback(() => {
    setQuery('');
    setEntities([]);
    setGraphData({ nodes: [], edges: [] });
    setError('');
    messageApi.info('已清空');
  }, [messageApi]);

  // 刷新图数据
  const handleRefresh = useCallback(async () => {
    if (entities.length === 0) return;
    
    setLoading(true);
    setError('');
    
    try {
      const graphResult = await loadMultiEntityGraph(entities, 50);
      setGraphData(graphResult);
      messageApi.success('刷新成功');
    } catch (error) {
      setError('刷新失败，请重试');
    } finally {
      setLoading(false);
    }
  }, [entities, messageApi]);

  // 节点点击处理
  const handleNodeClick = useCallback((node: any) => {
    messageApi.info(`选中节点: ${node.name}`);
  }, [messageApi]);

  // 节点双击处理
  const handleNodeDoubleClick = useCallback(async (node: GraphData['nodes'][number]) => {
    setLoading(true);
    setError('');
    try {
      const entity: Entity = { ...node, properties: {} };
      const graphResult = await loadMultiEntityGraph([entity], 50);
      setQuery(node.name);
      setEntities([entity]);
      setGraphData(graphResult);
    } catch {
      setError('加载节点关系失败，请重试');
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <Layout>
      {contextHolder}
      <div style={{ padding: '20px' }}>
        {/* 页面标题 */}
        <div style={{ marginBottom: '20px' }}>
          <Title level={2} style={{ margin: 0 }}>
            🌐 知识图谱
          </Title>
          <Text type="secondary">
            搜索实体查看关联关系，双击节点继续探索它的关联。
          </Text>
        </div>

        {/* 搜索区域 */}
        <Card style={{ marginBottom: '20px' }}>
          <div className={styles.toolbar}>
            <Input
              placeholder="搜索实体（如：特斯拉、马斯克、比亚迪）"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onPressEnter={() => handleSearch(query)}
              size="large"
              id="graph-search"
              name="graph-search"
              style={{ flex: '1 1 260px', width: 'auto' }}
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
          </div>
          
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
        {error && (
          <Alert type="error" showIcon message={error} description={graphData.nodes.length ? '下方保留上一次成功加载的图谱。' : undefined} style={{ marginBottom: 16 }} />
        )}
        {graphData.incomplete && (
          <Alert type="warning" showIcon message="部分实体的关联未能加载，请刷新重试。" style={{ marginBottom: 16 }} />
        )}
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

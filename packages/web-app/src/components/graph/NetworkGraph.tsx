'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { Network, Data, Options, Node, Edge } from 'vis-network';

const VIS_DEV_BUILD_WARNING = "You're running a development build.";

const suppressVisWarning = () => {
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    if (args[0] === VIS_DEV_BUILD_WARNING) return;
    originalWarn(...args);
  };
  return () => {
    console.warn = originalWarn;
  };
};

// 接口定义
interface GraphNode {
  id: string;
  name: string;
  type: string;
  properties?: Record<string, any>;
}

interface GraphEdge {
  source: string;
  target: string;
  type: string;
  properties?: Record<string, any>;
}

const getNodeColor = (type: string, isHighlighted: boolean) => {
  const colorMap: Record<string, any> = {
    PERSON: {
      background: '#e3f2fd',
      border: '#2196f3',
      highlight: { background: '#bbdefb', border: '#1976d2' },
    },
    ORGANIZATION: {
      background: '#ffebee',
      border: '#f44336',
      highlight: { background: '#ffcdd2', border: '#d32f2f' },
    },
    LOCATION: {
      background: '#e8f5e8',
      border: '#4caf50',
      highlight: { background: '#c8e6c9', border: '#388e3c' },
    },
    EVENT: {
      background: '#f3e5f5',
      border: '#9c27b0',
      highlight: { background: '#e1bee7', border: '#7b1fa2' },
    },
    PRODUCT: {
      background: '#fff3e0',
      border: '#ff9800',
      highlight: { background: '#ffe0b2', border: '#f57c00' },
    },
    default: {
      background: '#f5f5f5',
      border: '#9e9e9e',
      highlight: { background: '#eeeeee', border: '#757575' },
    },
  };

  const colors = colorMap[type] || colorMap.default;

  if (isHighlighted) {
    return {
      background: '#ffcdd2',
      border: '#f44336',
      highlight: { background: '#ef9a9a', border: '#d32f2f' },
    };
  }

  return colors;
};

const getTypeLabel = (type: string) => {
  const labelMap: Record<string, string> = {
    PERSON: '人',
    ORGANIZATION: '组织',
    LOCATION: '地点',
    EVENT: '事件',
    PRODUCT: '产品',
  };
  return labelMap[type] || type;
};

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface NetworkGraphProps {
  data: GraphData;
  width?: number;
  height?: number;
  onNodeClick?: (node: GraphNode) => void;
  onNodeDoubleClick?: (node: GraphNode) => void;
  highlightedNodeIds?: string[];
}

const NetworkGraph: React.FC<NetworkGraphProps> = ({
  data,
  width = 800,
  height = 600,
  onNodeClick,
  onNodeDoubleClick,
  highlightedNodeIds = []
}) => {
  const networkContainer = useRef<HTMLDivElement>(null);
  const networkInstance = useRef<Network | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [nodeInfo, setNodeInfo] = useState<{ node: GraphNode; position: { x: number; y: number } } | null>(null);

  // 转换数据格式
  const convertData = useCallback((): Data => {
    const nodes: Node[] = data.nodes.map(node => {
      const isHighlighted = highlightedNodeIds.includes(node.id);
      // Let vis-network manage selection so clicks preserve the current layout.
      const colors = getNodeColor(node.type, isHighlighted);
      
      // 构建节点标签，包含类型和名称
      const typeLabel = getTypeLabel(node.type);
      const nodeLabel = `${typeLabel}\n${node.name}`;
      
      return {
        id: node.id,
        label: nodeLabel,
        title: `${typeLabel}: ${node.name}`, // 悬停提示
        color: colors,
        font: {
          size: isHighlighted ? 18 : 16,
          color: '#1a1a1a',
          face: 'Microsoft YaHei, PingFang SC, Arial, sans-serif',
          multi: true, // 支持多行文本
          align: 'center'
        },
        size: isHighlighted ? 60 : 55,
        borderWidth: isHighlighted ? 4 : 3,
        shape: 'circle',
        shadow: {
          enabled: true,
          color: 'rgba(0,0,0,0.15)',
          size: 8,
          x: 1,
          y: 1
        }
      };
    });

    const edges: Edge[] = data.edges.map((edge, index) => ({
      id: `edge-${index}`,
      from: edge.source,
      to: edge.target,
      label: edge.type,
      color: {
        color: '#666666',
        highlight: '#e74c3c',
        hover: '#e74c3c'
      },
      font: {
        color: '#333333',
        size: 13,
        face: 'Microsoft YaHei, PingFang SC, Arial, sans-serif',
        strokeWidth: 4,
        strokeColor: 'white',
        align: 'middle'
      },
      arrows: {
        to: {
          enabled: true,
          scaleFactor: 0.8
        }
      },
      smooth: {
        enabled: true,
        type: 'dynamic',
        roundness: 0.6
      },
      width: 2,
      selectionWidth: 4
    }));

    return { nodes, edges };
  }, [data.edges, data.nodes, highlightedNodeIds]);

  // 网络图配置选项
  const getOptions = (): Options => ({
    nodes: {
      shape: 'circle',
      borderWidth: 3,
      borderWidthSelected: 5,
      size: 55,
      font: {
        size: 16,
        color: '#1a1a1a',
        face: 'Microsoft YaHei, PingFang SC, Arial, sans-serif',
        multi: true,
        align: 'center'
      },
      labelHighlightBold: true,
      chosen: true,
      shadow: {
        enabled: true,
        color: 'rgba(0,0,0,0.15)',
        size: 8,
        x: 1,
        y: 1
      }
    },
    edges: {
      width: 2,
      color: {
        color: '#666666',
        highlight: '#e74c3c',
        hover: '#e74c3c'
      },
      font: {
        color: '#333333',
        size: 13,
        face: 'Microsoft YaHei, PingFang SC, Arial, sans-serif',
        strokeWidth: 4,
        strokeColor: 'white',
        align: 'middle'
      },
      arrows: {
        to: {
          enabled: true,
          scaleFactor: 0.8
        }
      },
      smooth: {
        enabled: true,
        type: 'dynamic',
        roundness: 0.6
      },
      chosen: true
    },
    physics: {
      enabled: true,
      stabilization: {
        enabled: true,
        iterations: 150,
        fit: true
      },
      barnesHut: {
        gravitationalConstant: -12000,
        centralGravity: 0.15,
        springLength: 200,
        springConstant: 0.03,
        damping: 0.15,
        avoidOverlap: 0.4
      }
    },
    interaction: {
      dragNodes: true,
      dragView: true,
      zoomView: true,
      selectConnectedEdges: true,
      hover: true,
      hoverConnectedEdges: true,
      tooltipDelay: 200,
      hideEdgesOnDrag: false,
      hideNodesOnDrag: false
    },
    layout: {
      improvedLayout: true,
      randomSeed: 191006
    }
  });

  // 初始化网络图
  useEffect(() => {
    if (!networkContainer.current || !data.nodes.length) return;

    let cancelled = false;

    const initNetwork = async () => {
      const restoreWarn = suppressVisWarning();
      try {
        const vis = await import('vis-network/peer/esm/vis-network.mjs');
        if (cancelled || !networkContainer.current) return;

        const networkData = convertData();
        const options = getOptions();

        // 创建网络实例
        const network = new vis.Network(networkContainer.current, networkData, options);
        networkInstance.current = network;

        // 绑定事件
        network.on('click', (params) => {
          if (params.nodes.length > 0) {
            const nodeId = params.nodes[0] as string;
            const node = data.nodes.find(n => n.id === nodeId);
            if (node) {
              setSelectedNode(nodeId);
              
              // 获取节点位置并显示信息弹窗
              const position = network.getPositions([nodeId])[nodeId];
              const canvasPosition = network.canvasToDOM(position);
              setNodeInfo({ node, position: canvasPosition });
              
              onNodeClick?.(node);
            }
          } else {
            setSelectedNode(null);
            setNodeInfo(null);
          }
        });

        network.on('doubleClick', (params) => {
          if (params.nodes.length > 0) {
            const nodeId = params.nodes[0] as string;
            const node = data.nodes.find(n => n.id === nodeId);
            if (node) {
              onNodeDoubleClick?.(node);
            }
          }
        });

        // 点击空白区域隐藏信息弹窗
        network.on('click', (params) => {
          if (params.nodes.length === 0) {
            setNodeInfo(null);
          }
        });

        // 稳定化完成后适应画布
        network.on('stabilizationIterationsDone', () => {
          network.fit({
            animation: {
              duration: 1000,
              easingFunction: 'easeInOutQuad'
            }
          });
        });
      } finally {
        restoreWarn();
      }
    };

    void initNetwork();

    // 清理函数
    return () => {
      cancelled = true;
      if (networkInstance.current) {
        networkInstance.current.destroy();
        networkInstance.current = null;
      }
    };
  }, [convertData, data, onNodeClick, onNodeDoubleClick]);

  // 控制方法
  const handleFit = () => {
    networkInstance.current?.fit({
      animation: { duration: 1000, easingFunction: 'easeInOutQuad' }
    });
  };

  const handleStabilize = () => {
    networkInstance.current?.stabilize();
  };

  const handleEnablePhysics = () => {
    networkInstance.current?.setOptions({ physics: { enabled: true } });
  };

  const handleDisablePhysics = () => {
    networkInstance.current?.setOptions({ physics: { enabled: false } });
  };

  return (
    <div style={{ position: 'relative' }}>
      <div
        ref={networkContainer}
        style={{
          width: '100%',
          maxWidth: `${width}px`,
          height: `${height}px`,
          border: '1px solid #ddd',
          borderRadius: '4px',
          backgroundColor: '#fafafa'
        }}
      />
      
      {/* 控制按钮 */}
      <div style={{
        position: 'absolute',
        top: 15,
        right: 15,
        display: 'flex',
        flexDirection: 'column',
        gap: '6px'
      }}>
        <button
          onClick={handleFit}
          style={{
            padding: '6px 10px',
            fontSize: '13px',
            background: 'rgba(255,255,255,0.95)',
            border: '1px solid #e1e8ed',
            borderRadius: '6px',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            transition: 'all 0.2s ease'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,1)';
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.95)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
          }}
          title="适应画布"
        >
          📐
        </button>
        <button
          onClick={handleStabilize}
          style={{
            padding: '6px 10px',
            fontSize: '13px',
            background: 'rgba(255,255,255,0.95)',
            border: '1px solid #e1e8ed',
            borderRadius: '6px',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            transition: 'all 0.2s ease'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,1)';
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.95)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
          }}
          title="重新布局"
        >
          🔄
        </button>
        <button
          onClick={handleEnablePhysics}
          style={{
            padding: '6px 10px',
            fontSize: '13px',
            background: 'rgba(255,255,255,0.95)',
            border: '1px solid #e1e8ed',
            borderRadius: '6px',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            transition: 'all 0.2s ease'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,1)';
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.95)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
          }}
          title="启用物理"
        >
          ⚡
        </button>
        <button
          onClick={handleDisablePhysics}
          style={{
            padding: '6px 10px',
            fontSize: '13px',
            background: 'rgba(255,255,255,0.95)',
            border: '1px solid #e1e8ed',
            borderRadius: '6px',
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            transition: 'all 0.2s ease'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,1)';
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.95)';
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
          }}
          title="禁用物理"
        >
          🔒
        </button>
      </div>
      
      {/* 节点信息弹窗 */}
      {nodeInfo && (
        <div
          style={{
            position: 'absolute',
            left: nodeInfo.position.x + 20,
            top: nodeInfo.position.y - 10,
            background: 'white',
            border: '1px solid #e1e8ed',
            borderRadius: '8px',
            padding: '16px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            zIndex: 1000,
            minWidth: '220px',
            maxWidth: '320px',
            backdropFilter: 'blur(10px)',
            borderTop: '3px solid #3498db'
          }}
        >
          <div style={{ marginBottom: '12px' }}>
            <strong style={{ 
              color: '#2c3e50', 
              fontSize: '16px',
              fontWeight: '600'
            }}>
              {nodeInfo.node.name}
            </strong>
          </div>
          <div style={{ marginBottom: '8px' }}>
            <span style={{ color: '#7f8c8d', fontSize: '13px', fontWeight: '500' }}>类型: </span>
            <span style={{ 
              background: '#ecf0f1', 
              padding: '4px 8px', 
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: '500',
              color: '#34495e'
            }}>
              {getTypeLabel(nodeInfo.node.type)}
            </span>
          </div>
          <div style={{ marginBottom: '8px' }}>
            <span style={{ color: '#7f8c8d', fontSize: '13px' }}>ID: </span>
            <span style={{ 
              fontSize: '12px', 
              fontFamily: 'Monaco, Menlo, Consolas, monospace',
              background: '#f8f9fa',
              padding: '2px 6px',
              borderRadius: '4px',
              color: '#495057'
            }}>
              {nodeInfo.node.id.slice(0, 12)}...
            </span>
          </div>
          {nodeInfo.node.properties && Object.keys(nodeInfo.node.properties).length > 0 && (
            <div>
              <div style={{ 
                color: '#7f8c8d', 
                fontSize: '13px', 
                marginBottom: '6px',
                fontWeight: '500'
              }}>
                属性:
              </div>
              {Object.entries(nodeInfo.node.properties).slice(0, 3).map(([key, value]) => (
                <div key={key} style={{ 
                  fontSize: '12px', 
                  marginBottom: '4px',
                  padding: '4px 0',
                  borderBottom: '1px solid #f1f3f4'
                }}>
                  <span style={{ 
                    color: '#7f8c8d', 
                    fontWeight: '500',
                    display: 'inline-block',
                    width: '60px'
                  }}>
                    {key}: 
                  </span>
                  <span style={{ color: '#2c3e50' }}>
                    {String(value).slice(0, 35)}
                    {String(value).length > 35 ? '...' : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
      {/* 信息显示 */}
      <div style={{
        position: 'absolute',
        bottom: 15,
        left: 15,
        background: 'rgba(255,255,255,0.95)',
        padding: '8px 12px',
        borderRadius: '6px',
        fontSize: '13px',
        color: '#34495e',
        border: '1px solid #e1e8ed',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        fontWeight: '500'
      }}>
        {data.nodes.length} 节点 • {data.edges.length} 连线
        {selectedNode && ' • 已选中节点'}
      </div>
    </div>
  );
};

export default NetworkGraph; 

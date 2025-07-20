'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Layout as AntLayout, Menu, Drawer, Button, Typography } from 'antd';
import {
  MenuOutlined,
  HomeOutlined,
  FileTextOutlined,
  ShareAltOutlined,
  SnippetsOutlined,
  EyeOutlined,
  BarChartOutlined,
} from '@ant-design/icons';

const { Header, Sider, Content } = AntLayout;
const { Title } = Typography;

const navigation = [
  { key: '/', label: '📰 报社概览', icon: HomeOutlined },
  { key: '/news', label: '📋 新闻浏览', icon: FileTextOutlined },
  { key: '/graph', label: '🕸️ 知识图谱', icon: ShareAltOutlined },
  { key: '/summary', label: '📄 总结报告', icon: SnippetsOutlined },
  { key: '/monitor', label: '👁️ 实时监控', icon: EyeOutlined },
  { key: '/stats', label: '📊 数据统计', icon: BarChartOutlined },
];

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  const menuItems = navigation.map(item => ({
    key: item.key,
    icon: <item.icon className="newspaper-icon" />,
    label: (
      <Link href={item.key} style={{ textDecoration: 'none' }} onClick={() => setDrawerOpen(false)}>
        <span className="newspaper-body newspaper-body-no-indent" style={{ fontSize: '14px', color: 'inherit' }}>
          {item.label}
        </span>
      </Link>
    ),
  }));

  const siderContent = (
    <>
      <div
        style={{
          padding: '24px 20px',
          borderBottom: '2px solid var(--newspaper-dark-red)',
          textAlign: 'center',
          backgroundColor: 'var(--newspaper-red)',
          position: 'relative'
        }}
      >
        {/* 装饰性边框 */}
        <div style={{
          position: 'absolute',
          top: '8px',
          left: '8px',
          right: '8px',
          bottom: '8px',
          border: '1px solid var(--newspaper-bg)',
          opacity: 0.3,
          pointerEvents: 'none'
        }}></div>
        
        <div className="newspaper-title" style={{ 
          margin: 0, 
          color: 'var(--newspaper-title-light)',
          fontSize: '18px',
          fontWeight: 'bold',
          lineHeight: '1.4',
          textAlign: 'center',
          textShadow: '1px 1px 2px rgba(0,0,0,0.5)'
        }}>
          📰 大公报纸<br/>
          <span className="newspaper-subtitle-secondary" style={{ 
            fontSize: '12px', 
            fontWeight: 'normal',
            color: 'var(--newspaper-subtitle-light)',
            fontStyle: 'italic'
          }}>
            知识图谱系统
          </span>
        </div>
      </div>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[pathname]}
        items={menuItems}
        style={{ 
          border: 'none',
          backgroundColor: 'var(--newspaper-red)',
          fontFamily: 'SimSun, 宋体, serif'
        }}
      />
    </>
  );

  return (
    <AntLayout style={{ minHeight: '100vh' }} className="newspaper-page">
      {/* 桌面端侧边栏 */}
      <Sider
        width={280}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          boxShadow: '3px 0 6px var(--newspaper-shadow)',
          borderRight: '2px solid var(--newspaper-dark-red)',
          backgroundColor: 'var(--newspaper-red)'
        }}
        className="hidden-mobile"
      >
        {siderContent}
      </Sider>

      {/* 移动端抽屉 */}
      <Drawer
        title={
          <div className="newspaper-title newspaper-content-left" style={{ 
            color: 'var(--newspaper-red)',
            fontSize: '16px'
          }}>
            📰 大公报纸 • 导航
          </div>
        }
        placement="left"
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
        width={280}
        styles={{ 
          body: { 
            padding: 0, 
            backgroundColor: 'var(--newspaper-red)',
            fontFamily: 'SimSun, 宋体, serif'
          },
          header: { 
            backgroundColor: 'var(--newspaper-bg)', 
            borderBottom: '2px solid var(--newspaper-red)'
          }
        }}
        className="show-mobile"
      >
        {siderContent}
      </Drawer>

      {/* 移动端头部 */}
      <Header
        style={{
          display: 'none',
          position: 'fixed',
          zIndex: 1,
          width: '100%',
          backgroundColor: 'var(--newspaper-red)',
          borderBottom: '2px solid var(--newspaper-dark-red)',
          padding: '0 16px',
          boxShadow: '0 2px 4px var(--newspaper-shadow)'
        }}
        className="show-mobile mobile-header"
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Button
            type="text"
            icon={<MenuOutlined />}
            onClick={() => setDrawerOpen(true)}
            style={{
              fontSize: '18px',
              color: 'var(--newspaper-title-light)',
              border: 'none',
              background: 'none'
            }}
            className="newspaper-icon"
          />
          <Title level={4} style={{ 
            margin: 0, 
            color: 'var(--newspaper-title-light)',
            fontFamily: 'SimHei, 黑体, sans-serif'
          }}>
            📰 大公报纸
          </Title>
          <div style={{ width: '40px' }}></div>
        </div>
      </Header>

      {/* 主内容区域 */}
      <AntLayout style={{ marginLeft: '280px' }} className="hidden-mobile">
        <Content
          style={{
            margin: 0,
            overflow: 'initial',
            backgroundColor: 'var(--newspaper-bg)',
            minHeight: '100vh'
          }}
        >
          <div className="newspaper-page" style={{ padding: '24px', minHeight: '100vh' }}>
            {children}
          </div>
        </Content>
      </AntLayout>

      {/* 移动端主内容 */}
      <AntLayout className="show-mobile">
        <Content
          style={{
            marginTop: '64px',
            overflow: 'initial',
            backgroundColor: 'var(--newspaper-bg)',
            minHeight: 'calc(100vh - 64px)'
          }}
        >
          <div className="newspaper-page" style={{ padding: '16px' }}>
            {children}
          </div>
        </Content>
      </AntLayout>
    </AntLayout>
  );
}

// 媒体查询样式
const style = `
  @media (max-width: 768px) {
    .hidden-mobile {
      display: none !important;
    }
    .show-mobile {
      display: block !important;
    }
    .mobile-header {
      display: flex !important;
    }
  }
  
  @media (min-width: 769px) {
    .show-mobile {
      display: none !important;
    }
    .hidden-mobile {
      display: block !important;
    }
  }
`;

// 注入样式
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = style;
  document.head.appendChild(styleSheet);
}

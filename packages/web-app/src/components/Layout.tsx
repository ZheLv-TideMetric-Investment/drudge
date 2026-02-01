'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Layout as AntLayout, Menu, Drawer, Button, Typography } from 'antd';
import { MenuOutlined } from '@ant-design/icons';

const { Header, Sider, Content } = AntLayout;
const { Title } = Typography;

const navigation = [
  { key: '/', label: '报社概览', icon: '📰' },
  { key: '/news', label: '新闻浏览', icon: '📋' },
  { key: '/graph', label: '知识图谱', icon: '🕸️' },
  { key: '/summary', label: '总结报告', icon: '📄' },
  { key: '/monitor', label: '实时监控', icon: '👁️' },
  { key: '/stats', label: '数据统计', icon: '📊' },
];

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  const menuItems = navigation.map(item => ({
    key: item.key,
    icon: item.icon ? <span className="newspaper-icon">{item.icon}</span> : null,
    label: (
      <Link href={item.key} style={{ textDecoration: 'none' }} onClick={() => setDrawerOpen(false)}>
        <span
          className="newspaper-body newspaper-body-no-indent"
          style={{ fontSize: 'var(--font-size-lg)', color: 'var(--newspaper-title-light)' }}
        >
          {item.label}
        </span>
      </Link>
    ),
  }));

  const siderContent = (
    <>
      <div
        style={{
          padding: 'var(--space-2xl) var(--space-xl)',
          borderBottom: '2px solid var(--newspaper-dark-red)',
          textAlign: 'center',
          backgroundColor: 'var(--newspaper-red)',
          position: 'relative',
        }}
      >
        {/* 装饰性边框 */}
        <div
          style={{
            position: 'absolute',
            top: 'var(--space-sm)',
            left: 'var(--space-sm)',
            right: 'var(--space-sm)',
            bottom: 'var(--space-sm)',
            border: '1px solid var(--newspaper-bg)',
            opacity: 0.3,
            pointerEvents: 'none',
          }}
        ></div>

        <div
          className="newspaper-title"
          style={{
            margin: 0,
            color: 'var(--newspaper-title-light) !important',
            fontSize: 'var(--font-size-2xl)',
            fontWeight: 'bold',
            lineHeight: '1.4',
            textAlign: 'center',
            textShadow: '1px 1px 2px var(--newspaper-text-shadow)',
          }}
        >
          📰 长婷报社
          <br />
          <span
            className="newspaper-subtitle-secondary"
            style={{
              fontSize: 'var(--font-size-base)',
              fontWeight: 'normal',
              color: 'var(--newspaper-subtitle-light) !important',
              fontStyle: 'italic',
            }}
          >
            你的理财大学生
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
          fontFamily: 'SimSun, 宋体, serif',
        }}
      />
    </>
  );

  return (
    <AntLayout style={{ minHeight: '100vh' }} className="newspaper-page">
      {/* 桌面端侧边栏 */}
      <Sider
        width="var(--sidebar-width)"
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          boxShadow: '3px 0 6px var(--newspaper-shadow)',
          borderRight: '2px solid var(--newspaper-dark-red)',
          backgroundColor: 'var(--newspaper-red)',
        }}
        className="hidden-mobile"
      >
        {siderContent}
      </Sider>

      {/* 移动端抽屉 */}
      <Drawer
        title={
          <div
            className="newspaper-title newspaper-content-left"
            style={{
              color: 'var(--newspaper-red)',
              fontSize: 'var(--font-size-xl)',
            }}
          >
            📰 长婷报社 • 导航
          </div>
        }
        placement="left"
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
        width="var(--sidebar-width)"
        styles={{
          body: {
            padding: 0,
            backgroundColor: 'var(--newspaper-red)',
            fontFamily: 'SimSun, 宋体, serif',
          },
          header: {
            backgroundColor: 'var(--newspaper-bg)',
            borderBottom: '2px solid var(--newspaper-red)',
          },
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
          boxShadow: '0 2px 4px var(--newspaper-shadow)',
        }}
        className="show-mobile mobile-header"
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Button
            type="text"
            icon={<MenuOutlined />}
            onClick={() => setDrawerOpen(true)}
            style={{
              fontSize: 'var(--font-size-2xl)',
              color: 'var(--newspaper-title-light)',
              border: 'none',
              background: 'none',
            }}
            className="newspaper-icon"
          />
          <Title
            level={4}
            style={{
              margin: 0,
              color: 'var(--newspaper-title-light)',
              fontFamily: 'SimHei, 黑体, sans-serif',
            }}
          >
            📰 长婷报社
          </Title>
          <div style={{ width: 'var(--space-4xl)' }}></div>
        </div>
      </Header>

      {/* 主内容区域 */}
      <AntLayout style={{ marginLeft: 'var(--sidebar-width)' }} className="content-layout">
        <Content
          className="content-area"
          style={{
            margin: 0,
            overflow: 'initial',
            backgroundColor: 'var(--newspaper-bg)',
            minHeight: '100vh',
          }}
        >
          <div
            className="newspaper-page content-inner"
            style={{ padding: 'var(--space-2xl)', minHeight: '100vh' }}
          >
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
    .content-layout {
      margin-left: 0 !important;
    }
    .content-area {
      margin-top: var(--mobile-header-height) !important;
      min-height: calc(100vh - var(--mobile-header-height)) !important;
    }
    .content-inner {
      padding: var(--space-lg) !important;
      min-height: calc(100vh - var(--mobile-header-height)) !important;
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

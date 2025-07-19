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
  { key: '/', label: '概览', icon: HomeOutlined },
  { key: '/news', label: '新闻', icon: FileTextOutlined },
  { key: '/graph', label: '知识图谱', icon: ShareAltOutlined },
  { key: '/summary', label: '总结报告', icon: SnippetsOutlined },
  { key: '/monitor', label: '实时监控', icon: EyeOutlined },
  { key: '/stats', label: '节点统计', icon: BarChartOutlined },
];

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();

  const menuItems = navigation.map(item => ({
    key: item.key,
    icon: <item.icon />,
    label: (
      <Link href={item.key} style={{ textDecoration: 'none' }} onClick={() => setDrawerOpen(false)}>
        {item.label}
      </Link>
    ),
  }));

  const siderContent = (
    <>
      <div
        style={{
          padding: '16px',
          borderBottom: '1px solid #f0f0f0',
          textAlign: 'center',
        }}
      >
        <Title level={4} style={{ margin: 0, color: '#fff' }}>
          新闻知识图谱
        </Title>
      </div>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[pathname]}
        items={menuItems}
        style={{ border: 'none' }}
      />
    </>
  );

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      {/* 桌面端侧边栏 */}
      <Sider
        width={256}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
        }}
        className="hidden-mobile"
      >
        {siderContent}
      </Sider>

      {/* 移动端抽屉 */}
      <Drawer
        title="新闻知识图谱"
        placement="left"
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
        width={256}
        styles={{ body: { padding: 0 } }}
        className="drawer-mobile"
      >
        <Menu
          mode="inline"
          selectedKeys={[pathname]}
          items={menuItems}
          style={{ border: 'none' }}
        />
      </Drawer>

      <AntLayout style={{ marginLeft: 256 }} className="main-layout">
        {/* 移动端顶部导航 */}
        <Header
          style={{
            padding: '0 16px',
            background: '#fff',
            boxShadow: '0 1px 4px rgba(0,21,41,.08)',
            display: 'none',
          }}
          className="mobile-header"
        >
          <Button
            type="text"
            icon={<MenuOutlined />}
            onClick={() => setDrawerOpen(true)}
            style={{
              fontSize: '16px',
              width: 64,
              height: 64,
            }}
          />
        </Header>

        {/* 主内容区域 */}
        <Content
          style={{
            margin: '24px',
            padding: '24px',
            background: '#fff',
            borderRadius: '8px',
            minHeight: 'calc(100vh - 48px)',
          }}
        >
          {children}
        </Content>
      </AntLayout>

      <style jsx global>{`
        @media (max-width: 768px) {
          .hidden-mobile {
            display: none !important;
          }
          .main-layout {
            margin-left: 0 !important;
          }
          .mobile-header {
            display: flex !important;
          }
        }

        @media (min-width: 769px) {
          .drawer-mobile {
            display: none;
          }
        }
      `}</style>
    </AntLayout>
  );
}

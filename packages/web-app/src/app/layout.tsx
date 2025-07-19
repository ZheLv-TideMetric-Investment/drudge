import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '大公报纸 • 知识图谱系统',
  description: '基于AI的新闻知识图谱分析和可视化平台 - 传统报纸风格设计',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <head>
        {/* 预加载中文字体 */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* 如果需要网络字体，可以在这里添加 */}
      </head>
      <body className="newspaper-page antialiased">
        {children}
      </body>
    </html>
  );
}

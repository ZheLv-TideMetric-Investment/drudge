import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '长婷报社 • 你的理财大学生',
  description: '长婷报社，你的理财大学生',
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

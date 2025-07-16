import { Card as AntCard, Typography, Space } from 'antd';

const { Title, Text } = Typography;

interface CardProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  loading?: boolean;
  bordered?: boolean;
  hoverable?: boolean;
  size?: 'default' | 'small';
  style?: React.CSSProperties;
  extra?: React.ReactNode;
}

export function Card({
  children,
  className,
  title,
  subtitle,
  action,
  loading = false,
  bordered = true,
  hoverable = false,
  size = 'default',
  style,
  extra,
}: CardProps) {
  const cardTitle = title ? (
    <Space direction="vertical" size={0}>
      <Title level={5} style={{ margin: 0 }}>
        {title}
      </Title>
      {subtitle && (
        <Text type="secondary" style={{ fontSize: '14px' }}>
          {subtitle}
        </Text>
      )}
    </Space>
  ) : undefined;

  return (
    <AntCard
      title={cardTitle}
      extra={extra || action}
      loading={loading}
      bordered={bordered}
      hoverable={hoverable}
      size={size}
      className={className}
      style={style}
    >
      {children}
    </AntCard>
  );
}

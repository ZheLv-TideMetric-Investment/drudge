import { Spin, Typography } from 'antd';

const { Text } = Typography;

interface LoadingProps {
  size?: 'small' | 'default' | 'large';
  className?: string;
  text?: string;
  spinning?: boolean;
  style?: React.CSSProperties;
}

export function Loading({
  size = 'default',
  className,
  text,
  spinning = true,
  style,
}: LoadingProps) {
  return (
    <div
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        ...style,
      }}
    >
      <Spin size={size} spinning={spinning} />
      {text && (
        <Text
          type="secondary"
          style={{
            marginTop: '12px',
            textAlign: 'center',
            fontSize: size === 'large' ? '16px' : size === 'small' ? '12px' : '14px',
          }}
        >
          {text}
        </Text>
      )}
    </div>
  );
}

interface LoadingOverlayProps {
  children: React.ReactNode;
  loading: boolean;
  text?: string;
  size?: 'small' | 'default' | 'large';
  style?: React.CSSProperties;
}

export function LoadingOverlay({
  children,
  loading,
  text,
  size = 'default',
  style,
}: LoadingOverlayProps) {
  return (
    <Spin spinning={loading} tip={text} size={size} style={style}>
      {children}
    </Spin>
  );
}

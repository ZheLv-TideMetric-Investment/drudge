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
        padding: 'var(--space-xl)',
        ...style,
      }}
    >
      <Spin size={size} spinning={spinning} />
      {text && (
        <Text
          type="secondary"
          style={{
            marginTop: 'var(--space-md)',
            textAlign: 'center',
            fontSize: size === 'large' ? 'var(--font-size-xl)' : size === 'small' ? 'var(--font-size-base)' : 'var(--font-size-lg)',
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

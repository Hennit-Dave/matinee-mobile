import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { useTheme } from '../theme';
import { primitives, type SemanticToken } from '../tokens/tokens';

export type IconName =
  | 'search'
  | 'close'
  | 'info'
  | 'error'
  | 'success'
  | 'chevron-left'
  | 'chevron-right';

export type IconSize = 'sm' | 'md' | 'lg';

const SIZE_MAP: Record<IconSize, number> = {
  sm: primitives['size/icon-sm'],
  md: primitives['size/icon-md'],
  lg: primitives['size/icon-lg'],
};

export interface IconProps {
  name: IconName;
  size?: IconSize;
  color?: SemanticToken;
  accessibilityLabel?: string;
}

export function Icon({ name, size = 'lg', color = 'text/primary', accessibilityLabel }: IconProps) {
  const { colors } = useTheme();
  const px = SIZE_MAP[size];
  const stroke = colors[color];

  return (
    <Svg
      width={px}
      height={px}
      viewBox="0 0 24 24"
      fill="none"
      accessibilityLabel={accessibilityLabel}
      accessible={Boolean(accessibilityLabel)}
    >
      {name === 'search' ? (
        <>
          <Circle cx={11} cy={11} r={7} stroke={stroke} strokeWidth={2} />
          <Line x1={16.5} y1={16.5} x2={21} y2={21} stroke={stroke} strokeWidth={2} strokeLinecap="round" />
        </>
      ) : null}
      {name === 'close' ? (
        <>
          <Line x1={18} y1={6} x2={6} y2={18} stroke={stroke} strokeWidth={2} strokeLinecap="round" />
          <Line x1={6} y1={6} x2={18} y2={18} stroke={stroke} strokeWidth={2} strokeLinecap="round" />
        </>
      ) : null}
      {name === 'info' ? (
        <>
          <Circle cx={12} cy={12} r={9} stroke={stroke} strokeWidth={2} />
          <Line x1={12} y1={11} x2={12} y2={16} stroke={stroke} strokeWidth={2} strokeLinecap="round" />
          <Circle cx={12} cy={8} r={1} fill={stroke} />
        </>
      ) : null}
      {name === 'error' ? (
        <>
          <Circle cx={12} cy={12} r={9} stroke={stroke} strokeWidth={2} />
          <Line x1={12} y1={8} x2={12} y2={13} stroke={stroke} strokeWidth={2} strokeLinecap="round" />
          <Circle cx={12} cy={16} r={1} fill={stroke} />
        </>
      ) : null}
      {name === 'success' ? (
        <>
          <Circle cx={12} cy={12} r={9} stroke={stroke} strokeWidth={2} />
          <Polyline points="8.5 12.5 11 15 15.5 9.5" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </>
      ) : null}
      {name === 'chevron-left' ? (
        <Polyline points="15 6 9 12 15 18" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      ) : null}
      {name === 'chevron-right' ? (
        <Polyline points="9 6 15 12 9 18" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      ) : null}
    </Svg>
  );
}

import Svg, { Circle, Line, Path, Polyline } from 'react-native-svg';
import { useTheme } from '../theme';
import { primitives, type SemanticToken } from '../tokens/tokens';

export type IconName =
  | 'search'
  | 'close'
  | 'info'
  | 'error'
  | 'success'
  | 'chevron-left'
  | 'chevron-right'
  | 'home'
  | 'ticket'
  | 'user';

export type IconSize = 'sm' | 'md' | 'lg';

const SIZE_MAP: Record<IconSize, number> = {
  sm: primitives['size/icon-sm'],
  md: primitives['size/icon-md'],
  lg: primitives['size/icon-lg'],
};

// Shared stroke style for the icons whose geometry comes straight from the Figma `Icons` frame (17:2).
const STROKE = { strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' } as const;

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
      {name === 'home' ? (
        <>
          <Path d="M5 12H3L12 3L21 12H19" {...STROKE} stroke={stroke} />
          <Path
            d="M5 12V19C5 19.5304 5.21071 20.0391 5.58579 20.4142C5.96086 20.7893 6.46957 21 7 21H17C17.5304 21 18.0391 20.7893 18.4142 20.4142C18.7893 20.0391 19 19.5304 19 19V12"
            {...STROKE}
            stroke={stroke}
          />
          <Path
            d="M9 21V15C9 14.4696 9.21071 13.9609 9.58579 13.5858C9.96086 13.2107 10.4696 13 11 13H13C13.5304 13 14.0391 13.2107 14.4142 13.5858C14.7893 13.9609 15 14.4696 15 15V21"
            {...STROKE}
            stroke={stroke}
          />
        </>
      ) : null}
      {name === 'ticket' ? (
        <>
          <Path d="M15 5V7" {...STROKE} stroke={stroke} />
          <Path d="M15 11V13" {...STROKE} stroke={stroke} />
          <Path d="M15 17V19" {...STROKE} stroke={stroke} />
          <Path
            d="M5 5H19C19.5304 5 20.0391 5.21071 20.4142 5.58579C20.7893 5.96086 21 6.46957 21 7V10C20.4696 10 19.9609 10.2107 19.5858 10.5858C19.2107 10.9609 19 11.4696 19 12C19 12.5304 19.2107 13.0391 19.5858 13.4142C19.9609 13.7893 20.4696 14 21 14V17C21 17.5304 20.7893 18.0391 20.4142 18.4142C20.0391 18.7893 19.5304 19 19 19H5C4.46957 19 3.96086 18.7893 3.58579 18.4142C3.21071 18.0391 3 17.5304 3 17V14C3.53043 14 4.03914 13.7893 4.41421 13.4142C4.78929 13.0391 5 12.5304 5 12C5 11.4696 4.78929 10.9609 4.41421 10.5858C4.03914 10.2107 3.53043 10 3 10V7C3 6.46957 3.21071 5.96086 3.58579 5.58579C3.96086 5.21071 4.46957 5 5 5Z"
            {...STROKE}
            stroke={stroke}
          />
        </>
      ) : null}
      {name === 'user' ? (
        <>
          <Path
            d="M8 7C8 8.06087 8.42143 9.07828 9.17157 9.82843C9.92172 10.5786 10.9391 11 12 11C13.0609 11 14.0783 10.5786 14.8284 9.82843C15.5786 9.07828 16 8.06087 16 7C16 5.93913 15.5786 4.92172 14.8284 4.17157C14.0783 3.42143 13.0609 3 12 3C10.9391 3 9.92172 3.42143 9.17157 4.17157C8.42143 4.92172 8 5.93913 8 7Z"
            {...STROKE}
            stroke={stroke}
          />
          <Path
            d="M6 21V19C6 17.9391 6.42143 16.9217 7.17157 16.1716C7.92172 15.4214 8.93913 15 10 15H14C15.0609 15 16.0783 15.4214 16.8284 16.1716C17.5786 16.9217 18 17.9391 18 19V21"
            {...STROKE}
            stroke={stroke}
          />
        </>
      ) : null}
    </Svg>
  );
}

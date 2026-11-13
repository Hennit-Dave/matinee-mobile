import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { useTheme } from '../theme';
import type { SemanticToken, TextStyleToken } from '../tokens/tokens';

export type TextVariant =
  | 'display'
  | 'title-lg'
  | 'title'
  | 'body-lg'
  | 'body'
  | 'label-lg'
  | 'label'
  | 'caption'
  | 'numeral';

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  color?: Extract<
    SemanticToken,
    | 'text/primary'
    | 'text/secondary'
    | 'text/disabled'
    | 'text/on-primary'
    | 'text/on-secondary'
    | 'text/on-urgent'
    | 'status/error'
    | 'status/info'
    | 'status/success'
    | 'status/warning'
  >;
  tabularNums?: boolean;
}

export function Text({
  variant = 'body',
  color = 'text/primary',
  tabularNums = false,
  style,
  ...rest
}: TextProps) {
  const { colors, text } = useTheme();
  const typeKey: TextStyleToken = `type/${variant}`;
  const tabularStyle: TextStyle | undefined = tabularNums ? { fontVariant: ['tabular-nums'] } : undefined;

  return <RNText style={[text[typeKey], { color: colors[color] }, tabularStyle, style]} {...rest} />;
}

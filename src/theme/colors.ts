import { semantic, type SemanticToken, type ThemeMode } from '../tokens/tokens';

/** The semantic token values for one mode, keyed exactly as `tokens.ts` names them. */
export type ColorTokens = Record<SemanticToken, string>;

export function colorsFor(mode: ThemeMode): ColorTokens {
  return semantic[mode];
}

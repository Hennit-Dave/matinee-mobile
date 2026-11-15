import { type ReactNode, useId, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useTheme } from '../theme';
import { primitives } from '../tokens/tokens';
import { Skeleton } from './Skeleton';

const STATUS_SCRIM_HEIGHT = 112;

/**
 * react-native-svg ignores the alpha channel inside `rgba(r, g, b, a)` on `stopColor` unless
 * `stopOpacity` is passed explicitly. Splitting `rgba(...)` into `rgb(...)` + `stopOpacity` keeps
 * all gradient stops token-driven while rendering true transparency.
 */
export function svgStopProps(tokenColor: string): { stopColor: string; stopOpacity: number } {
  const match = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([0-9.]+)\s*)?\)$/i.exec(
    tokenColor.trim()
  );
  if (!match) {
    return { stopColor: tokenColor, stopOpacity: 1 };
  }
  const [, r, g, b, alpha] = match;
  return {
    stopColor: `rgb(${r}, ${g}, ${b})`,
    stopOpacity: alpha !== undefined ? Number(alpha) : 1,
  };
}

export interface HeroBackdropProps {
  height: number;
  imageUrl?: string | null;
  fallbackImageUrl?: string | null;
  accessibilityLabel?: string;
  loading?: boolean;
  children?: ReactNode;
}

export function HeroBackdrop({
  height,
  imageUrl = null,
  fallbackImageUrl = null,
  accessibilityLabel,
  loading = false,
  children,
}: HeroBackdropProps) {
  const { colors } = useTheme();
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const fadeId = `heroFadeToSurface-${uid}`;
  const scrimId = `heroStatusScrim-${uid}`;

  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [failedPrimaryUrl, setFailedPrimaryUrl] = useState<string | null>(null);
  const [failedFallbackUrl, setFailedFallbackUrl] = useState<string | null>(null);

  const primaryAvailable = Boolean(imageUrl) && failedPrimaryUrl !== imageUrl;
  const fallbackAvailable = Boolean(fallbackImageUrl) && failedFallbackUrl !== fallbackImageUrl;
  const activeUrl = primaryAvailable ? imageUrl : fallbackAvailable ? fallbackImageUrl : null;
  const imageLoaded = activeUrl !== null && loadedUrl === activeUrl;

  const fadeStart = svgStopProps(colors['surface/default-clear']);
  const fadeEnd = svgStopProps(colors['surface/default']);
  const scrimStart = svgStopProps(colors['surface/scrim']);
  const scrimEnd = svgStopProps(colors['surface/scrim-clear']);

  return (
    <View style={[styles.hero, { height }]}>
      {loading ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors['skeleton/base'] }]} />
      ) : (
        <>
          {!imageLoaded ? (
            <View style={styles.mediaFill}>
              <Skeleton shape="block" width="100%" height={height} />
            </View>
          ) : null}
          {activeUrl ? (
            <Image
              source={{ uri: activeUrl }}
              resizeMode="cover"
              accessibilityLabel={accessibilityLabel}
              onLoad={() => setLoadedUrl(activeUrl)}
              onError={() => {
                if (activeUrl === imageUrl) {
                  setFailedPrimaryUrl(activeUrl);
                } else {
                  setFailedFallbackUrl(activeUrl);
                }
              }}
              style={styles.mediaFill}
            />
          ) : null}
        </>
      )}

      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id={fadeId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0.3" stopColor={fadeStart.stopColor} stopOpacity={fadeStart.stopOpacity} />
              <Stop offset="0.92" stopColor={fadeEnd.stopColor} stopOpacity={fadeEnd.stopOpacity} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${fadeId})`} />
        </Svg>
      </View>

      <View pointerEvents="none" style={styles.statusScrim}>
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id={scrimId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={scrimStart.stopColor} stopOpacity={scrimStart.stopOpacity} />
              <Stop offset="1" stopColor={scrimEnd.stopColor} stopOpacity={scrimEnd.stopOpacity} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${scrimId})`} />
        </Svg>
      </View>

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    width: '100%',
    overflow: 'hidden',
    padding: primitives['space/4'],
    justifyContent: 'flex-end',
    gap: primitives['space/2'],
  },
  mediaFill: {
    ...StyleSheet.absoluteFill,
  },
  statusScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: STATUS_SCRIM_HEIGHT,
  },
});

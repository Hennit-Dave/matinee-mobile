import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image } from 'react-native';
import {
  HERO_CYCLE_INTERVAL_MS,
  nextHeroIndex,
  resolveHeroIndex,
  scheduleHeroAdvance,
  shouldAutoCycleHero,
  waitForImageReady,
} from './homeHelpers';

export interface UseHeroCycleParams {
  /** Number of slides the hero cycles through. */
  count: number;
  /** OS reduce-motion: no timer, always the first slide. */
  reducedMotion: boolean;
  /** How long the outgoing slide stays mounted under the incoming one. */
  settleMs: number;
  /** The image a slide will show, so it can be warmed before the cross-fade starts. */
  getImageUrl: (index: number) => string | null;
}

export interface UseHeroCycleResult {
  /** The slide currently shown. */
  index: number;
  /** The slide that will be shown next (to preload its detail). */
  nextIndex: number;
  /** The slide that just left, while it is still fading out. */
  previousIndex: number | null;
}

/**
 * Drives the Home featured hero. Advances every HERO_CYCLE_INTERVAL_MS, but only while
 * Home is focused and OS reduce-motion is off. The timer is cancelled on blur, and the next
 * slide's image is warmed first so the cross-fade never reveals a skeleton.
 */
export function useHeroCycle({
  count,
  reducedMotion,
  settleMs,
  getImageUrl,
}: UseHeroCycleParams): UseHeroCycleResult {
  const [rawIndex, setRawIndex] = useState(0);
  const [rawPrevious, setRawPrevious] = useState<number | null>(null);
  const [isFocused, setIsFocused] = useState(true);

  const getImageUrlRef = useRef(getImageUrl);
  useEffect(() => {
    getImageUrlRef.current = getImageUrl;
  });

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => setIsFocused(false);
    }, [])
  );

  const index = resolveHeroIndex(rawIndex, count, reducedMotion);
  const nextIndex = nextHeroIndex(index, count);
  const enabled = shouldAutoCycleHero({ count, isFocused, reducedMotion });

  useEffect(() => {
    if (!enabled) return undefined;
    return scheduleHeroAdvance({
      intervalMs: HERO_CYCLE_INTERVAL_MS,
      prepare: () =>
        waitForImageReady(getImageUrlRef.current(nextIndex), (url) => Image.prefetch(url)),
      onAdvance: () => {
        setRawPrevious(index);
        setRawIndex(nextIndex);
      },
    });
  }, [enabled, index, nextIndex]);

  useEffect(() => {
    if (rawPrevious === null) return undefined;
    const handle = setTimeout(() => setRawPrevious(null), settleMs);
    return () => clearTimeout(handle);
  }, [rawPrevious, rawIndex, settleMs]);

  const resolvedPrevious =
    rawPrevious === null || reducedMotion ? null : resolveHeroIndex(rawPrevious, count, false);

  return {
    index,
    nextIndex,
    previousIndex: resolvedPrevious === index ? null : resolvedPrevious,
  };
}

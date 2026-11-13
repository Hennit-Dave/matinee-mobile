import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * Whether the user turned on "Reduce Transparency". Only iOS has that setting; Android has no
 * equivalent system flag, so it is always false there (the NavBar falls back to solid on Android
 * where blur cannot be drawn instead, see navBarLogic).
 */
export function useReduceTransparency(): boolean {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    let mounted = true;
    AccessibilityInfo.isReduceTransparencyEnabled()
      .then((enabled) => {
        if (mounted) setReduce(enabled);
      })
      .catch(() => {
        // If the setting cannot be read, keep the default (glass).
      });
    const subscription = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduce);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduce;
}

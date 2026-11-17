import { useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { isPollingActive } from './seatsPolling';

/**
 * True while this screen is on top AND the app is in the foreground. The seat map polls only then, so a screen
 * that is covered by another (later: checkout) or a phone in a pocket asks the server for nothing.
 */
export function usePollActive(): boolean {
  const focused = useIsFocused();
  const [appState, setAppState] = useState<string>(AppState.currentState ?? 'active');

  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => subscription.remove();
  }, []);

  return isPollingActive({ focused, appState });
}

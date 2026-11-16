import { randomUUID } from 'expo-crypto';
import { getItemAsync, setItemAsync } from 'expo-secure-store';
import { Platform } from 'react-native';
import { CLIENT_ID_STORAGE_KEY, createClientIdProvider, type ClientIdStorage } from './clientId';

/**
 * The real wiring for clientId.ts: the id lives in `expo-secure-store` (Android Keystore, iOS Keychain) and is
 * made with `expo-crypto`'s `randomUUID()`. Kept apart from clientId.ts because these two packages load native
 * modules, which the plain `node --test` runs cannot.
 *
 * On the web there is no secure storage, so the id lasts for the session. (The app ships on Android.)
 */
const storage: ClientIdStorage = {
  read: () => getItemAsync(CLIENT_ID_STORAGE_KEY),
  write: (value) => setItemAsync(CLIENT_ID_STORAGE_KEY, value),
};

export const getClientId = createClientIdProvider({
  storage: Platform.OS === 'web' ? null : storage,
  generate: randomUUID,
});

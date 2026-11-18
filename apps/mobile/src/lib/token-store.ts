import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Tokens live ONLY in the device keychain/keystore (never AsyncStorage —
// plaintext on disk). On web (used for the CI bundle check and dev preview)
// SecureStore doesn't exist, so an in-memory fallback keeps the bundle
// working; web sessions simply don't survive a reload.
const ACCESS_KEY = 'classmode.accessToken';
const REFRESH_KEY = 'classmode.refreshToken';

const memory = new Map<string, string>();
const isWeb = Platform.OS === 'web';

async function getItem(key: string): Promise<string | null> {
  if (isWeb) return memory.get(key) ?? null;
  return SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    memory.set(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function deleteItem(key: string): Promise<void> {
  if (isWeb) {
    memory.delete(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export type StoredTokens = { accessToken: string; refreshToken: string };

export async function getTokens(): Promise<StoredTokens | null> {
  const [accessToken, refreshToken] = await Promise.all([
    getItem(ACCESS_KEY),
    getItem(REFRESH_KEY),
  ]);
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export async function setTokens(tokens: StoredTokens): Promise<void> {
  await Promise.all([
    setItem(ACCESS_KEY, tokens.accessToken),
    setItem(REFRESH_KEY, tokens.refreshToken),
  ]);
}

export async function clearTokens(): Promise<void> {
  await Promise.all([deleteItem(ACCESS_KEY), deleteItem(REFRESH_KEY)]);
}

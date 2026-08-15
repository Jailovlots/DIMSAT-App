/**
 * ThemeContext – persisted user theme preference.
 *
 * Wraps the native Appearance API so that:
 *  - On iOS/Android, `Appearance.setColorScheme` is called so native components follow.
 *  - On Web, React Native Web ignores `Appearance.setColorScheme`, so we apply
 *    `document.documentElement.dataset.theme` and keep our own state for the
 *    `useTheme()` hook instead of relying on `useColorScheme()`.
 *
 * Storage key: @attenda/theme-v1
 * Values: 'system' | 'light' | 'dark'
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Appearance, Platform, useColorScheme } from 'react-native';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

type ThemeContextValue = {
  /** The user's explicit preference ('system' means follow device). */
  preference: ThemePreference;
  /** The actually applied theme after resolving 'system'. */
  theme: ResolvedTheme;
  isDark: boolean;
  setPreference: (pref: ThemePreference) => Promise<void>;
  /** Convenience toggle: flips between light and dark. */
  toggle: () => Promise<void>;
};

const STORAGE_KEY = '@attenda/theme-v1';

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyWebTheme(theme: ResolvedTheme) {
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    document.documentElement.dataset.theme = theme;
    // Also set color-scheme CSS property so native scrollbars etc follow
    document.documentElement.style.colorScheme = theme;
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme(); // 'light' | 'dark' | null
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [loaded, setLoaded] = useState(false);

  // Hydrate persisted preference
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw === 'light' || raw === 'dark' || raw === 'system') {
          setPreferenceState(raw);
        }
      })
      .finally(() => setLoaded(true));
  }, []);

  const resolvedTheme: ResolvedTheme = useMemo(() => {
    if (preference === 'light') return 'light';
    if (preference === 'dark') return 'dark';
    return systemScheme === 'dark' ? 'dark' : 'light';
  }, [preference, systemScheme]);

  // Sync resolved theme to native Appearance and web DOM
  useEffect(() => {
    if (!loaded) return;
    // Native: set the appearance override
    if (Platform.OS !== 'web') {
      Appearance.setColorScheme(preference === 'system' ? null : preference);
    }
    // Web: update data-theme on <html>
    applyWebTheme(resolvedTheme);
  }, [preference, resolvedTheme, loaded]);

  const setPreference = useCallback(async (pref: ThemePreference) => {
    setPreferenceState(pref);
    await AsyncStorage.setItem(STORAGE_KEY, pref);
  }, []);

  const toggle = useCallback(async () => {
    const next: ThemePreference = resolvedTheme === 'dark' ? 'light' : 'dark';
    await setPreference(next);
  }, [resolvedTheme, setPreference]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      theme: resolvedTheme,
      isDark: resolvedTheme === 'dark',
      setPreference,
      toggle,
    }),
    [preference, resolvedTheme, setPreference, toggle],
  );

  // Always render the Provider – before AsyncStorage resolves we use the
  // system scheme as the default so child components never get a null context.
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}

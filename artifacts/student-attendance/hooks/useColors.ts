import colors from '@/constants/colors';
import { useTheme } from '@/context/ThemeContext';

/**
 * Returns the design tokens for the current color scheme.
 *
 * Reads from ThemeContext (which persists user preference and works on all
 * platforms including web, where useColorScheme() alone cannot be overridden
 * by Appearance.setColorScheme).
 *
 * Falls back to the light palette when no dark key is defined in
 * constants/colors.ts (the scaffold ships light-only by default).
 */
export function useColors() {
  const { isDark } = useTheme();
  const palette =
    isDark && 'dark' in colors
      ? (colors as unknown as { dark: typeof colors.light }).dark
      : colors.light;
  return { ...palette, radius: colors.radius };
}


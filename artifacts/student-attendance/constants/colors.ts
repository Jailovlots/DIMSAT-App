/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    text: '#102a43',
    tint: '#1d9e89',
    background: '#f5f6f0',
    foreground: '#102a43',
    card: '#fffdf8',
    cardForeground: '#102a43',
    primary: '#0b3954',
    primaryForeground: '#f5f6f0',
    secondary: '#e2eee9',
    secondaryForeground: '#164e63',
    muted: '#e7ebe4',
    mutedForeground: '#62727a',
    accent: '#48d6bd',
    accentForeground: '#073b4c',
    destructive: '#c95f58',
    destructiveForeground: '#fff8f1',
    border: '#d7e0da',
    input: '#d0ddd6',
    success: '#16836f',
    warning: '#b8793f',
    inkSoft: '#31536a',
    darkSurface: '#0b253b',
    cream: '#fff8ed',
  },
  dark: {
    text: '#edf3ee',
    tint: '#65e1ca',
    background: '#081c2b',
    foreground: '#edf3ee',
    card: '#102d42',
    cardForeground: '#edf3ee',
    primary: '#65e1ca',
    primaryForeground: '#082235',
    secondary: '#17394d',
    secondaryForeground: '#c9f1e8',
    muted: '#173144',
    mutedForeground: '#a8bdc0',
    accent: '#65e1ca',
    accentForeground: '#082235',
    destructive: '#ee8b80',
    destructiveForeground: '#291412',
    border: '#284557',
    input: '#315365',
    success: '#65e1ca',
    warning: '#e4b17a',
    inkSoft: '#b6d4d7',
    darkSurface: '#071a2a',
    cream: '#fff8ed',
  },
  radius: 18,
};

export default colors;

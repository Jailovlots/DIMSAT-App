/**
 * app.config.js – dynamic Expo configuration.
 *
 * Replaces the static app.json so we can switch the expo-router `origin`
 * depending on where the app is running:
 *
 *   Local dev  →  set EXPO_ORIGIN=http://localhost:8081  (via dev:web script)
 *   Replit     →  falls back to https://replit.com/       (production default)
 *
 * This fixes the "TypeError: fetch failed" error that occurs when
 * `expo start --web` tries to reach the hard-coded replit.com origin on a
 * machine that has no route to it.
 */

const PRODUCTION_ORIGIN = 'https://replit.com/';

module.exports = ({ config }) => {
  const origin = process.env.EXPO_ORIGIN || PRODUCTION_ORIGIN;

  return {
    ...config,
    name: 'DIMSAT',
    slug: 'workspace',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/attenda-icon.png',
    scheme: 'student-attendance',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    splash: {
      image: './assets/images/attenda-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#f5f6f0',
    },
    ios: {
      supportsTablet: false,
    },
    android: {
      package: 'com.tarttol.workspace',
    },
    extra: {
      eas: {
        projectId: '8e4586c8-8114-48db-8166-d62467916339',
      },
    },
    web: {
      favicon: './assets/images/attenda-icon.png',
    },
    plugins: [
      [
        'expo-router',
        {
          origin,
        },
      ],
      'expo-font',
      'expo-web-browser',
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
      baseUrl: '/student',
    },
  };
};


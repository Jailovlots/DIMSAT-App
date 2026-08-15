import React, { useEffect } from 'react';
import { Image, Platform } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ThemeProvider } from '@/context/ThemeContext';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Feather, Ionicons, MaterialIcons, MaterialCommunityIcons, FontAwesome } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { AttendanceProvider } from '@/context/AttendanceContext';

const featherFont = require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Feather.ttf');
const ioniconsFont = require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf');
const materialFont = require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialIcons.ttf');
const materialCommunityFont = require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialCommunityIcons.ttf');
const fontAwesomeFont = require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/FontAwesome.ttf');

// Inject web CSS @font-face rules for both capitalized and lowercase font names so web browsers match vector icon fonts
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const resolveUri = (asset: any) => {
    if (!asset) return '';
    if (typeof asset === 'string') return asset;
    if (typeof asset === 'number') {
      try {
        const resolved = Image.resolveAssetSource(asset);
        if (resolved?.uri) return resolved.uri;
      } catch {
        // Fall through
      }
    }
    if (typeof asset === 'object') return asset.uri || asset.default || asset.src || '';
    return '';
  };

  const cdn = {
    feather: 'https://cdn.jsdelivr.net/npm/@expo/vector-icons@14.0.0/build/vendor/react-native-vector-icons/Fonts/Feather.ttf',
    ionicons: 'https://cdn.jsdelivr.net/npm/@expo/vector-icons@14.0.0/build/vendor/react-native-vector-icons/Fonts/Ionicons.ttf',
    material: 'https://cdn.jsdelivr.net/npm/@expo/vector-icons@14.0.0/build/vendor/react-native-vector-icons/Fonts/MaterialIcons.ttf',
    materialCommunity: 'https://cdn.jsdelivr.net/npm/@expo/vector-icons@14.0.0/build/vendor/react-native-vector-icons/Fonts/MaterialCommunityIcons.ttf',
    fontAwesome: 'https://cdn.jsdelivr.net/npm/@expo/vector-icons@14.0.0/build/vendor/react-native-vector-icons/Fonts/FontAwesome.ttf',
  };

  const makeSrc = (asset: any, cdnUrl: string) => {
    const uri = resolveUri(asset);
    if (uri && uri.trim().length > 0) {
      return `url('${uri}') format('truetype'), url('${cdnUrl}') format('truetype')`;
    }
    return `url('${cdnUrl}') format('truetype')`;
  };

  const styleId = 'expo-vector-icons-web-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.type = 'text/css';
    const featherSrc = makeSrc(featherFont, cdn.feather);
    const ioniconsSrc = makeSrc(ioniconsFont, cdn.ionicons);
    const materialSrc = makeSrc(materialFont, cdn.material);
    const materialCommunitySrc = makeSrc(materialCommunityFont, cdn.materialCommunity);
    const fontAwesomeSrc = makeSrc(fontAwesomeFont, cdn.fontAwesome);

    style.textContent = `
      @font-face { font-family: 'Feather'; src: ${featherSrc}; font-display: swap; }
      @font-face { font-family: 'feather'; src: ${featherSrc}; font-display: swap; }
      @font-face { font-family: 'Ionicons'; src: ${ioniconsSrc}; font-display: swap; }
      @font-face { font-family: 'ionicons'; src: ${ioniconsSrc}; font-display: swap; }
      @font-face { font-family: 'MaterialIcons'; src: ${materialSrc}; font-display: swap; }
      @font-face { font-family: 'Material Icons'; src: ${materialSrc}; font-display: swap; }
      @font-face { font-family: 'material'; src: ${materialSrc}; font-display: swap; }
      @font-face { font-family: 'MaterialCommunityIcons'; src: ${materialCommunitySrc}; font-display: swap; }
      @font-face { font-family: 'material-community'; src: ${materialCommunitySrc}; font-display: swap; }
      @font-face { font-family: 'FontAwesome'; src: ${fontAwesomeSrc}; font-display: swap; }
      @font-face { font-family: 'fontawesome'; src: ${fontAwesomeSrc}; font-display: swap; }
    `;
    document.head.appendChild(style);
  }
}

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: 'Back' }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Feather: featherFont,
    feather: featherFont,
    Ionicons: ioniconsFont,
    ionicons: ioniconsFont,
    MaterialIcons: materialFont,
    material: materialFont,
    'Material Icons': materialFont,
    MaterialCommunityIcons: materialCommunityFont,
    'material-community': materialCommunityFont,
    FontAwesome: fontAwesomeFont,
    fontawesome: fontAwesomeFont,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <AttendanceProvider>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <KeyboardProvider>
                  <RootLayoutNav />
                </KeyboardProvider>
              </GestureHandlerRootView>
            </AttendanceProvider>
          </QueryClientProvider>
        </ErrorBoundary>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}


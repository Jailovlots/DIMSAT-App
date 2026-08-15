import React, { useEffect } from 'react';
import { Platform } from 'react-native';
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
    if (typeof asset === 'object') return asset.uri || asset.default || asset.src || '';
    return '';
  };

  const styleId = 'expo-vector-icons-web-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.type = 'text/css';
    const featherUri = resolveUri(featherFont);
    const ioniconsUri = resolveUri(ioniconsFont);
    const materialUri = resolveUri(materialFont);
    const materialCommunityUri = resolveUri(materialCommunityFont);
    const fontAwesomeUri = resolveUri(fontAwesomeFont);

    style.textContent = `
      @font-face { font-family: 'Feather'; src: url('${featherUri}') format('truetype'); font-display: swap; }
      @font-face { font-family: 'feather'; src: url('${featherUri}') format('truetype'); font-display: swap; }
      @font-face { font-family: 'Ionicons'; src: url('${ioniconsUri}') format('truetype'); font-display: swap; }
      @font-face { font-family: 'ionicons'; src: url('${ioniconsUri}') format('truetype'); font-display: swap; }
      @font-face { font-family: 'MaterialIcons'; src: url('${materialUri}') format('truetype'); font-display: swap; }
      @font-face { font-family: 'Material Icons'; src: url('${materialUri}') format('truetype'); font-display: swap; }
      @font-face { font-family: 'material'; src: url('${materialUri}') format('truetype'); font-display: swap; }
      @font-face { font-family: 'MaterialCommunityIcons'; src: url('${materialCommunityUri}') format('truetype'); font-display: swap; }
      @font-face { font-family: 'material-community'; src: url('${materialCommunityUri}') format('truetype'); font-display: swap; }
      @font-face { font-family: 'FontAwesome'; src: url('${fontAwesomeUri}') format('truetype'); font-display: swap; }
      @font-face { font-family: 'fontawesome'; src: url('${fontAwesomeUri}') format('truetype'); font-display: swap; }
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


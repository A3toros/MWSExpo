import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Provider } from 'react-redux';
import { store, useAppDispatch, useAppSelector } from '../src/store';
import { useFonts } from 'expo-font';
import { SplashScreen, Stack } from 'expo-router';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { hydrateFailure, hydrateStart, hydrateSuccess } from '../src/store/slices/authSlice';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider as CustomThemeProvider } from '../src/contexts/ThemeContext';
import '../global.css';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Provider store={store}>
        <CustomThemeProvider>
          <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
            <AppContent />
          </ThemeProvider>
        </CustomThemeProvider>
      </Provider>
    </GestureHandlerRootView>
  );
}

function AppContent() {
  const dispatch = useAppDispatch();
  const initialized = useAppSelector((s) => s.auth.initialized);

  return (
    <>
      <HydrateAuth />
            {initialized ? (
              <Stack>
                <Stack.Screen name="auth" options={{ headerShown: false }} />
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                {/* Hide native header for all test routes; keep custom headers */}
                <Stack.Screen name="tests" options={{ headerShown: false }} />
                <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
              </Stack>
            ) : null}
    </>
  );
}

function HydrateAuth() {
  const dispatch = useAppDispatch();
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      dispatch(hydrateStart());
      try {
        const token = await AsyncStorage.getItem('auth_token');
        if (cancelled) return;
        dispatch(hydrateSuccess({ token, user: null }));
      } catch (e) {
        if (cancelled) return;
        dispatch(hydrateFailure());
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [dispatch]);
  return null;
}

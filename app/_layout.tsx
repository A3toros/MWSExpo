import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Provider } from 'react-redux';
import { store, useAppDispatch, useAppSelector } from '../src/store';
import { useFonts } from 'expo-font';
import { SplashScreen, Stack } from 'expo-router';
import { useEffect, useCallback } from 'react';
import { useColorScheme, BackHandler, AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { hydrateFailure, hydrateStart, hydrateSuccess, AuthUser } from '../src/store/slices/authSlice';
import { SecureToken } from '../src/utils/secureTokenStorage';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider as CustomThemeProvider } from '../src/contexts/ThemeContext';
import { usePreventScreenshots } from '../src/hooks/usePreventScreenshots';
import { notificationService } from '../src/services/notificationService';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { termsOfServiceService } from '../src/services/termsOfServiceService';
import { TermsOfServiceModal } from '../src/components/TermsOfServiceModal';
import { useState } from 'react';
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
  const token = useAppSelector((s) => s.auth.token);
  const [showTOS, setShowTOS] = useState(false);
  const [tosChecked, setTosChecked] = useState(false);
  
  // Prevent screenshots app-wide
  usePreventScreenshots(true);

  // Check Terms of Service acceptance on startup and when app comes to foreground
  // This prevents users from bypassing ToS by minimizing/relaunching the app
  const checkTOS = useCallback(async () => {
    if (!initialized || !token) {
      // User not logged in, reset ToS check
      setTosChecked(false);
      setShowTOS(false);
      return;
    }

    try {
      const isAccepted = await termsOfServiceService.isAccepted();
      if (!isAccepted) {
        console.log('[ToS] Terms not accepted - showing modal');
        setShowTOS(true);
      } else {
        console.log('[ToS] Terms accepted - modal hidden');
        setShowTOS(false);
      }
      setTosChecked(true);
    } catch (error) {
      console.error('[ToS] Error checking ToS:', error);
      // If error, show ToS to be safe
      setShowTOS(true);
      setTosChecked(true);
    }
  }, [initialized, token]);

  // Check ToS on app startup (when initialized and token available)
  useEffect(() => {
    if (initialized && token) {
      checkTOS();
    } else if (initialized && !token) {
      // User not logged in, reset ToS check
      setTosChecked(false);
      setShowTOS(false);
    }
  }, [initialized, token, checkTOS]);

  // Check ToS when app comes to foreground (prevents bypass by minimizing/relaunching)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && initialized && token && tosChecked) {
        // App came to foreground - re-check ToS to prevent bypass
        console.log('[ToS] App came to foreground - re-checking ToS acceptance');
        checkTOS();
      }
    });

    return () => {
      subscription?.remove();
    };
  }, [initialized, token, tosChecked, checkTOS]);

  // Initialize notification service on app startup (after ToS accepted)
  useEffect(() => {
    if (initialized && token && tosChecked && !showTOS) {
      notificationService.initialize().catch((error) => {
        console.error('Failed to initialize notification service:', error);
      });
    }
  }, [initialized, token, tosChecked, showTOS]);

  const handleTOSAccept = async () => {
    try {
      await termsOfServiceService.accept();
      setShowTOS(false);
    } catch (error) {
      console.error('Error accepting ToS:', error);
    }
  };

  const handleTOSDecline = () => {
    // Exit app when user declines ToS (Google Play requirement)
    BackHandler.exitApp();
  };


  // Handle notification taps
  useEffect(() => {
    if (!initialized) return;

    // Handle notification received while app is in foreground
    const notificationReceivedListener = Notifications.addNotificationReceivedListener((notification) => {
      console.log('[App] Notification received:', notification);
    });

    // Handle notification tap
    const notificationResponseListener = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      console.log('[App] Notification tapped:', data);

      // Navigate based on notification type
      if (data?.type === 'new_test' || data?.type === 'retest') {
        const testType = data.test_type;
        const testId = data.test_id;

        if (testType && testId) {
          // Map test types to routes
          const routeMap: Record<string, string> = {
            multiple_choice: 'multiple-choice',
            'multiple-choice': 'multiple-choice',
            true_false: 'true-false',
            'true-false': 'true-false',
            input: 'input',
            fill_blanks: 'fill-blanks',
            'fill-blanks': 'fill-blanks',
            drawing: 'drawing',
            matching: 'matching',
            matching_type: 'matching',
            word_matching: 'word-matching',
            'word-matching': 'word-matching',
            speaking: 'speaking',
          };

          const routeType = routeMap[testType] || testType;
          const route = `/tests/${routeType}/${testId}`;
          
          console.log('[App] Navigating to test:', route);
          router.push(route as any);
        }
      }
    });

    return () => {
      notificationReceivedListener.remove();
      notificationResponseListener.remove();
    };
  }, [initialized]);

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
      <TermsOfServiceModal
        visible={showTOS}
        onAccept={handleTOSAccept}
        onDecline={handleTOSDecline}
      />
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
        // Load token from SecureToken (with fallback to AsyncStorage)
        let token: string | null = null;
        try {
          token = await SecureToken.get();
        } catch (e) {
          // Fallback to AsyncStorage if SecureToken fails
          token = await AsyncStorage.getItem('auth_token');
        }
        
        // Load user data from AsyncStorage
        let user: AuthUser | null = null;
        if (token) {
          try {
            const authUserStr = await AsyncStorage.getItem('auth_user');
            if (authUserStr) {
              user = JSON.parse(authUserStr);
              console.log('[HydrateAuth] Loaded user from storage:', user);
            } else {
              // Fallback: try to extract user info from JWT token
              try {
                const parts = token.split('.');
                if (parts.length === 3) {
                  const payload = JSON.parse(atob(parts[1]));
                  user = {
                    student_id: payload.student_id || payload.id || payload.user_id || '',
                    name: payload.name || '',
                    surname: payload.surname || '',
                    grade: payload.grade || '',
                    class: payload.class || '',
                    role: payload.role || 'student',
                  };
                  console.log('[HydrateAuth] Extracted user from JWT:', user);
                }
              } catch (jwtError) {
                console.warn('[HydrateAuth] Failed to extract user from JWT:', jwtError);
              }
            }
          } catch (userError) {
            console.error('[HydrateAuth] Error loading user data:', userError);
          }
        }
        
        if (cancelled) return;
        dispatch(hydrateSuccess({ token, user }));
      } catch (e) {
        if (cancelled) return;
        console.error('[HydrateAuth] Error during hydration:', e);
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

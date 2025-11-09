import { useEffect, useRef } from 'react';
import { Platform, Alert } from 'react-native';
// @ts-ignore - expo-screen-capture will be installed
import * as ScreenCapture from 'expo-screen-capture';

/**
 * Hook to prevent screenshots and screen recording app-wide
 * This ensures third-party screen recording apps also record only a black screen
 * 
 * On Android: Sets FLAG_SECURE which prevents screenshots and screen recording
 *             Third-party recording apps will record only a black screen
 * On iOS: Prevents screen capture and recording
 * 
 * This should be used at the root level of the app
 */
export function usePreventScreenshots(enabled: boolean = true) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled) return;

    // Prevent screenshots and screen recording permanently
    // This sets FLAG_SECURE on Android and prevents screen capture on iOS
    // Third-party recording apps will also record only a black screen
    const preventCapture = async () => {
      try {
        await ScreenCapture.preventScreenCaptureAsync();
      } catch (error: unknown) {
        console.warn('Failed to prevent screen capture:', error);
      }
    };

    // Apply immediately
    preventCapture();

    // Detect screenshot attempts and show message
    let screenshotSubscription: any = null;
    
    try {
      // @ts-ignore - expo-screen-capture API
      screenshotSubscription = ScreenCapture.addScreenshotListener(() => {
        // Show alert when user tries to take screenshot
        Alert.alert(
          'Screen Capture Blocked',
          'This app forbids screen capture to prevent cheating.',
          [{ text: 'OK' }],
          { cancelable: true }
        );
        // Re-apply prevention
        preventCapture();
      });
    } catch (error) {
      // Screenshot listener may not be available on all platforms
      console.warn('Screenshot listener not available:', error);
    }

    // On Android, continuously re-apply to ensure FLAG_SECURE stays active
    // This prevents any third-party apps from bypassing the protection
    // FLAG_SECURE ensures that screen recording apps record only a black screen
    if (Platform.OS === 'android') {
      intervalRef.current = setInterval(() => {
        preventCapture();
      }, 1000); // Re-apply every second to ensure protection stays active
    }

    // On iOS, re-apply periodically to ensure protection stays active
    if (Platform.OS === 'ios') {
      intervalRef.current = setInterval(() => {
        preventCapture();
      }, 2000); // Re-apply every 2 seconds on iOS
    }

    // Cleanup interval and subscription on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (screenshotSubscription) {
        try {
          screenshotSubscription.remove();
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    };
  }, [enabled]);
}


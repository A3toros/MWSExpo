import { useEffect } from 'react';
import { BackHandler, Platform } from 'react-native';

/**
 * Hook to intercept Android hardware back button presses
 * 
 * @param enabled - Whether to enable back button interception
 * @param onBackPress - Callback function to execute when back button is pressed
 * 
 * @example
 * ```tsx
 * useAndroidBackButton(
 *   true,
 *   () => {
 *     console.log('Back button pressed');
 *   }
 * );
 * ```
 */
export function useAndroidBackButton(
  enabled: boolean,
  onBackPress: () => void
): void {
  useEffect(() => {
    // Only enable on Android
    if (Platform.OS !== 'android' || !enabled) {
      return;
    }

    // Handler function that intercepts back button
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (__DEV__) {
        console.log('[useAndroidBackButton] Back button pressed, calling onBackPress');
      }
      
      // Call the provided callback
      onBackPress();
      
      // Return true to prevent default back behavior
      return true;
    });

    // Cleanup: remove listener when component unmounts or enabled changes
    return () => {
      if (__DEV__) {
        console.log('[useAndroidBackButton] Removing back button listener');
      }
      backHandler.remove();
    };
  }, [enabled, onBackPress]);
}


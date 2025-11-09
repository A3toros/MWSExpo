import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from 'expo-router';

interface UseAntiCheatingDetectionOptions {
  studentId: string;
  testType: string;
  testId: string | number;
  enabled?: boolean; // Default: true
  debug?: boolean; // Default: __DEV__ (enabled in development)
}

interface UseAntiCheatingDetectionReturn {
  caughtCheating: boolean;
  visibilityChangeTimes: number;
  clearCheatingKeys: () => Promise<void>; // Call on successful submission
  isMonitoring: boolean;
  // Props to apply to TextInput components to block copy/paste and autofill
  textInputProps: {
    contextMenuHidden: boolean;
    onFocus: () => void; // Clears clipboard
    textContentType?: 'none'; // iOS: Disable autofill
    autoComplete?: 'off'; // Android: Disable autofill
    autoCorrect?: boolean; // Disable autocorrect
    spellCheck?: boolean; // Disable spell check
  };
}

export function useAntiCheatingDetection({
  studentId,
  testType,
  testId,
  enabled = true,
  debug = __DEV__,
}: UseAntiCheatingDetectionOptions): UseAntiCheatingDetectionReturn {
  const [caughtCheating, setCaughtCheating] = useState(false);
  const [visibilityChangeTimes, setVisibilityChangeTimes] = useState(0);
  const [isMonitoring, setIsMonitoring] = useState(false);

  const backgroundTimerRef = useRef<NodeJS.Timeout | null>(null);
  const debugRef = useRef(debug);
  const isMonitoringRef = useRef(false);
  const hasNavigatedAwayRef = useRef(false);

  // Update debug ref when prop changes (but don't add to dependencies)
  useEffect(() => {
    debugRef.current = debug;
  }, [debug]);

  // Stable debug function that doesn't need to be in dependency arrays
  const debugLog = useCallback((message: string, data?: any) => {
    if (debugRef.current) {
      console.log(`[🎓 AntiCheating] ${message}`, data || '');
    }
  }, []); // Empty deps - uses ref, so it's stable

  // Normalize test type (e.g., multiple-choice -> multiple_choice)
  const normalizedTestType = useMemo(() => {
    return testType.replace(/-/g, '_');
  }, [testType]);

  // Key generation functions
  const getCheatingKey = useCallback(() => {
    const testIdStr = Array.isArray(testId) ? testId[0] : String(testId || '');
    const key = `${studentId}-${normalizedTestType}_${testIdStr}_cheating_attempt`;
    debugLog('Generated cheating key', { key, studentId, testType: normalizedTestType, testId: testIdStr });
    return key;
  }, [studentId, normalizedTestType, testId, debugLog]);


  // Clear clipboard function
  const clearClipboard = useCallback(() => {
    debugLog('Clearing clipboard on TextInput focus');
    Clipboard.setStringAsync('').catch(() => {
      // Ignore errors
    });
  }, [debugLog]);

  // TextInput props for blocking copy/paste and autofill
  const textInputProps = useMemo(
    () => ({
      contextMenuHidden: true,
      onFocus: clearClipboard,
      // Disable autofill
      textContentType: 'none' as const, // iOS
      autoComplete: 'off' as const, // Android
      autoCorrect: false,
      spellCheck: false,
    }),
    [clearClipboard]
  );

  // Load existing data on mount (only once)
  useEffect(() => {
    if (!enabled || !studentId) {
      debugLog('Hook disabled or no studentId', { enabled, studentId });
      return;
    }

    debugLog('Initializing anti-cheating detection', { studentId, testType: normalizedTestType, testId });

    const loadCheatingData = async () => {
      try {
        const cheatingKey = getCheatingKey();

        // Check for existing cheating key (written by timer or previous session)
        const cheatingData = await AsyncStorage.getItem(cheatingKey);
        if (cheatingData) {
          debugLog('Found existing cheating data on mount', { key: cheatingKey, data: cheatingData });
          try {
            const parsed = JSON.parse(cheatingData);
            if (parsed.visibilityChangeTimes) {
              debugLog('Loaded existing cheating state on mount', { visibilityChangeTimes: parsed.visibilityChangeTimes, reason: parsed.reason });
              setCaughtCheating(true);
              setVisibilityChangeTimes(parsed.visibilityChangeTimes);
            } else {
              // Legacy format - increment by 1
              debugLog('Legacy format detected, incrementing');
              setCaughtCheating(true);
              setVisibilityChangeTimes((prev) => prev + 1);
            }
          } catch (e) {
            // Legacy format - just timestamp string
            debugLog('Legacy timestamp format detected');
            setCaughtCheating(true);
            setVisibilityChangeTimes((prev) => prev + 1);
          }
        } else {
          debugLog('No existing cheating data found on mount', { key: cheatingKey });
        }
      } catch (error) {
        console.warn('Error loading anti-cheating data:', error);
        debugLog('Error loading data', { error });
      }
    };

    loadCheatingData();
  }, [enabled, studentId, getCheatingKey, normalizedTestType, testId, debugLog]);


  // App state monitoring with 5-second timer
  useEffect(() => {
    if (!enabled || !studentId) return;

    let backgroundTimer: NodeJS.Timeout | null = null;
    const cheatingKey = getCheatingKey();

    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      debugLog('App state changed', { from: AppState.currentState, to: nextAppState });

      if (nextAppState === 'background' || nextAppState === 'inactive') {
        debugLog('App went to background/inactive - starting 5-second timer');
        // Start 5-second timer
        backgroundTimer = setTimeout(async () => {
          // 5 seconds passed - app was minimized too long
          // Mark as 1 cheating attempt
          const newCount = visibilityChangeTimes + 1;
          debugLog('⛔ CHEATING DETECTED: App minimized for >5 seconds', { 
            visibilityChangeTimes: newCount,
            reason: 'minimized_too_long'
          });
          await AsyncStorage.setItem(
            cheatingKey,
            JSON.stringify({
              timestamp: new Date().toISOString(),
              visibilityChangeTimes: newCount,
              caughtCheating: true,
              reason: 'minimized_too_long',
            })
          );
          setVisibilityChangeTimes((prev) => prev + 1);
          setCaughtCheating(true);
        }, 5000);

        backgroundTimerRef.current = backgroundTimer;
        debugLog('5-second timer started', { timerId: backgroundTimer });
      } else if (nextAppState === 'active') {
        // App returned to foreground
        if (backgroundTimer) {
          debugLog('App returned to foreground - clearing timer (no cheating)');
          clearTimeout(backgroundTimer);
          backgroundTimer = null;
          backgroundTimerRef.current = null;
        } else {
          debugLog('App returned to foreground - no active timer');
        }

        // Check for existing cheating data (from timer or previous session)
        const cheatingData = await AsyncStorage.getItem(cheatingKey);
        if (cheatingData) {
          debugLog('Found cheating data on app resume', { data: cheatingData });
          try {
            const parsed = JSON.parse(cheatingData);
            // Load existing cheating state (could be from timer or previous session)
            if (parsed.visibilityChangeTimes) {
              debugLog('Loading existing cheating state', { 
                visibilityChangeTimes: parsed.visibilityChangeTimes,
                reason: parsed.reason 
              });
              setVisibilityChangeTimes(parsed.visibilityChangeTimes);
            }
            if (parsed.caughtCheating) {
              setCaughtCheating(true);
            }
          } catch (e) {
            // Legacy format or parsing error
            debugLog('Error parsing cheating data', { error: e });
            setCaughtCheating(true);
          }
        } else {
          debugLog('No cheating data found on app resume');
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    setIsMonitoring(true);
    debugLog('AppState monitoring started', { enabled, studentId });

    return () => {
      debugLog('Cleaning up AppState monitoring');
      subscription?.remove();
      if (backgroundTimer) {
        clearTimeout(backgroundTimer);
      }
      if (backgroundTimerRef.current) {
        clearTimeout(backgroundTimerRef.current);
      }
    };
  }, [
    enabled,
    studentId,
    getCheatingKey,
    visibilityChangeTimes,
    debugLog,
  ]);

  // Navigation monitoring using useFocusEffect
  useFocusEffect(
    useCallback(() => {
      // Screen is focused (user is on test screen)
      debugLog('Test screen focused - monitoring started');
      
      // Load cheating data every time screen is focused (in case user returned)
      const loadCheatingDataOnFocus = async () => {
        if (!enabled || !studentId) return;
        
        try {
          const cheatingKey = getCheatingKey();
          const cheatingData = await AsyncStorage.getItem(cheatingKey);
          if (cheatingData) {
            debugLog('Found existing cheating data on focus', { key: cheatingKey, data: cheatingData });
            try {
              const parsed = JSON.parse(cheatingData);
              // User is starting test again after navigating to cabinet
              // Keep the existing count (navigate away + start again = 1 attempt per cycle)
              if (parsed.visibilityChangeTimes) {
                debugLog('User started test again after navigating to cabinet - keeping existing attempt count', { 
                  visibilityChangeTimes: parsed.visibilityChangeTimes,
                  reason: parsed.reason
                });
                setCaughtCheating(true);
                setVisibilityChangeTimes(parsed.visibilityChangeTimes);
              }
            } catch (e) {
              // Ignore parsing errors
            }
          }
        } catch (error) {
          debugLog('Error loading cheating data on focus', { error });
        }
      };
      
      loadCheatingDataOnFocus();
      
      isMonitoringRef.current = true;
      hasNavigatedAwayRef.current = false;
      setIsMonitoring(true);

      return () => {
        // Screen lost focus (user navigated away)
        debugLog('Screen lost focus - checking if should mark cheating', {
          isMonitoring: isMonitoringRef.current,
          alreadyMarked: hasNavigatedAwayRef.current,
          enabled,
          studentId
        });
        
        // Only mark as cheating if we were actually monitoring and haven't already marked it
        if (isMonitoringRef.current && !hasNavigatedAwayRef.current && enabled && studentId) {
          hasNavigatedAwayRef.current = true; // Prevent multiple triggers
          const key = getCheatingKey();
          
          // Use functional update to get current value without needing it in dependencies
          setVisibilityChangeTimes((prev) => {
            const newCount = prev + 1;
            debugLog('⛔ CHEATING DETECTED: User navigated away from test', { 
              reason: 'navigated_away',
              visibilityChangeTimes: newCount
            });
            // Write to AsyncStorage with the new count
            AsyncStorage.setItem(
              key,
              JSON.stringify({
                timestamp: new Date().toISOString(),
                visibilityChangeTimes: newCount,
                caughtCheating: true,
                reason: 'navigated_away',
              })
            ).catch((error) => {
              console.warn('Error writing cheating key on navigation:', error);
              debugLog('Error writing cheating key', { error });
            });
            return newCount;
          });
          setCaughtCheating(true);
        } else {
          debugLog('Screen lost focus but not marking cheating', { 
            isMonitoring: isMonitoringRef.current, 
            alreadyMarked: hasNavigatedAwayRef.current,
            enabled, 
            studentId 
          });
        }
        isMonitoringRef.current = false;
        setIsMonitoring(false);
      };
    }, [enabled, studentId, getCheatingKey, debugLog])
  );

  // Clear cheating keys function
  const clearCheatingKeys = useCallback(async () => {
    if (!studentId) {
      debugLog('Cannot clear keys - no studentId');
      return;
    }

    try {
      const cheatingKey = getCheatingKey();
      debugLog('Clearing anti-cheating keys', { key: cheatingKey });

      // Clear cheating key
      await AsyncStorage.removeItem(cheatingKey);

      setCaughtCheating(false);
      setVisibilityChangeTimes(0);
      debugLog('✅ Anti-cheating keys cleared successfully', { key: cheatingKey });
      console.log('🎓 Cleared anti-cheating keys');
    } catch (error) {
      console.warn('Error clearing anti-cheating keys:', error);
      debugLog('Error clearing keys', { error });
    }
  }, [studentId, getCheatingKey, debugLog]);


  return {
    caughtCheating,
    visibilityChangeTimes,
    clearCheatingKeys,
    isMonitoring,
    textInputProps,
  };
}


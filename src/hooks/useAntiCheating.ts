import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { Alert } from 'react-native';

interface CheatingEvent {
  type: 'tab_switch' | 'copy_paste' | 'screenshot' | 'timeout' | 'rapid_click';
  timestamp: string;
  severity: 'low' | 'medium' | 'high';
  details?: any;
}

interface AntiCheatingState {
  isMonitoring: boolean;
  cheatingEvents: CheatingEvent[];
  warningCount: number;
  isBlocked: boolean;
  lastActivity: string;
}

interface AntiCheatingConfig {
  maxWarnings: number;
  warningThreshold: number;
  blockOnHighSeverity: boolean;
  enableTabSwitchDetection: boolean;
  enableCopyPasteDetection: boolean;
  enableScreenshotDetection: boolean;
  enableTimeoutDetection: boolean;
  enableRapidClickDetection: boolean;
  timeoutThreshold: number; // seconds
  rapidClickThreshold: number; // clicks per second
}

const defaultConfig: AntiCheatingConfig = {
  maxWarnings: 3,
  warningThreshold: 2,
  blockOnHighSeverity: true,
  enableTabSwitchDetection: true,
  enableCopyPasteDetection: true,
  enableScreenshotDetection: true,
  enableTimeoutDetection: true,
  enableRapidClickDetection: true,
  timeoutThreshold: 30,
  rapidClickThreshold: 5,
};

export function useAntiCheating(config: Partial<AntiCheatingConfig> = {}) {
  const finalConfig = { ...defaultConfig, ...config };
  
  const [state, setState] = useState<AntiCheatingState>({
    isMonitoring: false,
    cheatingEvents: [],
    warningCount: 0,
    isBlocked: false,
    lastActivity: new Date().toISOString(),
  });

  const clickCountRef = useRef(0);
  const clickTimerRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<string>(new Date().toISOString());

  // Update last activity
  const updateActivity = useCallback(() => {
    const now = new Date().toISOString();
    setState(prev => ({ ...prev, lastActivity: now }));
    lastActivityRef.current = now;
  }, []);

  // Add cheating event
  const addCheatingEvent = useCallback((event: Omit<CheatingEvent, 'timestamp'>) => {
    const cheatingEvent: CheatingEvent = {
      ...event,
      timestamp: new Date().toISOString(),
    };

    setState(prev => {
      const newEvents = [...prev.cheatingEvents, cheatingEvent];
      const newWarningCount = prev.warningCount + (event.severity === 'high' ? 2 : 1);
      
      return {
        ...prev,
        cheatingEvents: newEvents,
        warningCount: newWarningCount,
        isBlocked: newWarningCount >= finalConfig.maxWarnings || 
                  (finalConfig.blockOnHighSeverity && event.severity === 'high'),
      };
    });

    // Show warning
    if (event.severity === 'high') {
      Alert.alert(
        'Academic Integrity Warning',
        'Suspicious activity detected. This may result in test disqualification.',
        [{ text: 'OK' }]
      );
    }
  }, [finalConfig.maxWarnings, finalConfig.blockOnHighSeverity]);

  // Handle app state changes (tab switch detection)
  const handleAppStateChange = useCallback((nextAppState: AppStateStatus) => {
    if (!state.isMonitoring) return;

    if (nextAppState === 'background' || nextAppState === 'inactive') {
      if (finalConfig.enableTabSwitchDetection) {
        addCheatingEvent({
          type: 'tab_switch',
          severity: 'high',
          details: { appState: nextAppState },
        });
      }
    } else if (nextAppState === 'active') {
      updateActivity();
    }
  }, [state.isMonitoring, finalConfig.enableTabSwitchDetection, addCheatingEvent, updateActivity]);

  // Handle copy/paste detection
  const handleCopyPaste = useCallback(() => {
    if (!state.isMonitoring || !finalConfig.enableCopyPasteDetection) return;
    
    addCheatingEvent({
      type: 'copy_paste',
      severity: 'medium',
    });
  }, [state.isMonitoring, finalConfig.enableCopyPasteDetection, addCheatingEvent]);

  // Handle screenshot detection
  const handleScreenshot = useCallback(() => {
    if (!state.isMonitoring || !finalConfig.enableScreenshotDetection) return;
    
    addCheatingEvent({
      type: 'screenshot',
      severity: 'high',
    });
  }, [state.isMonitoring, finalConfig.enableScreenshotDetection, addCheatingEvent]);

  // Handle rapid click detection
  const handleClick = useCallback(() => {
    if (!state.isMonitoring || !finalConfig.enableRapidClickDetection) return;

    clickCountRef.current++;
    updateActivity();

    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
    }

    clickTimerRef.current = setTimeout(() => {
      const clicksPerSecond = clickCountRef.current / 1; // 1 second window
      
      if (clicksPerSecond >= finalConfig.rapidClickThreshold) {
        addCheatingEvent({
          type: 'rapid_click',
          severity: 'medium',
          details: { clicksPerSecond },
        });
      }
      
      clickCountRef.current = 0;
    }, 1000);
  }, [state.isMonitoring, finalConfig.enableRapidClickDetection, finalConfig.rapidClickThreshold, updateActivity, addCheatingEvent]);

  // Handle timeout detection
  const handleTimeout = useCallback(() => {
    if (!state.isMonitoring || !finalConfig.enableTimeoutDetection) return;

    const now = new Date();
    const lastActivity = new Date(lastActivityRef.current);
    const timeDiff = (now.getTime() - lastActivity.getTime()) / 1000;

    if (timeDiff >= finalConfig.timeoutThreshold) {
      addCheatingEvent({
        type: 'timeout',
        severity: 'low',
        details: { timeoutSeconds: timeDiff },
      });
    }
  }, [state.isMonitoring, finalConfig.enableTimeoutDetection, finalConfig.timeoutThreshold, addCheatingEvent]);

  // Start monitoring
  const startMonitoring = useCallback(() => {
    setState(prev => ({ ...prev, isMonitoring: true }));
    
    // Set up timeout check interval
    timeoutRef.current = setInterval(handleTimeout, 5000);
  }, [handleTimeout]);

  // Stop monitoring
  const stopMonitoring = useCallback(() => {
    setState(prev => ({ ...prev, isMonitoring: false }));
    
    if (timeoutRef.current) {
      clearInterval(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
  }, []);

  // Reset state
  const reset = useCallback(() => {
    setState({
      isMonitoring: false,
      cheatingEvents: [],
      warningCount: 0,
      isBlocked: false,
      lastActivity: new Date().toISOString(),
    });
    
    clickCountRef.current = 0;
    lastActivityRef.current = new Date().toISOString();
  }, []);

  // Clear events
  const clearEvents = useCallback(() => {
    setState(prev => ({
      ...prev,
      cheatingEvents: [],
      warningCount: 0,
      isBlocked: false,
    }));
  }, []);

  // Set up app state listener
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [handleAppStateChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearInterval(timeoutRef.current);
      }
      if (clickTimerRef.current) {
        clearTimeout(clickTimerRef.current);
      }
    };
  }, []);

  return {
    ...state,
    startMonitoring,
    stopMonitoring,
    reset,
    clearEvents,
    handleClick,
    handleCopyPaste,
    handleScreenshot,
    updateActivity,
    config: finalConfig,
  };
}

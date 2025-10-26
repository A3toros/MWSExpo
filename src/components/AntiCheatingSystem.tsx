import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Alert,
  AppState,
  AppStateStatus,
} from 'react-native';
import { useAntiCheating } from '../hooks/useAntiCheating';
import { antiCheatingManager } from '../utils/antiCheating';
import { logger } from '../utils/logger';

interface AntiCheatingSystemProps {
  testId: string;
  userId: string;
  sessionId: string;
  isActive: boolean;
  onCheatingDetected?: (event: any) => void;
  onBlocked?: () => void;
}

export const AntiCheatingSystem = React.forwardRef<any, AntiCheatingSystemProps>(({
  testId,
  userId,
  sessionId,
  isActive,
  onCheatingDetected,
  onBlocked,
}, ref) => {
  const {
    isMonitoring,
    isBlocked,
    warningCount,
    cheatingEvents,
    startMonitoring,
    stopMonitoring,
    reset,
  } = useAntiCheating();

  const [appState, setAppState] = useState(AppState.currentState);

  // Monitor app state changes
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (isActive && isMonitoring) {
        if (appState === 'active' && nextAppState.match(/inactive|background/)) {
          antiCheatingManager.handleClick();
        }
      }
      setAppState(nextAppState);
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription?.remove();
  }, [isActive, isMonitoring, appState]);

  // Start/stop monitoring based on isActive
  useEffect(() => {
    if (isActive) {
      startMonitoring();
    } else {
      stopMonitoring();
    }
  }, [isActive, startMonitoring, stopMonitoring]);

  // Handle cheating detection
  useEffect(() => {
    if (cheatingEvents.length > 0) {
      const latestEvent = cheatingEvents[cheatingEvents.length - 1];
      onCheatingDetected?.(latestEvent);
    }
  }, [cheatingEvents, onCheatingDetected]);

  // Handle blocking
  useEffect(() => {
    if (isBlocked) onBlocked?.();
  }, [isBlocked, onBlocked]);

  // Expose methods for parent components
  React.useImperativeHandle(ref, () => ({
    handleClick: () => antiCheatingManager.handleClick(),
    handleCopyPaste: () => antiCheatingManager.handleCopyPaste(),
    handleScreenshot: () => antiCheatingManager.handleScreenshot(),
    updateActivity: () => (antiCheatingManager as any).updateActivity?.(),
    getCheatingEvents: () => cheatingEvents,
    getWarningCount: () => warningCount,
    isBlocked: () => isBlocked,
  }));

  const handleBlocked = () => {
    stopMonitoring();
    onBlocked?.();
  };

  return (
    <>
      {isBlocked && (
        <Modal visible={isBlocked} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Test Blocked</Text>
              <Text style={styles.modalMessage}>
                You have been blocked from continuing this test due to suspicious activity.
              </Text>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={handleBlocked}
              >
                <Text style={styles.modalButtonText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
      
      {isActive && (
        <View style={styles.statusIndicator}>
          <Text style={styles.statusText}>
            {isBlocked ? 'BLOCKED' : warningCount > 0 ? 'WARNING' : 'MONITORING'}
          </Text>
        </View>
      )}
    </>
  );
});

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#dc2626',
    marginBottom: 12,
  },
  modalMessage: {
    fontSize: 16,
    color: '#374151',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 24,
  },
  modalButton: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  modalButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  statusIndicator: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
});

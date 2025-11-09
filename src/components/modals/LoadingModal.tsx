/** @jsxImportSource nativewind */
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Modal } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { getModalStyles } from '../../utils/themeUtils';
import { ErrorModal } from './ErrorModal';
import { router } from 'expo-router';

interface LoadingModalProps {
  visible: boolean;
  message?: string;
  showSpinner?: boolean;
  onTimeout?: () => void; // Optional callback when timeout occurs
}

export const LoadingModal: React.FC<LoadingModalProps> = ({
  visible,
  message = "Loading...",
  showSpinner = true,
  onTimeout
}) => {
  const { themeMode } = useTheme();
  const modalStyles = getModalStyles(themeMode);
  
  // Timeout state
  const [showError, setShowError] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Handle timeout
  useEffect(() => {
    if (visible) {
      // Start timeout timer (10 seconds)
      startTimeRef.current = Date.now();
      setShowError(false);
      
      timeoutRef.current = setTimeout(() => {
        console.log('[LoadingModal] Timeout after 10 seconds');
        setShowError(true);
        if (onTimeout) {
          onTimeout();
        }
      }, 10000);
    } else {
      // Clear timeout when hidden
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      startTimeRef.current = null;
      setShowError(false);
    }

    // Cleanup on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [visible, onTimeout]);

  const overlayBg = themeMode === 'cyberpunk'
    ? 'bg-black/90'
    : themeMode === 'dark'
    ? 'bg-gray-900/90'
    : 'bg-white/90';

  const cardClasses = themeMode === 'cyberpunk'
    ? 'bg-black border border-cyan-400/30'
    : themeMode === 'dark'
    ? 'bg-gray-800'
    : 'bg-white';

  const textClasses = themeMode === 'cyberpunk'
    ? 'text-cyan-300 tracking-wider'
    : themeMode === 'dark'
    ? 'text-gray-200'
    : 'text-gray-700';

  const getSpinnerColor = () => {
    switch (themeMode) {
      case 'cyberpunk': return '#00ffd2'; // Cyan
      case 'dark': return '#60a5fa'; // Blue
      default: return '#3b82f6'; // Blue
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
    >
      <View className={`flex-1 justify-center items-center ${overlayBg}`}>
        <View className={`px-6 py-5 rounded-xl ${cardClasses}`}>
          {showSpinner && (
            <ActivityIndicator 
              size="large" 
              color={getSpinnerColor()} 
              className="mb-4"
            />
          )}
          <Text className={`text-center ${textClasses}`}>
            {themeMode === 'cyberpunk' ? message.toUpperCase() : message}
          </Text>
        </View>
      </View>

      {/* Error Modal for timeout */}
      <ErrorModal
        visible={showError}
        onRetry={() => {
          setShowError(false);
          // Try to reload using expo-updates if available, otherwise navigate to same route
          try {
            // @ts-ignore - expo-updates may not be installed
            const Updates = require('expo-updates');
            if (Updates.reloadAsync) {
              Updates.reloadAsync();
              return;
            }
          } catch (e) {
            // expo-updates not available, use router navigation
          }
          
          // Fallback: navigate to current route to refresh
          const currentPath = router.pathname || '/';
          router.replace(currentPath as any);
        }}
        title="Loading Timeout"
        message="Something went wrong. Please try again."
      />
    </Modal>
  );
};

/** @jsxImportSource nativewind */
import React from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { Modal } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { getModalStyles } from '../../utils/themeUtils';

interface LoadingModalProps {
  visible: boolean;
  message?: string;
  showSpinner?: boolean;
}

export const LoadingModal: React.FC<LoadingModalProps> = ({
  visible,
  message = "Loading...",
  showSpinner = true
}) => {
  const { themeMode } = useTheme();
  const modalStyles = getModalStyles(themeMode);

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
    </Modal>
  );
};

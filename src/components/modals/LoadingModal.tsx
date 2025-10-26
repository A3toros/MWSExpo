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
      <View className={modalStyles.overlay}>
        <View className={modalStyles.container}>
          {showSpinner && (
            <ActivityIndicator 
              size="large" 
              color={getSpinnerColor()} 
              className="mb-4"
            />
          )}
          <Text className={modalStyles.text}>
            {message}
          </Text>
        </View>
      </View>
    </Modal>
  );
};

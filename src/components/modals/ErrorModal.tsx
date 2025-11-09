/** @jsxImportSource nativewind */
import React from 'react';
import { View, Text } from 'react-native';
import { ThemedButton } from '../ui';
import { Modal } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { getModalStyles } from '../../utils/themeUtils';

interface ErrorModalProps {
  visible: boolean;
  onRetry: () => void;
  onCancel?: () => void;
  title?: string;
  message?: string;
}

export const ErrorModal: React.FC<ErrorModalProps> = ({
  visible,
  onRetry,
  onCancel,
  title = 'Error',
  message = 'Something went wrong. Please try again.'
}) => {
  const { themeMode } = useTheme();
  const modalStyles = getModalStyles(themeMode);

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
    >
      <View className={modalStyles.overlay}>
        <View className={modalStyles.container}>
          <Text className={`${modalStyles.title} ${themeMode === 'cyberpunk' ? 'tracking-wider' : ''}`}>
            {themeMode === 'cyberpunk' ? title.toUpperCase() : title}
          </Text>
          
          <Text className={`${modalStyles.text} ${themeMode === 'cyberpunk' ? 'tracking-wider' : ''}`}>
            {themeMode === 'cyberpunk' ? message.toUpperCase() : message}
          </Text>
          
          <View className="flex-row space-x-3">
            {onCancel && (
              <View className="flex-1">
                <ThemedButton
                  title={themeMode === 'cyberpunk' ? 'CANCEL' : 'Cancel'}
                  onPress={onCancel}
                />
              </View>
            )}
            <View className={onCancel ? "flex-1" : "flex-1"}>
              <ThemedButton
                title={themeMode === 'cyberpunk' ? 'TRY AGAIN' : 'Try Again'}
                onPress={onRetry}
                variant="modal"
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};


/** @jsxImportSource nativewind */
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ThemedButton } from '../ui';
import { Modal } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { getModalStyles } from '../../utils/themeUtils';

interface NavigationModalProps {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
  message: string;
}

export const NavigationModal: React.FC<NavigationModalProps> = ({
  visible,
  onConfirm,
  onCancel,
  title,
  message
}) => {
  const { themeMode } = useTheme();
  const modalStyles = getModalStyles(themeMode);

  const getButtonClasses = (isPrimary: boolean) => {
    if (isPrimary) {
      return themeMode === 'cyberpunk' 
        ? 'bg-cyan-400 shadow-lg shadow-cyan-400/50'
        : themeMode === 'dark'
        ? 'bg-blue-600'
        : 'bg-[#8E66EB]';
    }
    return themeMode === 'cyberpunk' 
      ? 'bg-black border-2 border-gray-400 shadow-lg shadow-gray-400/50'
      : themeMode === 'dark'
      ? 'bg-gray-700 border border-gray-500'
      : 'bg-gray-200';
  };

  const getButtonTextClasses = (isPrimary: boolean) => {
    if (isPrimary) {
      return themeMode === 'cyberpunk' 
        ? 'text-black font-bold tracking-wider'
        : 'text-white font-semibold';
    }
    return themeMode === 'cyberpunk'
      ? 'text-gray-400 font-bold tracking-wider'
      : themeMode === 'dark'
      ? 'text-gray-300 font-semibold'
      : 'text-gray-700 font-semibold';
  };

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
            <View className="flex-1">
              <ThemedButton
                title={themeMode === 'cyberpunk' ? 'STAY' : 'Stay'}
                onPress={onCancel}
              />
            </View>
            <View className="flex-1">
              <ThemedButton
                title={themeMode === 'cyberpunk' ? 'LEAVE' : 'Leave'}
                onPress={onConfirm}
                variant="modal"
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

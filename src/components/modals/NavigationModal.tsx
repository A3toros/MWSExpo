/** @jsxImportSource nativewind */
import React from 'react';
import { View, Text } from 'react-native';
import { ThemedButton } from '../ui';
// Use ThemedButton so global glitch manager controls one-at-a-time
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
      <View className={`flex-1 justify-center items-center px-4 ${modalStyles.overlay}`}>
        <View className={`${modalStyles.container} p-6`}>
          <Text className={`${modalStyles.title} ${themeMode === 'cyberpunk' ? 'tracking-wider' : ''} mb-3`}>
            {themeMode === 'cyberpunk' ? title.toUpperCase() : title}
          </Text>
          
          <Text className={`${modalStyles.text} ${themeMode === 'cyberpunk' ? 'tracking-wider' : ''} mb-6`}>
            {themeMode === 'cyberpunk' ? message.toUpperCase() : message}
          </Text>
          
          <View className="flex-row justify-center">
            <View className={`flex-1 max-w-[140px] ${themeMode === 'cyberpunk' ? 'mr-3' : 'mr-4'}`}>
              <ThemedButton
                title={themeMode === 'cyberpunk' ? 'STAY' : 'Stay'}
                onPress={onCancel}
              />
            </View>
            <View className="flex-1 max-w-[140px]">
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

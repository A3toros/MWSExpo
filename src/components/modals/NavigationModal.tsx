/** @jsxImportSource nativewind */
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
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
            <TouchableOpacity
              onPress={onCancel}
              className={`flex-1 py-3 rounded-lg ${getButtonClasses(false)}`}
            >
              <Text className={`text-center ${getButtonTextClasses(false)}`}>
                {themeMode === 'cyberpunk' ? 'STAY' : 'Stay'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={onConfirm}
              className={`flex-1 py-3 rounded-lg ${getButtonClasses(true)}`}
              style={themeMode === 'cyberpunk' ? {
                shadowColor: '#00ffd2',
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.8,
                shadowRadius: 8,
                elevation: 8,
              } : {}}
            >
              <Text className={`text-center ${getButtonTextClasses(true)}`}>
                {themeMode === 'cyberpunk' ? 'LEAVE' : 'Leave'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

/** @jsxImportSource nativewind */
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Modal } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { getModalStyles } from '../../utils/themeUtils';

interface SubmitModalProps {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  testName?: string;
  questionCount?: number;
}

export const SubmitModal: React.FC<SubmitModalProps> = ({
  visible,
  onConfirm,
  onCancel,
  testName = "Test",
  questionCount
}) => {
  const { themeMode } = useTheme();
  const modalStyles = getModalStyles(themeMode);

  const getButtonClasses = (isPrimary: boolean) => {
    if (isPrimary) {
      return modalStyles.button;
    }
    return themeMode === 'cyberpunk' 
      ? 'bg-black border-2 border-gray-400 shadow-lg shadow-gray-400/50'
      : themeMode === 'dark'
      ? 'bg-gray-700 border border-gray-500'
      : 'bg-gray-200';
  };

  const getButtonTextClasses = (isPrimary: boolean) => {
    if (isPrimary) {
      return modalStyles.buttonText;
    }
    return themeMode === 'cyberpunk'
      ? 'text-gray-400 font-bold'
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
          <Text className={`${modalStyles.title} text-center`}>
            Submit {testName}?
          </Text>
          
          {questionCount && (
            <Text className={`${modalStyles.text} text-center`}>
              {questionCount} question{questionCount > 1 ? 's' : ''} completed
            </Text>
          )}
          
          <Text className={`${modalStyles.text} text-center`}>
            Are you sure you want to submit your answers? This action cannot be undone.
          </Text>
          
          <View className="flex-row gap-4 px-4 pt-4 pb-4">
            <TouchableOpacity
              onPress={onCancel}
              className={`flex-1 py-3 px-4 rounded-lg ${getButtonClasses(false)}`}
            >
              <Text className={`${getButtonTextClasses(false)} text-center`}>
                Cancel
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={onConfirm}
              className={`flex-1 py-3 px-4 rounded-lg ${getButtonClasses(true)}`}
            >
              <Text className={`${getButtonTextClasses(true)} text-center`}>
                Submit
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

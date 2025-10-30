/** @jsxImportSource nativewind */
import React from 'react';
import { View, Text } from 'react-native';
import { ThemedButton } from '../ui';
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
  const isCyberpunk = themeMode === 'cyberpunk';


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
      <View className={`${modalStyles.overlay} flex-1 justify-center items-center`}>
        <View className={`${modalStyles.container} w-11/12 max-w-xl` }>
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
          
          {isCyberpunk ? (
            <View className="flex-row justify-center items-center gap-4 px-4 pt-6 pb-2">
              <View className="w-36">
                <ThemedButton title="Cancel" onPress={onCancel} />
              </View>
              <View className="w-36">
                <ThemedButton title="Submit" onPress={onConfirm} variant="modal" />
              </View>
            </View>
          ) : (
            <View className="flex-row gap-4 px-4 pt-4 pb-4">
              <View className="flex-1">
                <ThemedButton title="Cancel" onPress={onCancel} />
              </View>
              <View className="flex-1">
                <ThemedButton title="Submit" onPress={onConfirm} variant="modal" />
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

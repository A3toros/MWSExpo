/** @jsxImportSource nativewind */
import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Modal } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { getModalStyles } from '../../utils/themeUtils';

interface FeedbackModalProps {
  visible: boolean;
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
  onClose: () => void;
  autoClose?: boolean;
  autoCloseDelay?: number;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  visible,
  type,
  title,
  message,
  onClose,
  autoClose = true,
  autoCloseDelay = 3000
}) => {
  const { themeMode } = useTheme();
  const modalStyles = getModalStyles(themeMode);

  useEffect(() => {
    if (visible && autoClose) {
      const timer = setTimeout(onClose, autoCloseDelay);
      return () => clearTimeout(timer);
    }
  }, [visible, autoClose, autoCloseDelay, onClose]);

  const getTypeStyles = () => {
    if (themeMode === 'cyberpunk') {
      switch (type) {
        case 'success':
          return {
            icon: '✅',
            bgColor: 'bg-black',
            borderColor: 'border-green-400',
            buttonColor: 'bg-green-400',
            iconColor: 'text-green-400',
            textColor: 'text-green-400',
            shadowColor: 'shadow-green-400/50'
          };
        case 'error':
          return {
            icon: '❌',
            bgColor: 'bg-black',
            borderColor: 'border-red-400',
            buttonColor: 'bg-red-400',
            iconColor: 'text-red-400',
            textColor: 'text-red-400',
            shadowColor: 'shadow-red-400/50'
          };
        default:
          return {
            icon: 'ℹ️',
            bgColor: 'bg-black',
            borderColor: 'border-cyan-400',
            buttonColor: 'bg-cyan-400',
            iconColor: 'text-cyan-400',
            textColor: 'text-cyan-400',
            shadowColor: 'shadow-cyan-400/50'
          };
      }
    }

    switch (type) {
      case 'success':
        return {
          icon: '✅',
          bgColor: themeMode === 'dark' ? 'bg-green-900' : 'bg-green-50',
          borderColor: themeMode === 'dark' ? 'border-green-700' : 'border-green-200',
          buttonColor: 'bg-green-600',
          iconColor: 'text-green-600',
          textColor: themeMode === 'dark' ? 'text-green-300' : 'text-green-800',
          shadowColor: ''
        };
      case 'error':
        return {
          icon: '❌',
          bgColor: themeMode === 'dark' ? 'bg-red-900' : 'bg-red-50',
          borderColor: themeMode === 'dark' ? 'border-red-700' : 'border-red-200',
          buttonColor: 'bg-red-600',
          iconColor: 'text-red-600',
          textColor: themeMode === 'dark' ? 'text-red-300' : 'text-red-800',
          shadowColor: ''
        };
      default:
        return {
          icon: 'ℹ️',
          bgColor: themeMode === 'dark' ? 'bg-blue-900' : 'bg-blue-50',
          borderColor: themeMode === 'dark' ? 'border-blue-700' : 'border-blue-200',
          buttonColor: 'bg-blue-600',
          iconColor: 'text-blue-600',
          textColor: themeMode === 'dark' ? 'text-blue-300' : 'text-blue-800',
          shadowColor: ''
        };
    }
  };

  const styles = getTypeStyles();

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
    >
      <View className={modalStyles.overlay}>
        <View className={`${modalStyles.container} ${styles.bgColor} ${styles.borderColor} border-2 ${styles.shadowColor} shadow-lg`}>
          <Text className={`text-4xl text-center mb-4 ${styles.iconColor}`}>
            {styles.icon}
          </Text>
          
          <Text className={`text-xl font-bold text-center mb-2 ${styles.textColor} ${themeMode === 'cyberpunk' ? 'tracking-wider' : ''}`}>
            {themeMode === 'cyberpunk' ? title.toUpperCase() : title}
          </Text>
          
          <Text className={`text-center mb-6 ${styles.textColor} ${themeMode === 'cyberpunk' ? 'tracking-wider' : ''}`}>
            {themeMode === 'cyberpunk' ? message.toUpperCase() : message}
          </Text>
          
          <TouchableOpacity
            onPress={onClose}
            className={`${styles.buttonColor} py-3 rounded-lg ${themeMode === 'cyberpunk' ? 'shadow-lg' : ''}`}
            style={themeMode === 'cyberpunk' ? {
              shadowColor: styles.iconColor.includes('green') ? '#10b981' : 
                          styles.iconColor.includes('red') ? '#ef4444' : '#06b6d4',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.8,
              shadowRadius: 8,
              elevation: 8,
            } : {}}
          >
            <Text className={`text-center font-semibold ${themeMode === 'cyberpunk' ? 'text-black tracking-wider' : 'text-white'}`}>
              {themeMode === 'cyberpunk' ? 'ACKNOWLEDGED' : 'OK'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

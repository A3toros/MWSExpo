/** @jsxImportSource nativewind */
import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { router } from 'expo-router';
import { Alert } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeClasses } from '../utils/themeUtils';

interface TestHeaderProps {
  testName: string;
  onExit?: () => void;
}

export default function TestHeader({ testName, onExit }: TestHeaderProps) {
  const { themeMode } = useTheme();
  const themeClasses = getThemeClasses(themeMode);
  
  const getArrowSource = () => {
    switch (themeMode) {
      case 'dark': return require('../../assets/images/arrow-back-dark.png');
      case 'cyberpunk': return require('../../assets/images/arrow-back-cyberpunk.png');
      default: return require('../../assets/images/arrow-back-light.png');
    }
  };

  const handleBackPress = () => {
    Alert.alert(
      themeMode === 'cyberpunk' ? 'EXIT TEST' : 'Exit Test',
      themeMode === 'cyberpunk' 
        ? 'ARE YOU SURE YOU WANT TO GO BACK TO CABINET? YOUR PROGRESS WILL BE SAVED BUT YOU WILL EXIT THE TEST.'
        : 'Are you sure you want to go back to cabinet? Your progress will be saved but you will exit the test.',
      [
        { text: themeMode === 'cyberpunk' ? 'CANCEL' : 'Cancel', style: 'cancel' },
        { 
          text: themeMode === 'cyberpunk' ? 'GO BACK' : 'Go Back', 
          style: 'destructive', 
          onPress: () => {
            if (onExit) {
              onExit();
            } else {
              router.back();
            }
          }
        }
      ]
    );
  };

  return (
    <View className={`shadow-md z-50 ${
      themeMode === 'cyberpunk' 
        ? 'bg-black border-b border-cyan-400/30' 
        : themeMode === 'dark' 
        ? 'bg-gray-800' 
        : 'bg-header-blue'
    }`}>
      <View className="px-4 py-3">
        <View className="flex-row items-center">
          <TouchableOpacity 
            className={`w-10 h-10 rounded-full justify-center items-center mr-3 ${
              themeMode === 'cyberpunk' 
                ? 'bg-black border border-cyan-400/30' 
                : themeMode === 'dark' 
                ? 'bg-white/20' 
                : 'bg-white/20'
            }`}
            onPress={handleBackPress}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Image 
              source={getArrowSource()} 
              className="w-5 h-5" 
              resizeMode="contain"
            />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className={`text-lg font-semibold text-center ${themeMode === 'cyberpunk' ? 'text-cyan-400 tracking-wider' : 'text-white'}`} numberOfLines={1}>
              {themeMode === 'cyberpunk' ? testName.toUpperCase() : testName}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}


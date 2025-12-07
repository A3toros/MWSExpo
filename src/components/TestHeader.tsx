/** @jsxImportSource nativewind */
import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { router } from 'expo-router';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeClasses } from '../utils/themeUtils';
import { NavigationModal } from './modals/NavigationModal';
import { useAndroidBackButton } from '../hooks/useAndroidBackButton';

interface TestHeaderProps {
  testName: string;
  onExit?: () => void;
  enableBackButton?: boolean; // Enable/disable Android back button interception
  showBackButton?: boolean; // Show/hide the UI back arrow
  onNext?: () => void;
  disableNext?: boolean;
}

export default function TestHeader({ testName, onExit, enableBackButton = true, showBackButton = false, onNext, disableNext }: TestHeaderProps) {
  const { themeMode } = useTheme();
  const themeClasses = getThemeClasses(themeMode);
  const [showExitModal, setShowExitModal] = useState(false);
  
  const getArrowSource = () => {
    switch (themeMode) {
      case 'dark': return require('../../assets/images/arrow-back-dark.png');
      case 'cyberpunk': return require('../../assets/images/arrow-back-cyberpunk.png');
      default: return require('../../assets/images/arrow-back-light.png');
    }
  };

  const handleBackPress = useCallback(() => {
    // Prevent showing duplicate modals if already visible
    setShowExitModal((prev) => {
      if (prev) {
        return prev; // Already showing, don't change
      }
      return true; // Show modal
    });
  }, []);

  const handleConfirm = () => {
    setShowExitModal(false);
    if (onExit) {
      onExit();
    } else {
      router.back();
    }
  };

  const handleCancel = () => {
    setShowExitModal(false);
  };

  // Intercept Android back button
  useAndroidBackButton(enableBackButton && showBackButton, handleBackPress);

  return (
    <View className={`shadow-md z-50 ${
      themeMode === 'cyberpunk' 
        ? 'bg-black border-b border-cyan-400/30' 
        : themeMode === 'dark' 
        ? 'bg-gray-800' 
        : 'bg-header-blue'
    }`}>
      <View className="px-4 pt-4 pb-3">
        <View className="flex-row items-center">
          {showBackButton && (
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
          )}
          <View className="flex-1">
            <Text className={`text-lg font-semibold text-center ${themeMode === 'cyberpunk' ? 'text-cyan-400 tracking-wider' : 'text-white'}`} numberOfLines={1}>
              {themeMode === 'cyberpunk' ? testName.toUpperCase() : testName}
            </Text>
          </View>
        </View>
        {onNext && (
          <View className="mt-3 items-end">
            <TouchableOpacity
              disabled={disableNext}
              onPress={onNext}
              className={`px-4 py-2 rounded-lg ${
                disableNext
                  ? 'bg-gray-500/50'
                  : themeMode === 'cyberpunk'
                  ? 'bg-cyan-600'
                  : themeMode === 'dark'
                  ? 'bg-white/10'
                  : 'bg-white/20'
              }`}
            >
              <Text
                className={
                  themeMode === 'cyberpunk'
                    ? 'text-black font-semibold'
                    : 'text-white font-semibold'
                }
              >
                Next
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Navigation Modal for exit confirmation */}
      <NavigationModal
        visible={showExitModal}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        title={themeMode === 'cyberpunk' ? 'EXIT TEST' : 'Exit Test'}
        message={themeMode === 'cyberpunk' 
          ? 'ARE YOU SURE YOU WANT TO GO BACK TO CABINET? YOUR PROGRESS WILL BE SAVED BUT YOU WILL EXIT THE TEST.'
          : 'Are you sure you want to go back to cabinet? Your progress will be saved but you will exit the test.'}
      />
    </View>
  );
}


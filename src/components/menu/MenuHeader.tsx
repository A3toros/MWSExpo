/** @jsxImportSource nativewind */
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withSpring, 
  withTiming,
  interpolate
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MenuTheme } from './MenuTheme';
import { useTheme } from '../../contexts/ThemeContext';
import { getThemeClasses } from '../../utils/themeUtils';

interface MenuHeaderProps {
  userName: string;
  userRole: string;
  onClose: () => void;
  delay?: number;
}

export const MenuHeader: React.FC<MenuHeaderProps> = ({
  userName,
  userRole,
  onClose,
  delay = 0,
}) => {
  const { themeMode } = useTheme();
  const themeClasses = getThemeClasses(themeMode);
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-20);

  useEffect(() => {
    loadProfilePicture();
  }, []);

  const loadProfilePicture = async () => {
    try {
      const savedPicture = await AsyncStorage.getItem('profile_picture');
      if (savedPicture) {
        setProfilePicture(savedPicture);
      }
    } catch (error) {
      console.error('Error loading profile picture:', error);
    }
  };

  React.useEffect(() => {
    const timer = setTimeout(() => {
      opacity.value = withTiming(1, { duration: 400 });
      translateY.value = withSpring(0, { 
        damping: 20, 
        stiffness: 300 
      });
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View 
      style={[animatedStyle]}
      className={`px-6 pt-12 pb-6 border-b ${themeMode === 'cyberpunk' ? 'border-cyan-400/30' : 'border-white/10'}`}
    >
      <View className="flex-row items-center justify-between mb-6">
        <View className="flex-1 items-center pt-4">
          <Text 
            style={{
              color: themeMode === 'cyberpunk' ? '#00ffd2' : 'white',
              fontSize: MenuTheme.typography.heading.fontSize,
              fontWeight: MenuTheme.typography.heading.fontWeight,
            }}
            className={`text-center ${themeMode === 'cyberpunk' ? 'tracking-wider' : ''}`}
          >
            {themeMode === 'cyberpunk' ? userName.toUpperCase() : userName}
          </Text>
        </View>

        {/* Close button */}
        <TouchableOpacity 
          onPress={onClose}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: themeMode === 'cyberpunk' 
              ? 'rgba(0, 255, 210, 0.1)' 
              : 'rgba(255, 255, 255, 0.1)',
            justifyContent: 'center',
            alignItems: 'center',
            ...MenuTheme.shadows.sm,
          }}
          className="ml-4"
        >
          <Text style={{ 
            color: themeMode === 'cyberpunk' ? '#00ffd2' : 'white', 
            fontSize: 18, 
            fontWeight: '600' 
          }}>
            ✕
          </Text>
        </TouchableOpacity>
      </View>

      {/* User avatar */}
      <View 
        style={{
          width: 60,
          height: 60,
          borderRadius: 30,
          backgroundColor: themeMode === 'cyberpunk' 
            ? 'rgba(0, 255, 210, 0.2)' 
            : 'rgba(255, 255, 255, 0.2)',
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: 12,
          overflow: 'hidden',
          ...(themeMode === 'cyberpunk' && {
            borderWidth: 2,
            borderColor: '#00ffd2',
            shadowColor: '#00ffd2',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.5,
            shadowRadius: 8,
            elevation: 8,
          }),
        }}
      >
        {profilePicture ? (
          <Image 
            source={{ uri: profilePicture }} 
            style={{
              width: 60,
              height: 60,
              borderRadius: 30,
            }}
            resizeMode="cover"
          />
        ) : (
          <Image 
            source={require('../../../assets/images/anon.png')} 
            style={{
              width: 60,
              height: 60,
              borderRadius: 30,
            }}
            resizeMode="cover"
          />
        )}
      </View>

      {/* Status indicator */}
      <View className="flex-row items-center">
        <View 
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: themeMode === 'cyberpunk' ? '#00ffd2' : MenuTheme.colors.success,
            marginRight: 8,
            ...(themeMode === 'cyberpunk' && {
              shadowColor: '#00ffd2',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.8,
              shadowRadius: 4,
              elevation: 4,
            }),
          }}
        />
        <Text 
          style={{
            color: themeMode === 'cyberpunk' ? '#00ffd2' : 'rgba(255, 255, 255, 0.8)',
            fontSize: MenuTheme.typography.small.fontSize,
          }}
          className={themeMode === 'cyberpunk' ? 'tracking-wider' : ''}
        >
          {themeMode === 'cyberpunk' ? 'ONLINE' : 'Online'}
        </Text>
      </View>
    </Animated.View>
  );
};

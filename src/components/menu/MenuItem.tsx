/** @jsxImportSource nativewind */
import React from 'react';
import { View, Text, TouchableOpacity, Pressable } from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withSpring, 
  withTiming,
  interpolate,
  Extrapolate
} from 'react-native-reanimated';
import { MenuTheme } from './MenuTheme';
import { useTheme } from '../../contexts/ThemeContext';
import { getThemeClasses } from '../../utils/themeUtils';

interface MenuItemProps {
  icon: string;
  title: string;
  subtitle?: string;
  badge?: number;
  onPress: () => void;
  variant?: 'default' | 'destructive';
  disabled?: boolean;
  delay?: number;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const MenuItem: React.FC<MenuItemProps> = ({
  icon,
  title,
  subtitle,
  badge,
  onPress,
  variant = 'default',
  disabled = false,
  delay = 0,
}) => {
  const { themeMode } = useTheme();
  const themeClasses = getThemeClasses(themeMode);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      opacity.value = withTiming(1, { duration: 300 });
      translateY.value = withSpring(0, { 
        damping: 20, 
        stiffness: 300 
      });
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translateY.value },
      { scale: scale.value }
    ],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'destructive':
        return {
          backgroundColor: MenuTheme.colors.error,
          textColor: 'white',
        };
      default:
        return {
          backgroundColor: MenuTheme.colors.primary,
          textColor: 'white',
        };
    }
  };

  const variantStyles = getVariantStyles();

  return (
    <AnimatedPressable
      style={[animatedStyle]}
      onPress={disabled ? undefined : onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      className={`mx-4 mb-2 rounded-xl overflow-hidden ${
        disabled ? 'opacity-50' : ''
      }`}
    >
      <View 
        style={{
          backgroundColor: themeMode === 'cyberpunk' 
            ? 'rgba(0, 0, 0, 0.8)' 
            : variantStyles.backgroundColor,
          paddingVertical: 16,
          paddingHorizontal: 20,
          borderRadius: 12,
          ...MenuTheme.shadows.sm,
          ...(themeMode === 'cyberpunk' && {
            borderWidth: 1,
            borderColor: '#00ffd2',
            shadowColor: '#00ffd2',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.3,
            shadowRadius: 4,
            elevation: 4,
          }),
        }}
        className="flex-row items-center justify-between"
      >
        <View className="flex-row items-center flex-1">
          {/* Icon placeholder - you can replace with actual icon component */}
          <View 
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: themeMode === 'cyberpunk' 
                ? 'rgba(0, 255, 210, 0.2)' 
                : 'rgba(255, 255, 255, 0.2)',
              marginRight: 12,
              justifyContent: 'center',
              alignItems: 'center',
              ...(themeMode === 'cyberpunk' && {
                borderWidth: 1,
                borderColor: '#00ffd2',
                shadowColor: '#00ffd2',
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.5,
                shadowRadius: 2,
                elevation: 2,
              }),
            }}
          >
            <Text style={{ 
              color: themeMode === 'cyberpunk' ? '#00ffd2' : 'white', 
              fontSize: 12, 
              fontWeight: '600' 
            }}>
              {icon}
            </Text>
          </View>

          <View className="flex-1">
            <Text 
              style={{
                color: themeMode === 'cyberpunk' ? '#00ffd2' : variantStyles.textColor,
                fontSize: MenuTheme.typography.body.fontSize,
                fontWeight: MenuTheme.typography.body.fontWeight,
              }}
              className={`font-medium ${themeMode === 'cyberpunk' ? 'tracking-wider' : ''}`}
            >
              {themeMode === 'cyberpunk' ? title.toUpperCase() : title}
            </Text>
            {subtitle && (
              <Text 
                style={{
                  color: themeMode === 'cyberpunk' ? '#f8ef02' : 'rgba(255, 255, 255, 0.8)',
                  fontSize: MenuTheme.typography.caption.fontSize,
                  marginTop: 2,
                }}
                className={themeMode === 'cyberpunk' ? 'tracking-wider' : ''}
              >
                {themeMode === 'cyberpunk' ? subtitle.toUpperCase() : subtitle}
              </Text>
            )}
          </View>
        </View>

        {/* Badge */}
        {badge && badge > 0 && (
          <View 
            style={{
              backgroundColor: themeMode === 'cyberpunk' 
                ? '#00ffd2' 
                : 'rgba(255, 255, 255, 0.9)',
              borderRadius: 10,
              paddingHorizontal: 8,
              paddingVertical: 4,
              marginLeft: 8,
              ...(themeMode === 'cyberpunk' && {
                shadowColor: '#00ffd2',
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.8,
                shadowRadius: 4,
                elevation: 4,
              }),
            }}
          >
            <Text 
              style={{
                color: themeMode === 'cyberpunk' ? '#000000' : MenuTheme.colors.primary,
                fontSize: 12,
                fontWeight: '600',
              }}
              className={themeMode === 'cyberpunk' ? 'tracking-wider' : ''}
            >
              {badge > 99 ? '99+' : badge}
            </Text>
          </View>
        )}

        {/* Arrow indicator */}
        <View style={{ marginLeft: 8 }}>
          <Text style={{ 
            color: themeMode === 'cyberpunk' ? '#00ffd2' : 'rgba(255, 255, 255, 0.7)', 
            fontSize: 16,
            fontWeight: themeMode === 'cyberpunk' ? 'bold' : 'normal'
          }}>
            {themeMode === 'cyberpunk' ? '▶' : '›'}
          </Text>
        </View>
      </View>
    </AnimatedPressable>
  );
};

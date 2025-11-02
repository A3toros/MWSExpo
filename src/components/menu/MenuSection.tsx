/** @jsxImportSource nativewind */
import React from 'react';
import { View, Text } from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withTiming,
  withSpring
} from 'react-native-reanimated';
import { MenuTheme } from './MenuTheme';
import { useTheme } from '../../contexts/ThemeContext';
import { getFontFamily } from '../../utils/themeUtils';

interface MenuSectionProps {
  title: string;
  children: React.ReactNode;
  delay?: number;
}

export const MenuSection: React.FC<MenuSectionProps> = ({
  title,
  children,
  delay = 0,
}) => {
  const { themeMode } = useTheme();
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
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[animatedStyle]} className="mb-6">
      <Text 
        style={{
          fontFamily: themeMode === 'cyberpunk' ? getFontFamily(themeMode, 'cyberpunk') : undefined,
          color: themeMode === 'cyberpunk' ? 'rgba(0, 255, 210, 0.8)' : 'rgba(255, 255, 255, 0.6)',
          fontSize: MenuTheme.typography.small.fontSize,
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
        className="px-6 mb-3"
      >
        {title}
      </Text>
      <View className="gap-3" style={{ paddingBottom: 6, alignItems: 'stretch' }}>
        {React.Children.map(children, (child) => {
          if (typeof child === 'string' || typeof child === 'number') {
            return <Text>{child}</Text>;
          }
          return child as React.ReactNode;
        })}
      </View>
    </Animated.View>
  );
};

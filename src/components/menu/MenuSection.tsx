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
          color: 'rgba(255, 255, 255, 0.6)',
          fontSize: MenuTheme.typography.small.fontSize,
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
        className="px-6 mb-3"
      >
        {title}
      </Text>
      <View>
        {children}
      </View>
    </Animated.View>
  );
};

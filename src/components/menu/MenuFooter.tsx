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

interface MenuFooterProps {
  delay?: number;
}

export const MenuFooter: React.FC<MenuFooterProps> = ({
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
    <Animated.View 
      style={[animatedStyle]}
      className="px-6 pt-4 border-t border-white/10"
    >
      {/* Version info */}
      <View className="mb-4">
        <Text 
          style={{
            color: 'rgba(255, 255, 255, 0.5)',
            fontSize: MenuTheme.typography.small.fontSize,
            textAlign: 'center',
          }}
        >
          Version 1.0.0
        </Text>
      </View>

    </Animated.View>
  );
};

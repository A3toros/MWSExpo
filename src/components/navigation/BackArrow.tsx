import React from 'react';
import { TouchableOpacity, Image } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming } from 'react-native-reanimated';
import { useTheme } from '../../contexts/ThemeContext';

interface BackArrowProps {
  onPress: () => void;
}

const BackArrow: React.FC<BackArrowProps> = ({ onPress }) => {
  const { themeMode } = useTheme();
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(0);

  const getArrowSource = () => {
    switch (themeMode) {
      case 'dark': return require('../../../assets/images/arrow-back-dark.png');
      case 'cyberpunk': return require('../../../assets/images/arrow-back-cyberpunk.png');
      default: return require('../../../assets/images/arrow-back-light.png');
    }
  };

  const handlePress = () => {
    // Cyberpunk press animation
    if (themeMode === 'cyberpunk') {
      scale.value = withSequence(
        withTiming(0.9, { duration: 100 }),
        withTiming(1, { duration: 100 })
      );
      glowOpacity.value = withSequence(
        withTiming(0.6, { duration: 100 }),
        withTiming(0, { duration: 200 })
      );
    }
    
    onPress();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const isCyberpunk = themeMode === 'cyberpunk';

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity 
        onPress={handlePress} 
        className="w-10 h-10 bg-white/20 rounded-full justify-center items-center mr-3"
        activeOpacity={isCyberpunk ? 1 : 0.7}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        {isCyberpunk && (
          <Animated.View 
            style={glowStyle} 
            className="absolute inset-0 bg-cyan-400/30 rounded-full" 
          />
        )}
        
        <Image 
          source={getArrowSource()} 
          className="w-5 h-5" 
          resizeMode="contain"
        />
      </TouchableOpacity>
    </Animated.View>
  );
};

export default BackArrow;

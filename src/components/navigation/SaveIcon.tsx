import React from 'react';
import { TouchableOpacity, Text, Image } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming } from 'react-native-reanimated';
import { useTheme } from '../../contexts/ThemeContext';

interface SaveIconProps {
  onPress: () => void;
  disabled?: boolean;
}

const SaveIcon: React.FC<SaveIconProps> = ({ onPress, disabled = false }) => {
  const { themeMode } = useTheme();
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.3);

  const isCyberpunk = themeMode === 'cyberpunk';

  const handlePress = () => {
    if (disabled) return;
    
    // Cyberpunk press animation
    if (isCyberpunk) {
      scale.value = withSequence(
        withTiming(0.95, { duration: 100 }),
        withTiming(1, { duration: 100 })
      );
      glowOpacity.value = withSequence(
        withTiming(0.8, { duration: 100 }),
        withTiming(0.3, { duration: 200 })
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

  const getSaveSource = () => {
    if (isCyberpunk) {
      return require('../../../assets/images/save-cyberpunk.png');
    }
    return null;
  };

  const getButtonClasses = () => {
    if (isCyberpunk) {
      return 'bg-black border-2 border-cyan-400 shadow-lg shadow-cyan-400/50';
    }
    return 'bg-blue-500';
  };

  const getTextClasses = () => {
    if (isCyberpunk) {
      return 'text-yellow-400 font-bold tracking-wider';
    }
    return 'text-white font-bold';
  };

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity 
        onPress={handlePress} 
        disabled={disabled}
        className={`flex-row items-center px-4 py-2 rounded-lg ${getButtonClasses()}`}
        activeOpacity={isCyberpunk ? 1 : 0.7}
      >
        {isCyberpunk && (
          <Animated.View style={glowStyle} className="absolute inset-0 bg-cyan-400/20 rounded-lg" />
        )}
        
        {isCyberpunk && (
          <Image 
            source={getSaveSource()} 
            className="w-6 h-6 mr-2" 
            resizeMode="contain"
          />
        )}
        
        <Text className={getTextClasses()}>
          {isCyberpunk ? 'SAVE TEST' : 'Save Test'}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

export default SaveIcon;

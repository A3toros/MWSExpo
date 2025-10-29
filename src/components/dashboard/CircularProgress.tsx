/** @jsxImportSource nativewind */
import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { ThemeMode } from '../../contexts/ThemeContext';
import { getProgressRingColor, getProgressBackgroundColor } from '../../utils/performanceColors';

interface CircularProgressProps {
  progress: number; // 0-100
  size?: number;
  strokeWidth?: number;
  themeMode: ThemeMode;
  showPercentage?: boolean;
  animationDuration?: number;
  shouldAnimate?: boolean;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function CircularProgress({
  progress,
  size = 120,
  strokeWidth = 8,
  themeMode,
  showPercentage = true,
  animationDuration = 800,
  shouldAnimate = true,
}: CircularProgressProps) {
  // Ensure progress is a valid number between 0 and 100
  const safeProgress = typeof progress === 'number' && !isNaN(progress) 
    ? Math.max(0, Math.min(100, progress)) 
    : 0;
    
  const animatedProgress = useSharedValue(0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    if (shouldAnimate) {
      // Reset to 0 first, then animate to target
      animatedProgress.value = 0;
      animatedProgress.value = withTiming(safeProgress, {
        duration: animationDuration,
      });
    } else {
      // Set immediately without animation
      animatedProgress.value = safeProgress;
    }
  }, [safeProgress, animationDuration, shouldAnimate]);

  const animatedStyle = useAnimatedStyle(() => {
    const strokeDashoffset = interpolate(
      animatedProgress.value,
      [0, 100],
      [circumference, 0],
      Extrapolate.CLAMP
    );

    return {
      strokeDashoffset,
    };
  });

  const progressColor = getProgressRingColor(safeProgress, themeMode);
  const backgroundColor = getProgressBackgroundColor(themeMode);

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        {/* Background circle */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={backgroundColor}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        
        {/* Progress circle */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={progressColor}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeLinecap="round"
          style={animatedStyle}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      
      {/* Percentage text */}
      {showPercentage && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Text
            style={{
              fontSize: size * 0.2,
              fontWeight: 'bold',
              color: progressColor,
              textAlign: 'center',
            }}
          >
            {Math.round(safeProgress)}%
          </Text>
        </View>
      )}
    </View>
  );
}

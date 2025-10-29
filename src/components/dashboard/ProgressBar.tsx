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
import Svg, { Rect } from 'react-native-svg';
import { ThemeMode } from '../../contexts/ThemeContext';
import { getProgressBarColor, getProgressBackgroundColor } from '../../utils/performanceColors';

interface ProgressBarProps {
  progress: number; // 0-100
  width?: number;
  height?: number;
  themeMode: ThemeMode;
  showPercentage?: boolean;
  animationDuration?: number;
  showGlow?: boolean;
  shouldAnimate?: boolean;
}

const AnimatedRect = Animated.createAnimatedComponent(Rect);

export default function ProgressBar({
  progress,
  width = 200,
  height = 20,
  themeMode,
  showPercentage = true,
  animationDuration = 800,
  showGlow = true,
  shouldAnimate = true,
}: ProgressBarProps) {
  // Ensure progress is a valid number between 0 and 100
  const safeProgress = typeof progress === 'number' && !isNaN(progress) 
    ? Math.max(0, Math.min(100, progress)) 
    : 0;
    
  const animatedProgress = useSharedValue(0);

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
    const fillWidth = interpolate(
      animatedProgress.value,
      [0, 100],
      [0, width],
      Extrapolate.CLAMP
    );

    return {
      width: fillWidth,
    };
  });

  const progressColor = getProgressBarColor(safeProgress, themeMode);
  const backgroundColor = getProgressBackgroundColor(themeMode);

  return (
    <View style={{ width, height }}>
      {/* Background bar */}
      <Svg width={width} height={height} style={{ position: 'absolute' }}>
        <Rect
          x={0}
          y={0}
          width={width}
          height={height}
          rx={height / 2}
          ry={height / 2}
          fill={backgroundColor}
        />
      </Svg>

      {/* Progress bar */}
      <Svg width={width} height={height} style={{ position: 'absolute' }}>
        <AnimatedRect
          x={0}
          y={0}
          height={height}
          rx={height / 2}
          ry={height / 2}
          fill={progressColor}
          animatedProps={animatedStyle}
        />
      </Svg>

      {/* Glow effect for cyberpunk theme */}
      {themeMode === 'cyberpunk' && showGlow && (
        <Svg width={width} height={height} style={{ position: 'absolute' }}>
          <AnimatedRect
            x={0}
            y={0}
            height={height}
            rx={height / 2}
            ry={height / 2}
            fill={progressColor}
            opacity={0.3}
            animatedProps={animatedStyle}
          />
        </Svg>
      )}

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
              fontSize: height * 0.6,
              fontWeight: 'bold',
              color: themeMode === 'cyberpunk' ? '#000000' : '#ffffff',
              textAlign: 'center',
              textShadowColor: themeMode === 'cyberpunk' ? progressColor : 'rgba(0,0,0,0.5)',
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 2,
            }}
          >
            {Math.round(progress)}%
          </Text>
        </View>
      )}
    </View>
  );
}

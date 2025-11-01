/** @jsxImportSource nativewind */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  interpolate,
  Extrapolate,
  Easing,
  useAnimatedProps,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

interface CyberpunkCircularProgressProps {
  progress: number; // 0-100
  size?: number;
  animationDuration?: number;
  shouldAnimate?: boolean;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function CyberpunkCircularProgress({
  progress,
  size = 200,
  animationDuration = 2000,
  shouldAnimate = true,
}: CyberpunkCircularProgressProps) {
  const safeProgress = typeof progress === 'number' && !isNaN(progress) 
    ? Math.max(0, Math.min(100, progress)) 
    : 0;

  const [displayProgress, setDisplayProgress] = useState(0);

  // Center point for circles
  const center = size / 2;
  const ringRadius = center - 6;
  const ringCircumference = 2 * Math.PI * ringRadius;
  
  // Progress animation
  const animatedProgress = useSharedValue(0);
  const progressDashOffset = useSharedValue(ringCircumference);
  const progressRatio = useSharedValue(0); // 0..1 shared ratio for syncing rings
  
  // Loading pulse animation
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (shouldAnimate) {
      // Animate progress counter and ring
      animatedProgress.value = 0;
      progressDashOffset.value = ringCircumference;
      
      const intervalTime = 20;
      const increment = safeProgress / (animationDuration / intervalTime);
      let count = 0;
      
      const timer = setInterval(() => {
        count += increment;
        if (count >= safeProgress) {
          count = safeProgress;
          clearInterval(timer);
          // Stop pulse when progress animation completes (any target)
          pulse.value = 0;
        }
        setDisplayProgress(Math.floor(count));
        const ratio = Math.max(0, Math.min(1, count / 100));
        progressRatio.value = ratio;
        progressDashOffset.value = ringCircumference * (1 - ratio);
      }, intervalTime);

      animatedProgress.value = withTiming(safeProgress, {
        duration: animationDuration,
        easing: Easing.out(Easing.cubic),
      });
      
      return () => clearInterval(timer);
    } else {
      animatedProgress.value = safeProgress;
      const ratio = Math.max(0, Math.min(1, safeProgress / 100));
      progressRatio.value = ratio;
      progressDashOffset.value = ringCircumference * (1 - ratio);
      setDisplayProgress(Math.floor(safeProgress));
    }
  }, [safeProgress, animationDuration, shouldAnimate]);

  // Loading pulse (subtle scale) while animating - use UI-thread repeat (no JS callbacks)
  useEffect(() => {
    if (shouldAnimate && safeProgress > 0) {
      pulse.value = 0;
      pulse.value = withRepeat(
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true // reverse for ping-pong effect
      );
      return () => {
        pulse.value = 0;
      };
    } else {
      pulse.value = 0;
    }
  }, [shouldAnimate, safeProgress]);

  // Animated styles
  const progressCircleProps = useAnimatedProps(() => ({
    strokeDashoffset: progressDashOffset.value,
  }));

  // Middle purple circle progress (gradual fill like yellow)
  const middleRadius = center - 20;
  const middleCirc = 2 * Math.PI * middleRadius;
  const middleProgressProps = useAnimatedProps(() => ({
    strokeDashoffset: middleCirc * (1 - progressRatio.value),
  }));

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: 1 + 0.02 * (pulse.value || 0) },
    ],
  }));

  // Colors: red, yellow, purple for cyberpunk
  const colors = {
    red: '#ff003c',
    yellow: '#f8ef02',
    purple: '#9333ea',
    redOpacity: (opacity: number) => `rgba(255, 0, 60, ${opacity})`,
    yellowOpacity: (opacity: number) => `rgba(248, 239, 2, ${opacity})`,
    purpleOpacity: (opacity: number) => `rgba(147, 51, 234, ${opacity})`,
  };

  const viewBoxSize = size;
  const viewBoxOffset = -viewBoxSize / 2;

  const innerRadius = center - 65; // matches the smallest inner circle radius

  return (
    <Animated.View style={[styles.container, containerAnimatedStyle, { width: size, height: size }]}> 
      {/* Percentage Counter inside inner circle */}
      <View 
        style={{
          position: 'absolute',
          left: center - innerRadius,
          top: center - innerRadius,
          width: innerRadius * 2,
          height: innerRadius * 2,
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
        }}
      > 
        <Text style={[styles.percentageText, { fontSize: Math.max(14, innerRadius * 0.5) }]}>
          {displayProgress}%
        </Text>
      </View>

      <Svg width={size} height={size} viewBox={`${viewBoxOffset} ${viewBoxOffset} ${viewBoxSize} ${viewBoxSize}`}>
        <Defs>
          <LinearGradient id="gradYellow" x1="-1" y1="0" x2="1" y2="0">
            <Stop offset="0%" stopColor="#fff34b" stopOpacity="1" />
            <Stop offset="100%" stopColor="#f8ef02" stopOpacity="1" />
          </LinearGradient>
          <LinearGradient id="gradPurple" x1="0" y1="-1" x2="0" y2="1">
            <Stop offset="0%" stopColor="#d946ef" stopOpacity="1" />
            <Stop offset="100%" stopColor="#7c3aed" stopOpacity="1" />
          </LinearGradient>
        </Defs>

        {/* Outer Circle - Red with subtle neon glow */}
        <Circle
          cx="0"
          cy="0"
          r={center - 3}
          fill="transparent"
          stroke={colors.red}
          strokeWidth={10}
          opacity={0.08}
        />
        <Circle
          cx="0"
          cy="0"
          r={center - 3}
          fill="transparent"
          stroke={colors.red}
          strokeWidth={2}
          strokeDasharray="7 1"
        />

        {/* Outer Circle Bars Left - Red */}
        <Circle
          cx="0"
          cy="0"
          r={center - 6}
          fill="transparent"
          stroke={colors.red}
          strokeWidth={7}
          strokeDasharray="0.4 7.6"
          strokeDashoffset={0.1}
        />

        {/* Outer Circle Bars Right - Red */}
        <Circle
          cx="0"
          cy="0"
          r={center - 6}
          fill="transparent"
          stroke={colors.red}
          strokeWidth={7}
          strokeDasharray="0.4 7.6"
          strokeDashoffset={1.4}
        />

        {/* Progress Ring - Yellow with glow */}
        <Circle
          cx="0"
          cy="0"
          r={ringRadius}
          fill="transparent"
          stroke={colors.yellow}
          strokeWidth={16}
          opacity={0.22}
          transform="rotate(-90 0 0)"
        />
        <AnimatedCircle
          cx="0"
          cy="0"
          r={ringRadius}
          fill="transparent"
          stroke="url(#gradYellow)"
          strokeWidth={9}
          strokeDasharray={[ringCircumference]}
          animatedProps={progressCircleProps}
          strokeLinecap="round"
          transform="rotate(-90 0 0)"
        />

        {/* Inner Half Circle - Purple (progress) with glow */}
        <Circle
          cx="0"
          cy="0"
          r={middleRadius}
          fill="transparent"
          stroke={colors.purple}
          strokeWidth={16}
          opacity={0.2}
          transform="rotate(-90 0 0)"
        />
        <AnimatedCircle
          cx="0"
          cy="0"
          r={middleRadius}
          fill="transparent"
          stroke="url(#gradPurple)"
          strokeWidth={9}
          strokeDasharray={[middleCirc]}
          animatedProps={middleProgressProps}
          strokeLinecap="round"
          transform="rotate(-90 0 0)"
        />

        {/* Center Outer Circle - Purple opacity */}
        <Circle
          cx="0"
          cy="0"
          r={center - 27}
          fill="transparent"
          stroke={colors.purpleOpacity(0.5)}
          strokeWidth={1}
        />

        {/* Center Inner Circle Second - Yellow (static) */}
        <Circle
          cx="0"
          cy="0"
          r={center - 33}
          fill="transparent"
          stroke={colors.yellow}
          strokeWidth={2}
          strokeDasharray="5 95"
        />

        {/* Center Inner Circle 3 - Red opacity */}
        <Circle
          cx="0"
          cy="0"
          r={center - 35}
          fill="transparent"
          stroke={colors.redOpacity(0.3)}
          strokeWidth={2}
          strokeDasharray="33 66"
          strokeDashoffset={-10}
        />

        {/* Center Inner Circle 3 Dashed Vertical - Yellow opacity */}
        <Circle
          cx="0"
          cy="0"
          r={center - 39}
          fill="transparent"
          stroke={colors.yellowOpacity(0.6)}
          strokeWidth={7}
          strokeDasharray="0.2 7.8"
        />

        {/* Center Inner Circle 3 Dashed - Purple opacity */}
        <Circle
          cx="0"
          cy="0"
          r={center - 39}
          fill="transparent"
          stroke={colors.purpleOpacity(0.3)}
          strokeWidth={1}
          strokeDasharray="1 3.5"
        />

        {/* Center Inner Circle 2 - Red opacity */}
        <Circle
          cx="0"
          cy="0"
          r={center - 42}
          fill="transparent"
          stroke={colors.redOpacity(0.3)}
          strokeWidth={1}
          strokeDasharray="75 25"
          strokeDashoffset={60}
        />

        {/* Center Inner Circle 1 - Yellow opacity */}
        <Circle
          cx="0"
          cy="0"
          r={center - 45}
          fill="transparent"
          stroke={colors.yellowOpacity(0.3)}
          strokeWidth={1}
          strokeDasharray="95 5"
          strokeDashoffset={20}
        />

        {/* Center Inner Circle 0 - Purple opacity (static) */}
        <Circle
          cx="0"
          cy="0"
          r={center - 65}
          fill="transparent"
          stroke={colors.purpleOpacity(0.3)}
          strokeWidth={7}
          strokeDasharray="0.3 0.7"
        />

      
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentageText: {
    color: '#ff003c', // Red
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    fontFamily: 'monospace',
    textShadowColor: '#f8ef02',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
});


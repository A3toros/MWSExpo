import { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence, interpolate } from 'react-native-reanimated';

// Cyberpunk animation hooks using Reanimated
export const useCyberpunkPulse = () => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.3);

  const startPulse = () => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1000 }),
        withTiming(1, { duration: 1000 })
      ),
      -1,
      true
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 1000 }),
        withTiming(0.3, { duration: 1000 })
      ),
      -1,
      true
    );
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return { animatedStyle, startPulse };
};

export const useCyberpunkGlitch = () => {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);

  const startGlitch = () => {
    translateX.value = withSequence(
      withTiming(-2, { duration: 50 }),
      withTiming(2, { duration: 50 }),
      withTiming(0, { duration: 50 })
    );
    translateY.value = withSequence(
      withTiming(-1, { duration: 50 }),
      withTiming(1, { duration: 50 }),
      withTiming(0, { duration: 50 })
    );
    opacity.value = withSequence(
      withTiming(0.7, { duration: 50 }),
      withTiming(1, { duration: 50 })
    );
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value }
    ],
    opacity: opacity.value,
  }));

  return { animatedStyle, startGlitch };
};

export const useCyberpunkNeon = () => {
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);

  const startNeonFlicker = () => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 200 }),
        withTiming(1, { duration: 200 }),
        withTiming(0.8, { duration: 200 }),
        withTiming(1, { duration: 200 })
      ),
      -1,
      false
    );
  };

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return { animatedStyle, startNeonFlicker };
};

export const useCyberpunkGlow = () => {
  const glowOpacity = useSharedValue(0.3);
  const scale = useSharedValue(1);

  const startGlow = () => {
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 1500 }),
        withTiming(0.3, { duration: 1500 })
      ),
      -1,
      true
    );
    scale.value = withRepeat(
      withSequence(
        withTiming(1.02, { duration: 1500 }),
        withTiming(1, { duration: 1500 })
      ),
      -1,
      true
    );
  };

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: scale.value }],
  }));

  return { glowStyle, startGlow };
};

export const useCyberpunkMatrix = () => {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0.1);

  const startMatrix = () => {
    translateY.value = withRepeat(
      withTiming(100, { duration: 3000 }),
      -1,
      false
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.3, { duration: 1000 }),
        withTiming(0.1, { duration: 2000 })
      ),
      -1,
      true
    );
  };

  const matrixStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  return { matrixStyle, startMatrix };
};

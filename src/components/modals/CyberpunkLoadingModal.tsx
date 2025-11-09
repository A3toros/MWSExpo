/** @jsxImportSource nativewind */
import React, { useEffect, useState, useRef } from 'react';
import { View, Text, Modal } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  interpolate,
  Easing
} from 'react-native-reanimated';
import { ErrorModal } from './ErrorModal';
import { router } from 'expo-router';

interface CyberpunkLoadingModalProps {
  visible: boolean;
  message?: string;
  cpu?: number; // 0-100
  ram?: number; // 0-100
  net?: number; // 0-100
  onTimeout?: () => void; // Optional callback when timeout occurs
}

export const CyberpunkLoadingModal: React.FC<CyberpunkLoadingModalProps> = ({
  visible,
  message = 'LOADING',
  cpu = 0,
  ram = 0,
  net = 0,
  onTimeout
}) => {
  // Timeout state
  const [showError, setShowError] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Animated values for progress bars
  const cpuProgress = useSharedValue(0);
  const ramProgress = useSharedValue(0);
  const netProgress = useSharedValue(0);
  const messageProgress = useSharedValue(0);
  
  // Pulsing animation for status indicator
  const pulseOpacity = useSharedValue(1);
  const glowIntensity = useSharedValue(0.3);

  useEffect(() => {
    if (visible) {
      // Start timeout timer (10 seconds)
      startTimeRef.current = Date.now();
      setShowError(false);
      
      timeoutRef.current = setTimeout(() => {
        console.log('[CyberpunkLoadingModal] Timeout after 10 seconds');
        setShowError(true);
        if (onTimeout) {
          onTimeout();
        }
      }, 10000);

      // Animate progress bars
      cpuProgress.value = withTiming(cpu, { duration: 1500, easing: Easing.out(Easing.cubic) });
      ramProgress.value = withTiming(ram, { duration: 1500, easing: Easing.out(Easing.cubic) });
      netProgress.value = withTiming(net, { duration: 1500, easing: Easing.out(Easing.cubic) });
      
      // Animate message progress bar (follows average of CPU/RAM/NET)
      const avgProgress = (cpu + ram + net) / 3;
      messageProgress.value = withTiming(avgProgress, { duration: 1500, easing: Easing.out(Easing.cubic) });
      
      // Pulsing animation
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.3, { duration: 1000 }),
          withTiming(1, { duration: 1000 })
        ),
        -1,
        false
      );
      
      // Glow animation
      glowIntensity.value = withRepeat(
        withSequence(
          withTiming(0.6, { duration: 1200 }),
          withTiming(0.3, { duration: 1200 })
        ),
        -1,
        false
      );
    } else {
      // Clear timeout when hidden
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      startTimeRef.current = null;
      setShowError(false);
      
      // Reset when hidden
      cpuProgress.value = 0;
      ramProgress.value = 0;
      netProgress.value = 0;
      messageProgress.value = 0;
    }

    // Cleanup on unmount
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [visible, cpu, ram, net, onTimeout]);

  // Animated styles for progress bars
  const cpuStyle = useAnimatedStyle(() => ({
    width: `${cpuProgress.value}%`,
  }));

  const ramStyle = useAnimatedStyle(() => ({
    width: `${ramProgress.value}%`,
  }));

  const netStyle = useAnimatedStyle(() => ({
    width: `${netProgress.value}%`,
  }));

  const messageStyle = useAnimatedStyle(() => ({
    width: `${messageProgress.value}%`,
  }));

  // Pulsing indicator style
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  // Glow style
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowIntensity.value,
  }));

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
    >
      <View className="flex-1" pointerEvents="box-none" style={{ backgroundColor: 'transparent' }}>
        {/* Header area - completely transparent, allows header to show through */}
        <View 
          className="absolute top-0 left-0 right-0 h-24" 
          pointerEvents="box-none" 
          style={{ backgroundColor: 'transparent', zIndex: -1 }}
        />
        {/* Loading overlay - positioned below header, only covers content area */}
        <View 
          className="absolute top-24 left-0 right-0 bottom-0 bg-black/95 justify-center items-center" 
          pointerEvents="box-none"
        >
          <View className="w-11/12 max-w-md p-6 bg-black" pointerEvents="auto">
          {/* Header */}
          <View className="mb-6">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-cyan-400 font-bold tracking-wider text-xl">
                SYSTEM STATUS: ONLINE
              </Text>
              <Animated.View style={pulseStyle} className="flex-row space-x-1">
                <View className="w-2 h-2 bg-cyan-400 rounded-full" />
                <View className="w-2 h-2 bg-cyan-400 rounded-full" />
                <View className="w-2 h-2 bg-cyan-400 rounded-full" />
              </Animated.View>
            </View>
            
            <View className="mb-2">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-yellow-400 text-xs font-bold tracking-wider">
                  {message}
                </Text>
                <Text className="text-yellow-400 text-xs font-bold tracking-wider">
                  {Math.round((cpu + ram + net) / 3)}%
                </Text>
              </View>
              <View className="h-3 bg-black overflow-hidden">
                <Animated.View
                  style={[
                    messageStyle,
                    {
                      height: '100%',
                      backgroundColor: '#f8ef02',
                    }
                  ]}
                >
                  <Animated.View
                    style={[
                      glowStyle,
                      {
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: '#f8ef02',
                        shadowColor: '#f8ef02',
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: 1,
                        shadowRadius: 8,
                      }
                    ]}
                  />
                </Animated.View>
              </View>
            </View>
          </View>

          {/* CPU Progress */}
          <View className="mb-4">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-cyan-400 text-xs font-bold tracking-wider">
                CPU
              </Text>
              <Text className="text-cyan-400 text-xs font-bold tracking-wider">
                {cpu}%
              </Text>
            </View>
            <View className="h-3 bg-black overflow-hidden">
              <Animated.View
                style={[
                  cpuStyle,
                  {
                    height: '100%',
                    backgroundColor: '#00ffd2',
                  }
                ]}
              >
                <Animated.View
                  style={[
                    glowStyle,
                    {
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: '#00ffd2',
                      shadowColor: '#00ffd2',
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 1,
                      shadowRadius: 8,
                    }
                  ]}
                />
              </Animated.View>
            </View>
          </View>

          {/* RAM Progress */}
          <View className="mb-4">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-yellow-400 text-xs font-bold tracking-wider">
                RAM
              </Text>
              <Text className="text-yellow-400 text-xs font-bold tracking-wider">
                {ram}%
              </Text>
            </View>
            <View className="h-3 bg-black overflow-hidden">
              <Animated.View
                style={[
                  ramStyle,
                  {
                    height: '100%',
                    backgroundColor: '#f8ef02',
                  }
                ]}
              >
                <Animated.View
                  style={[
                    glowStyle,
                    {
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: '#f8ef02',
                      shadowColor: '#f8ef02',
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 1,
                      shadowRadius: 8,
                    }
                  ]}
                />
              </Animated.View>
            </View>
          </View>

          {/* NET Progress */}
          <View className="mb-4">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-red-400 text-xs font-bold tracking-wider">
                NET
              </Text>
              <Text className="text-red-400 text-xs font-bold tracking-wider">
                {net}%
              </Text>
            </View>
            <View className="h-3 bg-black overflow-hidden">
              <Animated.View
                style={[
                  netStyle,
                  {
                    height: '100%',
                    backgroundColor: '#ff003c',
                  }
                ]}
              >
                <Animated.View
                  style={[
                    glowStyle,
                    {
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: '#ff003c',
                      shadowColor: '#ff003c',
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 1,
                      shadowRadius: 8,
                    }
                  ]}
                />
              </Animated.View>
            </View>
          </View>

          {/* Status Footer */}
          <View className="flex-row items-center mt-4">
            <View className="w-3 h-3 bg-cyan-400 rounded-full mr-2" />
            <View className="w-3 h-3 bg-yellow-400 rounded-full mr-2" />
            <View className="w-3 h-3 bg-red-400 rounded-full mr-2" />
            <Text className="text-cyan-400 text-xs font-bold tracking-wider">
              NEURAL LINK ACTIVE
            </Text>
          </View>
          </View>
        </View>
      </View>

      {/* Error Modal for timeout */}
      <ErrorModal
        visible={showError}
        onRetry={() => {
          setShowError(false);
          // Try to reload using expo-updates if available, otherwise navigate to same route
          try {
            // @ts-ignore - expo-updates may not be installed
            const Updates = require('expo-updates');
            if (Updates.reloadAsync) {
              Updates.reloadAsync();
              return;
            }
          } catch (e) {
            // expo-updates not available, use router navigation
          }
          
          // Fallback: navigate to current route to refresh
          const currentPath = router.pathname || '/';
          router.replace(currentPath as any);
        }}
        title="Loading Timeout"
        message="Something went wrong. Please try again."
      />
    </Modal>
  );
};


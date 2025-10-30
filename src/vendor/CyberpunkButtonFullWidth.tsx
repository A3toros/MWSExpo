import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { StyleSheet, View, Text, Animated, ViewStyle, TextStyle, Pressable } from 'react-native';

const SHADOW_COLOR = '#add8e6';
const MAIN_COLOR = '#ff003c';
const ANIMATION_DURATION = 1500;
const GLITCH_AMPLITUDE = 5;
const REPEAT_DELAY = 2000;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  leftCorner: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderRightColor: 'transparent',
    transform: [{ rotate: '90deg' }],
  },
  rightSide: {
    borderRightWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightSideCover: {
    borderTopWidth: 2,
  },
  leftSideCover: {
    borderLeftWidth: 2,
  },
  coverContainer: {
    position: 'absolute',
    overflow: 'hidden',
    height: 0,
    zIndex: 1,
    left: 0,
    right: 0,
    alignSelf: 'stretch',
    width: '100%',
  },
  labelText: {
    color: '#ffffff',
    fontWeight: 'bold',
    letterSpacing: 3,
  },
  glitchText: {
    textShadowOffset: { width: 3, height: 2 },
    textShadowRadius: 1,
  },
});

type Props = {
  label?: string;
  buttonHeight?: number;
  glitchAmplitude?: number;
  glitchDuration?: number;
  repeatDelay?: number;
  shadowColor?: string;
  mainColor?: string;
  labelTextStyle?: TextStyle;
  labelContainerStyle?: ViewStyle;
  disableAutoAnimation?: boolean;
  style?: ViewStyle; // NEW: outer container style to allow full-width
  onPress?: () => void;
  containerStyle?: ViewStyle; // accept for API compatibility
};

function CyberpunkButtonFullWidth(
  {
    label = '',
    buttonHeight = 80,
    glitchAmplitude = GLITCH_AMPLITUDE,
    glitchDuration = ANIMATION_DURATION,
    repeatDelay = REPEAT_DELAY,
    shadowColor = SHADOW_COLOR,
    mainColor = MAIN_COLOR,
    labelTextStyle,
    labelContainerStyle, // currently unused, kept for API compatibility
    disableAutoAnimation = false,
    style,
    onPress,
    containerStyle,
  }: Props,
  ref: any,
) {
  const cornerCutSize = buttonHeight / 4;
  const mainAnimatedValue = useRef(new Animated.Value(0)).current;
  const animatedX = useRef(new Animated.Value(0)).current;

  const runAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.spring(animatedX, {
          toValue: -glitchAmplitude,
          useNativeDriver: false,
          speed: 1000,
          bounciness: 1000,
        }),
        Animated.spring(animatedX, {
          toValue: glitchAmplitude,
          useNativeDriver: false,
          speed: 1000,
          bounciness: 1000,
        }),
      ]),
    ).start();

    Animated.timing(mainAnimatedValue, {
      toValue: 100,
      duration: glitchDuration,
      useNativeDriver: false,
    }).start(() => {
      mainAnimatedValue.setValue(0);
      if (!disableAutoAnimation) {
        setTimeout(() => runAnimation(), repeatDelay);
      }
    });
  };

  useEffect(() => {
    if (!disableAutoAnimation) {
      runAnimation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useImperativeHandle(ref, () => ({
    animate: runAnimation,
  }));

  const height = mainAnimatedValue.interpolate({
    inputRange: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
    outputRange: [
      0.01,
      buttonHeight / 4,
      buttonHeight / 8,
      buttonHeight / 2.5,
      buttonHeight / 2.5,
      buttonHeight / 2.5,
      buttonHeight / 5.5,
      buttonHeight / 4,
      buttonHeight / 8,
      buttonHeight / 8,
      buttonHeight / 4,
    ],
  });

  const positionY = mainAnimatedValue.interpolate({
    inputRange: [0, 10, 20, 30, 60, 65, 70, 80, 90, 100],
    outputRange: [
      buttonHeight / 2.5,
      buttonHeight / 2,
      buttonHeight / 4,
      buttonHeight / 1.3,
      buttonHeight / 1.3,
      buttonHeight / 4,
      buttonHeight / 16,
      0,
      0,
      buttonHeight / 4,
    ],
  });

  const renderButton = (isCover = false) => {
    return (
      <View style={[styles.row, { flexGrow: 1, alignSelf: 'stretch' }]}>
        <View>
          <View
            style={[
              {
                height: buttonHeight - cornerCutSize,
                width: cornerCutSize,
                backgroundColor: mainColor,
              },
              isCover ? styles.leftSideCover : null,
              isCover ? { borderLeftColor: shadowColor } : null,
            ]}
          />
          <View
            style={[
              styles.leftCorner,
              {
                borderRightWidth: cornerCutSize,
                borderTopWidth: cornerCutSize,
                borderTopColor: mainColor,
              },
            ]}
          />
        </View>
        <View
          style={[
            styles.rightSide,
            isCover ? styles.rightSideCover : null,
            {
              height: buttonHeight,
              paddingRight: cornerCutSize * 2,
              paddingLeft: cornerCutSize,
              paddingBottom: Math.max(8, buttonHeight / 8),
              borderColor: shadowColor,
              backgroundColor: mainColor,
              flex: 1, // allow stretching to full width
              alignSelf: 'stretch',
            },
            isCover
              ? {
                  borderRightWidth: buttonHeight / 16,
                  borderBottomWidth: buttonHeight / 16,
                }
              : null,
          ]}
        >
          <Text
            style={[
              styles.labelText,
              { fontSize: buttonHeight / 2.5 },
              labelTextStyle,
              isCover ? styles.glitchText : null,
              isCover ? { textShadowColor: shadowColor } : null,
            ]}
          >
            {label?.toUpperCase()}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <Pressable onPress={onPress} style={[styles.row, { alignSelf: 'stretch', width: '100%' }, style, containerStyle]}>
      {renderButton()}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.row,
          styles.coverContainer,
          { height },
          { transform: [{ translateX: animatedX }, { translateY: positionY }] },
        ]}
      >
        <Animated.View
          pointerEvents="none"
          style={[
            styles.row,
            {
              transform: [{ translateY: Animated.multiply(positionY, -1) }],
              height: buttonHeight,
              width: '100%',
              alignSelf: 'stretch',
              flexGrow: 1,
            },
          ]}
        >
          {renderButton(true)}
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

export default forwardRef(CyberpunkButtonFullWidth);



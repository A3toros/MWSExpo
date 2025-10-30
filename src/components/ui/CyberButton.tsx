/** @jsxImportSource nativewind */
import React from 'react';
import { TouchableOpacity, View, Text, ViewStyle, StyleProp } from 'react-native';
import Svg, { Defs, ClipPath, Polygon, Rect } from 'react-native-svg';

type CyberButtonProps = {
  onPress?: () => void;
  disabled?: boolean;
  children?: React.ReactNode;
  tag?: string;
  glitchText?: string;
  style?: StyleProp<ViewStyle>;
  size?: 'sm' | 'md' | 'lg';
  color?: 'red' | 'yellow';
  shadow?: boolean;
  diagonalCut?: boolean;
};

const CYBER_GLITCH_4_TIMELINE = [
  { value: 1, duration: 50 }, // 0% - 1%
  { value: 0, duration: 100 }, // 1% - 3%
  { value: 1, duration: 900 }, // 3% - 21%
  { value: 0, duration: 200 }, // 21% - 25%
  { value: 1, duration: 800 }, // 25% - 41%
  { value: 0, duration: 100 }, // 41% - 43%
  { value: 1, duration: 100 }, // 43% - 45%
  { value: 0, duration: 100 }, // 45% - 47%
  { value: 1, duration: 700 }, // 47% - 61%
  { value: 0, duration: 200 }, // 61% - 65%
  { value: 1, duration: 300 }, // 65% - 71%
  { value: 0, duration: 100 }, // 71% - 73%
  { value: 1, duration: 1350 }, // 73% - 100%
];

const GLITCH_TRANSLATE_KEYFRAMES = [
  { x: 0, y: 0, duration: 80 },
  { x: -3, y: -1, duration: 160 },
  { x: 4, y: 1, duration: 120 },
  { x: -4, y: 2, duration: 40 },
  { x: 3, y: -2, duration: 120 },
  { x: -3, y: 1, duration: 120 },
  { x: 0, y: 0, duration: 280 },
  { x: -2, y: 2, duration: 160 },
  { x: 3, y: -2, duration: 200 },
  { x: -4, y: 1, duration: 200 },
  { x: 0, y: 0, duration: 200 },
  { x: 2, y: -1, duration: 200 },
  { x: -2, y: 1, duration: 200 },
  { x: 0, y: 0, duration: 360 },
];

// Cyberpunk style button for RN (red by default, yellow for modal variant)
export const CyberButton: React.FC<CyberButtonProps> = ({
  onPress,
  disabled,
  children,
  tag,
  glitchText,
  style,
  size = 'md',
  color = 'red',
  shadow = false,
  diagonalCut = false,
}) => {
  const paddingY = size === 'lg' ? 14 : size === 'sm' ? 8 : 12;
  const paddingX = size === 'lg' ? 20 : size === 'sm' ? 12 : 16;
  const bgColor = color === 'yellow' ? '#f8ef02' : '#ff003c';
  const borderGlow = color === 'yellow' ? '#f8ef02' : '#ff003c';
  const shadowColor = '#00ffd2'; // --button-shadow-primary: var(--cyan)
  const textColor = color === 'yellow' ? '#000000' : '#ffffff';
  const [dimensions, setDimensions] = React.useState({ width: 0, height: 0 });
  // No built-in glitch here; modals use react-native-cyberpunk-button instead


  // No scan animation here

  return (
    <TouchableOpacity
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      style={[{ opacity: disabled ? 0.6 : 1 }, style]}
      className="relative rounded-md"
    >
      {/* Optional glow */}
      {shadow ? (
        <View
          className="absolute inset-0 rounded-md"
          style={{
            shadowColor: shadowColor,
            shadowOpacity: 0.6,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 0 },
            elevation: 6,
          }}
        />
      ) : null}

      {/* Button body */}
      <View
        className={diagonalCut ? undefined : "rounded-md border"}
        onLayout={(e) => {
          const { width, height } = e.nativeEvent.layout;
          if (width !== dimensions.width || height !== dimensions.height) {
            setDimensions({ width, height });
          }
        }}
        style={{
          backgroundColor: 'transparent', // Like CSS: background: transparent !important
          paddingVertical: paddingY,
          paddingHorizontal: paddingX,
          position: 'relative',
          ...(diagonalCut && {
            overflow: 'hidden',
            borderWidth: 0,
          }),
        }}
      >
          {/* Shadow layer (like :before) - cyan shadow offset by 4px */}
          {diagonalCut && dimensions.width > 0 && dimensions.height > 0 && (
            <View 
              style={{ 
                position: 'absolute', 
                top: 4, 
                left: 4, 
                right: 0, 
                bottom: 0,
                zIndex: -2,
              }} 
              pointerEvents="none"
            >
              <Svg width={dimensions.width} height={dimensions.height}>
                <Defs>
                  <ClipPath id="shadowClip">
                    {(() => {
                      const w = dimensions.width;
                      const h = dimensions.height;
                      // Increased cutout values for more pronounced diagonal cut
                      const cutoutPx = size === 'sm' ? 20 : size === 'lg' ? 35 : 28; // Increased from CSS values
                      const cutout = Math.min(cutoutPx, Math.round(h * 0.3)); // Increased from 0.22 to 0.3
                      // Exact polygon: 0 0, 100% 0, 100% 100%, 95% 100%, 95% 90%, 80% 90%, 80% 100%, var(--button-cutout) 100%, 0 calc(100% - var(--button-cutout))
                      const points = `0,0 ${w},0 ${w},${h} ${w * 0.95},${h} ${w * 0.95},${h * 0.9} ${w * 0.8},${h * 0.9} ${w * 0.8},${h} ${cutout},${h} 0,${h - cutout}`;
                      return <Polygon points={points} />;
                    })()}
                  </ClipPath>
                </Defs>
                <Rect width={dimensions.width} height={dimensions.height} fill={shadowColor} clipPath="url(#shadowClip)" />
              </Svg>
            </View>
          )}

          {/* Background layer (like :after) */}
          {diagonalCut && dimensions.width > 0 && dimensions.height > 0 ? (
            <View 
              style={{ 
                position: 'absolute', 
                top: 0, 
                left: 0, 
                right: 0, 
                bottom: 0,
                zIndex: -1,
              }} 
              pointerEvents="none"
            >
              <Svg width={dimensions.width} height={dimensions.height}>
                <Defs>
                  <ClipPath id="bgClip">
                    {(() => {
                      const w = dimensions.width;
                      const h = dimensions.height;
                      // Increased cutout values for more pronounced diagonal cut
                      const cutoutPx = size === 'sm' ? 20 : size === 'lg' ? 35 : 28; // Increased from CSS values
                      const cutout = Math.min(cutoutPx, Math.round(h * 0.3)); // Increased from 0.22 to 0.3
                      // Exact polygon: 0 0, 100% 0, 100% 100%, 95% 100%, 95% 90%, 80% 90%, 80% 100%, var(--button-cutout) 100%, 0 calc(100% - var(--button-cutout))
                      const points = `0,0 ${w},0 ${w},${h} ${w * 0.95},${h} ${w * 0.95},${h * 0.9} ${w * 0.8},${h * 0.9} ${w * 0.8},${h} ${cutout},${h} 0,${h - cutout}`;
                      return <Polygon points={points} />;
                    })()}
                  </ClipPath>
                </Defs>
                <Rect width={dimensions.width} height={dimensions.height} fill={bgColor} clipPath="url(#bgClip)" />
              </Svg>
            </View>
          ) : (
            // Regular rounded button
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: bgColor,
                borderColor: borderGlow,
                borderWidth: 1,
                borderRadius: 4,
                zIndex: -1,
              }}
              pointerEvents="none"
            />
          )}
          {/* Main label */}
          <View pointerEvents="none" style={{ position: 'relative', alignSelf: 'center' }}>
            <Text className="font-semibold tracking-wider" style={{ color: textColor, textAlign: 'center' }}>
              {children}
            </Text>
          </View>

          {/* No overlay glitch slice in app-level button */}

          {/* Tag (e.g., R25) */}
          {tag ? (
            <Animated.View
              pointerEvents="none"
              className="absolute right-2 top-1.5 rounded-sm px-1"
              style={{ backgroundColor: 'rgba(0,0,0,0.25)', opacity: 1 }}
            >
              <Text className="text-white text-[10px] font-bold">{tag}</Text>
            </Animated.View>
          ) : null}

          {/* Diagonal cut mask - similar to borderRadius but for diagonal cut */}
          {diagonalCut && (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: -8,
                bottom: -8,
                width: 16,
                height: 16,
                backgroundColor: 'transparent',
                borderTopWidth: 16,
                borderLeftWidth: 16,
                borderTopColor: 'transparent',
                borderLeftColor: '#000000', // This should match the background behind the button
                borderStyle: 'solid',
              }}
            />
          )}
      </View>
    </TouchableOpacity>
  );
};

export default CyberButton;



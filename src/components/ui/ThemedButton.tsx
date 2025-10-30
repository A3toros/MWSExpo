/** @jsxImportSource nativewind */
import { useEffect, useRef, useState } from 'react';
import { TouchableOpacity, View, Text, StyleProp, ViewStyle } from 'react-native';
import CyberButton from './CyberButton';
import CyberpunkButton from 'react-native-cyberpunk-button';
import { useOneAtATimeGlitch } from '../../utils/useOneAtATimeGlitch';
import { useTheme } from '../../contexts/ThemeContext';

type ThemedButtonProps = {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'submit' | 'modal';
  tag?: string;
  glitchText?: string;
};

export const ThemedButton: React.FC<ThemedButtonProps> = ({
  title,
  onPress,
  disabled,
  style,
  size = 'md',
  variant = 'default',
  tag,
  glitchText,
}) => {
  const { themeMode } = useTheme();

  if (themeMode === 'cyberpunk') {
    // Smaller sizes (about -30%)
    const buttonHeight = size === 'lg' ? 42 : size === 'sm' ? 31 : 36;
    const isModal = variant === 'modal';
    const mainColor = isModal ? '#f8ef02' : '#ff003c';
    const labelColor = isModal ? '#000000' : '#ffffff';

    const { active: isActive, id } = useOneAtATimeGlitch();
    return (
      <TouchableOpacity onPress={disabled ? undefined : onPress} disabled={disabled} style={style} activeOpacity={0.8}>
        <CyberpunkButton
          key={`${id}-${isActive ? 'on' : 'off'}`}
          label={title}
          // do not pass onPress to library button to avoid overlay intercepting touches
          buttonHeight={buttonHeight}
          mainColor={mainColor}
          shadowColor="#00ffd2"
          glitchDuration={900}
          glitchAmplitude={10}
          repeatDelay={1500}
          labelTextStyle={{ fontWeight: '800', letterSpacing: 1, color: labelColor }}
          labelContainerStyle={undefined}
          disableAutoAnimation={!isActive}
        />
      </TouchableOpacity>
    );
  }

  const paddingY = size === 'lg' ? 14 : size === 'sm' ? 8 : 12;
  const paddingX = size === 'lg' ? 20 : size === 'sm' ? 12 : 16;

  return (
    <TouchableOpacity onPress={disabled ? undefined : onPress} disabled={disabled} style={style}>
      <View
        className={`rounded-md ${disabled ? 'opacity-60' : ''}`}
        style={{ paddingVertical: paddingY, paddingHorizontal: paddingX, backgroundColor: '#3b82f6' }}
      >
        <Text className="text-white font-semibold">{title}</Text>
      </View>
    </TouchableOpacity>
  );
};

export default ThemedButton;



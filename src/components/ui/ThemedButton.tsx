/** @jsxImportSource nativewind */
import React from 'react';
import { TouchableOpacity, View, Text, StyleProp, ViewStyle } from 'react-native';
import CyberButton from './CyberButton';
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

  if (themeMode === 'cyberpunk' && variant !== 'submit') {
    return (
      <CyberButton
        onPress={onPress}
        disabled={disabled}
        style={style}
        size={size}
        tag={tag}
        glitchText={glitchText}
        color={variant === 'modal' ? 'yellow' : 'red'}
        diagonalCut={variant === 'modal'}
      >
        {title}
      </CyberButton>
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



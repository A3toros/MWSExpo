/** @jsxImportSource nativewind */
import { useMemo } from 'react';
import CyberpunkButton from 'react-native-cyberpunk-button';
import { useOneAtATimeGlitch } from '../../utils/useOneAtATimeGlitch';

type PaletteKey = 'yellow' | 'cyan' | 'red' | 'blue' | 'green' | 'purple';

type MenuButtonProps = {
  title: string;
  onPress?: () => void;
  color?: PaletteKey;
  size?: 'sm' | 'md' | 'lg';
};

const CSS_PALETTE: Record<PaletteKey, string> = {
  yellow: '#f8ef02',
  cyan: '#00ffd2',
  red: '#ff003c',
  blue: '#136377',
  green: '#446d44',
  purple: 'purple',
};

export default function MenuButton({ title, onPress, color = 'cyan', size = 'md' }: MenuButtonProps) {
  const { active } = useOneAtATimeGlitch();
  const buttonHeight = useMemo(() => (size === 'lg' ? 42 : size === 'sm' ? 31 : 36), [size]);
  const mainColor = CSS_PALETTE[color];
  const labelColor = color === 'yellow' ? '#000000' : '#ffffff';
  // Shadow cyan works well against all theme colors
  const shadowColor = '#00ffd2';

  return (
    <CyberpunkButton
      label={title}
      onPress={onPress}
      buttonHeight={buttonHeight}
      mainColor={mainColor}
      shadowColor={shadowColor}
      glitchDuration={900}
      glitchAmplitude={10}
      repeatDelay={1500}
      labelTextStyle={{ fontWeight: '800', letterSpacing: 1, color: labelColor }}
      disableAutoAnimation={!active}
    />
  );
}



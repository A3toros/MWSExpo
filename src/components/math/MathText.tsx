import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import MathRenderer from './MathRenderer';
import { useTheme } from '../../contexts/ThemeContext';

type MathTextProps = {
  text: string;
  style?: ViewStyle;
  textStyle?: TextStyle;
  mathStyle?: ViewStyle;
  fontSize?: number;
};

export default function MathText({
  text,
  style,
  textStyle,
  mathStyle,
  fontSize = 16,
}: MathTextProps) {
  const { themeMode } = useTheme();

  const textColor = themeMode === 'dark' 
    ? '#FFFFFF' 
    : themeMode === 'cyberpunk' 
    ? '#00ffd2' 
    : '#000000';

  const parts = useMemo(() => {
    if (!text || typeof text !== 'string') {
      return [{ type: 'text', content: text || '' }];
    }

    const result: Array<{ type: 'text' | 'math' | 'display'; content: string }> = [];
    let currentPos = 0;

    // Find all math expressions
    const matches: Array<{ 
      type: 'display' | 'inline'; 
      content: string; 
      index: number; 
      length: number 
    }> = [];

    // Find display math ($$...$$) first
    const displayPattern = /\$\$(.*?)\$\$/g;
    let match;
    while ((match = displayPattern.exec(text)) !== null) {
      matches.push({
        type: 'display',
        content: match[1],
        index: match.index,
        length: match[0].length,
      });
    }

    // Find inline math ($...$), but skip if part of display math
    const inlinePattern = /\$(.*?)\$/g;
    while ((match = inlinePattern.exec(text)) !== null) {
      // Skip if it's part of a display math pattern
      if (match[0].startsWith('$$')) continue;

      // Check if this match overlaps with any display math
      const overlaps = matches.some(
        (dm) => match.index >= dm.index && match.index < dm.index + dm.length
      );
      if (!overlaps) {
        matches.push({
          type: 'inline',
          content: match[1],
          index: match.index,
          length: match[0].length,
        });
      }
    }

    // Sort by position
    matches.sort((a, b) => a.index - b.index);

    // Build result array
    for (const mathMatch of matches) {
      // Add text before math
      if (mathMatch.index > currentPos) {
        const textPart = text.substring(currentPos, mathMatch.index);
        if (textPart) {
          result.push({ type: 'text', content: textPart });
        }
      }

      // Add math component
      result.push({
        type: mathMatch.type,
        content: mathMatch.content,
      });

      currentPos = mathMatch.index + mathMatch.length;
    }

    // Add remaining text
    if (currentPos < text.length) {
      const textPart = text.substring(currentPos);
      if (textPart) {
        result.push({ type: 'text', content: textPart });
      }
    }

    return result.length > 0 ? result : [{ type: 'text', content: text }];
  }, [text]);

  return (
    <View style={[styles.container, style]}>
      {parts.map((part, index) => {
        if (part.type === 'text') {
          return (
            <Text 
              key={`text-${index}`} 
              style={[styles.text, textStyle, { color: textColor, fontSize }]}
            >
              {part.content}
            </Text>
          );
        } else {
          return (
            <MathRenderer
              key={`math-${index}`}
              formula={part.content}
              displayMode={part.type === 'display'}
              style={mathStyle}
              textColor={textColor}
              fontSize={fontSize}
            />
          );
        }
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  text: {
    fontSize: 16,
  },
});


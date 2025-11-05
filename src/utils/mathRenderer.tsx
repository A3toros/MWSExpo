// @ts-ignore - react-katex doesn't have type definitions
import { Block, InlineMath } from 'react-katex';
import React from 'react';
import { Text } from 'react-native';

/**
 * Renders math expressions within text for React Native
 * Supports:
 * - $...$ for inline math
 * - $$...$$ for display math
 * @param text - Text that may contain math expressions
 * @returns Array of React Native components (strings and React elements)
 */
export const renderMathInText = (text: string): (React.ReactElement | string)[] => {
  if (!text || typeof text !== 'string') return [text || ''];

  const result: (React.ReactElement | string)[] = [];
  let keyCounter = 0;

  // Process all math expressions (display first, then inline)
  const allMatches: Array<{
    type: 'display' | 'inline';
    expression: string;
    fullMatch: string;
    index: number;
  }> = [];

  // Find display math ($$...$$)
  const displayPattern = /\$\$(.*?)\$\$/g;
  let match: RegExpExecArray | null;
  while ((match = displayPattern.exec(text)) !== null) {
    allMatches.push({
      type: 'display',
      expression: match[1],
      fullMatch: match[0],
      index: match.index,
    });
  }

  // Find inline math ($...$), but skip if it's part of display math
  const inlinePattern = /\$(.*?)\$/g;
  while ((match = inlinePattern.exec(text)) !== null) {
    // Skip if it's part of a display math pattern
    if (match[0].startsWith('$$')) continue;
    
    // Check if this match overlaps with any display math
    const overlaps = allMatches.some(
      (dm) => match!.index >= dm.index && match!.index < dm.index + dm.fullMatch.length
    );
    if (!overlaps) {
      allMatches.push({
        type: 'inline',
        expression: match[1],
        fullMatch: match[0],
        index: match.index,
      });
    }
  }

  // Sort by position in text
  allMatches.sort((a, b) => a.index - b.index);

  // Build result array using React.createElement (no JSX in utility functions)
  let currentPos = 0;
  for (const mathMatch of allMatches) {
    // Add text before math
    if (mathMatch.index > currentPos) {
      const textPart = text.substring(currentPos, mathMatch.index);
      if (textPart) {
        result.push(textPart);
      }
    }

    // Add math component using React.createElement
    try {
      const key = `math-${mathMatch.type}-${keyCounter++}`;
      if (mathMatch.type === 'display') {
        result.push(React.createElement(Block, { key, math: mathMatch.expression }));
      } else {
        result.push(React.createElement(InlineMath, { key, math: mathMatch.expression }));
      }
    } catch (error) {
      console.error('Math rendering error:', error);
      result.push(mathMatch.fullMatch);
    }

    currentPos = mathMatch.index + mathMatch.fullMatch.length;
  }

  // Add remaining text
  if (currentPos < text.length) {
    const textPart = text.substring(currentPos);
    if (textPart) {
      result.push(textPart);
    }
  }

  return result.length > 0 ? result : [text];
};

/**
 * Renders a LaTeX expression to React Native component using KaTeX
 * @param latex - LaTeX expression to render
 * @param displayMode - Whether to render in display mode (block) or inline
 * @returns React Native component
 */
export const renderMathExpression = (
  latex: string,
  displayMode: boolean = false
): React.ReactElement => {
  if (!latex || typeof latex !== 'string') {
    return React.createElement(Text, {}, '');
  }

  try {
    if (displayMode) {
      return React.createElement(Block, { math: latex });
    } else {
      return React.createElement(InlineMath, { math: latex });
    }
  } catch (error) {
    console.error('Math rendering error:', error);
    return React.createElement(Text, {}, latex);
  }
};

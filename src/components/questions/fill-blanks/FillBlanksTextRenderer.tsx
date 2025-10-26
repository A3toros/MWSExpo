/** @jsxImportSource nativewind */
import React from 'react';
import { View, Text } from 'react-native';
import { ThemeMode } from '../../../contexts/ThemeContext';
import { getThemeClasses } from '../../../utils/themeUtils';

export interface Blank {
  id: string | number;
  correct_answer: string;
  position: number;
  options?: string[];
}

interface FillBlanksTextRendererProps {
  text: string;
  blanks: Blank[];
  mode: 'inline' | 'separate';
  themeMode: ThemeMode;
}

export default function FillBlanksTextRenderer({
  text,
  blanks,
  mode,
  themeMode
}: FillBlanksTextRendererProps) {
  const themeClasses = getThemeClasses(themeMode);
  
  const renderTextWithBlanks = () => {
    if (mode === 'inline') {
      return renderInlineBlanks();
    }
    return renderSeparateBlanks();
  };
  
  const renderSeparateBlanks = () => {
    try {
      // Parse Lexical JSON if it's a string (following web app pattern)
      let content = text;
      if (typeof text === 'string' && text.startsWith('{')) {
        try {
          const parsed = JSON.parse(text);
          if (parsed.root && parsed.root.children) {
            // Extract text content from Lexical JSON and find blanks
            content = parsed.root.children.map((child: any) => {
              if (child.children) {
                return child.children.map((textNode: any) => {
                  // Check if this is a blank (has the special styling)
                  if (textNode.style && textNode.style.includes('background-color: #f0f9ff')) {
                    return `[BLANK_PLACEHOLDER]`;
                  }
                  return textNode.text || '';
                }).join('');
              }
              return '';
            }).join(' ');
          }
        } catch (e) {
          console.error('Error parsing Lexical JSON:', e);
        }
      }
      
      // Replace blank placeholders with styled numbered blanks
      let processedContent = content;
      blanks.forEach((blank, index) => {
        const numberedBlank = `[${index + 1}_________]`;
        processedContent = processedContent.replace('[BLANK_PLACEHOLDER]', numberedBlank);
      });
      
      // Split content and style the blanks
      const parts = processedContent.split(/(\[\d+_________\])/);
      const result = parts.map((part, index) => {
        if (part.match(/\[\d+_________\]/)) {
          return (
            <Text 
              key={index}
              className={`inline-block px-3 py-1 mx-1 rounded-lg border-2 font-mono font-bold shadow-sm ${
                themeMode === 'cyberpunk' 
                  ? 'bg-yellow-400/20 text-yellow-400 border-yellow-400 tracking-wider' 
                  : themeMode === 'dark' 
                  ? 'bg-purple-900 text-purple-200 border-purple-600' 
                  : 'bg-purple-100 text-purple-800 border-purple-400'
              }`}
            >
              {part}
            </Text>
          );
        }
        return <Text key={index} className={themeClasses.text}>{part}</Text>;
      });
      
      return (
        <View className="prose max-w-none mb-6">
          <View className="text-lg leading-relaxed">
            {result}
          </View>
        </View>
      );
    } catch (error) {
      console.error('Error rendering text with blanks:', error);
      return (
        <Text className={`text-red-500 ${themeClasses.text}`}>
          Error loading test content
        </Text>
      );
    }
  };
  
  const renderInlineBlanks = () => {
    try {
      // Parse Lexical JSON if it's a string (following web app pattern)
      let content = text;
      if (typeof text === 'string' && text.startsWith('{')) {
        try {
          const parsed = JSON.parse(text);
          if (parsed.root && parsed.root.children) {
            // Extract text content from Lexical JSON and find blanks
            content = parsed.root.children.map((child: any) => {
              if (child.children) {
                return child.children.map((textNode: any) => {
                  // Check if this is a blank (has the special styling)
                  if (textNode.style && textNode.style.includes('background-color: #f0f9ff')) {
                    return `[BLANK_PLACEHOLDER]`;
                  }
                  return textNode.text || '';
                }).join('');
              }
              return '';
            }).join(' ');
          }
        } catch (e) {
          console.error('Error parsing Lexical JSON:', e);
        }
      }
      
      // For inline mode, if no placeholders exist, just show the text
      if (!content.includes('[BLANK_PLACEHOLDER]') && !content.includes('[BLANK_') && !content.includes('___')) {
        return (
          <Text className={`text-lg leading-relaxed ${themeClasses.text}`}>
            {content}
          </Text>
        );
      }
      
      // Replace blank placeholders with clickable dropdowns
      const blankElements: Array<{
        id: string | number;
        index: number;
        element: React.ReactElement;
      }> = [];
      
      blanks.forEach((blank, index) => {
        const blankId = `__BLANK_${blank.id}__`;
        content = content.replace('[BLANK_PLACEHOLDER]', blankId);
        
        blankElements.push({
          id: blank.id,
          index: index,
          element: (
            <Text 
              key={blank.id}
              className={`inline-block px-3 py-2 rounded-lg border-2 font-bold shadow-sm ${
                themeMode === 'cyberpunk' 
                  ? 'bg-yellow-400/20 text-yellow-400 border-yellow-400 tracking-wider' 
                  : themeMode === 'dark' 
                  ? 'bg-purple-900 text-purple-200 border-purple-600' 
                  : 'bg-purple-100 text-purple-800 border-purple-400'
              }`}
            >
              {index + 1}_________
            </Text>
          )
        });
      });
      
      // Split and insert blank elements
      const parts = content.split(/__BLANK_\d+__/);
      const result: React.ReactElement[] = [];
      
      for (let i = 0; i < parts.length; i++) {
        if (parts[i]) {
          result.push(<Text key={`text-${i}`} className={themeClasses.text}>{parts[i]}</Text>);
        }
        if (i < blankElements.length) {
          result.push(blankElements[i].element);
        }
      }
      
      return result;
    } catch (error) {
      console.error('Error rendering inline blanks:', error);
      return (
        <Text className={`text-red-500 ${themeClasses.text}`}>
          Error loading test content
        </Text>
      );
    }
  };
  
  return (
    <View className={`prose max-w-none mb-6`}>
      <View className="text-lg leading-relaxed">
        {renderTextWithBlanks()}
      </View>
    </View>
  );
}

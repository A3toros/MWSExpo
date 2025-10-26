/** @jsxImportSource nativewind */
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ThemeMode } from '../../../contexts/ThemeContext';
import { getThemeClasses } from '../../../utils/themeUtils';

interface FillBlanksTestRendererProps {
  testData: any;
  questions: any[];
  answers: string[];
  onAnswerChange: (questionId: string | number, answer: any) => void;
  themeMode: ThemeMode;
}

export default function FillBlanksTestRenderer({
  testData,
  questions,
  answers,
  onAnswerChange,
  themeMode
}: FillBlanksTestRendererProps) {
  const themeClasses = getThemeClasses(themeMode);

  // Get main test text - try different possible fields
  const mainText = testData?.test_text || testData?.description || testData?.instructions || '';
  
  console.log('🔍 FillBlanksTestRenderer Debug:', {
    mainText,
    questions: questions.length,
    questionsData: questions
  });

  // Render main text with numbered blanks (following web app pattern)
  const renderMainTextWithBlanks = () => {
    if (!mainText) return null;
    
    try {
      // Parse Lexical JSON if it's a string (following web app pattern)
      let content = mainText;
      if (typeof mainText === 'string' && mainText.startsWith('{')) {
        try {
          const parsed = JSON.parse(mainText);
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
      let blankIndex = 0;
      questions.forEach((question: any) => {
        const questionBlanks = question.blanks || [];
        questionBlanks.forEach((blank: any) => {
          const numberedBlank = `[${blankIndex + 1}_________]`;
          processedContent = processedContent.replace('[BLANK_PLACEHOLDER]', numberedBlank);
          blankIndex++;
        });
      });
      
      // Split content and style the blanks
      const parts = processedContent.split(/(\[\d+_________\])/);
      
      return (
        <View className="mb-6">
          <Text className={`text-lg leading-relaxed ${themeClasses.text}`}>
            {parts.map((part: string, index: number) => {
              if (part.match(/\[\d+_________\]/)) {
                return (
                  <Text 
                    key={index}
                    className={`px-2 py-1 mx-1 rounded border font-mono font-bold text-sm ${
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
              return part;
            })}
          </Text>
        </View>
      );
    } catch (error) {
      console.error('Error rendering main text with blanks:', error);
      return (
        <View className="mb-6">
          <Text className={`text-red-500 ${themeClasses.text}`}>
            Error loading test content
          </Text>
        </View>
      );
    }
  };

  // Render individual question cards (following web app pattern)
  const renderQuestionCards = () => {
    return (
      <View className="gap-6">
        {questions.map((question: any, questionIndex: number) => {
          const questionText = question.question_text || question.question || `Question ${questionIndex + 1}`;
          const questionBlanks = question.blanks || [];
          
          console.log(`🔍 Question ${questionIndex + 1} Debug:`, {
            questionText,
            questionBlanks: questionBlanks.length,
            questionData: question
          });
          
          return (
            <View 
              key={question.question_id || questionIndex} 
              className={`p-4 rounded-lg border ${
                themeMode === 'cyberpunk' 
                  ? 'bg-black border-cyan-400/30' 
                  : themeMode === 'dark' 
                  ? 'bg-gray-800 border-gray-600' 
                  : 'bg-white border-gray-200'
              }`}
            >
              {/* Question Header */}
              <View className="mb-4">
                <Text className={`text-lg font-semibold mb-2 ${
                  themeMode === 'cyberpunk' 
                    ? 'text-cyan-400 tracking-wider' 
                    : themeMode === 'dark' 
                    ? 'text-white' 
                    : 'text-gray-900'
                }`}>
                  {themeMode === 'cyberpunk' ? 'QUESTION' : 'Question'} {questionIndex + 1}
                </Text>
                <Text className={`text-base leading-relaxed mb-4 ${
                  themeMode === 'cyberpunk' 
                    ? 'text-cyan-400' 
                    : themeMode === 'dark' 
                    ? 'text-gray-300' 
                    : 'text-gray-700'
                }`}>
                  {questionText}
                </Text>
              </View>
              
              {/* Multiple Choice Options for this question */}
              <View className="gap-3">
                {questionBlanks.map((blank: any, blankIndex: number) => {
                  const blankOptions = blank.blank_options || blank.options || [];
                  const blankId = blank.question_id || blank.id || `${questionIndex}_${blankIndex}`;
                  const currentAnswer = answers[questionIndex] || '';
                  
                  
                  return (
                    <View key={blankId} className="gap-2">
                      {/* Options for this blank */}
                      {blankOptions.filter((option: string) => option && option.trim().length > 0).map((option: string, optIndex: number) => {
                        const optionLetter = String.fromCharCode(65 + optIndex); // A, B, C, D...
                        const isSelected = currentAnswer === optionLetter;
                        
                        
                        
                        return (
                          <TouchableOpacity
                            key={optIndex}
                            onPress={() => onAnswerChange(question.question_id, optionLetter)}
                            className={`flex-row items-center gap-3 p-2 rounded-lg ${
                              isSelected 
                                ? (themeMode === 'cyberpunk' 
                                    ? 'bg-yellow-400/20' 
                                    : themeMode === 'dark' 
                                    ? 'bg-blue-900/30' 
                                    : 'bg-blue-50')
                                : 'bg-transparent'
                            }`}
                          >
                            {/* Radio Button Circle */}
                            <View className={`w-4 h-4 rounded-full border-2 items-center justify-center ${
                              isSelected 
                                ? (themeMode === 'cyberpunk' 
                                    ? 'border-yellow-400 bg-yellow-400' 
                                    : themeMode === 'dark' 
                                    ? 'border-blue-600 bg-blue-600' 
                                    : 'border-blue-500 bg-blue-500')
                                : (themeMode === 'cyberpunk' 
                                    ? 'border-cyan-400' 
                                    : themeMode === 'dark' 
                                    ? 'border-gray-600' 
                                    : 'border-gray-400')
                            }`}>
                              {isSelected && (
                                <View className={`w-2 h-2 rounded-full ${
                                  themeMode === 'cyberpunk' 
                                    ? 'bg-black' 
                                    : 'bg-white'
                                }`} />
                              )}
                            </View>
                            
                            {/* Option Letter */}
                            <View className={`w-6 h-6 rounded-full items-center justify-center ${
                              themeMode === 'cyberpunk' 
                                ? 'bg-black border border-cyan-400' 
                                : themeMode === 'dark' 
                                ? 'bg-gray-700 border border-gray-600' 
                                : 'bg-gray-100 border border-gray-400'
                            }`}>
                              <Text className={`text-sm font-semibold ${
                                themeMode === 'cyberpunk' 
                                  ? 'text-cyan-400' 
                                  : themeMode === 'dark' 
                                  ? 'text-gray-300' 
                                  : 'text-gray-600'
                              }`}>
                                {optionLetter}
                              </Text>
                            </View>
                            
                            {/* Option Text */}
                            <Text className={`flex-1 text-base ${
                              themeMode === 'cyberpunk' 
                                ? 'text-cyan-400' 
                                : themeMode === 'dark' 
                                ? 'text-white' 
                                : 'text-gray-900'
                            }`}>
                              {option}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <View>
      {/* Main Text with Numbered Blanks */}
      {renderMainTextWithBlanks()}
      
      {/* Individual Question Cards */}
      {renderQuestionCards()}
    </View>
  );
}

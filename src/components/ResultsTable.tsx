/** @jsxImportSource nativewind */
import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { TestResult } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { getThemeClasses } from '../utils/themeUtils';

// RESULTS TABLE COMPONENT - React Native Component for Test Results Table
// ✅ REWRITTEN: From web StudentResults.jsx to React Native
// ✅ REWRITTEN: Enhanced results table with detailed analysis
// ✅ REWRITTEN: Score display with pass/fail indication
// ✅ REWRITTEN: Subject abbreviations and teacher names
// ✅ REWRITTEN: Responsive design for mobile
// ✅ REWRITTEN: Show more/less functionality
// ✅ REWRITTEN: Color-coded scores and performance indicators

type Props = {
  results: TestResult[];
  showAll?: boolean;
  onToggleShowAll?: () => void;
  maxInitial?: number;
  compact?: boolean;
};

export function ResultsTable({
  results,
  showAll = false,
  onToggleShowAll,
  maxInitial = 3,
  compact = false
}: Props) {
  const { themeMode } = useTheme();
  const themeClasses = getThemeClasses(themeMode);
  // Get subject abbreviations for results table
  const getSubjectAbbreviation = useCallback((subjectName: string) => {
    const abbreviations: Record<string, string> = {
      'Listening and Speaking': 'L&S',
      'Reading and Writing': 'R&W',
      'English for Career': 'Eng for Career',
      'Science Fundamental': 'Science F',
      'Science Supplementary': 'Science S',
      'Math Fundamental': 'Math F',
      'Math Supplementary': 'Math S',
      'English for Communication': 'Eng for Comm'
    };
    return abbreviations[subjectName] || subjectName;
  }, []);

  // Helper function to get display scores (prefer retest if available)
  const getDisplayScores = useCallback((result: TestResult) => {
    const displayPercentage = result.retest_score || result.percentage;
    
    return {
      score: Math.round(displayPercentage), // Use percentage as score
      maxScore: 100, // Max score is always 100 for percentage
      percentage: displayPercentage
    };
  }, []);

  // Get score color based on percentage (exact copy from web app)
  const getScoreColor = useCallback((percentage: number) => {
    if (percentage >= 80) return { text: '#166534', bg: '#dcfce7' }; // text-green-800, bg-green-100
    if (percentage >= 60) return { text: '#92400e', bg: '#fef3c7' }; // text-yellow-800, bg-yellow-100
    return { text: '#991b1b', bg: '#fecaca' }; // text-red-800, bg-red-100
  }, []);

  if (!results || results.length === 0) {
    return (
      <View className="p-8 items-center">
        <Text className="text-gray-500 text-base">No results available</Text>
      </View>
    );
  }

  const displayResults = showAll ? results : results.slice(0, maxInitial);

  return (
    <View className={`${themeClasses.surface} rounded-xl mb-4 shadow-sm border ${themeClasses.border}`}>
      {!compact && (
        <View className={`p-4 border-b ${themeClasses.border}`}>
          <Text className={`text-lg font-semibold ${themeClasses.text}`}>
            {themeMode === 'cyberpunk' ? 'TEST RESULTS' : 'Test Results'}
          </Text>
        </View>
      )}
      
      <View className="p-4">
        {displayResults.map((result, index) => {
          const { score, maxScore, percentage } = getDisplayScores(result);
          const scoreColor = getScoreColor(percentage);
          const subjectAbbr = getSubjectAbbreviation(result.subject);

          return (
            <View key={index} className={`${themeClasses.surface} rounded-lg p-3 mb-2 border ${themeClasses.border}`}>
              <View className="flex-row justify-between items-center mb-2">
                <View className="flex-row items-center flex-1">
                  <View className={themeMode === 'cyberpunk' 
                    ? 'px-2 py-1 rounded-xl bg-black border border-cyan-400 shadow-lg shadow-cyan-400/50'
                    : themeMode === 'dark'
                    ? 'px-2 py-1 rounded-xl bg-blue-900'
                    : 'px-2 py-1 rounded-xl bg-blue-100'
                  }>
                    <Text className={themeMode === 'cyberpunk' 
                      ? 'text-xs font-bold text-cyan-400 tracking-wider'
                      : themeMode === 'dark'
                      ? 'text-xs font-semibold text-blue-300'
                      : 'text-xs font-semibold text-blue-800'
                    }>
                      {themeMode === 'cyberpunk' ? subjectAbbr.toUpperCase() : subjectAbbr}
                    </Text>
                  </View>
                  <Text className={`text-sm font-semibold ${themeClasses.text} ml-2 flex-1`}>
                    {themeMode === 'cyberpunk' ? result.test_name.toUpperCase() : result.test_name}
                  </Text>
                </View>
                <View className={themeMode === 'cyberpunk' 
                  ? 'px-2 py-1 rounded-lg bg-black border border-cyan-400 shadow-lg shadow-cyan-400/50'
                  : 'px-2 py-1 rounded-lg'
                } style={themeMode !== 'cyberpunk' ? { backgroundColor: scoreColor.bg } : {}}>
                  <Text style={themeMode === 'cyberpunk' ? { color: '#00ffd2' } : { color: scoreColor.text }} className={themeMode === 'cyberpunk' ? 'text-xs font-bold tracking-wider' : 'text-xs font-semibold'}>
                    {percentage}%
                  </Text>
                </View>
              </View>
              
              <View className="flex-row justify-between items-center">
                <Text className={`text-xs ${themeClasses.textSecondary}`}>
                  {themeMode === 'cyberpunk' ? (result.teacher_name || 'UNKNOWN').toUpperCase() : (result.teacher_name || 'Unknown')}
                </Text>
                <Text className={`text-xs ${themeClasses.textSecondary}`}>
                  {new Date(result.submitted_at).toLocaleDateString()}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* Show expand/collapse button if there are more than maxInitial results */}
      {results.length > maxInitial && onToggleShowAll && (
        <View className={`p-4 items-center border-t ${themeClasses.border}`}>
          <TouchableOpacity 
            onPress={onToggleShowAll} 
            className={themeMode === 'cyberpunk' 
              ? 'bg-black border-2 border-cyan-400 shadow-lg shadow-cyan-400/50 px-4 py-2 rounded-md'
              : 'px-4 py-2'
            }
          >
            <Text className={themeMode === 'cyberpunk' 
              ? 'text-cyan-400 text-sm font-bold tracking-wider'
              : 'text-blue-600 text-sm font-medium'
            }>
              {themeMode === 'cyberpunk' 
                ? (showAll ? 'SHOW LESS' : `SHOW ${results.length - maxInitial} MORE`)
                : (showAll ? 'Show Less' : `Show ${results.length - maxInitial} More`)
              }
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}


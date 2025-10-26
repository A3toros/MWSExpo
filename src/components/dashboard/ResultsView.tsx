/** @jsxImportSource nativewind */
import React from 'react';
import { View, Text } from 'react-native';
import { ResultsTable } from '../ResultsTable';
import { TestResult } from '../../types';
import { useTheme } from '../../contexts/ThemeContext';
import { getThemeClasses } from '../../utils/themeUtils';

type Props = {
  results: TestResult[];
  loading: boolean;
  showAllResults: boolean;
  onToggleShowAll: () => void;
};

export function ResultsView({ results, loading, showAllResults, onToggleShowAll }: Props) {
  const { themeMode } = useTheme();
  const themeClasses = getThemeClasses(themeMode);
  const skeletonItems = Array.from({ length: 3 }).map((_, i) => i);

  return (
    <View className="px-4">
      <Text className={`text-lg font-bold ${themeClasses.text} mb-3 text-center`}>
        {themeMode === 'cyberpunk' ? 'TEST RESULTS' : 'Test Results'}
      </Text>
      {loading ? (
        skeletonItems.map((i) => (
          <View key={`r-skel-${i}`} className={`${themeClasses.surface} rounded-lg h-15 mb-2 border ${themeClasses.border}`} />
        ))
      ) : results.length === 0 ? (
        <View className="items-center py-8">
          <Text className={`text-lg font-semibold ${themeClasses.text} mb-2`}>
            {themeMode === 'cyberpunk' ? 'NO RESULTS YET' : 'No Results Yet'}
          </Text>
          <Text className={`text-sm ${themeClasses.textSecondary} text-center`}>
            {themeMode === 'cyberpunk' 
              ? 'COMPLETE SOME TESTS TO SEE YOUR RESULTS HERE.'
              : 'Complete some tests to see your results here.'
            }
          </Text>
        </View>
      ) : (
        <ResultsTable
          results={results}
          showAll={showAllResults}
          onToggleShowAll={onToggleShowAll}
          maxInitial={3}
          compact={false}
        />
      )}
    </View>
  );
}


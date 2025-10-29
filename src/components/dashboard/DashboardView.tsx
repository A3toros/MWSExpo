/** @jsxImportSource nativewind */
import React, { useState, useMemo } from 'react';
import { View, Text, FlatList, RefreshControl, ScrollView, Dimensions } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { getThemeClasses } from '../../utils/themeUtils';
import { TestResult } from '../../types';
import { 
  calculateSubjectPerformance, 
  hasAnyTestResults,
  SubjectPerformance 
} from '../../utils/subjectPerformanceCalculator';
import SubjectPerformanceCard from './SubjectPerformanceCard';

interface User {
  student_id: string;
  name: string;
  surname: string;
  nickname?: string;
  grade: string;
  class: string;
}

interface DashboardViewProps {
  results: TestResult[];
  user: User | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  refreshing: boolean;
}

export default function DashboardView({
  results,
  user,
  loading,
  error,
  onRefresh,
  refreshing,
}: DashboardViewProps) {
  const { themeMode } = useTheme();
  const themeClasses = getThemeClasses(themeMode);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const screenWidth = Dimensions.get('window').width;

  // Calculate subject performance data
  const subjectPerformance = useMemo(() => {
    return calculateSubjectPerformance(results);
  }, [results]);

  // Check if there are any test results
  const hasResults = useMemo(() => {
    return hasAnyTestResults(results);
  }, [results]);

  // Calculate overall performance
  const overallPerformance = useMemo(() => {
    if (!hasResults) return 0;
    const totalScore = results.reduce((sum, result) => {
      return sum + (result.retest_score || result.percentage || 0);
    }, 0);
    return Math.round((totalScore / results.length) * 100) / 100;
  }, [results, hasResults]);

  const renderSubjectCard = ({ item, index }: { item: SubjectPerformance; index: number }) => (
    <SubjectPerformanceCard
      subject={item}
      themeMode={themeMode}
      isActive={index === activeCardIndex}
      onPress={() => setActiveCardIndex(index)}
    />
  );

  const renderEmptyState = () => (
    <View className="flex-1 justify-center items-center px-8">
      <View className={`rounded-2xl p-8 items-center ${
        themeMode === 'cyberpunk'
          ? 'bg-gray-900 border border-cyan-400/30'
          : themeMode === 'dark'
          ? 'bg-gray-800 border border-gray-600'
          : 'bg-gray-50 border border-gray-200'
      }`}>
        <Text className="text-6xl mb-4">📊</Text>
        <Text className={`text-xl font-bold text-center mb-2 ${
          themeMode === 'cyberpunk'
            ? 'text-cyan-400 tracking-wider'
            : themeClasses.text
        }`}>
          {themeMode === 'cyberpunk' ? 'NOTHING HERE YET' : 'Nothing Here Yet'}
        </Text>
        <Text className={`text-base text-center ${
          themeMode === 'cyberpunk'
            ? 'text-cyan-300 tracking-wider'
            : themeClasses.textSecondary
        }`}>
          {themeMode === 'cyberpunk' 
            ? 'COMPLETE SOME TESTS TO SEE YOUR PERFORMANCE DASHBOARD.'
            : 'Complete some tests to see your performance dashboard.'
          }
        </Text>
      </View>
    </View>
  );

  const renderLoadingState = () => (
    <View className="flex-1 justify-center items-center">
      <View className={`rounded-2xl p-8 items-center ${
        themeMode === 'cyberpunk'
          ? 'bg-gray-900 border border-cyan-400/30'
          : themeMode === 'dark'
          ? 'bg-gray-800 border border-gray-600'
          : 'bg-gray-50 border border-gray-200'
      }`}>
        <Text className={`text-lg font-semibold ${
          themeMode === 'cyberpunk'
            ? 'text-cyan-400 tracking-wider'
            : themeClasses.text
        }`}>
          {themeMode === 'cyberpunk' ? 'LOADING DASHBOARD...' : 'Loading Dashboard...'}
        </Text>
      </View>
    </View>
  );

  const renderErrorState = () => (
    <View className="flex-1 justify-center items-center px-8">
      <View className={`rounded-2xl p-8 items-center ${
        themeMode === 'cyberpunk'
          ? 'bg-red-900/20 border border-red-400/30'
          : themeMode === 'dark'
          ? 'bg-red-900/30 border border-red-600'
          : 'bg-red-50 border border-red-200'
      }`}>
        <Text className="text-6xl mb-4">⚠️</Text>
        <Text className={`text-xl font-bold text-center mb-2 ${
          themeMode === 'cyberpunk'
            ? 'text-red-400 tracking-wider'
            : 'text-red-800'
        }`}>
          {themeMode === 'cyberpunk' ? 'ERROR LOADING DATA' : 'Error Loading Data'}
        </Text>
        <Text className={`text-base text-center ${
          themeMode === 'cyberpunk'
            ? 'text-red-300 tracking-wider'
            : 'text-red-600'
        }`}>
          {error || 'Something went wrong. Please try again.'}
        </Text>
      </View>
    </View>
  );

  if (loading) {
    return renderLoadingState();
  }

  if (error) {
    return renderErrorState();
  }

  if (!hasResults) {
    return renderEmptyState();
  }

  return (
    <View className="flex-1">
      <ScrollView 
        className="flex-1"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={themeMode === 'cyberpunk' ? '#00ffd2' : undefined}
            colors={themeMode === 'dark' ? ['#8b5cf6'] : undefined}
          />
        }
      >

      {/* Subject Performance Cards - Limited Height Container */}
      <View style={{ height: 320, marginBottom: 20 }}>
        <FlatList
          data={subjectPerformance}
          renderItem={renderSubjectCard}
          keyExtractor={(item) => item.subject}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={screenWidth} // Snap to screen width
          snapToAlignment="start"
          decelerationRate="fast"
          getItemLayout={(data, index) => ({
            length: screenWidth, // Full screen width
            offset: screenWidth * index,
            index,
          })}
          contentContainerStyle={{ 
            paddingVertical: 20,
            paddingBottom: 30
          }}
          onViewableItemsChanged={({ viewableItems }) => {
            if (viewableItems.length > 0) {
              setActiveCardIndex(viewableItems[0].index || 0);
            }
          }}
          viewabilityConfig={{ itemVisiblePercentThreshold: 80 }} // Only consider item visible when 80% is shown
          // Allow menu swipe gestures to work by reducing gesture sensitivity
          scrollEventThrottle={16}
          directionalLockEnabled={true}
        />
      </View>

        {/* Subject Count Indicator */}
        <View className="px-4 py-2">
          <Text className={`text-sm text-center ${
            themeMode === 'cyberpunk'
              ? 'text-cyan-300 tracking-wider'
              : themeClasses.textSecondary
          }`}>
            {subjectPerformance.length} {subjectPerformance.length === 1 ? 'subject' : 'subjects'} with test results
          </Text>
        </View>
      </ScrollView>

    </View>
  );
}

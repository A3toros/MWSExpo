/** @jsxImportSource nativewind */
import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, FlatList, RefreshControl, ScrollView, Dimensions } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { getThemeClasses } from '../../utils/themeUtils';
import { TestResult, LeaderboardEntry } from '../../types';
import { 
  calculateSubjectPerformance, 
  hasAnyTestResults,
  SubjectPerformance 
} from '../../utils/subjectPerformanceCalculator';
import SubjectPerformanceCard from './SubjectPerformanceCard';
import { leaderboardService } from '../../services/leaderboardService';

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
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);
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

  // Fetch leaderboard data
  useEffect(() => {
    const fetchLeaderboard = async () => {
      if (!user) return;
      
      setLoadingLeaderboard(true);
      try {
        const data = await leaderboardService.getClassLeaderboard();
        setLeaderboard(data);
      } catch (error: any) {
        console.error('Error fetching leaderboard:', error);
        // Don't show error to user if it's a 404 (function not deployed yet)
        // Just silently fail - leaderboard won't be displayed
        if (error.message?.includes('404')) {
          console.warn('Leaderboard function not deployed yet. Skipping leaderboard display.');
        }
      } finally {
        setLoadingLeaderboard(false);
      }
    };

    fetchLeaderboard();
  }, [user]);

  // Refresh leaderboard when onRefresh is called
  const handleRefresh = async () => {
    onRefresh();
    if (user) {
      try {
        const data = await leaderboardService.getClassLeaderboard();
        setLeaderboard(data);
      } catch (error) {
        console.error('Error fetching leaderboard:', error);
      }
    }
  };

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
            onRefresh={handleRefresh}
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

        
        {/* Class Leaderboard Section */}
        {leaderboard.length > 0 && (
          <View className="px-4 mb-6">
            <Text className={`text-lg font-bold mb-3 ${
              themeMode === 'cyberpunk'
                ? 'text-cyan-400 tracking-wider'
                : themeClasses.text
            } text-center`}>
              {themeMode === 'cyberpunk' ? 'CLASS LEADERBOARD' : 'Class Leaderboard'}
            </Text>
            <View className={`rounded-xl p-4 ${
              themeMode === 'cyberpunk'
                ? 'bg-gray-900 border border-cyan-400/30'
                : themeMode === 'dark'
                ? 'bg-gray-800 border border-gray-600'
                : 'bg-white border border-gray-200'
            }`}>
              {/* Table Headers */}
              <View className={`flex-row items-center py-2 px-3 mb-2 border-b ${
                themeMode === 'cyberpunk'
                  ? 'border-cyan-400/30'
                  : themeMode === 'dark'
                  ? 'border-gray-600'
                  : 'border-gray-200'
              }`}>
                <Text className={`text-xs font-bold uppercase tracking-wider mr-3 ${
                  themeMode === 'cyberpunk'
                    ? 'text-cyan-400'
                    : themeClasses.textSecondary
                }`} style={{ width: 40 }}>
                  #
                </Text>
                <Text className={`text-xs font-bold uppercase tracking-wider flex-1 ${
                  themeMode === 'cyberpunk'
                    ? 'text-cyan-400'
                    : themeClasses.textSecondary
                }`}>
                  Nick
                </Text>
                <Text className={`text-xs font-bold uppercase tracking-wider mr-3 ${
                  themeMode === 'cyberpunk'
                    ? 'text-cyan-400'
                    : themeClasses.textSecondary
                }`} style={{ width: 50 }}>
                  XP
                </Text>
                <Text className={`text-xs font-bold uppercase tracking-wider ${
                  themeMode === 'cyberpunk'
                    ? 'text-cyan-400'
                    : themeClasses.textSecondary
                }`} style={{ flex: 1.5 }}>
                  Rank
                </Text>
              </View>
              <FlatList
                data={leaderboard}
                keyExtractor={(item) => item.number.toString()}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <View className={`flex-row items-center py-2 px-3 mb-2 rounded-lg ${
                    item.is_current_student
                      ? themeMode === 'cyberpunk'
                        ? 'bg-cyan-500/20 border border-cyan-400'
                        : themeMode === 'dark'
                        ? 'bg-blue-900/30 border border-blue-400'
                        : 'bg-blue-100 border border-blue-300'
                      : ''
                  }`}>
                    <Text className={`text-lg font-semibold mr-3 ${
                      item.is_current_student
                        ? themeMode === 'cyberpunk' 
                          ? 'text-cyan-400' 
                          : themeMode === 'dark'
                          ? 'text-blue-400'
                          : 'text-blue-600'
                        : themeMode === 'cyberpunk'
                        ? 'text-cyan-300'
                        : themeClasses.text
                    } ${themeMode === 'cyberpunk' ? 'text-[#ff003c]' : ''}`} style={{ width: 40 }}>
                      {item.number}
                    </Text>
                    <Text className={`text-base flex-1 ${
                      item.is_current_student
                        ? themeMode === 'cyberpunk' 
                          ? 'text-cyan-300' 
                          : themeMode === 'dark'
                          ? 'text-blue-300'
                          : 'text-blue-700'
                        : themeMode === 'cyberpunk'
                        ? 'text-cyan-200'
                        : themeClasses.text
                    }`}>
                      {item.nickname}
                    </Text>
                    <Text className={`text-sm font-semibold mr-3 ${
                      item.is_current_student
                        ? themeMode === 'cyberpunk' 
                          ? 'text-cyan-400' 
                          : themeMode === 'dark'
                          ? 'text-blue-400'
                          : 'text-blue-600'
                        : themeMode === 'cyberpunk'
                        ? 'text-cyan-300'
                        : themeClasses.textSecondary
                    } ${themeMode === 'cyberpunk' ? 'text-[#f8ef02]' : ''}`} style={{ width: 50 }}>
                      {item.xp}
                    </Text>
                    <Text className={`text-sm font-semibold ${
                      item.is_current_student
                        ? themeMode === 'cyberpunk' 
                          ? 'text-cyan-400' 
                          : themeMode === 'dark'
                          ? 'text-blue-400'
                          : 'text-blue-600'
                        : themeMode === 'cyberpunk'
                        ? 'text-cyan-300'
                        : themeClasses.textSecondary
                    } ${themeMode === 'cyberpunk' ? 'text-purple-500' : ''}`} style={{ flex: 1.5 }}>
                      {item.rank_title}
                    </Text>
                  </View>
                )}
              />
            </View>
          </View>
        )}
      </ScrollView>

    </View>
  );
}

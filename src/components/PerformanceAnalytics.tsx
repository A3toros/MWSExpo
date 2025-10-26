/** @jsxImportSource nativewind */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { performanceService } from '../services/performanceService';
import { useApi } from '../hooks/useApi';
import { logger } from '../utils/logger';

interface PerformanceAnalyticsProps {
  onViewDetails?: (metric: string) => void;
  onExportAnalytics?: () => void;
}

const { width } = Dimensions.get('window');

export function PerformanceAnalytics({ onViewDetails, onExportAnalytics }: PerformanceAnalyticsProps) {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'week' | 'month' | 'semester' | 'year'>('month');
  const [selectedView, setSelectedView] = useState<'overview' | 'trends' | 'insights' | 'comparison'>('overview');

  // Load analytics data
  const loadAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      const data = await performanceService.getPerformanceAnalytics({
        from_date: getDateForPeriod(selectedPeriod),
        include_comparison: true,
        include_prediction: true,
      });
      
      setAnalytics(data);
      logger.info('Performance analytics loaded', 'performance', { period: selectedPeriod });
    } catch (error) {
      logger.error('Failed to load performance analytics', 'performance', error);
    } finally {
      setLoading(false);
    }
  }, [selectedPeriod]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadAnalytics();
    } catch (error) {
      logger.error('Failed to refresh performance analytics', 'performance', error);
    } finally {
      setRefreshing(false);
    }
  }, [loadAnalytics]);

  // Load data on mount and when period changes
  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  // Get date for period
  const getDateForPeriod = (period: string) => {
    const now = new Date();
    switch (period) {
      case 'week':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      case 'month':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      case 'semester':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
      case 'year':
        return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();
      default:
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    }
  };

  // Get trend color
  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up': return '#10b981';
      case 'down': return '#ef4444';
      case 'stable': return '#6b7280';
      default: return '#6b7280';
    }
  };

  // Get trend icon
  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return '↗';
      case 'down': return '↘';
      case 'stable': return '→';
      default: return '→';
    }
  };

  // Render overview
  const renderOverview = () => {
    if (!analytics?.current_performance) return null;

    const { current_performance } = analytics;
    
    return (
      <View className="p-4">
        {/* Key Metrics */}
        <View className="flex-row flex-wrap gap-3 mb-6">
          <View className="flex-1 min-w-[45%] bg-white p-4 rounded-xl items-center shadow-sm border border-gray-200">
            <Text className="text-2xl font-bold text-header-blue mb-1">{current_performance.overall_score}</Text>
            <Text className="text-xs text-gray-600 text-center">Overall Score</Text>
          </View>
          <View className="flex-1 min-w-[45%] bg-white p-4 rounded-xl items-center shadow-sm border border-gray-200">
            <Text className="text-2xl font-bold text-header-blue mb-1">{current_performance.tests_taken}</Text>
            <Text className="text-xs text-gray-600 text-center">Tests Taken</Text>
          </View>
          <View className="flex-1 min-w-[45%] bg-white p-4 rounded-xl items-center shadow-sm border border-gray-200">
            <Text className="text-2xl font-bold text-header-blue mb-1">{current_performance.tests_passed}</Text>
            <Text className="text-xs text-gray-600 text-center">Tests Passed</Text>
          </View>
          <View className="flex-1 min-w-[45%] bg-white p-4 rounded-xl items-center shadow-sm border border-gray-200">
            <Text className="text-2xl font-bold text-header-blue mb-1">{current_performance.tests_failed}</Text>
            <Text className="text-xs text-gray-600 text-center">Tests Failed</Text>
          </View>
        </View>

        {/* Subject Performance */}
        <View className="mb-6">
          <Text className="text-lg font-bold text-gray-800 mb-3">Subject Performance</Text>
          <View className="gap-3">
            {current_performance.subject_breakdown.map((subject: any, index: number) => (
              <View key={index} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-base font-bold text-gray-800">{subject.subject}</Text>
                  <Text className="text-base font-bold text-header-blue">{subject.average_score}%</Text>
                </View>
                <View className="h-2 bg-gray-200 rounded mb-2 overflow-hidden">
                  <View 
                    className="h-full rounded"
                    style={{ 
                      width: `${subject.average_score}%`,
                      backgroundColor: subject.average_score >= 80 ? '#10b981' : 
                                     subject.average_score >= 60 ? '#f59e0b' : '#ef4444'
                    }} 
                  />
                </View>
                <Text className="text-xs text-gray-600">
                  {subject.tests_taken} tests • {subject.improvement > 0 ? '+' : ''}{subject.improvement}% improvement
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  };

  // Render trends
  const renderTrends = () => {
    if (!analytics?.historical_trends) return null;

    const { historical_trends } = analytics;
    
    return (
      <View className="p-4">
        <Text className="text-lg font-bold text-gray-800 mb-3">Performance Trends</Text>
        <View className="gap-4">
          {historical_trends.map((trend: any, index: number) => (
            <View key={index} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
              <View className="flex-row justify-between items-center mb-3">
                <Text className="text-base font-bold text-gray-800">{trend.period}</Text>
                <View className="flex-row items-center gap-1">
                  <Text style={{ color: getTrendColor(trend.trend) }} className="text-base font-bold">
                    {getTrendIcon(trend.trend)}
                  </Text>
                  <Text style={{ color: getTrendColor(trend.trend) }} className="text-xs font-bold">
                    {trend.trend.toUpperCase()}
                  </Text>
                </View>
              </View>
              <View className="flex-row flex-wrap gap-3">
                <View className="flex-1 min-w-[45%] items-center">
                  <Text className="text-xs text-gray-600 mb-1">Tests Taken</Text>
                  <Text className="text-base font-bold text-gray-800">{trend.tests_taken}</Text>
                </View>
                <View className="flex-1 min-w-[45%] items-center">
                  <Text className="text-xs text-gray-600 mb-1">Average Score</Text>
                  <Text className="text-base font-bold text-gray-800">{trend.average_score}%</Text>
                </View>
                <View className="flex-1 min-w-[45%] items-center">
                  <Text className="text-xs text-gray-600 mb-1">Pass Rate</Text>
                  <Text className="text-base font-bold text-gray-800">{trend.pass_rate}%</Text>
                </View>
                <View className="flex-1 min-w-[45%] items-center">
                  <Text className="text-xs text-gray-600 mb-1">Improvement</Text>
                  <Text style={{ 
                    color: trend.improvement > 0 ? '#10b981' : trend.improvement < 0 ? '#ef4444' : '#6b7280' 
                  }} className="text-base font-bold">
                    {trend.improvement > 0 ? '+' : ''}{trend.improvement}%
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  };

  // Render insights
  const renderInsights = () => {
    if (!analytics?.insights) return null;

    const { insights } = analytics;
    
    return (
      <View className="p-4">
        {/* Strengths */}
        <View className="mb-6">
          <Text className="text-lg font-bold text-gray-800 mb-3">Strengths</Text>
          <View className="gap-3">
            {insights.strengths.map((strength: any, index: number) => (
              <View key={index} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-base font-bold text-gray-800">{strength.area}</Text>
                  <Text className="text-lg font-bold text-green-600">{strength.score}%</Text>
                </View>
                <Text className="text-sm text-gray-700 leading-5">{strength.description}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Weaknesses */}
        <View className="mb-6">
          <Text className="text-lg font-bold text-gray-800 mb-3">Areas for Improvement</Text>
          <View className="gap-3">
            {insights.weaknesses.map((weakness: any, index: number) => (
              <View key={index} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-base font-bold text-gray-800">{weakness.area}</Text>
                  <Text className="text-lg font-bold text-red-600">{weakness.score}%</Text>
                </View>
                <Text className="text-sm text-gray-700 mb-3 leading-5">{weakness.description}</Text>
                <View className="gap-1">
                  {weakness.recommendations.map((rec: string, recIndex: number) => (
                    <Text key={recIndex} className="text-sm text-blue-700">
                      • {rec}
                    </Text>
                  ))}
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Recommendations */}
        <View className="mb-6">
          <Text className="text-lg font-bold text-gray-800 mb-3">Recommendations</Text>
          <View className="gap-3">
            {insights.recommendations.map((rec: any, index: number) => (
              <View key={index} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-base font-bold text-gray-800">{rec.title}</Text>
                  <View 
                    className="px-2 py-1 rounded"
                    style={{ 
                      backgroundColor: rec.priority === 'high' ? '#ef4444' : 
                                     rec.priority === 'medium' ? '#f59e0b' : '#10b981' 
                    }}
                  >
                    <Text className="text-xs text-white font-bold">{rec.priority.toUpperCase()}</Text>
                  </View>
                </View>
                <Text className="text-sm text-gray-700 mb-3 leading-5">{rec.description}</Text>
                {rec.resources.length > 0 && (
                  <View className="bg-blue-50 p-3 rounded-lg">
                    <Text className="text-sm font-bold text-blue-800 mb-2">Resources:</Text>
                    <View className="gap-1">
                      {rec.resources.map((resource: string, resIndex: number) => (
                        <Text key={resIndex} className="text-sm text-blue-700">
                          • {resource}
                        </Text>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  };

  // Render comparison
  const renderComparison = () => {
    if (!analytics?.comparison) return null;

    const { comparison } = analytics;
    
    return (
      <View className="p-4">
        <Text className="text-lg font-bold text-gray-800 mb-4">Performance Comparison</Text>
        
        {/* Comparison Stats */}
        <View className="flex-row gap-3 mb-6">
          <View className="flex-1 bg-white p-4 rounded-xl shadow-sm border border-gray-200 items-center">
            <Text className="text-sm text-gray-600 mb-1">Your Performance</Text>
            <Text className="text-2xl font-bold text-gray-800">{comparison.student_performance.overall_score}%</Text>
          </View>
          <View className="flex-1 bg-white p-4 rounded-xl shadow-sm border border-gray-200 items-center">
            <Text className="text-sm text-gray-600 mb-1">Class Average</Text>
            <Text className="text-2xl font-bold text-gray-800">{comparison.class_average.overall_score}%</Text>
          </View>
          <View className="flex-1 bg-white p-4 rounded-xl shadow-sm border border-gray-200 items-center">
            <Text className="text-sm text-gray-600 mb-1">School Average</Text>
            <Text className="text-2xl font-bold text-gray-800">{comparison.school_average.overall_score}%</Text>
          </View>
        </View>

        {/* Percentile Rank */}
        <View className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6">
          <Text className="text-base font-bold text-gray-800 mb-2">Percentile Rank</Text>
          <Text className="text-2xl font-bold text-blue-600 mb-1">{comparison.percentile_rank}th percentile</Text>
          <Text className="text-sm text-gray-600">
            You're performing better than {comparison.percentile_rank}% of students
          </Text>
        </View>

        {/* Comparison Insights */}
        <View className="mb-6">
          <Text className="text-lg font-bold text-gray-800 mb-3">Comparison Insights</Text>
          <View className="gap-3">
            {comparison.comparison_insights.map((insight: any, index: number) => (
              <View key={index} className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                <View className="flex-row justify-between items-center mb-2">
                  <Text className="text-base font-bold text-gray-800">{insight.metric}</Text>
                  <Text style={{ 
                    color: insight.status === 'above' ? '#10b981' : 
                           insight.status === 'below' ? '#ef4444' : '#6b7280' 
                  }} className="text-sm font-bold">
                    {insight.status === 'above' ? 'Above' : 
                     insight.status === 'below' ? 'Below' : 'Equal'} Average
                  </Text>
                </View>
                <Text className="text-sm text-gray-700">
                  Your score: {insight.student_value} • Average: {insight.average_value} • 
                  Difference: {insight.difference > 0 ? '+' : ''}{insight.difference}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-header-blue shadow-md">
        <View className="px-4 py-4">
          <Text className="text-white text-2xl font-bold mb-1">Performance Analytics</Text>
          <Text className="text-blue-100 text-base">
            Track your academic progress and performance
          </Text>
        </View>
      </View>

      {/* Period Selector */}
      <View className="bg-white py-3 border-b border-gray-200">
        <View className="flex-row px-4 gap-1">
          {['week', 'month', 'semester', 'year'].map((period) => (
            <TouchableOpacity
              key={period}
              className={`flex-1 py-2 px-3 mx-1 rounded-lg items-center ${
                selectedPeriod === period 
                  ? 'bg-header-blue' 
                  : 'bg-gray-100'
              }`}
              onPress={() => setSelectedPeriod(period as any)}
            >
              <Text className={`text-sm font-medium ${
                selectedPeriod === period 
                  ? 'text-white' 
                  : 'text-gray-600'
              }`}>
                {period.charAt(0).toUpperCase() + period.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* View Selector */}
      <View className="bg-white py-3 border-b border-gray-200">
        <View className="flex-row px-4 gap-1">
          {[
            { key: 'overview', label: 'Overview' },
            { key: 'trends', label: 'Trends' },
            { key: 'insights', label: 'Insights' },
            { key: 'comparison', label: 'Comparison' },
          ].map((view) => (
            <TouchableOpacity
              key={view.key}
              className={`flex-1 py-2 px-3 mx-1 rounded-lg items-center ${
                selectedView === view.key 
                  ? 'bg-header-blue' 
                  : 'bg-gray-100'
              }`}
              onPress={() => setSelectedView(view.key as any)}
            >
              <Text className={`text-sm font-medium ${
                selectedView === view.key 
                  ? 'text-white' 
                  : 'text-gray-600'
              }`}>
                {view.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Content */}
      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {loading ? (
          <View className="p-5 items-center">
            <Text className="text-base text-gray-500">Loading analytics...</Text>
          </View>
        ) : (
          <>
            {selectedView === 'overview' && renderOverview()}
            {selectedView === 'trends' && renderTrends()}
            {selectedView === 'insights' && renderInsights()}
            {selectedView === 'comparison' && renderComparison()}
          </>
        )}
      </ScrollView>
    </View>
  );
}

export default PerformanceAnalytics;
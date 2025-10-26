import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
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
      <View style={styles.overviewContainer}>
        {/* Key Metrics */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricNumber}>{current_performance.overall_score}</Text>
            <Text style={styles.metricLabel}>Overall Score</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricNumber}>{current_performance.tests_taken}</Text>
            <Text style={styles.metricLabel}>Tests Taken</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricNumber}>{current_performance.tests_passed}</Text>
            <Text style={styles.metricLabel}>Tests Passed</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricNumber}>{current_performance.tests_failed}</Text>
            <Text style={styles.metricLabel}>Tests Failed</Text>
          </View>
        </View>

        {/* Subject Performance */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subject Performance</Text>
          <View style={styles.subjectPerformanceList}>
            {current_performance.subject_breakdown.map((subject: any, index: number) => (
              <View key={index} style={styles.subjectPerformanceCard}>
                <View style={styles.subjectPerformanceHeader}>
                  <Text style={styles.subjectName}>{subject.subject}</Text>
                  <Text style={styles.subjectScore}>{subject.average_score}%</Text>
                </View>
                <View style={styles.subjectPerformanceBar}>
                  <View 
                    style={[
                      styles.subjectPerformanceFill,
                      { 
                        width: `${subject.average_score}%`,
                        backgroundColor: subject.average_score >= 80 ? '#10b981' : 
                                       subject.average_score >= 60 ? '#f59e0b' : '#ef4444'
                      }
                    ]} 
                  />
                </View>
                <Text style={styles.subjectTests}>
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
      <View style={styles.trendsContainer}>
        <Text style={styles.sectionTitle}>Performance Trends</Text>
        <View style={styles.trendsList}>
          {historical_trends.map((trend: any, index: number) => (
            <View key={index} style={styles.trendCard}>
              <View style={styles.trendHeader}>
                <Text style={styles.trendPeriod}>{trend.period}</Text>
                <View style={styles.trendIndicator}>
                  <Text style={[
                    styles.trendIcon,
                    { color: getTrendColor(trend.trend) }
                  ]}>
                    {getTrendIcon(trend.trend)}
                  </Text>
                  <Text style={[
                    styles.trendText,
                    { color: getTrendColor(trend.trend) }
                  ]}>
                    {trend.trend.toUpperCase()}
                  </Text>
                </View>
              </View>
              <View style={styles.trendMetrics}>
                <View style={styles.trendMetric}>
                  <Text style={styles.trendMetricLabel}>Tests Taken</Text>
                  <Text style={styles.trendMetricValue}>{trend.tests_taken}</Text>
                </View>
                <View style={styles.trendMetric}>
                  <Text style={styles.trendMetricLabel}>Average Score</Text>
                  <Text style={styles.trendMetricValue}>{trend.average_score}%</Text>
                </View>
                <View style={styles.trendMetric}>
                  <Text style={styles.trendMetricLabel}>Pass Rate</Text>
                  <Text style={styles.trendMetricValue}>{trend.pass_rate}%</Text>
                </View>
                <View style={styles.trendMetric}>
                  <Text style={styles.trendMetricLabel}>Improvement</Text>
                  <Text style={[
                    styles.trendMetricValue,
                    { color: trend.improvement > 0 ? '#10b981' : trend.improvement < 0 ? '#ef4444' : '#6b7280' }
                  ]}>
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
      <View style={styles.insightsContainer}>
        {/* Strengths */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Strengths</Text>
          <View style={styles.insightsList}>
            {insights.strengths.map((strength: any, index: number) => (
              <View key={index} style={styles.insightCard}>
                <View style={styles.insightHeader}>
                  <Text style={styles.insightTitle}>{strength.area}</Text>
                  <Text style={styles.insightScore}>{strength.score}%</Text>
                </View>
                <Text style={styles.insightDescription}>{strength.description}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Weaknesses */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Areas for Improvement</Text>
          <View style={styles.insightsList}>
            {insights.weaknesses.map((weakness: any, index: number) => (
              <View key={index} style={styles.insightCard}>
                <View style={styles.insightHeader}>
                  <Text style={styles.insightTitle}>{weakness.area}</Text>
                  <Text style={styles.insightScore}>{weakness.score}%</Text>
                </View>
                <Text style={styles.insightDescription}>{weakness.description}</Text>
                <View style={styles.recommendationsList}>
                  {weakness.recommendations.map((rec: string, recIndex: number) => (
                    <Text key={recIndex} style={styles.recommendationText}>
                      • {rec}
                    </Text>
                  ))}
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Recommendations */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recommendations</Text>
          <View style={styles.recommendationsList}>
            {insights.recommendations.map((rec: any, index: number) => (
              <View key={index} style={styles.recommendationCard}>
                <View style={styles.recommendationHeader}>
                  <Text style={styles.recommendationTitle}>{rec.title}</Text>
                  <View style={[
                    styles.priorityBadge,
                    { backgroundColor: rec.priority === 'high' ? '#ef4444' : 
                                     rec.priority === 'medium' ? '#f59e0b' : '#10b981' }
                  ]}>
                    <Text style={styles.priorityText}>{rec.priority.toUpperCase()}</Text>
                  </View>
                </View>
                <Text style={styles.recommendationDescription}>{rec.description}</Text>
                {rec.resources.length > 0 && (
                  <View style={styles.resourcesList}>
                    <Text style={styles.resourcesTitle}>Resources:</Text>
                    {rec.resources.map((resource: string, resIndex: number) => (
                      <Text key={resIndex} style={styles.resourceText}>
                        • {resource}
                      </Text>
                    ))}
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
      <View style={styles.comparisonContainer}>
        <Text style={styles.sectionTitle}>Performance Comparison</Text>
        
        {/* Comparison Stats */}
        <View style={styles.comparisonStats}>
          <View style={styles.comparisonCard}>
            <Text style={styles.comparisonLabel}>Your Performance</Text>
            <Text style={styles.comparisonValue}>{comparison.student_performance.overall_score}%</Text>
          </View>
          <View style={styles.comparisonCard}>
            <Text style={styles.comparisonLabel}>Class Average</Text>
            <Text style={styles.comparisonValue}>{comparison.class_average.overall_score}%</Text>
          </View>
          <View style={styles.comparisonCard}>
            <Text style={styles.comparisonLabel}>School Average</Text>
            <Text style={styles.comparisonValue}>{comparison.school_average.overall_score}%</Text>
          </View>
        </View>

        {/* Percentile Rank */}
        <View style={styles.percentileCard}>
          <Text style={styles.percentileTitle}>Percentile Rank</Text>
          <Text style={styles.percentileValue}>{comparison.percentile_rank}th percentile</Text>
          <Text style={styles.percentileDescription}>
            You're performing better than {comparison.percentile_rank}% of students
          </Text>
        </View>

        {/* Comparison Insights */}
        <View style={styles.comparisonInsights}>
          <Text style={styles.sectionTitle}>Comparison Insights</Text>
          {comparison.comparison_insights.map((insight: any, index: number) => (
            <View key={index} style={styles.insightCard}>
              <View style={styles.insightHeader}>
                <Text style={styles.insightTitle}>{insight.metric}</Text>
                <Text style={[
                  styles.insightScore,
                  { color: insight.status === 'above' ? '#10b981' : 
                           insight.status === 'below' ? '#ef4444' : '#6b7280' }
                ]}>
                  {insight.status === 'above' ? 'Above' : 
                   insight.status === 'below' ? 'Below' : 'Equal'} Average
                </Text>
              </View>
              <Text style={styles.insightDescription}>
                Your score: {insight.student_value} • Average: {insight.average_value} • 
                Difference: {insight.difference > 0 ? '+' : ''}{insight.difference}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Performance Analytics</Text>
        <Text style={styles.subtitle}>
          Track your academic progress and performance
        </Text>
      </View>

      {/* Period Selector */}
      <View style={styles.periodSelector}>
        {['week', 'month', 'semester', 'year'].map((period) => (
          <TouchableOpacity
            key={period}
            style={[
              styles.periodButton,
              selectedPeriod === period && styles.activePeriodButton
            ]}
            onPress={() => setSelectedPeriod(period as any)}
          >
            <Text style={[
              styles.periodButtonText,
              selectedPeriod === period && styles.activePeriodButtonText
            ]}>
              {period.charAt(0).toUpperCase() + period.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* View Selector */}
      <View style={styles.viewSelector}>
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'trends', label: 'Trends' },
          { key: 'insights', label: 'Insights' },
          { key: 'comparison', label: 'Comparison' },
        ].map((view) => (
          <TouchableOpacity
            key={view.key}
            style={[
              styles.viewButton,
              selectedView === view.key && styles.activeViewButton
            ]}
            onPress={() => setSelectedView(view.key as any)}
          >
            <Text style={[
              styles.viewButtonText,
              selectedView === view.key && styles.activeViewButtonText
            ]}>
              {view.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading analytics...</Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#4f46e5',
    padding: 20,
    paddingTop: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#e0e7ff',
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: 'white',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  periodButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  activePeriodButton: {
    backgroundColor: '#4f46e5',
  },
  periodButtonText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  activePeriodButtonText: {
    color: 'white',
  },
  viewSelector: {
    flexDirection: 'row',
    backgroundColor: 'white',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  viewButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  activeViewButton: {
    backgroundColor: '#4f46e5',
  },
  viewButtonText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  activeViewButtonText: {
    color: 'white',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
  },
  overviewContainer: {
    padding: 16,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  metricNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4f46e5',
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
  },
  subjectPerformanceList: {
    gap: 12,
  },
  subjectPerformanceCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  subjectPerformanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  subjectName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  subjectScore: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4f46e5',
  },
  subjectPerformanceBar: {
    height: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
    marginBottom: 8,
    overflow: 'hidden',
  },
  subjectPerformanceFill: {
    height: '100%',
    borderRadius: 4,
  },
  subjectTests: {
    fontSize: 12,
    color: '#6b7280',
  },
  trendsContainer: {
    padding: 16,
  },
  trendsList: {
    gap: 16,
  },
  trendCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  trendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  trendPeriod: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  trendIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trendIcon: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  trendText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  trendMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  trendMetric: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
  },
  trendMetricLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  trendMetricValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  insightsContainer: {
    padding: 16,
  },
  insightsList: {
    gap: 12,
  },
  insightCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  insightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  insightScore: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4f46e5',
  },
  insightDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  recommendationsList: {
    marginTop: 8,
  },
  recommendationText: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  recommendationCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  recommendationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  recommendationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  priorityText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  recommendationDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 8,
  },
  resourcesList: {
    marginTop: 8,
  },
  resourcesTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  resourceText: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  comparisonContainer: {
    padding: 16,
  },
  comparisonStats: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  comparisonCard: {
    flex: 1,
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  comparisonLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  comparisonValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  percentileCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  percentileTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  percentileValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4f46e5',
    marginBottom: 4,
  },
  percentileDescription: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
  comparisonInsights: {
    gap: 12,
  },
});

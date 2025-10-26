import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';

interface ProgressTrackerProps {
  answeredCount?: number;
  totalQuestions?: number;
  percentage?: number;
  timeElapsed?: number;
  timeRemaining?: number;
  onSubmitTest?: () => void;
  isSubmitting?: boolean;
  canSubmit?: boolean;
  className?: string;
}

const ProgressTracker: React.FC<ProgressTrackerProps> = ({
  answeredCount = 0,
  totalQuestions = 0,
  percentage: propPercentage,
  timeElapsed = 0,
  timeRemaining,
  onSubmitTest,
  isSubmitting = false,
  canSubmit = false,
  className = ''
}) => {
  const percentage = propPercentage !== undefined ? propPercentage : (totalQuestions > 0 ? Math.round((answeredCount / totalQuestions) * 100) : 0);
  const remainingQuestions = totalQuestions - answeredCount;
  
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  // Use timeRemaining if provided, otherwise fall back to timeElapsed
  const displayTime = timeRemaining !== undefined ? timeRemaining : timeElapsed;
  const isTimeRemaining = timeRemaining !== undefined;

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return '#10B981'; // green
    if (percentage >= 80) return '#3B82F6'; // blue
    if (percentage >= 60) return '#F59E0B'; // yellow
    if (percentage >= 40) return '#F97316'; // orange
    return '#EF4444'; // red
  };

  const getProgressTextColor = (percentage: number) => {
    if (percentage >= 100) return '#059669';
    if (percentage >= 80) return '#2563EB';
    if (percentage >= 60) return '#D97706';
    if (percentage >= 40) return '#EA580C';
    return '#DC2626';
  };

  return (
    <View style={styles.container}>
      {/* Progress Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Test Progress</Text>
        {displayTime !== undefined && displayTime > 0 && (
          <View style={styles.timeContainer}>
            <Text style={styles.timeText}>
              {isTimeRemaining ? `Time Remaining: ${formatTime(displayTime)}` : `Time Elapsed: ${formatTime(displayTime)}`}
            </Text>
          </View>
        )}
      </View>

      {/* Progress Bar */}
      <View style={styles.progressSection}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>Progress</Text>
          <Text style={[styles.progressPercentage, { color: getProgressTextColor(percentage) }]}>
            {percentage}%
          </Text>
        </View>
        
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBar, { backgroundColor: getProgressColor(percentage), width: `${percentage}%` }]} />
        </View>
      </View>

      {/* Question Counter */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, styles.answeredCard]}>
          <Text style={[styles.statNumber, styles.answeredNumber]}>{answeredCount}</Text>
          <Text style={[styles.statLabel, styles.answeredLabel]}>Answered</Text>
        </View>
        <View style={[styles.statCard, styles.remainingCard]}>
          <Text style={[styles.statNumber, styles.remainingNumber]}>{remainingQuestions}</Text>
          <Text style={[styles.statLabel, styles.remainingLabel]}>Remaining</Text>
        </View>
        <View style={[styles.statCard, styles.totalCard]}>
          <Text style={[styles.statNumber, styles.totalNumber]}>{totalQuestions}</Text>
          <Text style={[styles.statLabel, styles.totalLabel]}>Total</Text>
        </View>
      </View>

      {/* Progress Status */}
      <View style={styles.statusContainer}>
        {answeredCount === totalQuestions ? (
          <View style={styles.completedStatus}>
            <Text style={styles.completedText}>All questions answered! Ready to submit.</Text>
          </View>
        ) : remainingQuestions === 1 ? (
          <View style={styles.almostStatus}>
            <Text style={styles.almostText}>Almost there! 1 question remaining.</Text>
          </View>
        ) : (
          <View style={styles.defaultStatus}>
            <Text style={styles.defaultText}>
              {remainingQuestions} questions remaining
            </Text>
          </View>
        )}
      </View>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  timeText: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#6B7280',
  },
  progressSection: {
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  progressPercentage: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressBarContainer: {
    width: '100%',
    height: 12,
    backgroundColor: '#E5E7EB',
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 6,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
  },
  answeredCard: {
    backgroundColor: '#EBF8FF',
  },
  remainingCard: {
    backgroundColor: '#F3F4F6',
  },
  totalCard: {
    backgroundColor: '#F3E8FF',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  answeredNumber: {
    color: '#2563EB',
  },
  remainingNumber: {
    color: '#6B7280',
  },
  totalNumber: {
    color: '#7C3AED',
  },
  statLabel: {
    fontSize: 12,
  },
  answeredLabel: {
    color: '#2563EB',
  },
  remainingLabel: {
    color: '#6B7280',
  },
  totalLabel: {
    color: '#7C3AED',
  },
  statusContainer: {
    marginBottom: 16,
  },
  completedStatus: {
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 8,
  },
  almostStatus: {
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 8,
  },
  defaultStatus: {
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
  },
  completedText: {
    color: '#059669',
    fontWeight: '500',
  },
  almostText: {
    color: '#D97706',
    fontWeight: '500',
  },
  defaultText: {
    color: '#6B7280',
    fontWeight: '500',
  },
});

export default ProgressTracker;

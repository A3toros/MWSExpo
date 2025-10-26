import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  Switch,
} from 'react-native';
import { useUser } from '../contexts/UserContext';
import { useApi } from '../hooks/useApi';
import { Student, UserProfile, Notification } from '../contexts/UserContext';

interface StudentDataProps {
  onEditProfile?: () => void;
  onViewStatistics?: () => void;
  onViewNotifications?: () => void;
}

export function StudentData({ onEditProfile, onViewStatistics, onViewNotifications }: StudentDataProps) {
  const { state: userState, updateProfile, loadProfile, loadNotifications } = useUser();
  const [refreshing, setRefreshing] = useState(false);
  const [preferences, setPreferences] = useState(userState.profile?.preferences || {
    theme: 'auto' as const,
    notifications: true,
    auto_save: true,
    show_hints: true,
  });

  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      await Promise.all([
        loadProfile(),
        loadNotifications(),
      ]);
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadData();
    } catch (error) {
      console.error('Failed to refresh data:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handlePreferenceChange = async (key: keyof typeof preferences, value: any) => {
    const newPreferences = { ...preferences, [key]: value };
    setPreferences(newPreferences);
    
    try {
      await updateProfile({ preferences: newPreferences });
    } catch (error) {
      console.error('Failed to update preferences:', error);
      Alert.alert('Error', 'Failed to update preferences. Please try again.');
    }
  };

  const handleNotificationPress = (notification: Notification) => {
    // Mark as read if not already
    if (!notification.read) {
      // This would be implemented with actual API call
      console.log('Marking notification as read:', notification.id);
    }
  };

  const getUnreadNotificationsCount = () => {
    return userState.notifications.filter(n => !n.read).length;
  };

  const getAcademicInfo = () => {
    if (!userState.profile?.academic_info) return null;
    
    const { current_term, current_period, academic_year, subjects } = userState.profile.academic_info;
    return { current_term, current_period, academic_year, subjects };
  };

  const getStatistics = () => {
    if (!userState.profile?.statistics) return null;
    
    const { total_tests_taken, average_score, tests_passed, tests_failed, current_streak, best_streak } = userState.profile.statistics;
    return { total_tests_taken, average_score, tests_passed, tests_failed, current_streak, best_streak };
  };

  const academicInfo = getAcademicInfo();
  const statistics = getStatistics();

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      {/* Profile Header */}
      <View style={styles.header}>
        <View style={styles.profileInfo}>
          <Text style={styles.studentName}>
            {userState.profile?.student.first_name} {userState.profile?.student.last_name}
          </Text>
          <Text style={styles.studentId}>
            Student ID: {userState.profile?.student.student_id}
          </Text>
          <Text style={styles.studentGrade}>
            Grade {userState.profile?.student.grade} - Class {userState.profile?.student.class}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.editButton}
          onPress={onEditProfile}
        >
          <Text style={styles.editButtonText}>Edit Profile</Text>
        </TouchableOpacity>
      </View>

      {/* Academic Information */}
      {academicInfo && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Academic Information</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Academic Year:</Text>
              <Text style={styles.infoValue}>{academicInfo.academic_year}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Current Term:</Text>
              <Text style={styles.infoValue}>{academicInfo.current_term}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Current Period:</Text>
              <Text style={styles.infoValue}>{academicInfo.current_period}</Text>
            </View>
          </View>
          
          <Text style={styles.subsectionTitle}>Subjects</Text>
          <View style={styles.subjectsList}>
            {academicInfo.subjects.map((subject, index) => (
              <View key={index} style={styles.subjectCard}>
                <Text style={styles.subjectName}>{subject.name}</Text>
                <Text style={styles.subjectTeacher}>Teacher: {subject.teacher}</Text>
                <Text style={styles.subjectGrade}>Grade: {subject.grade}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Statistics */}
      {statistics && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Performance Statistics</Text>
            <TouchableOpacity onPress={onViewStatistics}>
              <Text style={styles.seeAllText}>View Details</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{statistics.total_tests_taken}</Text>
              <Text style={styles.statLabel}>Tests Taken</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{statistics.average_score}%</Text>
              <Text style={styles.statLabel}>Average Score</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{statistics.tests_passed}</Text>
              <Text style={styles.statLabel}>Tests Passed</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{statistics.current_streak}</Text>
              <Text style={styles.statLabel}>Current Streak</Text>
            </View>
          </View>
        </View>
      )}

      {/* Notifications */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <TouchableOpacity onPress={onViewNotifications}>
            <Text style={styles.seeAllText}>View All</Text>
          </TouchableOpacity>
        </View>
        
        {userState.notifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No notifications</Text>
          </View>
        ) : (
          <View style={styles.notificationsList}>
            {userState.notifications.slice(0, 5).map((notification) => (
              <TouchableOpacity
                key={notification.id}
                style={[
                  styles.notificationCard,
                  !notification.read && styles.unreadNotification
                ]}
                onPress={() => handleNotificationPress(notification)}
              >
                <View style={styles.notificationHeader}>
                  <Text style={styles.notificationTitle}>{notification.title}</Text>
                  {!notification.read && <View style={styles.unreadDot} />}
                </View>
                <Text style={styles.notificationMessage}>{notification.message}</Text>
                <Text style={styles.notificationTime}>
                  {new Date(notification.created_at).toLocaleDateString()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* Preferences */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={styles.preferencesCard}>
          <View style={styles.preferenceRow}>
            <Text style={styles.preferenceLabel}>Notifications</Text>
            <Switch
              value={preferences.notifications}
              onValueChange={(value) => handlePreferenceChange('notifications', value)}
            />
          </View>
          <View style={styles.preferenceRow}>
            <Text style={styles.preferenceLabel}>Auto-save</Text>
            <Switch
              value={preferences.auto_save}
              onValueChange={(value) => handlePreferenceChange('auto_save', value)}
            />
          </View>
          <View style={styles.preferenceRow}>
            <Text style={styles.preferenceLabel}>Show Hints</Text>
            <Switch
              value={preferences.show_hints}
              onValueChange={(value) => handlePreferenceChange('show_hints', value)}
            />
          </View>
        </View>
      </View>

      {/* Account Information */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Information</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Email:</Text>
            <Text style={styles.infoValue}>{userState.profile?.student.email}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Username:</Text>
            <Text style={styles.infoValue}>{userState.profile?.student.username}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Last Login:</Text>
            <Text style={styles.infoValue}>
              {userState.profile?.student.last_login 
                ? new Date(userState.profile.student.last_login).toLocaleDateString()
                : 'Never'
              }
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Account Status:</Text>
            <Text style={[
              styles.infoValue,
              userState.profile?.student.is_active ? styles.activeStatus : styles.inactiveStatus
            ]}>
              {userState.profile?.student.is_active ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  studentId: {
    fontSize: 16,
    color: '#e0e7ff',
    marginBottom: 2,
  },
  studentGrade: {
    fontSize: 14,
    color: '#e0e7ff',
  },
  editButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  editButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  section: {
    margin: 16,
    marginTop: 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
  },
  subsectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 16,
  },
  seeAllText: {
    fontSize: 14,
    color: '#4f46e5',
    fontWeight: '500',
  },
  infoCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  infoLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
  },
  activeStatus: {
    color: '#10b981',
  },
  inactiveStatus: {
    color: '#ef4444',
  },
  subjectsList: {
    gap: 12,
  },
  subjectCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  subjectName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  subjectTeacher: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 2,
  },
  subjectGrade: {
    fontSize: 14,
    color: '#6b7280',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
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
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4f46e5',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
  },
  notificationsList: {
    gap: 12,
  },
  notificationCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  unreadNotification: {
    borderLeftWidth: 4,
    borderLeftColor: '#4f46e5',
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4f46e5',
  },
  notificationMessage: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  notificationTime: {
    fontSize: 12,
    color: '#9ca3af',
  },
  preferencesCard: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  preferenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  preferenceLabel: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '500',
  },
});

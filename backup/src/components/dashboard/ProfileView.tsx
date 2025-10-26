import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { router } from 'expo-router';

type User = {
  student_id: string;
  name: string;
  surname: string;
  grade: string;
  class: string;
};

type Props = {
  user: User | null;
  onLogout: () => void;
};

export function ProfileView({ user, onLogout }: Props) {
  const handleChangePassword = () => {
    router.push('/(tabs)/profile');
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Profile</Text>
      
      <View style={styles.card}>
        {/* Student Information */}
        <View style={styles.studentInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.name?.charAt(0) || 'S'}
            </Text>
          </View>
          <View style={styles.studentDetails}>
            <Text style={styles.studentName}>
              {user?.name} {user?.surname}
            </Text>
            <Text style={styles.studentClass}>
              Grade {user?.grade} - Class {user?.class}
            </Text>
            <Text style={styles.studentId}>
              Student ID: {user?.student_id}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleChangePassword}
          >
            <Text style={styles.actionButtonText}>Change Password</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, styles.logoutButton]}
            onPress={onLogout}
          >
            <Text style={[styles.actionButtonText, styles.logoutButtonText]}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    margin: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  studentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    color: 'white',
    fontSize: 24,
    fontWeight: '600',
  },
  studentDetails: {
    flex: 1,
  },
  studentName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  studentClass: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 4,
  },
  studentId: {
    fontSize: 14,
    color: '#9ca3af',
  },
  actionsContainer: {
    gap: 12,
  },
  actionButton: {
    backgroundColor: '#f8fafc',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  logoutButton: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  logoutButtonText: {
    color: '#dc2626',
  },
});

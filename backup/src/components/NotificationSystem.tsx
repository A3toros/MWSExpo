import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Alert,
  Modal,
} from 'react-native';
import { useUser } from '../contexts/UserContext';
import { useApi } from '../hooks/useApi';
import { logger } from '../utils/logger';

interface NotificationSystemProps {
  onNotificationPress?: (notification: any) => void;
  onMarkAllRead?: () => void;
  onClearNotifications?: () => void;
}

export function NotificationSystem({ 
  onNotificationPress, 
  onMarkAllRead, 
  onClearNotifications 
}: NotificationSystemProps) {
  const { state: userState, loadNotifications, markNotificationRead, clearNotifications } = useUser();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [showMarkAllModal, setShowMarkAllModal] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);

  // Load notifications on mount
  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadNotifications();
    } catch (error) {
      logger.error('Failed to refresh notifications', 'notifications', error);
    } finally {
      setRefreshing(false);
    }
  }, [loadNotifications]);

  // Handle notification press
  const handleNotificationPress = useCallback((notification: any) => {
    if (!notification.read) {
      markNotificationRead(notification.id);
    }
    
    if (onNotificationPress) {
      onNotificationPress(notification);
    }
  }, [markNotificationRead, onNotificationPress]);

  // Handle mark all as read
  const handleMarkAllAsRead = useCallback(async () => {
    try {
      // This would be implemented with actual API call
      // await userService.markAllNotificationsRead();
      setShowMarkAllModal(false);
      if (onMarkAllRead) {
        onMarkAllRead();
      }
      logger.info('All notifications marked as read', 'notifications');
    } catch (error) {
      logger.error('Failed to mark all notifications as read', 'notifications', error);
      Alert.alert('Error', 'Failed to mark all notifications as read. Please try again.');
    }
  }, [onMarkAllRead]);

  // Handle clear notifications
  const handleClearNotifications = useCallback(async () => {
    try {
      await clearNotifications();
      setShowClearModal(false);
      if (onClearNotifications) {
        onClearNotifications();
      }
      logger.info('All notifications cleared', 'notifications');
    } catch (error) {
      logger.error('Failed to clear notifications', 'notifications', error);
      Alert.alert('Error', 'Failed to clear notifications. Please try again.');
    }
  }, [clearNotifications, onClearNotifications]);

  // Get filtered notifications
  const getFilteredNotifications = () => {
    let filtered = userState.notifications;
    
    switch (selectedFilter) {
      case 'unread':
        filtered = filtered.filter(n => !n.read);
        break;
      case 'read':
        filtered = filtered.filter(n => n.read);
        break;
      default:
        // 'all' - no filtering
        break;
    }
    
    return filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  };

  // Get notification type color
  const getNotificationTypeColor = (type: string) => {
    switch (type) {
      case 'test_assigned': return '#4f46e5';
      case 'test_due': return '#f59e0b';
      case 'result_available': return '#10b981';
      case 'retest_available': return '#8b5cf6';
      case 'system': return '#6b7280';
      default: return '#6b7280';
    }
  };

  // Get notification type icon
  const getNotificationTypeIcon = (type: string) => {
    switch (type) {
      case 'test_assigned': return '📝';
      case 'test_due': return '⏰';
      case 'result_available': return '📊';
      case 'retest_available': return '🔄';
      case 'system': return '🔔';
      default: return '📌';
    }
  };

  // Format notification time
  const formatNotificationTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else if (diffInHours < 168) { // 7 days
      return `${Math.floor(diffInHours / 24)}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  // Get unread count
  const getUnreadCount = () => {
    return userState.notifications.filter(n => !n.read).length;
  };

  const filteredNotifications = getFilteredNotifications();
  const unreadCount = getUnreadCount();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
        <Text style={styles.subtitle}>
          {filteredNotifications.length} notification{filteredNotifications.length !== 1 ? 's' : ''}
          {unreadCount > 0 && ` • ${unreadCount} unread`}
        </Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <View style={styles.filterTabs}>
          {[
            { key: 'all', label: 'All', count: userState.notifications.length },
            { key: 'unread', label: 'Unread', count: unreadCount },
            { key: 'read', label: 'Read', count: userState.notifications.length - unreadCount },
          ].map((filter) => (
            <TouchableOpacity
              key={filter.key}
              style={[
                styles.filterTab,
                selectedFilter === filter.key && styles.activeFilterTab
              ]}
              onPress={() => setSelectedFilter(filter.key as any)}
            >
              <Text style={[
                styles.filterTabText,
                selectedFilter === filter.key && styles.activeFilterTabText
              ]}>
                {filter.label}
              </Text>
              {filter.count > 0 && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterBadgeText}>{filter.count}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => setShowMarkAllModal(true)}
        >
          <Text style={styles.actionButtonText}>Mark All Read</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => setShowClearModal(true)}
        >
          <Text style={styles.actionButtonText}>Clear All</Text>
        </TouchableOpacity>
      </View>

      {/* Notifications List */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {filteredNotifications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {selectedFilter === 'all' ? 'No notifications' : 
               selectedFilter === 'unread' ? 'No unread notifications' : 
               'No read notifications'}
            </Text>
            <Text style={styles.emptySubtext}>
              {selectedFilter === 'all' ? 'You\'re all caught up!' : 
               selectedFilter === 'unread' ? 'All notifications have been read' : 
               'No notifications have been read yet'}
            </Text>
          </View>
        ) : (
          <View style={styles.notificationsList}>
            {filteredNotifications.map((notification) => (
              <TouchableOpacity
                key={notification.id}
                style={[
                  styles.notificationCard,
                  !notification.read && styles.unreadNotification
                ]}
                onPress={() => handleNotificationPress(notification)}
              >
                <View style={styles.notificationHeader}>
                  <View style={styles.notificationTitleContainer}>
                    <Text style={styles.notificationTypeIcon}>
                      {getNotificationTypeIcon(notification.type)}
                    </Text>
                    <Text style={styles.notificationTitle}>{notification.title}</Text>
                  </View>
                  {!notification.read && <View style={styles.unreadDot} />}
                </View>
                
                <Text style={styles.notificationMessage}>{notification.message}</Text>
                
                <View style={styles.notificationFooter}>
                  <Text style={styles.notificationTime}>
                    {formatNotificationTime(notification.created_at)}
                  </Text>
                  <View style={[
                    styles.notificationTypeBadge,
                    { backgroundColor: getNotificationTypeColor(notification.type) }
                  ]}>
                    <Text style={styles.notificationTypeText}>
                      {notification.type.replace('_', ' ').toUpperCase()}
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Mark All Read Modal */}
      <Modal
        visible={showMarkAllModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMarkAllModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Mark All as Read</Text>
            <Text style={styles.modalMessage}>
              Are you sure you want to mark all notifications as read?
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowMarkAllModal(false)}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={handleMarkAllAsRead}
              >
                <Text style={styles.modalConfirmButtonText}>Mark All Read</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Clear All Modal */}
      <Modal
        visible={showClearModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowClearModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Clear All Notifications</Text>
            <Text style={styles.modalMessage}>
              Are you sure you want to clear all notifications? This action cannot be undone.
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowClearModal(false)}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={handleClearNotifications}
              >
                <Text style={styles.modalConfirmButtonText}>Clear All</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  filterContainer: {
    backgroundColor: 'white',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  filterTabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
  },
  filterTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  activeFilterTab: {
    backgroundColor: '#4f46e5',
  },
  filterTabText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  activeFilterTabText: {
    color: 'white',
  },
  filterBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  filterBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  actionsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#6b7280',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    color: '#6b7280',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
  notificationsList: {
    padding: 16,
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
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  notificationTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  notificationTypeIcon: {
    fontSize: 16,
    marginRight: 8,
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
    lineHeight: 20,
    marginBottom: 12,
  },
  notificationFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notificationTime: {
    fontSize: 12,
    color: '#9ca3af',
  },
  notificationTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  notificationTypeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelButtonText: {
    color: '#6b7280',
    fontSize: 16,
    fontWeight: '500',
  },
  modalConfirmButton: {
    flex: 1,
    backgroundColor: '#ef4444',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalConfirmButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

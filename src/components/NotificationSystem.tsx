/** @jsxImportSource nativewind */
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
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
    <View className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="bg-header-blue shadow-md">
        <View className="px-4 py-4">
          <Text className="text-white text-2xl font-bold mb-1">Notifications</Text>
          <Text className="text-blue-100 text-base">
            {filteredNotifications.length} notification{filteredNotifications.length !== 1 ? 's' : ''}
            {unreadCount > 0 && ` • ${unreadCount} unread`}
          </Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <View className="bg-white py-4 border-b border-gray-200">
        <View className="flex-row px-4 gap-2">
          {[
            { key: 'all', label: 'All', count: userState.notifications.length },
            { key: 'unread', label: 'Unread', count: unreadCount },
            { key: 'read', label: 'Read', count: userState.notifications.length - unreadCount },
          ].map((filter) => (
            <TouchableOpacity
              key={filter.key}
              className={`flex-1 flex-row items-center justify-center py-2 px-3 rounded-lg ${
                selectedFilter === filter.key 
                  ? 'bg-header-blue' 
                  : 'bg-gray-100'
              }`}
              onPress={() => setSelectedFilter(filter.key as any)}
            >
              <Text className={`text-sm font-medium ${
                selectedFilter === filter.key 
                  ? 'text-white' 
                  : 'text-gray-600'
              }`}>
                {filter.label}
              </Text>
              {filter.count > 0 && (
                <View className="bg-white/20 rounded-full px-1.5 py-0.5 ml-2">
                  <Text className="text-white text-xs font-bold">{filter.count}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Actions */}
      <View className="flex-row p-4 gap-3">
        <TouchableOpacity
          className="flex-1 bg-gray-600 py-3 rounded-lg items-center"
          onPress={() => setShowMarkAllModal(true)}
        >
          <Text className="text-white text-sm font-medium">Mark All Read</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="flex-1 bg-gray-600 py-3 rounded-lg items-center"
          onPress={() => setShowClearModal(true)}
        >
          <Text className="text-white text-sm font-medium">Clear All</Text>
        </TouchableOpacity>
      </View>

      {/* Notifications List */}
      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {filteredNotifications.length === 0 ? (
          <View className="p-10 items-center">
            <Text className="text-lg text-gray-500 mb-2">
              {selectedFilter === 'all' ? 'No notifications' : 
               selectedFilter === 'unread' ? 'No unread notifications' : 
               'No read notifications'}
            </Text>
            <Text className="text-sm text-gray-400 text-center">
              {selectedFilter === 'all' ? 'You\'re all caught up!' : 
               selectedFilter === 'unread' ? 'All notifications have been read' : 
               'No notifications have been read yet'}
            </Text>
          </View>
        ) : (
          <View className="p-4 gap-3">
            {filteredNotifications.map((notification) => (
              <TouchableOpacity
                key={notification.id}
                className={`bg-white p-4 rounded-xl shadow-sm border border-gray-200 ${
                  !notification.read ? 'border-l-4 border-l-header-blue' : ''
                }`}
                onPress={() => handleNotificationPress(notification)}
              >
                <View className="flex-row justify-between items-start mb-2">
                  <View className="flex-row items-center flex-1">
                    <Text className="text-base mr-2">
                      {getNotificationTypeIcon(notification.type)}
                    </Text>
                    <Text className="text-base font-bold text-gray-800 flex-1">
                      {notification.title}
                    </Text>
                  </View>
                  {!notification.read && <View className="w-2 h-2 rounded-full bg-header-blue" />}
                </View>
                
                <Text className="text-sm text-gray-600 leading-5 mb-3">
                  {notification.message}
                </Text>
                
                <View className="flex-row justify-between items-center">
                  <Text className="text-xs text-gray-400">
                    {formatNotificationTime(notification.created_at)}
                  </Text>
                  <View 
                    className="px-2 py-1 rounded"
                    style={{ backgroundColor: getNotificationTypeColor(notification.type) }}
                  >
                    <Text className="text-white text-xs font-bold">
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
        <View className="flex-1 bg-black/50 justify-center items-center p-5">
          <View className="bg-white rounded-2xl p-6 w-full max-w-[400px] shadow-xl">
            <Text className="text-xl font-bold text-gray-800 mb-3 text-center">Mark All as Read</Text>
            <Text className="text-base text-gray-600 text-center leading-6 mb-6">
              Are you sure you want to mark all notifications as read?
            </Text>
            <View className="flex-row gap-3">
              <TouchableOpacity
                className="flex-1 bg-gray-100 py-4 rounded-lg items-center"
                onPress={() => setShowMarkAllModal(false)}
              >
                <Text className="text-gray-600 text-base font-medium">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 bg-red-500 py-4 rounded-lg items-center"
                onPress={handleMarkAllAsRead}
              >
                <Text className="text-white text-base font-bold">Mark All Read</Text>
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
        <View className="flex-1 bg-black/50 justify-center items-center p-5">
          <View className="bg-white rounded-2xl p-6 w-full max-w-[400px] shadow-xl">
            <Text className="text-xl font-bold text-gray-800 mb-3 text-center">Clear All Notifications</Text>
            <Text className="text-base text-gray-600 text-center leading-6 mb-6">
              Are you sure you want to clear all notifications? This action cannot be undone.
            </Text>
            <View className="flex-row gap-3">
              <TouchableOpacity
                className="flex-1 bg-gray-100 py-4 rounded-lg items-center"
                onPress={() => setShowClearModal(false)}
              >
                <Text className="text-gray-600 text-base font-medium">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 bg-red-500 py-4 rounded-lg items-center"
                onPress={handleClearNotifications}
              >
                <Text className="text-white text-base font-bold">Clear All</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}


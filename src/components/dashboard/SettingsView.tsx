/** @jsxImportSource nativewind */
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
import { getThemeClasses, getCyberpunkClasses } from '../../utils/themeUtils';
import { notificationService } from '../../services/notificationService';

const SettingsView: React.FC = () => {
  const { themeMode, setTheme } = useTheme();
  const [selectedTheme, setSelectedTheme] = useState<typeof themeMode>(themeMode);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<'enabled' | 'disabled' | 'permissions_required'>('disabled');
  
  const themeClasses = getThemeClasses(themeMode);
  const cyberpunkClasses = getCyberpunkClasses();

  // Load notification status on mount
  useEffect(() => {
    const loadNotificationStatus = async () => {
      try {
        const enabled = await notificationService.isEnabled();
        const hasPermissions = await notificationService.checkPermissions();
        
        setNotificationsEnabled(enabled);
        if (enabled && hasPermissions) {
          setNotificationStatus('enabled');
        } else if (enabled && !hasPermissions) {
          setNotificationStatus('permissions_required');
        } else {
          setNotificationStatus('disabled');
        }
      } catch (error) {
        console.error('Error loading notification status:', error);
      }
    };

    loadNotificationStatus();
  }, []);

  const handleNotificationToggle = async (value: boolean) => {
    try {
      if (value) {
        // Enabling notifications - check permissions first
        const hasPermissions = await notificationService.checkPermissions();
        
        if (!hasPermissions) {
          // Request permissions if not granted
          const granted = await notificationService.requestPermissions();
          if (!granted) {
            Alert.alert(
              'Permissions Required',
              'Notification permissions are required to receive test notifications. Please enable them in your device settings.',
              [{ text: 'OK' }]
            );
            // Still allow toggle to be enabled, but show permissions required status
            await notificationService.setEnabled(value);
            setNotificationsEnabled(value);
            setNotificationStatus('permissions_required');
            return;
          }
        }
      }

      await notificationService.setEnabled(value);
      setNotificationsEnabled(value);
      
      if (value) {
        const hasPermissions = await notificationService.checkPermissions();
        setNotificationStatus(hasPermissions ? 'enabled' : 'permissions_required');
      } else {
        setNotificationStatus('disabled');
      }
    } catch (error) {
      console.error('Error toggling notifications:', error);
      Alert.alert('Error', 'Failed to update notification settings. Please try again.');
    }
  };


  const themes = [
    { id: 'light', name: 'Light', description: 'Clean and bright interface' },
    { id: 'dark', name: 'Dark', description: 'Easy on the eyes' },
    { id: 'cyberpunk', name: 'Cyberpunk', description: 'Futuristic neon experience' }
  ];

  const handleThemeSelect = (themeId: typeof themeMode) => {
    setSelectedTheme(themeId);
    setTheme(themeId);
  };

  const getThemePreviewClasses = (themeId: typeof themeMode) => {
    switch (themeId) {
      case 'dark':
        return 'bg-slate-800 border-slate-600';
      case 'cyberpunk':
        return 'bg-black border-2 border-cyan-400';
      default:
        return 'bg-white border-gray-200';
    }
  };

  const getThemeTextClasses = (themeId: typeof themeMode) => {
    switch (themeId) {
      case 'dark':
        return 'text-slate-100';
      case 'cyberpunk':
        return 'text-cyan-400 font-bold tracking-wider';
      default:
        return 'text-gray-900';
    }
  };

  const getThemeAccentClasses = (themeId: typeof themeMode) => {
    switch (themeId) {
      case 'dark':
        return 'bg-blue-500';
      case 'cyberpunk':
        return 'bg-cyan-400';
      default:
        return 'bg-blue-500';
    }
  };

  return (
    <ScrollView className={`flex-1 ${themeClasses.background}`}>
      <View className="p-6">
        {/* Header */}
        <View className={`mb-8 ${themeMode === 'cyberpunk' ? 'border-b border-cyan-400/30 pb-4' : ''}`}>
          <Text className={`text-3xl font-bold ${themeClasses.text} mb-2 ${themeMode === 'cyberpunk' ? 'tracking-wider' : ''}`}>
            {themeMode === 'cyberpunk' ? 'SETTINGS' : 'Settings'}
          </Text>
          <Text className={`text-base ${themeClasses.textSecondary} ${themeMode === 'cyberpunk' ? 'tracking-wider' : ''}`}>
            {themeMode === 'cyberpunk' 
              ? 'CUSTOMIZE YOUR APP EXPERIENCE'
              : 'Customize your app experience'
            }
          </Text>
        </View>

        {/* Theme Selection */}
        <View className="mb-8">
          <Text className={`text-xl font-semibold ${themeClasses.text} mb-4 ${themeMode === 'cyberpunk' ? 'tracking-wider' : ''}`}>
            {themeMode === 'cyberpunk' ? 'THEME' : 'Theme'}
          </Text>
          
          <View className="space-y-4">
            {themes.map((theme) => {
              const isSelected = selectedTheme === theme.id;
              return (
                <TouchableOpacity
                  key={theme.id}
                  onPress={() => handleThemeSelect(theme.id as typeof themeMode)}
                  activeOpacity={0.7}
                  className={`p-4 rounded-xl border-2 ${
                    isSelected 
                      ? getThemePreviewClasses(theme.id as typeof themeMode)
                      : `${themeClasses.surface} ${themeClasses.border}`
                  }`}
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                      <Text className={`text-lg font-semibold ${
                        isSelected 
                          ? getThemeTextClasses(theme.id as typeof themeMode)
                          : themeClasses.text
                      }`}>
                        {theme.name}
                      </Text>
                      <Text className={`text-sm ${
                        isSelected 
                          ? (theme.id === 'cyberpunk' ? 'text-cyan-300' : theme.id === 'dark' ? 'text-slate-300' : 'text-gray-600')
                          : themeClasses.textSecondary
                      } mt-1`}>
                        {theme.description}
                      </Text>
                    </View>
                    
                    {/* Toggle Switch */}
                    <View className={`w-12 h-6 rounded-full ${
                      isSelected 
                        ? themeMode === 'cyberpunk' 
                          ? 'bg-cyan-400' 
                          : 'bg-blue-500'
                        : 'bg-gray-300'
                    }`}>
                      <View 
                        className={`w-5 h-5 rounded-full bg-white shadow-md absolute top-0.5 ${
                          isSelected ? 'right-0.5' : 'left-0.5'
                        }`}
                      />
                    </View>
                  </View>
                  
                  {theme.id === 'cyberpunk' && isSelected && (
                    <View className="mt-2">
                      <View className="flex-row items-center">
                        <View className="w-2 h-2 bg-cyan-400 rounded-full mr-2" />
                        <Text className="text-cyan-400 text-sm font-bold tracking-wider">
                          NEON MODE ACTIVE
                        </Text>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Additional Settings */}
        <View className="mb-8">
          <Text className={`text-xl font-semibold ${themeClasses.text} mb-4 ${themeMode === 'cyberpunk' ? 'tracking-wider' : ''}`}>
            {themeMode === 'cyberpunk' ? 'PREFERENCES' : 'Preferences'}
          </Text>
          
          <View className="space-y-3">
            <View 
              className={`p-4 rounded-xl ${themeClasses.surface} border ${themeClasses.border} ${themeMode === 'cyberpunk' ? 'border-cyan-400/30' : ''}`}
            >
              <View className="flex-row items-center justify-between">
                <View className="flex-1 mr-4">
                  <Text className={`text-lg font-semibold ${themeClasses.text} ${themeMode === 'cyberpunk' ? 'tracking-wider' : ''}`}>
                    {themeMode === 'cyberpunk' ? 'TEST NOTIFICATIONS' : 'Test Notifications'}
                  </Text>
                  <Text className={`text-sm ${themeClasses.textSecondary} mt-1 ${themeMode === 'cyberpunk' ? 'tracking-wider' : ''}`}>
                    {themeMode === 'cyberpunk' 
                      ? 'GET NOTIFIED ABOUT NEW TESTS AND RETESTS'
                      : 'Get notified about new tests and retests'
                    }
                  </Text>
                  {notificationStatus === 'permissions_required' && (
                    <Text className={`text-xs ${themeMode === 'cyberpunk' ? 'text-yellow-400' : 'text-orange-500'} mt-1`}>
                      Permissions required
                    </Text>
                  )}
                  {notificationStatus === 'enabled' && (
                    <Text className={`text-xs ${themeMode === 'cyberpunk' ? 'text-cyan-400' : 'text-green-500'} mt-1`}>
                      Enabled
                    </Text>
                  )}
                  {notificationStatus === 'disabled' && (
                    <Text className={`text-xs ${themeClasses.textSecondary} mt-1`}>
                      Disabled
                    </Text>
                  )}
                </View>
                <Switch
                  value={notificationsEnabled}
                  onValueChange={handleNotificationToggle}
                  trackColor={{ false: '#767577', true: themeMode === 'cyberpunk' ? '#22d3ee' : '#3b82f6' }}
                  thumbColor={notificationsEnabled ? '#ffffff' : '#f4f3f4'}
                />
              </View>
            </View>
          </View>
        </View>

        {/* App Information */}
        <View className={`mb-8 ${themeMode === 'cyberpunk' ? 'border-t border-cyan-400/30 pt-6' : ''}`}>
          <Text className={`text-xl font-semibold ${themeClasses.text} mb-4 ${themeMode === 'cyberpunk' ? 'tracking-wider' : ''}`}>
            {themeMode === 'cyberpunk' ? 'APP INFORMATION' : 'App Information'}
          </Text>
          
          <View className={`p-4 rounded-xl ${themeClasses.surface} border ${themeClasses.border} ${themeMode === 'cyberpunk' ? 'border-cyan-400/30' : ''}`}>
            <View className="flex-row items-center justify-between mb-3">
              <Text className={`text-lg font-semibold ${themeClasses.text} ${themeMode === 'cyberpunk' ? 'tracking-wider' : ''}`}>
                {themeMode === 'cyberpunk' ? 'MWS STUDENT APP' : 'MWS Student App'}
              </Text>
              <View className={`px-3 py-1 rounded-full ${themeMode === 'cyberpunk' 
                ? 'bg-cyan-400' 
                : 'bg-green-500'
              }`}>
                <Text className={`text-xs font-bold ${themeMode === 'cyberpunk' ? 'text-black tracking-wider' : 'text-white'}`}>
                  v1.0.0
                </Text>
              </View>
            </View>
            
            <Text className={`text-sm ${themeClasses.textSecondary} ${themeMode === 'cyberpunk' ? 'tracking-wider' : ''}`}>
              {themeMode === 'cyberpunk' 
                ? 'ADVANCED LEARNING MANAGEMENT SYSTEM FOR MATHAYOMWATSING SCHOOL'
                : 'Advanced learning management system for Mathayomwatsing School'
              }
            </Text>
            
            {themeMode === 'cyberpunk' && (
              <View className="mt-3 flex-row items-center">
                <View className="w-2 h-2 bg-cyan-400 rounded-full mr-2" />
                <Text className="text-cyan-400 text-xs font-bold tracking-wider">
                  NEURAL NETWORK INTEGRATION ACTIVE
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

export default SettingsView;

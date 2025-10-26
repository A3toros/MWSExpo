/** @jsxImportSource nativewind */
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, Image, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../contexts/ThemeContext';
import { getThemeClasses, getCyberpunkClasses } from '../../utils/themeUtils';

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
  const { themeMode } = useTheme();
  const themeClasses = getThemeClasses(themeMode);
  const cyberpunkClasses = getCyberpunkClasses();
  const [profilePicture, setProfilePicture] = useState<string | null>(null);
  
  // Password change form state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  useEffect(() => {
    loadProfilePicture();
  }, []);

  const loadProfilePicture = async () => {
    try {
      const savedPicture = await AsyncStorage.getItem('profile_picture');
      if (savedPicture) {
        setProfilePicture(savedPicture);
      }
    } catch (error) {
      console.error('Error loading profile picture:', error);
    }
  };

  const handleImagePicker = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        setProfilePicture(imageUri);
        await AsyncStorage.setItem('profile_picture', imageUri);
        Alert.alert('Success', 'Profile picture updated!');
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select image');
    }
  };

  const handleChangePassword = () => {
    setShowPasswordForm(true);
  };

  const handlePasswordFormChange = (field: string, value: string) => {
    setPasswordForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const validatePassword = (password: string) => {
    if (password.length < 6) {
      return 'Password must be at least 6 characters long';
    }
    
    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    
    if (!hasLetter || !hasNumber) {
      return 'Password must contain both letters and numbers';
    }
    
    return null;
  };

  const handlePasswordSubmit = async () => {
    const { currentPassword, newPassword, confirmPassword } = passwordForm;
    
    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }
    
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      Alert.alert('Error', passwordError);
      return;
    }
    
    if (!user?.student_id) {
      Alert.alert('Error', 'Session expired. Please login again.');
      return;
    }
    
    // Show confirmation dialog
    Alert.alert(
      'Change Password',
      'Are you sure you want to change your password?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Change', onPress: submitPasswordChange }
      ]
    );
  };

  const submitPasswordChange = async () => {
    try {
      setIsChangingPassword(true);
      
      const response = await fetch('/.netlify/functions/change-student-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studentId: user?.student_id,
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        Alert.alert('Success', 'Password changed successfully!');
        setShowPasswordForm(false);
        setPasswordForm({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
      } else {
        Alert.alert('Error', data.message || 'Failed to change password');
      }
    } catch (error) {
      console.error('Password change error:', error);
      Alert.alert('Error', 'Failed to change password. Please try again.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const cancelPasswordChange = () => {
    setShowPasswordForm(false);
    setPasswordForm({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
  };

  if (showPasswordForm) {
    return (
      <ScrollView className="m-4">
        <Text className="text-lg font-bold text-gray-800 mb-3 text-center">Change Password</Text>
        
        <View className="bg-white rounded-xl p-4 shadow-sm border border-gray-200">
          {/* Current Password */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-2">Current Password</Text>
            <TextInput
              value={passwordForm.currentPassword}
              onChangeText={(value) => handlePasswordFormChange('currentPassword', value)}
              secureTextEntry
              placeholder="Enter current password"
              className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:border-blue-500"
            />
          </View>
          
          {/* New Password */}
          <View className="mb-4">
            <Text className="text-sm font-medium text-gray-700 mb-2">New Password</Text>
            <TextInput
              value={passwordForm.newPassword}
              onChangeText={(value) => handlePasswordFormChange('newPassword', value)}
              secureTextEntry
              placeholder="Enter new password"
              className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:border-blue-500"
            />
          </View>
          
          {/* Confirm Password */}
          <View className="mb-6">
            <Text className="text-sm font-medium text-gray-700 mb-2">Confirm New Password</Text>
            <TextInput
              value={passwordForm.confirmPassword}
              onChangeText={(value) => handlePasswordFormChange('confirmPassword', value)}
              secureTextEntry
              placeholder="Confirm new password"
              className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:border-blue-500"
            />
          </View>
          
          {/* Form Actions */}
          <View className="flex-row gap-3">
            <TouchableOpacity
              className="flex-1 bg-gray-100 py-3 px-4 rounded-lg border border-gray-300 items-center"
              onPress={cancelPasswordChange}
              disabled={isChangingPassword}
            >
              <Text className="text-base font-medium text-gray-700">Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              className="flex-1 bg-blue-500 py-3 px-4 rounded-lg items-center"
              onPress={handlePasswordSubmit}
              disabled={isChangingPassword}
            >
              {isChangingPassword ? (
                <View className="flex-row items-center">
                  <ActivityIndicator size="small" color="white" className="mr-2" />
                  <Text className="text-base font-medium text-white">Changing...</Text>
                </View>
              ) : (
                <Text className="text-base font-medium text-white">Change Password</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <View className={`m-4 ${themeClasses.background}`}>
      <Text className={`text-lg font-bold ${themeClasses.text} mb-3 text-center`}>
        {themeMode === 'cyberpunk' ? 'PROFILE' : 'Profile'}
      </Text>
      
      <View className={`${themeClasses.surface} rounded-xl p-4 shadow-sm border ${themeClasses.border}`}>
        {/* Student Information */}
        <View className={`flex-row items-center mb-6 pb-4 border-b ${themeClasses.border}`}>
          <TouchableOpacity 
            onPress={handleImagePicker}
            className={`w-16 h-16 rounded-full ${themeMode === 'cyberpunk' ? 'bg-cyan-400' : 'bg-blue-500'} justify-center items-center mr-4 overflow-hidden`}
          >
            {profilePicture ? (
              <Image 
                source={{ uri: profilePicture }} 
                className="w-full h-full rounded-full"
                resizeMode="cover"
                onError={() => console.log('ProfileView: Error loading custom profile picture')}
              />
            ) : (
              <Image 
                source={require('../../../assets/images/anon.png')} 
                className="w-full h-full rounded-full"
                resizeMode="cover"
                onError={() => console.log('ProfileView: Error loading anon.png')}
              />
            )}
          </TouchableOpacity>
          <View className="flex-1">
            <Text className={`text-xl font-bold ${themeClasses.text} mb-1`}>
              {themeMode === 'cyberpunk' ? `${user?.name?.toUpperCase()} ${user?.surname?.toUpperCase()}` : `${user?.name} ${user?.surname}`}
            </Text>
            <Text className={`text-base ${themeClasses.textSecondary} mb-1`}>
              Grade {user?.grade} - Class {user?.class}
            </Text>
            <Text className={`text-sm ${themeClasses.textSecondary}`}>
              Student ID: {user?.student_id}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View className="gap-3">
          <TouchableOpacity
            className={themeMode === 'cyberpunk' 
              ? 'bg-black border-2 border-cyan-400 py-3 px-4 rounded-lg items-center'
              : 'bg-blue-50 py-3 px-4 rounded-lg border border-blue-200 items-center'
            }
            onPress={handleImagePicker}
          >
            <Text className={themeMode === 'cyberpunk' 
              ? 'text-cyan-400 font-bold tracking-wider'
              : 'text-blue-700 font-medium'
            }>
              {themeMode === 'cyberpunk' ? 'UPLOAD PROFILE PICTURE' : 'Upload Profile Picture'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            className={themeMode === 'cyberpunk' 
              ? 'bg-black border-2 border-yellow-400 py-3 px-4 rounded-lg items-center'
              : 'bg-gray-50 py-3 px-4 rounded-lg border border-gray-200 items-center'
            }
            onPress={handleChangePassword}
          >
            <Text className={themeMode === 'cyberpunk' 
              ? 'text-yellow-400 font-bold tracking-wider'
              : 'text-gray-700 font-medium'
            }>
              {themeMode === 'cyberpunk' ? 'CHANGE PASSWORD' : 'Change Password'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            className={themeMode === 'cyberpunk' 
              ? 'bg-black border-2 border-red-400 py-3 px-4 rounded-lg items-center'
              : 'bg-red-50 py-3 px-4 rounded-lg border border-red-200 items-center'
            }
            onPress={onLogout}
          >
            <Text className={themeMode === 'cyberpunk' 
              ? 'text-red-400 font-bold tracking-wider'
              : 'text-red-600 font-medium'
            }>
              {themeMode === 'cyberpunk' ? 'LOGOUT' : 'Logout'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}


import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, Alert, Platform } from 'react-native';
import { Audio } from 'expo-av';
import RecordingManager from './RecordingManager';
import { ThemeMode } from '../../contexts/ThemeContext';
import { getThemeClasses } from '../../utils/themeUtils';

interface AudioRecorderProps {
  onRecordingStart: () => void;
  onRecordingStop: (audioUri: string, duration: number) => void;
  onError: (error: string) => void;
  maxDuration?: number;
  minDuration?: number;
  disabled?: boolean;
  themeMode?: ThemeMode;
}

interface RecordingState {
  isRecording: boolean;
  duration: number;
  hasPermission: boolean;
  error: string | null;
  isPreparing: boolean;
}

export default function AudioRecorderNew({
  onRecordingStart,
  onRecordingStop,
  onError,
  maxDuration = 300, // 5 minutes
  minDuration = 5, // 5 seconds
  disabled = false,
  themeMode = 'light',
}: AudioRecorderProps) {
  const [state, setState] = useState<RecordingState>({
    isRecording: false,
    duration: 0,
    hasPermission: false,
    error: null,
    isPreparing: false,
  });

  const recordingManager = RecordingManager.getInstance();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [permissionResponse, requestPermission] = Audio.usePermissions();
  const themeClasses = getThemeClasses(themeMode);

  // Check and request permissions on mount
  useEffect(() => {
    const checkPermissions = async () => {
      console.log('🎤 Checking microphone permissions...');
      console.log('🎤 Permission response:', permissionResponse);
      
      // Always request permission to ensure we have it
      console.log('🎤 Requesting microphone permission...');
      try {
        const permission = await requestPermission();
        console.log('🎤 Permission result:', permission);
        if (permission.granted) {
          setState(prev => ({ ...prev, hasPermission: true }));
          console.log('🎤 Microphone permission granted');
        } else {
          console.log('🎤 Microphone permission denied');
          setState(prev => ({ ...prev, hasPermission: false }));
        }
      } catch (error) {
        console.error('🎤 Error requesting permission:', error);
        setState(prev => ({ ...prev, hasPermission: false }));
      }
    };
    
    checkPermissions();
  }, [requestPermission]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recordingManager.cleanup();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Auto-stop at max duration
  useEffect(() => {
    if (state.isRecording && state.duration >= maxDuration) {
      console.log('🎤 Auto-stopping at max duration');
      stopRecording();
    }
  }, [state.duration, maxDuration, state.isRecording]);

  // Monitor recording status to ensure it's actually capturing audio
  useEffect(() => {
    if (state.isRecording) {
      const checkInterval = setInterval(async () => {
        try {
          const status = await recordingManager.checkRecordingStatus();
          if (status && !status.isRecording) {
            console.warn('🎤 Recording status shows not recording, but state says recording');
          }
        } catch (error) {
          console.error('🎤 Error checking recording status:', error);
        }
      }, 2000); // Check every 2 seconds

      return () => clearInterval(checkInterval);
    }
  }, [state.isRecording]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const startTimer = () => {
    intervalRef.current = setInterval(() => {
      setState(prev => ({ 
        ...prev, 
        duration: prev.duration + 1 
      }));
    }, 1000);
  };

  const stopTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const handleError = (message: string) => {
    console.error('🎤 AudioRecorder error:', message);
    setState(prev => ({ ...prev, error: message, isPreparing: false }));
    onError(message);
  };

  const requestMicPermission = async () => {
    try {
      console.log('🎤 Requesting microphone permission...');
      const permission = await requestPermission();
      
      if (permission.granted) {
        setState(prev => ({ ...prev, hasPermission: true, error: null }));
        console.log('🎤 Microphone permission granted');
      } else {
        handleError('Microphone permission is required to record audio');
      }
    } catch (error) {
      handleError('Failed to request microphone permission');
    }
  };

  const startRecording = async () => {
    if (disabled) return;
    
    try {
      setState(prev => ({ ...prev, error: null, isPreparing: true }));
      
      console.log('🎤 Starting recording process...');
      
      // Check if we have permission
      if (!state.hasPermission) {
        throw new Error('Microphone permission is required to record audio');
      }
      
      console.log('🎤 Permission status:', permissionResponse);
      console.log('🎤 Has permission:', state.hasPermission);
      
      // Configure audio mode for recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });

      console.log('🎤 Audio mode configured, preparing recording...');
      
      // Prepare and start recording
      await recordingManager.prepareRecording();
      console.log('🎤 Recording prepared, starting...');
      
      await recordingManager.startRecording();
      console.log('🎤 Recording started successfully');
      
      setState(prev => ({ 
        ...prev, 
        isRecording: true, 
        duration: 0,
        isPreparing: false
      }));
      
      startTimer();
      onRecordingStart();
      
    } catch (error: any) {
      console.error('🎤 Failed to start recording:', error);
      handleError(`Failed to start recording: ${error?.message || 'Unknown error'}`);
    }
  };

  const stopRecording = async () => {
    if (disabled) return;
    if (!state.isRecording) {
      // Avoid throwing when a duplicate stop is triggered
      console.warn('🎤 Stop requested but not currently recording');
      return;
    }
    
    try {
      const { uri, durationMillis } = await recordingManager.stopRecording();
      const actualSeconds = durationMillis ? Math.round(durationMillis / 1000) : state.duration;
      
      // Check minimum duration using actual recorded length
      if (actualSeconds < minDuration) {
        setState(prev => ({ 
          ...prev, 
          isRecording: false, 
          duration: actualSeconds 
        }));
        stopTimer();
        handleError(`Recording must be at least ${minDuration} seconds long`);
        return;
      }
      
      setState(prev => ({ 
        ...prev, 
        isRecording: false,
        duration: actualSeconds
      }));
      
      stopTimer();
      onRecordingStop(uri, actualSeconds);
      console.log('🎤 Recording stopped successfully');
      
    } catch (error) {
      console.error('🎤 Failed to stop recording:', error);
      handleError('Failed to stop recording. Please try again.');
    }
  };

  const handleResetRecording = async () => {
    console.log('🎤 Resetting recording...');
    await recordingManager.cleanup();
    setState(prev => ({ 
      ...prev, 
      isRecording: false, 
      duration: 0, 
      error: null 
    }));
    stopTimer();
  };

  // Permission denied state
  if (!state.hasPermission) {
    return (
      <View className="items-center p-5">
        <View className={`mb-4 p-4 rounded-lg ${
          themeMode === 'cyberpunk' 
            ? 'bg-yellow-900/30 border border-yellow-400' 
            : themeMode === 'dark' 
            ? 'bg-yellow-900/30 border border-yellow-600' 
            : 'bg-yellow-50 border border-yellow-200'
        }`}>
          <Text className={`text-center mb-2 ${
            themeMode === 'cyberpunk' 
              ? 'text-yellow-400 tracking-wider' 
              : themeMode === 'dark' 
              ? 'text-yellow-300' 
              : 'text-yellow-800'
          }`}>
            {themeMode === 'cyberpunk' ? 'MICROPHONE PERMISSION IS REQUIRED TO RECORD AUDIO' : 'Microphone permission is required to record audio'}
          </Text>
          <TouchableOpacity
            className={`px-5 py-3 rounded-lg mt-2 ${
              themeMode === 'cyberpunk' 
                ? 'bg-yellow-400 shadow-lg shadow-yellow-400/50' 
                : themeMode === 'dark' 
                ? 'bg-yellow-600' 
                : 'bg-yellow-600'
            }`}
            onPress={requestMicPermission}
            disabled={disabled}
          >
            <Text className={`text-base font-semibold text-center ${
              themeMode === 'cyberpunk' 
                ? 'text-black tracking-wider' 
                : 'text-white'
            }`}>
              {themeMode === 'cyberpunk' ? 'GRANT PERMISSION' : 'Grant Permission'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View className="items-center p-5">
      {/* Recording Status */}
      {state.isRecording && (
        <View className={`mb-4 p-4 rounded-lg ${
          themeMode === 'cyberpunk' 
            ? 'bg-red-900/30 border border-red-400' 
            : themeMode === 'dark' 
            ? 'bg-red-900/30 border border-red-600' 
            : 'bg-red-50 border border-red-200'
        }`}>
          <View className="flex-row items-center justify-center">
            <View className={`w-3 h-3 rounded-full animate-pulse mr-2 ${
              themeMode === 'cyberpunk' 
                ? 'bg-red-400' 
                : 'bg-red-500'
            }`} />
            <Text className={`font-semibold ${
              themeMode === 'cyberpunk' 
                ? 'text-red-400 tracking-wider' 
                : themeMode === 'dark' 
                ? 'text-red-300' 
                : 'text-red-800'
            }`}>
              {themeMode === 'cyberpunk' ? 'RECORDING:' : 'Recording:'} {formatTime(state.duration)}
            </Text>
          </View>
        </View>
      )}

      {/* Preparing State */}
      {state.isPreparing && (
        <View className={`mb-4 p-4 rounded-lg ${
          themeMode === 'cyberpunk' 
            ? 'bg-cyan-400/10 border border-cyan-400/30' 
            : themeMode === 'dark' 
            ? 'bg-blue-900/30 border border-blue-600' 
            : 'bg-blue-50 border border-blue-200'
        }`}>
          <Text className={`text-center ${
            themeMode === 'cyberpunk' 
              ? 'text-cyan-400 tracking-wider' 
              : themeMode === 'dark' 
              ? 'text-blue-300' 
              : 'text-blue-800'
          }`}>
            {themeMode === 'cyberpunk' ? 'PREPARING RECORDING...' : 'Preparing recording...'}
          </Text>
        </View>
      )}

      {/* Recording Controls */}
      <View className="items-center mb-4">
        {!state.isRecording ? (
          <TouchableOpacity
            className={`px-6 py-3 rounded-full shadow-lg transition-all duration-200 ${
              themeMode === 'cyberpunk' 
                ? 'bg-cyan-400 shadow-cyan-400/50' 
                : themeMode === 'dark' 
                ? 'bg-violet-600' 
                : 'bg-violet-600'
            }`}
            onPress={startRecording}
            disabled={disabled || state.isPreparing}
            style={{
              backgroundColor: themeMode === 'cyberpunk' ? '#00ffd2' : themeMode === 'dark' ? '#8b5cf6' : '#8b5cf6',
              paddingHorizontal: 25,
              paddingVertical: 12,
              borderRadius: 25,
              shadowColor: themeMode === 'cyberpunk' ? '#00ffd2' : '#8b5cf6',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.3,
              shadowRadius: 4,
              elevation: 4,
              minWidth: 100,
            }}
          >
            <Text style={{ 
              color: themeMode === 'cyberpunk' ? 'black' : 'white', 
              fontSize: 16, 
              fontWeight: 'bold',
              textAlign: 'center'
            }}>
              {state.isPreparing ? (themeMode === 'cyberpunk' ? 'PREPARING...' : 'Preparing...') : (themeMode === 'cyberpunk' ? 'START RECORDING' : 'Start Recording')}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            className={`px-6 py-3 rounded-full shadow-lg transition-all duration-200 ${
              themeMode === 'cyberpunk' 
                ? 'bg-red-400 shadow-red-400/50' 
                : themeMode === 'dark' 
                ? 'bg-red-500' 
                : 'bg-red-500'
            }`}
            onPress={stopRecording}
            style={{
              backgroundColor: themeMode === 'cyberpunk' ? '#f87171' : '#ef4444',
              paddingHorizontal: 25,
              paddingVertical: 12,
              borderRadius: 25,
              shadowColor: themeMode === 'cyberpunk' ? '#f87171' : '#ef4444',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.3,
              shadowRadius: 4,
              elevation: 4,
              minWidth: 100,
            }}
          >
            <Text style={{ 
              color: themeMode === 'cyberpunk' ? 'black' : 'white', 
              fontSize: 16, 
              fontWeight: 'bold',
              textAlign: 'center'
            }}>
              {themeMode === 'cyberpunk' ? 'STOP RECORDING' : 'Stop Recording'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Recording Complete Section */}
      {!state.isRecording && state.duration > 0 && (
        <View className={`p-4 rounded-lg mt-4 items-center ${
          themeMode === 'cyberpunk' 
            ? 'bg-green-900/30 border border-green-400' 
            : themeMode === 'dark' 
            ? 'bg-green-900/30 border border-green-600' 
            : 'bg-green-50 border border-green-200'
        }`}>
          <Text className={`text-base font-semibold mb-2 ${
            themeMode === 'cyberpunk' 
              ? 'text-green-400 tracking-wider' 
              : themeMode === 'dark' 
              ? 'text-green-300' 
              : 'text-green-600'
          }`}>
            ✅ {themeMode === 'cyberpunk' ? 'AUDIO RECORDED SUCCESSFULLY' : 'Audio recorded successfully'}
          </Text>
          <Text className={`text-sm mb-2 ${
            themeMode === 'cyberpunk' 
              ? 'text-cyan-300' 
              : themeMode === 'dark' 
              ? 'text-gray-400' 
              : 'text-gray-600'
          }`}>
            {themeMode === 'cyberpunk' ? 'DURATION:' : 'Duration:'} {formatTime(state.duration)}
          </Text>
          <TouchableOpacity
            className={`px-4 py-2 rounded-md mt-2 ${
              themeMode === 'cyberpunk' 
                ? 'bg-gray-600 border border-cyan-400' 
                : themeMode === 'dark' 
                ? 'bg-gray-500' 
                : 'bg-gray-500'
            }`}
            onPress={handleResetRecording}
          >
            <Text className={`text-sm font-semibold ${
              themeMode === 'cyberpunk' 
                ? 'text-cyan-400 tracking-wider' 
                : 'text-white'
            }`}>
              {themeMode === 'cyberpunk' ? 'RE-RECORD' : 'Re-record'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Duration Info */}
      <View className="items-center">
        <Text className={`text-sm mb-1 ${
          themeMode === 'cyberpunk' 
            ? 'text-cyan-300 tracking-wider' 
            : themeMode === 'dark' 
            ? 'text-gray-400' 
            : 'text-gray-500'
        }`}>
          {themeMode === 'cyberpunk' ? 'MINIMUM:' : 'Minimum:'} {formatTime(minDuration)} | {themeMode === 'cyberpunk' ? 'MAXIMUM:' : 'Maximum:'} {formatTime(maxDuration)}
        </Text>
        {state.duration > 0 && (
          <Text className={`text-base font-semibold ${
            themeMode === 'cyberpunk' 
              ? 'text-cyan-400 tracking-wider' 
              : themeMode === 'dark' 
              ? 'text-gray-300' 
              : 'text-gray-700'
          }`}>
            {themeMode === 'cyberpunk' ? 'CURRENT:' : 'Current:'} {formatTime(state.duration)}
          </Text>
        )}
      </View>

      {/* Error Display */}
      {state.error && (
        <View className={`mt-4 p-3 rounded-lg ${
          themeMode === 'cyberpunk' 
            ? 'bg-red-900/30 border border-red-400' 
            : themeMode === 'dark' 
            ? 'bg-red-900/30 border border-red-600' 
            : 'bg-red-50 border border-red-200'
        }`}>
          <Text className={`text-center ${
            themeMode === 'cyberpunk' 
              ? 'text-red-400 tracking-wider' 
              : themeMode === 'dark' 
              ? 'text-red-300' 
              : 'text-red-800'
          }`}>
            {themeMode === 'cyberpunk' ? state.error.toUpperCase() : state.error}
          </Text>
        </View>
      )}
    </View>
  );
}

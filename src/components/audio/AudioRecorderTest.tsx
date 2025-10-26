/** @jsxImportSource nativewind */
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import AudioRecorderNew from './AudioRecorderNew';

/**
 * Test component for the new AudioRecorder
 * This can be used to verify the AudioRecorder works correctly
 */
export default function AudioRecorderTest() {
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const handleRecordingStart = () => {
    console.log('🎤 Test: Recording started');
    setError(null);
  };

  const handleRecordingStop = (audioUri: string, duration: number) => {
    console.log('🎤 Test: Recording stopped', { audioUri, duration });
    setRecordingUri(audioUri);
    setRecordingDuration(duration);
  };

  const handleError = (errorMessage: string) => {
    console.error('🎤 Test: Recording error', errorMessage);
    setError(errorMessage);
    Alert.alert('Recording Error', errorMessage);
  };

  const handleReset = () => {
    setRecordingUri(null);
    setRecordingDuration(0);
    setError(null);
  };

  return (
    <View className="flex-1 bg-gray-50 p-4">
      <Text className="text-2xl font-bold text-center mb-6">AudioRecorder Test</Text>
      
      {/* Test AudioRecorder */}
      <View className="bg-white rounded-lg p-4 mb-4 shadow-sm">
        <AudioRecorderNew
          onRecordingStart={handleRecordingStart}
          onRecordingStop={handleRecordingStop}
          onError={handleError}
          maxDuration={60} // 1 minute for testing
          minDuration={3}  // 3 seconds minimum
        />
      </View>

      {/* Test Results */}
      {recordingUri && (
        <View className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
          <Text className="text-lg font-semibold text-green-800 mb-2">
            ✅ Recording Successful!
          </Text>
          <Text className="text-sm text-green-700 mb-1">
            Duration: {Math.floor(recordingDuration / 60)}:{(recordingDuration % 60).toString().padStart(2, '0')}
          </Text>
          <Text className="text-xs text-gray-600 mb-3">
            URI: {recordingUri.substring(0, 50)}...
          </Text>
          <TouchableOpacity
            className="bg-green-600 px-4 py-2 rounded-md self-start"
            onPress={handleReset}
          >
            <Text className="text-white text-sm font-medium">Reset Test</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Error Display */}
      {error && (
        <View className="bg-red-50 border border-red-200 rounded-lg p-4">
          <Text className="text-sm text-red-700 mb-2">Error: {error}</Text>
          <TouchableOpacity
            className="bg-red-600 px-4 py-2 rounded-md self-start"
            onPress={() => setError(null)}
          >
            <Text className="text-white text-sm font-medium">Clear Error</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Test Instructions */}
      <View className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <Text className="text-sm font-medium text-blue-800 mb-2">Test Instructions:</Text>
        <Text className="text-xs text-blue-700 mb-1">1. Grant microphone permission when prompted</Text>
        <Text className="text-xs text-blue-700 mb-1">2. Click "Start Recording" to begin</Text>
        <Text className="text-xs text-blue-700 mb-1">3. Speak for at least 3 seconds</Text>
        <Text className="text-xs text-blue-700 mb-1">4. Click "Stop Recording" to finish</Text>
        <Text className="text-xs text-blue-700">5. Verify the recording URI is generated</Text>
      </View>
    </View>
  );
}

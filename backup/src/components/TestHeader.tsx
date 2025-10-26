import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Alert } from 'react-native';

interface TestHeaderProps {
  testName: string;
  onExit?: () => void;
}

export default function TestHeader({ testName, onExit }: TestHeaderProps) {
  const handleBackPress = () => {
    Alert.alert(
      'Exit Test',
      'Are you sure you want to go back to cabinet? Your progress will be saved but you will exit the test.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Go Back', 
          style: 'destructive', 
          onPress: () => {
            if (onExit) {
              onExit();
            } else {
              router.back();
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.header}>
      <TouchableOpacity 
        style={styles.backButton}
        onPress={handleBackPress}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={styles.backArrow}>←</Text>
      </TouchableOpacity>
      <View style={styles.titleContainer}>
        <Text style={styles.testName} numberOfLines={1}>
          {testName}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
          backgroundColor: '#6900a3', // Custom violet
          borderBottomWidth: 1,
          borderBottomColor: '#5a008a',
  },
  backButton: {
    marginRight: 12,
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  backArrow: {
    fontSize: 20,
    color: '#FFFFFF', // White for contrast
    fontWeight: 'bold',
  },
  titleContainer: {
    flex: 1,
  },
  testName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF', // White for contrast
    textAlign: 'center',
  },
});

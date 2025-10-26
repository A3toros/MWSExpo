/** @jsxImportSource nativewind */
import React from 'react';
import { View, Text, TouchableOpacity, Dimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

interface SwipeMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: string) => void;
  onLogout: () => void;
}

export default function SwipeMenu({ isOpen, onClose, onNavigate, onLogout }: SwipeMenuProps) {
  const screenHeight = Dimensions.get('window').height;
  const screenWidth = Dimensions.get('window').width;
  const menuWidth = screenWidth * 0.6;

  const translateX = useSharedValue(-menuWidth);
  const backdropOpacity = useSharedValue(0);

  React.useEffect(() => {
    if (isOpen) {
      translateX.value = withSpring(0, { damping: 20, stiffness: 300 });
      backdropOpacity.value = withTiming(0.5, { duration: 300 });
    } else {
      translateX.value = withSpring(-menuWidth, { damping: 20, stiffness: 300 });
      backdropOpacity.value = withTiming(0, { duration: 300 });
    }
  }, [isOpen]);

  const menuStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 999,
          },
          backdropStyle,
        ]}
      >
        <TouchableOpacity
          style={{ flex: 1 }}
          onPress={onClose}
          activeOpacity={1}
        />
      </Animated.View>

      {/* Menu */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            width: menuWidth,
            height: screenHeight,
            backgroundColor: '#8B5CF6',
            zIndex: 1000,
          },
          menuStyle,
        ]}
      >
        <View style={{ flex: 1, paddingTop: 48, paddingHorizontal: 4 }}>
          {/* Header */}
          <View style={{ 
            flexDirection: 'row', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: 32, 
            paddingBottom: 20, 
            borderBottomWidth: 1, 
            borderBottomColor: '#374151' 
          }}>
            <Text style={{ 
              color: 'white', 
              fontSize: 28, 
              fontWeight: 'bold' 
            }}>Menu</Text>
            <TouchableOpacity 
              onPress={onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: '#374151',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Text style={{ 
                color: 'white', 
                fontSize: 18, 
                fontWeight: 'bold' 
              }}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Menu Items */}
          <TouchableOpacity
            style={{
              paddingVertical: 16,
              paddingHorizontal: 20,
              marginVertical: 4,
              backgroundColor: '#8B5CF6',
              borderRadius: 8,
            }}
            onPress={() => {
              onClose();
              onNavigate('active');
            }}
          >
            <Text style={{ 
              color: 'white', 
              fontSize: 18, 
              fontWeight: 'bold' 
            }}>Active Tests</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              paddingVertical: 16,
              paddingHorizontal: 20,
              marginVertical: 4,
              backgroundColor: '#8B5CF6',
              borderRadius: 8,
            }}
            onPress={() => {
              onClose();
              onNavigate('results');
            }}
          >
            <Text style={{ 
              color: 'white', 
              fontSize: 18, 
              fontWeight: 'bold' 
            }}>Results</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              paddingVertical: 16,
              paddingHorizontal: 20,
              marginVertical: 4,
              backgroundColor: '#8B5CF6',
              borderRadius: 8,
            }}
            onPress={() => {
              onClose();
              onNavigate('profile');
            }}
          >
            <Text style={{ 
              color: 'white', 
              fontSize: 18, 
              fontWeight: 'bold' 
            }}>Profile</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              paddingVertical: 16,
              paddingHorizontal: 20,
              marginVertical: 4,
              backgroundColor: '#8B5CF6',
              borderRadius: 8,
            }}
            onPress={() => {
              onClose();
              onNavigate('password');
            }}
          >
            <Text style={{ 
              color: 'white', 
              fontSize: 18, 
              fontWeight: 'bold' 
            }}>Change Password</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              paddingVertical: 16,
              paddingHorizontal: 20,
              marginVertical: 4,
              backgroundColor: '#8B5CF6',
              borderRadius: 8,
            }}
            onPress={() => {
              onClose();
              onLogout();
            }}
          >
            <Text style={{ 
              color: 'white', 
              fontSize: 18, 
              fontWeight: 'bold' 
            }}>Logout</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </>
  );
}

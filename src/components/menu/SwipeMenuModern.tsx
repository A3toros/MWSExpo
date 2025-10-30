/** @jsxImportSource nativewind */
import React from 'react';
import { View, Dimensions, StatusBar } from 'react-native';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withSpring, 
  withTiming
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { MenuHeader } from './MenuHeader';
import { MenuSection } from './MenuSection';
import { MenuItem } from './MenuItem';
import { MenuFooter } from './MenuFooter';
import { useTheme } from '../../contexts/ThemeContext';
import { getThemeClasses } from '../../utils/themeUtils';

interface SwipeMenuModernProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: string) => void;
  userName?: string;
  userRole?: string;
  activeTestsCount?: number;
}

export default function SwipeMenuModern({ 
  isOpen, 
  onClose, 
  onNavigate, 
  userName = 'Student', 
  userRole = 'Student',
  activeTestsCount = 0
}: SwipeMenuModernProps) {
  const { themeMode } = useTheme();
  const screenHeight = Dimensions.get('window').height;
  const screenWidth = Dimensions.get('window').width;
  const menuWidth = screenWidth * 0.75; // Slightly wider for modern look

  const translateX = useSharedValue(-menuWidth);
  const backdropOpacity = useSharedValue(0);
  const menuOpacity = useSharedValue(0);

  React.useEffect(() => {
    if (isOpen) {
      // Entrance animation
      translateX.value = withSpring(0, { 
        damping: 20, 
        stiffness: 300 
      });
      backdropOpacity.value = withTiming(0.6, { duration: 300 });
      menuOpacity.value = withTiming(1, { duration: 400 });
    } else {
      // Exit animation
      translateX.value = withSpring(-menuWidth, { 
        damping: 20, 
        stiffness: 300 
      });
      backdropOpacity.value = withTiming(0, { duration: 200 });
      menuOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [isOpen]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const menuStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: menuOpacity.value,
  }));

  if (!isOpen) return null;

  return (
    <>
      {/* Status Bar */}
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      {/* Backdrop with blur */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 999,
          },
          backdropStyle,
        ]}
      >
        <BlurView
          intensity={20}
          tint="dark"
          style={{ flex: 1 }}
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
            zIndex: 1000,
          },
          menuStyle,
        ]}
      >
        <LinearGradient
          colors={themeMode === 'cyberpunk' 
            ? ['#000000', '#111111', '#000000']
            : themeMode === 'dark'
            ? ['#1e293b', '#334155', '#475569']
            : ['#6366F1', '#8B5CF6', '#A855F7']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1 }}
        >
          <View style={{ flex: 1 }}>
            {/* Header */}
            <MenuHeader
              userName={userName}
              userRole={userRole}
              onClose={onClose}
              delay={100}
            />

            {/* Menu Content */}
            <View style={{ flex: 1, paddingTop: 8 }}>
              {/* Quick Actions Section */}
              <MenuSection title="Quick Actions" delay={200}>
                <MenuItem
                  icon="🏠"
                  title="Dashboard"
                  subtitle="View your progress"
                  cyberStyle={themeMode === 'cyberpunk'}
                  color={themeMode === 'cyberpunk' ? 'red' : undefined}
                  onPress={() => {
                    onClose();
                    onNavigate('dashboard');
                  }}
                  delay={250}
                />
                <MenuItem
                  icon="📝"
                  title="Active Tests"
                  subtitle="Continue your tests"
                  badge={activeTestsCount}
                  cyberStyle={themeMode === 'cyberpunk'}
                  color={themeMode === 'cyberpunk' ? 'yellow' : undefined}
                  onPress={() => {
                    onClose();
                    onNavigate('active');
                  }}
                  delay={300}
                />
                <MenuItem
                  icon="📊"
                  title="Results"
                  subtitle="View your scores"
                  cyberStyle={themeMode === 'cyberpunk'}
                  color={themeMode === 'cyberpunk' ? 'purple' : undefined}
                  onPress={() => {
                    onClose();
                    onNavigate('results');
                  }}
                  delay={350}
                />
              </MenuSection>

              {/* Account Section */}
              <MenuSection title="Account" delay={400}>
                <MenuItem
                  icon="👤"
                  title="Profile"
                  subtitle="Manage your account"
                  cyberStyle={themeMode === 'cyberpunk'}
                  color={themeMode === 'cyberpunk' ? 'green' : undefined}
                  onPress={() => {
                    onClose();
                    onNavigate('profile');
                  }}
                  delay={450}
                />
                <MenuItem
                  icon="⚙️"
                  title="Settings"
                  subtitle="App preferences"
                  cyberStyle={themeMode === 'cyberpunk'}
                  color={themeMode === 'cyberpunk' ? 'cyan' : undefined}
                  onPress={() => {
                    onClose();
                    onNavigate('settings');
                  }}
                  delay={550}
                />
              </MenuSection>

              {/* Support Section */}
              <MenuSection title="Support" delay={600}>
                <MenuItem
                  icon="❓"
                  title="Help & FAQ"
                  subtitle="Get assistance"
                  cyberStyle={themeMode === 'cyberpunk'}
                  color={themeMode === 'cyberpunk' ? 'blue' : undefined}
                  onPress={() => {
                    onClose();
                    onNavigate('help');
                  }}
                  delay={650}
                />
                <MenuItem
                  icon="💬"
                  title="Feedback"
                  subtitle="Share your thoughts"
                  cyberStyle={themeMode === 'cyberpunk'}
                  color={themeMode === 'cyberpunk' ? 'purple' : undefined}
                  onPress={() => {
                    onClose();
                    onNavigate('feedback');
                  }}
                  delay={700}
                />
                <MenuItem
                  icon="ℹ️"
                  title="About"
                  subtitle="App information"
                  cyberStyle={themeMode === 'cyberpunk'}
                  color={themeMode === 'cyberpunk' ? 'red' : undefined}
                  onPress={() => {
                    onClose();
                    onNavigate('about');
                  }}
                  delay={750}
                />
              </MenuSection>
            </View>

            {/* Footer */}
            <MenuFooter
              delay={800}
            />
          </View>
        </LinearGradient>
      </Animated.View>
    </>
  );
}

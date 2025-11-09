/** @jsxImportSource nativewind */
import React, { useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  BackHandler,
  Alert,
  Linking,
} from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

interface TermsOfServiceModalProps {
  visible: boolean;
  onAccept: () => void;
  onDecline?: () => void;
}

export function TermsOfServiceModal({
  visible,
  onAccept,
  onDecline,
}: TermsOfServiceModalProps) {
  const { themeMode } = useTheme();
  const isCyberpunk = themeMode === 'cyberpunk';
  const isDark = themeMode === 'dark';
  const [agreed, setAgreed] = React.useState(false);

  // Privacy Policy URL
  const privacyPolicyUrl = 'https://mathayomwatsing.netlify.app/privacy';

  const handleOpenPrivacyPolicy = () => {
    Linking.openURL(privacyPolicyUrl).catch((err) => {
      console.error('Failed to open privacy policy:', err);
      Alert.alert(
        'Error',
        'Unable to open privacy policy. Please visit our website for more information.'
      );
    });
  };

  const handleDecline = useCallback(() => {
    Alert.alert(
      isCyberpunk ? 'TERMS REQUIRED' : 'Terms Required',
      isCyberpunk
        ? 'YOU MUST ACCEPT THE TERMS OF SERVICE TO USE THIS APP. WOULD YOU LIKE TO EXIT?'
        : 'You must accept the Terms of Service to use this app. Would you like to exit?',
      [
        {
          text: isCyberpunk ? 'CANCEL' : 'Cancel',
          style: 'cancel',
        },
        {
          text: isCyberpunk ? 'EXIT APP' : 'Exit App',
          style: 'destructive',
          onPress: () => {
            if (onDecline) {
              onDecline();
            } else {
              BackHandler.exitApp();
            }
          },
        },
      ]
    );
  }, [isCyberpunk, onDecline]);

  // Reset agreement state when modal becomes visible
  React.useEffect(() => {
    if (visible) {
      setAgreed(false);
    }
  }, [visible]);

  // Prevent Android back button from dismissing the modal
  React.useEffect(() => {
    if (visible) {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        // Prevent back button from dismissing - show decline alert instead
        handleDecline();
        return true; // Prevent default back behavior
      });

      return () => backHandler.remove();
    }
  }, [visible, handleDecline]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {}} // Prevent dismissal by back button
    >
      <View
        className={`flex-1 ${
          isCyberpunk
            ? 'bg-black'
            : isDark
            ? 'bg-slate-900'
            : 'bg-white'
        }`}
      >
        {/* Header */}
        <View
          className={`px-6 py-6 border-b ${
            isCyberpunk
              ? 'border-cyan-400/30'
              : isDark
              ? 'border-slate-700'
              : 'border-gray-200'
          }`}
        >
          <Text
            className={`text-2xl font-bold ${
              isCyberpunk
                ? 'text-cyan-400 tracking-wider'
                : isDark
                ? 'text-slate-100'
                : 'text-gray-900'
            }`}
          >
            {isCyberpunk
              ? 'TERMS OF SERVICE & PRIVACY NOTICE'
              : 'Terms of Service & Privacy Notice'}
          </Text>
          <Text
            className={`text-sm mt-2 ${
              isCyberpunk
                ? 'text-yellow-400 tracking-wider'
                : isDark
                ? 'text-slate-300'
                : 'text-gray-600'
            }`}
          >
            {isCyberpunk
              ? 'PLEASE READ AND ACCEPT TO CONTINUE'
              : 'Please read and accept to continue'}
          </Text>
        </View>

        {/* Content */}
        <ScrollView className="flex-1 px-6 py-6" contentContainerStyle={{ paddingBottom: 24 }}>
          <View className="space-y-6">
            {/* Purpose */}
            <View>
              <Text
                className={`text-lg font-semibold mb-3 mt-2 ${
                  isCyberpunk
                    ? 'text-cyan-400 tracking-wider'
                    : isDark
                    ? 'text-slate-100'
                    : 'text-gray-900'
                }`}
              >
                {isCyberpunk ? 'APP PURPOSE' : 'App Purpose'}
              </Text>
              <Text
                className={`text-base leading-6 ${
                  isCyberpunk
                    ? 'text-cyan-300'
                    : isDark
                    ? 'text-slate-300'
                    : 'text-gray-700'
                }`}
              >
                The MWS Student App is an educational learning management system designed for
                Mathayomwatsing School students. The app enables students to take tests, view
                results, track progress, and access educational content.
              </Text>
            </View>

            {/* Data Collection */}
            <View>
              <Text
                className={`text-lg font-semibold mb-3 mt-6 ${
                  isCyberpunk
                    ? 'text-cyan-400 tracking-wider'
                    : isDark
                    ? 'text-slate-100'
                    : 'text-gray-900'
                }`}
              >
                {isCyberpunk ? 'DATA COLLECTION' : 'Data Collection'}
              </Text>
              <Text
                className={`text-base leading-6 mb-3 ${
                  isCyberpunk
                    ? 'text-cyan-300'
                    : isDark
                    ? 'text-slate-300'
                    : 'text-gray-700'
                }`}
              >
                We collect the following data to provide and improve our services:
              </Text>
              <TouchableOpacity
                onPress={handleOpenPrivacyPolicy}
                className="mt-2 mb-3"
              >
                <Text
                  className={`text-base underline font-semibold ${
                    isCyberpunk
                      ? 'text-cyan-400'
                      : isDark
                      ? 'text-blue-400'
                      : 'text-blue-600'
                  }`}
                >
                  {isCyberpunk ? '📄 VIEW PRIVACY POLICY' : '📄 View Privacy Policy'}
                </Text>
              </TouchableOpacity>
              <View className="ml-4 space-y-3">
                <Text
                  className={`text-base leading-6 ${
                    isCyberpunk
                      ? 'text-cyan-300'
                      : isDark
                      ? 'text-slate-300'
                      : 'text-gray-700'
                  }`}
                >
                  • <Text className="font-semibold">Account Information:</Text> Student ID,
                  name, class, and grade for authentication and personalization
                </Text>
                <Text
                  className={`text-base leading-6 ${
                    isCyberpunk
                      ? 'text-cyan-300'
                      : isDark
                      ? 'text-slate-300'
                      : 'text-gray-700'
                  }`}
                >
                  • <Text className="font-semibold">Test Data:</Text> Test answers, scores,
                  completion status, and progress for academic assessment
                </Text>
                <Text
                  className={`text-base leading-6 ${
                    isCyberpunk
                      ? 'text-cyan-300'
                      : isDark
                      ? 'text-slate-300'
                      : 'text-gray-700'
                  }`}
                >
                  • <Text className="font-semibold">Usage Data:</Text> App interactions,
                  feature usage, and performance metrics to improve the app experience
                </Text>
              </View>
              <View
                className={`mt-4 p-4 rounded-lg border ${
                  isCyberpunk
                    ? 'bg-yellow-400/10 border-yellow-400/30'
                    : isDark
                    ? 'bg-yellow-900/20 border-yellow-700/50'
                    : 'bg-yellow-50 border-yellow-200'
                }`}
              >
                <Text
                  className={`text-sm leading-6 ${
                    isCyberpunk
                      ? 'text-yellow-400'
                      : isDark
                      ? 'text-yellow-300'
                      : 'text-yellow-800'
                  }`}
                >
                  <Text className="font-semibold">
                    {isCyberpunk ? 'IMPORTANT: ' : 'Important: '}
                  </Text>
                  This app does not use or share personal data for advertising or commercial
                  purposes. All data collection is strictly for educational and assessment use.
                  We comply with COPPA (Children's Online Privacy Protection Act) and equivalent
                  child-data protection laws. This app does not display advertisements or use
                  tracking SDKs.
                </Text>
              </View>
            </View>

            {/* Data Usage */}
            <View>
              <Text
                className={`text-lg font-semibold mb-3 mt-6 ${
                  isCyberpunk
                    ? 'text-cyan-400 tracking-wider'
                    : isDark
                    ? 'text-slate-100'
                    : 'text-gray-900'
                }`}
              >
                {isCyberpunk ? 'DATA USAGE' : 'Data Usage'}
              </Text>
              <Text
                className={`text-base leading-6 mb-3 ${
                  isCyberpunk
                    ? 'text-cyan-300'
                    : isDark
                    ? 'text-slate-300'
                    : 'text-gray-700'
                }`}
              >
                Your data is used to:
              </Text>
              <View className="ml-4 space-y-2">
                <Text
                  className={`text-base leading-6 ${
                    isCyberpunk
                      ? 'text-cyan-300'
                      : isDark
                      ? 'text-slate-300'
                      : 'text-gray-700'
                  }`}
                >
                  • Deliver and maintain educational services
                </Text>
                <Text
                  className={`text-base leading-6 ${
                    isCyberpunk
                      ? 'text-cyan-300'
                      : isDark
                      ? 'text-slate-300'
                      : 'text-gray-700'
                  }`}
                >
                  • Assess academic performance and provide feedback
                </Text>
                <Text
                  className={`text-base leading-6 ${
                    isCyberpunk
                      ? 'text-cyan-300'
                      : isDark
                      ? 'text-slate-300'
                      : 'text-gray-700'
                  }`}
                >
                  • Improve app functionality and user experience
                </Text>
                <Text
                  className={`text-base leading-6 ${
                    isCyberpunk
                      ? 'text-cyan-300'
                      : isDark
                      ? 'text-slate-300'
                      : 'text-gray-700'
                  }`}
                >
                  • Ensure academic integrity during tests
                </Text>
                <Text
                  className={`text-base leading-6 ${
                    isCyberpunk
                      ? 'text-cyan-300'
                      : isDark
                      ? 'text-slate-300'
                      : 'text-gray-700'
                  }`}
                >
                  • Provide technical support and troubleshooting
                </Text>
              </View>
            </View>

            {/* Data Storage */}
            <View>
              <Text
                className={`text-lg font-semibold mb-3 mt-6 ${
                  isCyberpunk
                    ? 'text-cyan-400 tracking-wider'
                    : isDark
                    ? 'text-slate-100'
                    : 'text-gray-900'
                }`}
              >
                {isCyberpunk ? 'DATA STORAGE' : 'Data Storage'}
              </Text>
              <Text
                className={`text-base leading-6 ${
                  isCyberpunk
                    ? 'text-cyan-300'
                    : isDark
                    ? 'text-slate-300'
                    : 'text-gray-700'
                }`}
              >
                Your data is stored securely on our servers and locally on your device. Test
                progress is saved locally to enable offline functionality. All data is
                encrypted and protected according to educational data privacy standards.
              </Text>
            </View>

            {/* Academic Integrity */}
            <View>
              <Text
                className={`text-lg font-semibold mb-3 mt-6 ${
                  isCyberpunk
                    ? 'text-cyan-400 tracking-wider'
                    : isDark
                    ? 'text-slate-100'
                    : 'text-gray-900'
                }`}
              >
                {isCyberpunk ? 'ACADEMIC INTEGRITY' : 'Academic Integrity'}
              </Text>
              <Text
                className={`text-base leading-6 ${
                  isCyberpunk
                    ? 'text-cyan-300'
                    : isDark
                    ? 'text-slate-300'
                    : 'text-gray-700'
                }`}
              >
                The app includes anti-cheating measures to ensure fair assessment. This
                includes monitoring app state changes, preventing unauthorized actions during
                tests, and detecting suspicious behavior. By using this app, you agree to
                maintain academic honesty.
              </Text>
            </View>

            {/* Acceptance */}
            <View
              className={`p-5 mb-6 rounded-lg border ${
                isCyberpunk
                  ? 'bg-cyan-400/10 border-cyan-400/30'
                  : isDark
                  ? 'bg-blue-900/30 border-blue-700/50'
                  : 'bg-blue-50 border-blue-200'
              }`}
            >
              <Text
                className={`text-sm leading-6 ${
                  isCyberpunk
                    ? 'text-cyan-400'
                    : isDark
                    ? 'text-blue-300'
                    : 'text-blue-700'
                }`}
              >
                By tapping "Accept", you acknowledge that you have read, understood, and
                agree to our Privacy Policy and Terms of Service. You consent to the
                collection and use of your data as described above for educational purposes.
                {'\n\n'}
                <Text className="font-semibold">
                  {isCyberpunk ? 'PRIVACY POLICY: ' : 'Privacy Policy: '}
                </Text>
                <Text
                  className="underline"
                  onPress={handleOpenPrivacyPolicy}
                >
                  {privacyPolicyUrl}
                </Text>
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Footer */}
        <View
          className={`px-6 py-6 border-t ${
            isCyberpunk
              ? 'border-cyan-400/30'
              : isDark
              ? 'border-slate-700'
              : 'border-gray-200'
          }`}
        >
          {/* Checkbox */}
          <TouchableOpacity
            onPress={() => setAgreed(!agreed)}
            className="flex-row items-center mb-4"
            activeOpacity={0.7}
          >
            <View
              className={`w-5 h-5 rounded border-2 items-center justify-center mr-3 ${
                agreed
                  ? isCyberpunk
                    ? 'bg-cyan-400 border-cyan-400'
                    : isDark
                    ? 'bg-blue-500 border-blue-500'
                    : 'bg-blue-500 border-blue-500'
                  : isCyberpunk
                  ? 'border-cyan-400/50'
                  : isDark
                  ? 'border-slate-500'
                  : 'border-gray-400'
              }`}
            >
              {agreed && (
                <Text
                  className={`text-white text-xs font-bold ${
                    isCyberpunk ? 'tracking-wider' : ''
                  }`}
                >
                  ✓
                </Text>
              )}
            </View>
            <Text
              className={`flex-1 text-sm ${
                isCyberpunk
                  ? 'text-cyan-300'
                  : isDark
                  ? 'text-slate-300'
                  : 'text-gray-700'
              }`}
            >
              I have read and agree to the Privacy Policy & Terms of Service
            </Text>
          </TouchableOpacity>

          <View className="flex-row" style={{ gap: 12 }}>
            <TouchableOpacity
              onPress={handleDecline}
              className={`flex-1 py-3 px-4 rounded-lg border ${
                isCyberpunk
                  ? 'border-red-400 bg-black'
                  : isDark
                  ? 'border-slate-600 bg-slate-800'
                  : 'border-gray-300 bg-white'
              }`}
              activeOpacity={0.8}
            >
              <Text
                className={`text-center font-semibold text-base ${
                  isCyberpunk
                    ? 'text-red-400 tracking-wider'
                    : isDark
                    ? 'text-slate-300'
                    : 'text-gray-700'
                }`}
              >
                {isCyberpunk ? 'DECLINE' : 'Decline'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onAccept}
              disabled={!agreed}
              className={`flex-1 py-3 px-4 rounded-lg ${
                agreed
                  ? isCyberpunk
                    ? 'bg-cyan-400'
                    : isDark
                    ? 'bg-blue-500'
                    : 'bg-blue-500'
                  : isCyberpunk
                  ? 'bg-gray-700 opacity-50'
                  : isDark
                  ? 'bg-slate-600 opacity-50'
                  : 'bg-gray-300 opacity-50'
              }`}
              activeOpacity={agreed ? 0.8 : 1}
            >
              <Text
                className={`text-center font-semibold text-base ${
                  agreed
                    ? 'text-white'
                    : isCyberpunk
                    ? 'text-gray-400 tracking-wider'
                    : isDark
                    ? 'text-slate-400'
                    : 'text-gray-500'
                } ${isCyberpunk && agreed ? 'tracking-wider' : ''}`}
              >
                {isCyberpunk ? 'ACCEPT & CONTINUE' : 'Accept & Continue'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View, Image, StyleSheet } from 'react-native';
import { useAppDispatch, useAppSelector } from '../../src/store';
import { loginFailure, loginStart, loginSuccess } from '../../src/store/slices/authSlice';
import { api } from '../../src/services/apiClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

export default function LoginScreen() {
  const dispatch = useAppDispatch();
  const loading = useAppSelector((s) => s.auth.loading);
  const error = useAppSelector((s) => s.auth.error);
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState<{ studentId: boolean; password: boolean }>({ studentId: false, password: false });

  const studentIdError = useMemo(() => {
    if (!touched.studentId) return '';
    if (!studentId) return 'Student ID is required';
    const ok = /^\d+$/.test(studentId);
    return ok ? '' : 'Enter a valid student ID (numbers only)';
  }, [studentId, touched.studentId]);

        const passwordError = useMemo(() => {
          if (!touched.password) return '';
          if (!password) return 'Password is required';
          return '';
        }, [password, touched.password]);

  const formInvalid = !!studentIdError || !!passwordError || !studentId || !password;

  const onSubmit = async () => {
    setTouched({ studentId: true, password: true });
    if (formInvalid) return;
    dispatch(loginStart());
    
    try {
      console.log('Attempting login with:', { username: studentId, password: '***' });
      console.log('API base URL:', api.defaults.baseURL);
      
      const response = await api.post('/api/student-login', {
        studentId: studentId,
        password: password
      });
      
      console.log('Login response:', response.data);
      const { accessToken, refreshToken, student } = response.data;
      console.log('Extracted data:', { accessToken: !!accessToken, refreshToken: !!refreshToken, student });
      console.log('Student data:', student);
      
      await AsyncStorage.setItem('auth_token', accessToken);
      await AsyncStorage.setItem('refresh_token', refreshToken);
      await AsyncStorage.setItem('auth_user', JSON.stringify(student));
      
      // Verify storage
      const storedUser = await AsyncStorage.getItem('auth_user');
      console.log('Stored user data:', storedUser);
      
      dispatch(loginSuccess({ token: accessToken, user: student }));
      router.replace('/(tabs)');
    } catch (error: any) {
      console.error('Login error:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      dispatch(loginFailure(error.response?.data?.message || 'Login failed'));
    }
  };

        return (
          <View style={styles.container}>
            {/* School Logo */}
            <View style={styles.logoContainer}>
              <Image 
                source={{ uri: 'https://mathayomwatsing.netlify.app/pics/logo_mws.png' }}
                style={styles.logo}
                resizeMode="contain"
              />
              <Text style={styles.schoolName}>โรงเรียนมัธยมวัดสิงห์</Text>
              <Text style={styles.schoolNameEn}>Mathayomwatsing School</Text>
            </View>

            {/* Login Form */}
            <View style={styles.formContainer}>
              <Text style={styles.title}>Student Login</Text>
              <Text style={styles.subtitle}>Enter your credentials to access your tests</Text>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Student ID</Text>
                <TextInput
                  accessibilityLabel="Student ID"
                  placeholder="Enter student ID"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="numeric"
                  value={studentId}
                  onBlur={() => setTouched((t) => ({ ...t, studentId: true }))}
                  onChangeText={setStudentId}
                  style={[styles.input, { borderColor: studentIdError ? '#ef4444' : '#d1d5db' }]}
                />
                {!!studentIdError && <Text style={styles.errorText}>{studentIdError}</Text>}
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Password</Text>
                <TextInput
                  accessibilityLabel="Password"
                  placeholder="Your password"
                  value={password}
                  onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                  onChangeText={setPassword}
                  secureTextEntry
                  style={[styles.input, { borderColor: passwordError ? '#ef4444' : '#d1d5db' }]}
                />
                {!!passwordError && <Text style={styles.errorText}>{passwordError}</Text>}
              </View>

              {!!error && (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <TouchableOpacity
                onPress={onSubmit}
                disabled={loading || formInvalid}
                accessibilityRole="button"
                style={[styles.loginButton, { backgroundColor: loading || formInvalid ? '#9ca3af' : '#2563eb' }]}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.loginButtonText}>Sign In</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
    marginTop: 20,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 16,
  },
  schoolName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 4,
  },
  schoolNameEn: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    fontWeight: '500',
  },
  formContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 32,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    fontSize: 16,
    backgroundColor: '#f9fafb',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    marginTop: 4,
  },
  errorContainer: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  loginButton: {
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  loginButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});



import axios, { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SecureToken, SecureRefreshToken } from '../utils/secureTokenStorage';

export const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_BASE_URL || 'https://mathayomwatsing.netlify.app',
  timeout: 30000, // Increased timeout for production server
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: false,
});

// Export apiClient for backward compatibility
export const apiClient = api;

// Remove the problematic CORS header that's causing issues

let isRefreshing = false;
type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason?: any) => void;
};
const pendingQueue: PendingRequest[] = [];

async function setAuthHeader(config: InternalAxiosRequestConfig): Promise<InternalAxiosRequestConfig> {
  try {
    const token = await SecureToken.get();
    if (token) {
      config.headers = config.headers ?? {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {}
  return config;
}

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const status = error.response?.status;

    if (status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          pendingQueue.push({ resolve, reject });
        })
          .then(async () => {
            const config = await setAuthHeader(originalRequest);
            return api.request(config);
          })
          .catch((err) => Promise.reject(err));
      }

      isRefreshing = true;
      try {
        const refreshToken = await SecureRefreshToken.get();
        if (!refreshToken) throw new Error('No refresh token');
        const response = await api.post('/api/refresh-token', { refreshToken });
        const newAccessToken = (response.data as any)?.accessToken;
        if (!newAccessToken) throw new Error('No access token in refresh');
        
        // Use SecureToken to store the new token (with hash verification, retry, write verification)
        await SecureToken.set(newAccessToken);

        // Drain queue
        pendingQueue.splice(0).forEach((p) => p.resolve(true));

        // Retry the original request with new token
        return api(await setAuthHeader(originalRequest));
      } catch (refreshErr) {
        // Clear tokens using SecureToken and SecureRefreshToken
        await SecureToken.clear().catch(() => {});
        await SecureRefreshToken.clear().catch(() => {});
        pendingQueue.splice(0).forEach((p) => p.reject(refreshErr));
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

api.interceptors.request.use(setAuthHeader);

// Type-specific submission methods
export const submitTest = {
  multipleChoice: (payload: any) => api.post('/api/submit-multiple-choice-test', payload),
  trueFalse: (payload: any) => api.post('/api/submit-true-false-test', payload),
  input: (payload: any) => api.post('/api/submit-input-test', payload),
  fillBlanks: (payload: any) => api.post('/api/submit-fill-blanks-test', payload),
  drawing: (payload: any) => api.post('/api/submit-drawing-test', payload),
  matching: (payload: any) => api.post('/api/submit-matching-type-test', payload),
  wordMatching: (payload: any) => api.post('/api/submit-word-matching-test', payload),
  speaking: (payload: any) => api.post('/api/submit-speaking-test-final', payload),
};

// Helper function to get the correct submission method based on test type
export const getSubmissionMethod = (testType: string) => {
  switch (testType.toLowerCase()) {
    case 'multiple_choice':
      return submitTest.multipleChoice;
    case 'true_false':
      return submitTest.trueFalse;
    case 'input':
      return submitTest.input;
    case 'fill_blanks':
      return submitTest.fillBlanks;
    case 'drawing':
      return submitTest.drawing;
    case 'matching':
    case 'matching_type':
      return submitTest.matching;
    case 'word_matching':
      return submitTest.wordMatching;
    case 'speaking':
      return submitTest.speaking;
    default:
      throw new Error(`Unsupported test type: ${testType}`);
  }
};

// Upload helpers
export async function uploadSpeakingAudio(fileUri: string) {
  const formData = new FormData();
  const fileName = fileUri.split('/').pop() || `recording-${Date.now()}.m4a`;
  const fileType = 'audio/m4a';
  // React Native specific file descriptor type
  const file: any = { uri: fileUri, name: fileName, type: fileType };
  formData.append('file', file as any);

  return api.post('/api/upload-speaking-audio', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}


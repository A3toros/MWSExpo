import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark' | 'cyberpunk';

export interface ThemeColors {
  background: string;
  surface: string;
  primary: string;
  secondary: string;
  accent: string;
  text: string;
  textSecondary: string;
  border: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  purple: string;
  white: string;
  dark: string;
}

export interface Theme {
  mode: ThemeMode;
  colors: ThemeColors;
  fonts: {
    primary: string;
    secondary: string;
    cyberpunk: string;
  };
}

const lightTheme: Theme = {
  mode: 'light',
  colors: {
    background: '#ffffff',
    surface: '#f8fafc',
    primary: '#3b82f6',
    secondary: '#64748b',
    accent: '#8b5cf6',
    text: '#1e293b',
    textSecondary: '#64748b',
    border: '#e2e8f0',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
    purple: '#8b5cf6',
    white: '#ffffff',
    dark: '#1e293b'
  },
  fonts: {
    primary: 'System',
    secondary: 'System',
    cyberpunk: 'System'
  }
};

const darkTheme: Theme = {
  mode: 'dark',
  colors: {
    background: '#0f172a',
    surface: '#1e293b',
    primary: '#60a5fa',
    secondary: '#94a3b8',
    accent: '#a78bfa',
    text: '#f1f5f9',
    textSecondary: '#94a3b8',
    border: '#334155',
    success: '#34d399',
    warning: '#fbbf24',
    error: '#f87171',
    info: '#60a5fa',
    purple: '#a78bfa',
    white: '#ffffff',
    dark: '#0f172a'
  },
  fonts: {
    primary: 'System',
    secondary: 'System',
    cyberpunk: 'System'
  }
};

const cyberpunkTheme: Theme = {
  mode: 'cyberpunk',
  colors: {
    background: '#000000',
    surface: '#111111',
    primary: '#00ffd2', // Cyan
    secondary: '#f8ef02', // Yellow
    accent: '#ff003c', // Red
    text: '#00ffd2', // Cyan text
    textSecondary: '#f8ef02', // Yellow text
    border: '#00ffd2', // Cyan borders
    success: '#446d44', // Green
    warning: '#f8ef02', // Yellow
    error: '#ff003c', // Red
    info: '#136377', // Blue
    purple: '#800080', // Purple
    white: '#ffffff',
    dark: '#000000'
  },
  fonts: {
    primary: 'BlenderProBook',
    secondary: 'Oxanium',
    cyberpunk: 'Cyberpunk'
  }
};

interface ThemeContextType {
  themeMode: ThemeMode;
  theme: Theme;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [themeMode, setThemeMode] = useState<ThemeMode>('light');
  const [isLoading, setIsLoading] = useState(true);

  const getTheme = (mode: ThemeMode): Theme => {
    switch (mode) {
      case 'dark':
        return darkTheme;
      case 'cyberpunk':
        return cyberpunkTheme;
      default:
        return lightTheme;
    }
  };

  const theme = getTheme(themeMode);

  const setTheme = async (mode: ThemeMode) => {
    try {
      setThemeMode(mode);
      await AsyncStorage.setItem('theme_mode', mode);
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  const toggleTheme = () => {
    const nextTheme: ThemeMode = 
      themeMode === 'light' ? 'dark' : 
      themeMode === 'dark' ? 'cyberpunk' : 'light';
    setTheme(nextTheme);
  };

  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('theme_mode');
        if (savedTheme && ['light', 'dark', 'cyberpunk'].includes(savedTheme)) {
          setThemeMode(savedTheme as ThemeMode);
        }
      } catch (error) {
        console.error('Error loading theme:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadTheme();
  }, []);

  if (isLoading) {
    return null; // Or a loading spinner
  }

  return (
    <ThemeContext.Provider value={{ themeMode, theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

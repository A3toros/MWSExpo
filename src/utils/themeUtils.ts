import { ThemeMode, ThemeColors } from '../contexts/ThemeContext';

export const getThemeClasses = (themeMode: ThemeMode) => {
  switch (themeMode) {
    case 'dark':
      return {
        background: 'bg-slate-900',
        surface: 'bg-slate-800',
        text: 'text-slate-100',
        textSecondary: 'text-slate-300',
        border: 'border-slate-700',
        primary: 'bg-blue-500',
        secondary: 'bg-slate-600',
        success: 'bg-green-500',
        warning: 'bg-yellow-500',
        error: 'bg-red-500',
        info: 'bg-blue-500'
      };
    case 'cyberpunk':
      return {
        background: 'bg-black',
        surface: 'bg-gray-900',
        text: 'text-cyan-400',
        textSecondary: 'text-yellow-400',
        border: 'border-cyan-400',
        primary: 'bg-black border-2 border-cyan-400',
        secondary: 'bg-black border-2 border-yellow-400',
        success: 'bg-black border-2 border-green-400',
        warning: 'bg-black border-2 border-yellow-400',
        error: 'bg-black border-2 border-red-400',
        info: 'bg-black border-2 border-blue-400'
      };
    default: // light
      return {
        background: 'bg-white',
        surface: 'bg-gray-50',
        text: 'text-gray-900',
        textSecondary: 'text-gray-600',
        border: 'border-gray-200',
        primary: 'bg-blue-500',
        secondary: 'bg-gray-500',
        success: 'bg-green-500',
        warning: 'bg-yellow-500',
        error: 'bg-red-500',
        info: 'bg-blue-500'
      };
  }
};

export const getCyberpunkClasses = () => {
  return {
    // Cyberpunk button styles
    button: {
      primary: 'bg-black border-2 border-cyan-400',
      secondary: 'bg-black border-2 border-yellow-400',
      danger: 'bg-black border-2 border-red-400',
      success: 'bg-black border-2 border-green-400'
    },
    // Cyberpunk text styles
    text: {
      primary: 'text-cyan-400 font-bold tracking-wider',
      secondary: 'text-yellow-400 font-bold tracking-wider',
      accent: 'text-red-400 font-bold tracking-wider',
      cyberpunk: 'text-yellow-400 font-bold tracking-wider uppercase'
    },
    // Cyberpunk container styles
    container: {
      card: 'bg-black border-2 border-cyan-400 rounded-xl',
      surface: 'bg-gray-900 border border-cyan-400',
      modal: 'bg-black border-2 border-cyan-400 rounded-xl'
    },
    // Cyberpunk input styles
    input: {
      base: 'bg-black border-2 border-cyan-400 text-cyan-400 placeholder-cyan-400/50',
      focus: 'border-yellow-400'
    },
    // Cyberpunk navigation styles
    navigation: {
      back: 'bg-black border-2 border-cyan-400 rounded-full',
      save: 'bg-black border-2 border-yellow-400'
    }
  };
};

export const getModalStyles = (themeMode: ThemeMode) => {
  switch (themeMode) {
    case 'cyberpunk':
      return {
        overlay: 'bg-black/80',
        container: 'bg-black border-2 border-cyan-400 rounded-xl',
        title: 'text-yellow-400 font-bold tracking-wider',
        text: 'text-cyan-400',
        button: 'bg-black border-2 border-cyan-400',
        buttonText: 'text-yellow-400 font-bold',
        closeButton: 'bg-red-500 border-2 border-red-400'
      };
    case 'dark':
      return {
        overlay: 'bg-black/50',
        container: 'bg-gray-800 border border-gray-600 rounded-xl',
        title: 'text-white font-bold',
        text: 'text-gray-300',
        button: 'bg-gray-700 border border-gray-500',
        buttonText: 'text-white font-bold',
        closeButton: 'bg-red-600'
      };
    default:
      return {
        overlay: 'bg-black/50',
        container: 'bg-white border border-gray-200 rounded-xl',
        title: 'text-gray-900 font-bold',
        text: 'text-gray-600',
        button: 'bg-blue-500',
        buttonText: 'text-white font-bold',
        closeButton: 'bg-red-500'
      };
  }
};

export const getFontFamily = (themeMode: ThemeMode, fontType: 'primary' | 'secondary' | 'cyberpunk' = 'primary') => {
  if (themeMode === 'cyberpunk') {
    switch (fontType) {
      case 'primary': return 'BlenderProBook';
      case 'secondary': return 'Oxanium';
      case 'cyberpunk': return 'Cyberpunk';
      default: return 'BlenderProBook';
    }
  }
  return 'System';
};

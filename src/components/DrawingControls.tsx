/** @jsxImportSource nativewind */
import React from 'react';
import { View, TouchableOpacity, Text as RNText, Image } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';

interface DrawingControlsProps {
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFullscreenRequest?: () => void;
  canUndo: boolean;
  canRedo: boolean;
  zoomLevel: number;
}

export default function DrawingControls({
  onUndo,
  onRedo,
  onReset,
  onZoomIn,
  onZoomOut,
  onFullscreenRequest,
  canUndo,
  canRedo,
  zoomLevel
}: DrawingControlsProps) {
  const { themeMode } = useTheme();
  return (
    <View className={`flex-row items-center p-1 gap-1 ${
      themeMode === 'cyberpunk' 
        ? 'bg-black border-b border-cyan-400' 
        : themeMode === 'dark' 
        ? 'bg-gray-800 border-b border-gray-600' 
        : 'bg-gray-50 border-b border-gray-300'
    }`}>
      <TouchableOpacity 
        className={`p-1 rounded ${
          themeMode === 'cyberpunk' 
            ? 'border border-cyan-400' 
            : themeMode === 'dark' 
            ? 'bg-gray-700 border border-gray-600' 
            : 'bg-white border border-gray-300'
        } ${!canUndo ? 'opacity-50' : ''}`}
        style={themeMode === 'cyberpunk' ? { backgroundColor: '#f8ef02' } : {}}
        onPress={onUndo}
        disabled={!canUndo}
      >
        <Image source={require('../../assets/images/canvas/undo.png')} className="w-4 h-4" />
      </TouchableOpacity>
      
      <TouchableOpacity 
        className={`p-1 rounded ${
          themeMode === 'cyberpunk' 
            ? 'border border-cyan-400' 
            : themeMode === 'dark' 
            ? 'bg-gray-700 border border-gray-600' 
            : 'bg-white border border-gray-300'
        } ${!canRedo ? 'opacity-50' : ''}`}
        style={themeMode === 'cyberpunk' ? { backgroundColor: '#f8ef02' } : {}}
        onPress={onRedo}
        disabled={!canRedo}
      >
        <Image source={require('../../assets/images/canvas/redo.png')} className="w-4 h-4" />
      </TouchableOpacity>
      
      <TouchableOpacity 
        className={`p-1 rounded ${
          themeMode === 'cyberpunk' 
            ? 'border border-cyan-400' 
            : themeMode === 'dark' 
            ? 'bg-gray-700 border border-gray-600' 
            : 'bg-white border border-gray-300'
        }`}
        style={themeMode === 'cyberpunk' ? { backgroundColor: '#f8ef02' } : {}}
        onPress={onReset}
      >
        <Image source={require('../../assets/images/canvas/reset.png')} className="w-4 h-4" />
      </TouchableOpacity>
      
      <View className={`w-px h-4 mx-1 ${
        themeMode === 'cyberpunk' 
          ? 'bg-cyan-400' 
          : themeMode === 'dark' 
          ? 'bg-gray-600' 
          : 'bg-gray-300'
      }`} />
      
      <TouchableOpacity 
        className={`p-1 rounded ${
          themeMode === 'cyberpunk' 
            ? 'border border-cyan-400' 
            : themeMode === 'dark' 
            ? 'bg-gray-700 border border-gray-600' 
            : 'bg-white border border-gray-300'
        } ${zoomLevel >= 5 ? 'opacity-50' : ''}`}
        style={themeMode === 'cyberpunk' ? { backgroundColor: '#f8ef02' } : {}}
        onPress={onZoomIn}
        disabled={zoomLevel >= 5}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Image source={require('../../assets/images/canvas/zoom-in.png')} className="w-4 h-4" />
      </TouchableOpacity>
      
      <TouchableOpacity 
        className={`p-1 rounded ${
          themeMode === 'cyberpunk' 
            ? 'border border-cyan-400' 
            : themeMode === 'dark' 
            ? 'bg-gray-700 border border-gray-600' 
            : 'bg-white border border-gray-300'
        } ${zoomLevel <= 0.1 ? 'opacity-50' : ''}`}
        style={themeMode === 'cyberpunk' ? { backgroundColor: '#f8ef02' } : {}}
        onPress={onZoomOut}
        disabled={zoomLevel <= 0.1}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Image source={require('../../assets/images/canvas/zoom-out.png')} className="w-4 h-4" />
      </TouchableOpacity>
      
      {onFullscreenRequest && (
        <TouchableOpacity 
          className={`p-1 rounded ${
            themeMode === 'cyberpunk' 
              ? 'border border-cyan-400' 
              : themeMode === 'dark' 
              ? 'bg-gray-700 border border-gray-600' 
              : 'bg-white border border-gray-300'
          }`}
          style={themeMode === 'cyberpunk' ? { backgroundColor: '#f8ef02' } : {}}
          onPress={onFullscreenRequest}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialCommunityIcons 
            name="fullscreen" 
            size={16} 
            color={themeMode === 'cyberpunk' ? '#000000' : themeMode === 'dark' ? '#e2e8f0' : '#374151'} 
          />
        </TouchableOpacity>
      )}
      
      <RNText className={`text-xs ml-2 ${
        themeMode === 'cyberpunk' 
          ? 'text-cyan-400' 
          : themeMode === 'dark' 
          ? 'text-gray-300' 
          : 'text-gray-600'
      }`}>Zoom: {Math.round(zoomLevel * 100)}%</RNText>
    </View>
  );
}
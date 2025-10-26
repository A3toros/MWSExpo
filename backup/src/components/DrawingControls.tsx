import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text as RNText, Image } from 'react-native';

interface DrawingControlsProps {
  onUndo: () => void;
  onRedo: () => void;
  onReset: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
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
  canUndo,
  canRedo,
  zoomLevel
}: DrawingControlsProps) {
  return (
    <View style={styles.controlsContainer}>
      <TouchableOpacity 
        style={[styles.controlButton, !canUndo && styles.controlButtonDisabled]} 
        onPress={onUndo}
        disabled={!canUndo}
      >
        <Image source={require('../../assets/images/canvas/undo.png')} style={styles.icon} />
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.controlButton, !canRedo && styles.controlButtonDisabled]} 
        onPress={onRedo}
        disabled={!canRedo}
      >
        <Image source={require('../../assets/images/canvas/redo.png')} style={styles.icon} />
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.controlButton} onPress={onReset}>
        <Image source={require('../../assets/images/canvas/reset.png')} style={styles.icon} />
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.controlButton, zoomLevel >= 5 && styles.controlButtonDisabled]} 
        onPress={onZoomIn}
        disabled={zoomLevel >= 5}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Image source={require('../../assets/images/canvas/zoom-in.png')} style={styles.icon} />
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={[styles.controlButton, zoomLevel <= 0.1 && styles.controlButtonDisabled]} 
        onPress={onZoomOut}
        disabled={zoomLevel <= 0.1}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Image source={require('../../assets/images/canvas/zoom-out.png')} style={styles.icon} />
      </TouchableOpacity>
      
      <RNText style={styles.zoomText}>Zoom: {Math.round(zoomLevel * 100)}%</RNText>
    </View>
  );
}

const styles = StyleSheet.create({
  controlsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 8,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    gap: 8,
  },
  controlButton: {
    backgroundColor: 'transparent',
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderRadius: 4,
    minWidth: 30,
    alignItems: 'center',
  },
  controlButtonDisabled: {
    backgroundColor: 'transparent',
    opacity: 0.5,
  },
  controlButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  icon: {
    width: 18,
    height: 18,
    resizeMode: 'contain',
  },
  zoomText: {
    fontSize: 12,
    color: '#495057',
    alignSelf: 'center',
    marginLeft: 8,
  },
});

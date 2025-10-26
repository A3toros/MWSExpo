import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';

interface AudioPlayerProps {
  uri: string;
  onPlaybackComplete?: () => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  showWaveform?: boolean;
}

export default function AudioPlayer({
  uri,
  onPlaybackComplete,
  onError,
  disabled = false,
  showWaveform = false,
}: AudioPlayerProps) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const loadAudio = async () => {
    try {
      setIsLoading(true);
      
      // Unload previous sound if exists
      if (sound) {
        await sound.unloadAsync();
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: false },
        (status) => {
          if (status.isLoaded) {
            setDuration(status.durationMillis || 0);
            setIsLoaded(true);
            setIsLoading(false);
          }
        }
      );

      setSound(newSound);

      // Set up status update listener
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          setPosition(status.positionMillis || 0);
          if (status.didJustFinish) {
            setIsPlaying(false);
            setPosition(0);
            onPlaybackComplete?.();
          }
        }
      });

    } catch (error) {
      console.error('Failed to load audio:', error);
      setIsLoading(false);
      onError?.('Failed to load audio file');
    }
  };

  const playAudio = async () => {
    if (!sound || !isLoaded) {
      await loadAudio();
      return;
    }

    try {
      await sound.playAsync();
      setIsPlaying(true);
      
      // Start position update interval
      intervalRef.current = setInterval(() => {
        sound.getStatusAsync().then((status) => {
          if (status.isLoaded) {
            setPosition(status.positionMillis || 0);
          }
        });
      }, 100);

    } catch (error) {
      console.error('Failed to play audio:', error);
      onError?.('Failed to play audio');
    }
  };

  const pauseAudio = async () => {
    if (!sound) return;

    try {
      await sound.pauseAsync();
      setIsPlaying(false);
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    } catch (error) {
      console.error('Failed to pause audio:', error);
    }
  };

  const stopAudio = async () => {
    if (!sound) return;

    try {
      await sound.stopAsync();
      setIsPlaying(false);
      setPosition(0);
      
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    } catch (error) {
      console.error('Failed to stop audio:', error);
    }
  };

  const seekTo = async (positionMillis: number) => {
    if (!sound || !isLoaded) return;

    try {
      await sound.setPositionAsync(positionMillis);
      setPosition(positionMillis);
    } catch (error) {
      console.error('Failed to seek audio:', error);
    }
  };

  const formatTime = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgressPercentage = () => {
    if (duration === 0) return 0;
    return (position / duration) * 100;
  };

  const handleSeek = (event: any) => {
    if (!sound || !isLoaded) return;
    
    const { locationX } = event.nativeEvent;
    const { width } = event.currentTarget.getBoundingClientRect();
    const percentage = locationX / width;
    const newPosition = percentage * duration;
    seekTo(newPosition);
  };

  return (
    <View style={styles.container}>
      <View style={styles.timeInfo}>
        <Text style={styles.timeText}>
          {formatTime(position)} / {formatTime(duration)}
        </Text>
      </View>

      {showWaveform && (
        <View style={styles.waveformContainer}>
          <View style={styles.waveform}>
            {/* Simple waveform visualization */}
            {Array.from({ length: 50 }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.waveformBar,
                  {
                    height: Math.random() * 20 + 5,
                    backgroundColor: i < (getProgressPercentage() / 2) ? '#3b82f6' : '#e5e7eb',
                  },
                ]}
              />
            ))}
          </View>
        </View>
      )}

      <View style={styles.progressContainer}>
        <View style={styles.progressBar} onTouchEnd={handleSeek}>
          <View 
            style={[
              styles.progressFill, 
              { width: `${getProgressPercentage()}%` }
            ]} 
          />
        </View>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.controlButton, disabled && styles.controlButtonDisabled]}
          onPress={stopAudio}
          disabled={disabled || !isLoaded}
        >
          <Ionicons name="stop" size={24} color={disabled ? '#9ca3af' : '#6b7280'} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.playButton, disabled && styles.playButtonDisabled]}
          onPress={isPlaying ? pauseAudio : playAudio}
          disabled={disabled || isLoading || !isLoaded}
        >
          {isLoading ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <Ionicons 
              name={isPlaying ? "pause" : "play"} 
              size={32} 
              color="white" 
            />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, disabled && styles.controlButtonDisabled]}
          onPress={() => seekTo(0)}
          disabled={disabled || !isLoaded}
        >
          <Ionicons name="refresh" size={24} color={disabled ? '#9ca3af' : '#6b7280'} />
        </TouchableOpacity>
      </View>

      {!isLoaded && !isLoading && (
        <TouchableOpacity
          style={styles.loadButton}
          onPress={loadAudio}
          disabled={disabled}
        >
          <Text style={styles.loadButtonText}>Load Audio</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: 20,
  },
  timeInfo: {
    marginBottom: 16,
  },
  timeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  waveformContainer: {
    width: '100%',
    marginBottom: 16,
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    gap: 2,
  },
  waveformBar: {
    width: 3,
    borderRadius: 1.5,
  },
  progressContainer: {
    width: '100%',
    marginBottom: 20,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 4,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  controlButton: {
    padding: 12,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
  },
  controlButtonDisabled: {
    backgroundColor: '#f9fafb',
  },
  playButton: {
    backgroundColor: '#3b82f6',
    padding: 16,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
    height: 60,
  },
  playButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  loadButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  loadButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

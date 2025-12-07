import { Audio } from 'expo-av';

// Recording options for consistent audio quality
const RECORDING_OPTIONS = {
  android: {
    extension: '.m4a',
    outputFormat: 2,
    audioEncoder: 3,
  },
  ios: {
    extension: '.m4a',
    outputFormat: 'aac',
    audioQuality: 0x7f,
    sampleRate: 44100,
    numberOfChannels: 1,
    bitRate: 128000,
  },
  web: {
    mimeType: 'audio/mp4',
  },
};

/**
 * Global Recording Manager - Singleton pattern to ensure only one recording exists at a time
 * This prevents the "Only one Recording object can be prepared at a given time" error
 */
class RecordingManager {
  private static instance: RecordingManager;
  private currentRecording: Audio.Recording | null = null;
  private isPrepared: boolean = false;
  private isRecording: boolean = false;

  private constructor() {}

  static getInstance(): RecordingManager {
    if (!RecordingManager.instance) {
      RecordingManager.instance = new RecordingManager();
    }
    return RecordingManager.instance;
  }

  /**
   * Prepare a new recording instance
   * This will cleanup any existing recording first
   */
  async prepareRecording(): Promise<void> {
    console.log('🎤 Preparing recording...');
    
    // Cleanup any existing recording first
    await this.cleanup();
    
    // Create new recording instance
    this.currentRecording = new Audio.Recording();
    
    // Prepare with consistent options
    await this.currentRecording.prepareToRecordAsync(RECORDING_OPTIONS);
    this.isPrepared = true;
    
    console.log('🎤 Recording prepared successfully');
  }

  /**
   * Start recording
   * Must be called after prepareRecording()
   */
  async startRecording(): Promise<void> {
    if (!this.isPrepared || !this.currentRecording) {
      throw new Error('Recording not prepared. Call prepareRecording() first.');
    }

    console.log('🎤 Starting recording...');
    
    try {
      await this.currentRecording.startAsync();
      this.isRecording = true;
      console.log('🎤 Recording started successfully');
      
      // Verify recording is actually active
      const status = await this.currentRecording.getStatusAsync();
      console.log('🎤 Recording status after start:', status);
      
      if (!status.isRecording) {
        throw new Error('Recording failed to start - status shows not recording');
      }
      
    } catch (error) {
      console.error('🎤 Failed to start recording:', error);
      this.isRecording = false;
      throw error;
    }
  }

  /**
   * Stop recording and return the audio URI
   */
  async stopRecording(): Promise<{ uri: string; durationMillis: number | null }> {
    if (!this.currentRecording || !this.isRecording) {
      throw new Error('No active recording to stop');
    }

    console.log('🎤 Stopping recording...');
    
    try {
      // Check recording status before stopping
      const status = await this.currentRecording.getStatusAsync();
      console.log('🎤 Recording status before stop:', status);
      
      if (!status.isRecording) {
        console.warn('🎤 Recording was not active, but attempting to stop anyway');
      }
      
      await this.currentRecording.stopAndUnloadAsync();
      const uri = this.currentRecording.getURI();
      
      if (!uri) {
        throw new Error('Failed to get recording URI');
      }

      console.log('🎤 Recording stopped successfully, URI:', uri);
      console.log('🎤 Recording duration:', status.durationMillis, 'ms');
      
      // Validate that we have actual audio data
      if (status.durationMillis && status.durationMillis < 100) {
        console.warn('🎤 Warning: Recording duration is very short:', status.durationMillis, 'ms');
      }
      
      return { uri, durationMillis: status.durationMillis ?? null };
    } finally {
      // Always cleanup after stopping
      await this.cleanup();
    }
  }

  /**
   * Get current recording status
   */
  getStatus() {
    return {
      isPrepared: this.isPrepared,
      isRecording: this.isRecording,
      hasRecording: !!this.currentRecording,
    };
  }

  /**
   * Check if recording is actually capturing audio
   */
  async checkRecordingStatus(): Promise<any> {
    if (!this.currentRecording) {
      return null;
    }
    
    try {
      const status = await this.currentRecording.getStatusAsync();
      console.log('🎤 Current recording status:', status);
      return status;
    } catch (error) {
      console.error('🎤 Error checking recording status:', error);
      return null;
    }
  }

  /**
   * Cleanup current recording instance
   * This is safe to call multiple times
   */
  async cleanup(): Promise<void> {
    if (this.currentRecording) {
      try {
        console.log('🎤 Cleaning up recording...');
        await this.currentRecording.stopAndUnloadAsync();
      } catch (error) {
        // Ignore cleanup errors - recording might already be stopped
        console.log('🎤 Cleanup error (expected):', error);
      }
    }
    
    this.currentRecording = null;
    this.isPrepared = false;
    this.isRecording = false;
  }

  /**
   * Force cleanup - for emergency situations
   */
  async forceCleanup(): Promise<void> {
    console.log('🎤 Force cleanup...');
    this.currentRecording = null;
    this.isPrepared = false;
    this.isRecording = false;
  }
}

export default RecordingManager;

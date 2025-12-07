import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './apiClient';

const CHUNK_SIZE = 3 * 1024 * 1024; // 3MB base64 chunk size (matches web)
const MAX_BASE64_SIZE = 12 * 1024 * 1024; // ~12MB hard limit
const MAX_RETRIES = 3;
const RETRY_BACKOFF_MS = 1000;

export interface AIAnalysis {
  transcript: string;
  word_count: number;
  overall_score: number;
  grammar_score: number;
  vocabulary_score: number;
  pronunciation_score: number;
  fluency_score: number;
  content_score: number;
  grammar_mistakes: number;
  vocabulary_mistakes: number;
  feedback: string;
  improved_transcript: string;
  grammar_corrections: any[];
  vocabulary_corrections: any[];
  language_use_corrections: any[];
  pronunciation_corrections: any[];
  ai_feedback: any;
  keywords_found: string[];
  keywords_missing: string[];
  suggestions: string[];
}

export interface ProcessingProgress {
  step: 'uploading' | 'transcribing' | 'analyzing' | 'complete';
  progress: number;
}

export class AIProcessingService {
  /**
   * Convert audio file to base64 (like web app)
   */
  static async convertAudioToBase64(audioUri: string): Promise<string> {
    try {
      const response = await fetch(audioUri);
      const blob = await response.blob();
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result as string;
          // Remove data URL prefix if present
          const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Failed to convert audio to base64:', error);
      throw new Error('Failed to convert audio to base64');
    }
  }

  /**
   * Process audio with AI (like web app) with chunked transcription and better errors
   */
  static async processAudioWithAI(
    audioBase64: string,
    testId: string,
    questionId: string = '1',
    audioMimeType: string = 'audio/m4a',
    audioHash?: string,
    retryCount: number = 0
  ): Promise<AIAnalysis> {
    try {
      console.log('🎤 Processing audio with AI (two-stage: transcribe -> analyze)...', { testId, questionId, audioSize: audioBase64.length, retryCount });

      if (audioBase64.length > MAX_BASE64_SIZE) {
        throw new Error('Audio file is too large. Please record a shorter audio clip.');
      }

      // Stage 1: Transcription (chunked like web)
      const transcript = await this.transcribeAudio(audioBase64, audioMimeType, testId, questionId, audioHash);
      if (!transcript.trim()) {
        throw new Error('Your speech was not recognized, please speak louder and try again.');
      }

      // Stage 2: Analysis using transcript (matches web flow)
      const analyzeResp = await this.requestWithRetry(
        '/.netlify/functions/analyze-speaking-transcript',
        {
          transcript,
          test_id: testId,
          question_id: questionId,
        },
        45000,
      );

      const analyzeData = analyzeResp?.data;
      if (!analyzeData?.success) {
        const msg = analyzeData?.error || analyzeData?.message || 'Analysis failed. Please try again.';
        throw new Error(msg);
      }

      const aiResponse = analyzeData;
      const analysis: AIAnalysis = {
        transcript,
        word_count: aiResponse.word_count || 0,
        overall_score: aiResponse.overall_score || 0,
        grammar_score: aiResponse.grammar_score || 0,
        vocabulary_score: aiResponse.vocabulary_score || 0,
        pronunciation_score: aiResponse.pronunciation_score || 0, // may be missing, default 0
        fluency_score: aiResponse.fluency_score || 0,
        content_score: aiResponse.content_score || 0,
        grammar_mistakes: aiResponse.grammar_mistakes || 0,
        vocabulary_mistakes: aiResponse.vocabulary_mistakes || 0,
        feedback: aiResponse.feedback || '',
        improved_transcript: aiResponse.improved_transcript || '',
        grammar_corrections: aiResponse.grammar_corrections || [],
        vocabulary_corrections: aiResponse.vocabulary_corrections || [],
        language_use_corrections: aiResponse.language_use_corrections || [],
        pronunciation_corrections: aiResponse.pronunciation_corrections || [],
        ai_feedback: aiResponse.ai_feedback || null,
        keywords_found: aiResponse.keywords_found || [],
        keywords_missing: aiResponse.keywords_missing || [],
        suggestions: aiResponse.suggestions || [],
      };

      console.log('🎤 Mapped AI analysis (two-stage):', analysis);
      return analysis;
    } catch (error: any) {
      console.error('Failed to process audio with AI:', error);
      const status = error?.response?.status;
      if (status >= 500) {
        throw new Error('AI service is temporarily unavailable. Please try again.');
      }
      if (error.code === 'ECONNABORTED') {
        throw new Error('Request timed out. Please check your connection and try again.');
      }
      if (error.request) {
        throw new Error('No response from server. Please check your internet connection.');
      }
      throw new Error(error?.message || 'Failed to process audio');
    }
  }

  /**
   * Submit final results (like web app)
   */
  static async submitFinalResults(data: {
    test_id: string;
    test_name: string;
    teacher_id?: string;
    subject_id?: string;
    student_id: string;
    question_id: string;
    audio_blob: string | null;
    transcript: string;
    scores: any;
    audio_duration: number;
    time_taken: number;
    caught_cheating: boolean;
    visibility_change_times: number;
    retest_assignment_id?: number | null;
    parent_test_id: string;
    academic_period_id?: number;
  }): Promise<any> {
    try {
      console.log('🎤 Submitting final results...', data);
      console.log('🎤 ===== BACKEND REQUEST DEBUG =====');
      console.log('🎤 Request URL:', '/.netlify/functions/submit-speaking-test-final');
      console.log('🎤 Request method: POST');
      console.log('🎤 Payload size:', JSON.stringify(data).length, 'characters');
      console.log('🎤 Audio blob present:', !!data.audio_blob);
      console.log('🎤 Audio blob size:', data.audio_blob?.length || 0, 'characters');
      console.log('🎤 Academic period ID:', data.academic_period_id, 'type:', typeof data.academic_period_id);
      console.log('🎤 Question ID:', data.question_id, 'type:', typeof data.question_id);
      console.log('🎤 Retest assignment ID:', data.retest_assignment_id, 'type:', typeof data.retest_assignment_id);
      console.log('🎤 ===== END BACKEND REQUEST DEBUG =====');
      
      const response = await api.post('/.netlify/functions/submit-speaking-test-final', data);

      if (!response.data.success) {
        throw new Error(response.data.error || 'Final submission failed');
      }

      console.log('🎤 Final submission successful:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('Failed to submit final results:', error);
      console.error('Backend response:', error.response?.data);
      console.error('Backend status:', error.response?.status);
      console.error('Backend headers:', error.response?.headers);
      throw new Error('Failed to submit final results');
    }
  }

  /**
   * Complete AI processing workflow (like web app)
   */
  static async processCompleteWorkflow(
    audioUri: string,
    testId: string,
    testName: string,
    questionId: string = '1',
    studentId: string,
    onProgress?: (progress: ProcessingProgress) => void
  ): Promise<AIAnalysis> {
    try {
      // Step 1: Convert audio to base64
      onProgress?.({ step: 'uploading', progress: 20 });
      console.log('🎤 Converting audio to base64...');
      const audioBase64 = await this.convertAudioToBase64(audioUri);
      console.log('🎤 Audio converted, size:', audioBase64.length);
    const audioMimeType = this.getMimeFromUri(audioUri);
    const audioHash = this.generateAudioHash(audioBase64);

      // Step 2: Process with AI
      onProgress?.({ step: 'transcribing', progress: 50 });
      console.log('🎤 Processing with AI...');
    const analysis = await this.processAudioWithAI(audioBase64, testId, questionId, audioMimeType, audioHash);
      console.log('🎤 AI processing complete:', analysis);

      // Clear cached failed payload on success
      await this.clearFailedPayload(studentId, testId, questionId);

      // Step 3: Complete
      onProgress?.({ step: 'complete', progress: 100 });
      
      return analysis;
    } catch (error) {
      console.error('Complete workflow error:', error);
      // Cache payload for retry (parity with web keeping last attempt)
      try {
        await this.cacheFailedPayload(studentId, testId, questionId, {
          audio_base64: await this.safeConvertToBase64(audioUri),
          audio_mime_type: this.getMimeFromUri(audioUri),
          test_id: testId,
          question_id: questionId,
          audio_hash: this.generateAudioHash(await this.safeConvertToBase64(audioUri)),
        });
      } catch (cacheErr) {
        console.error('Failed to cache failed payload:', cacheErr);
      }
      throw error;
    }
  }

  /**
   * Derive mime type from uri
   */
  private static getMimeFromUri(uri: string | null): string {
    if (!uri) return 'audio/m4a';
    const lower = uri.toLowerCase();
    if (lower.endsWith('.wav')) return 'audio/wav';
    if (lower.endsWith('.mp3')) return 'audio/mpeg';
    if (lower.endsWith('.m4a')) return 'audio/m4a';
    if (lower.endsWith('.aac')) return 'audio/aac';
    return 'audio/m4a';
  }

  /**
   * Save failed payload for retry/debug (web parity)
   */
  private static async cacheFailedPayload(
    studentId: string,
    testId: string,
    questionId: string,
    payload: any
  ) {
    const key = this.getFailedPayloadKey(studentId, testId, questionId);
    const value = JSON.stringify({ payload, timestamp: Date.now() });
    await AsyncStorage.setItem(key, value);
  }

  private static async clearFailedPayload(
    studentId: string,
    testId: string,
    questionId: string
  ) {
    const key = this.getFailedPayloadKey(studentId, testId, questionId);
    await AsyncStorage.removeItem(key);
  }

  private static getFailedPayloadKey(studentId: string, testId: string, questionId: string) {
    return `speaking_failed_payload_${studentId || 'unknown'}_${testId}_${questionId}`;
  }

  /**
   * Lightweight audio hash (first 1000 chars) for backend caching parity with web
   */
  private static generateAudioHash(base64Audio: string | null): string {
    if (!base64Audio) return '';
    const sample = base64Audio.slice(0, 1000);
    let hash = 0;
    for (let i = 0; i < sample.length; i++) {
      const char = sample.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0; // to 32-bit
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Transcribe audio with chunked upload, mirroring web app behavior
   */
  private static async transcribeAudio(
    audioBase64: string,
    audioMimeType: string,
    testId: string,
    questionId: string,
    audioHash?: string
  ): Promise<string> {
    const single = async (useDataUrl: boolean) => {
      const body = {
        test_id: testId,
        question_id: questionId,
        audio_blob: useDataUrl ? `data:${audioMimeType};base64,${audioBase64}` : audioBase64,
        audio_mime_type: audioMimeType,
        audio_hash: audioHash,
      };
      const resp = await this.requestWithRetry('/.netlify/functions/transcribe-speaking-audio', body, 60000);
      const data = resp?.data;
      if (!data?.success) {
        const msg = data?.error || data?.message || 'Transcription failed. Please speak louder and try again.';
        throw new Error(msg);
      }
      return data.transcript as string;
    };

    if (audioBase64.length <= CHUNK_SIZE) {
      try {
        return await single(false);
      } catch (err: any) {
        console.error('🎤 Transcription failed (raw base64), retrying with data URL prefix', err?.response?.data || err?.message);
        return single(true);
      }
    }

    const chunks: string[] = [];
    for (let i = 0; i < audioBase64.length; i += CHUNK_SIZE) {
      chunks.push(audioBase64.slice(i, i + CHUNK_SIZE));
    }

    let responseData: any = null;
    for (let i = 0; i < chunks.length; i++) {
      const body = {
        test_id: testId,
        question_id: questionId,
        audio_blob: chunks[i],
        audio_mime_type: audioMimeType,
        chunk_index: i,
        total_chunks: chunks.length,
        is_chunked: true,
        audio_hash: audioHash,
      };
      const resp = await this.requestWithRetry('/.netlify/functions/transcribe-speaking-audio', body, 60000);
      responseData = resp?.data;
      if (i < chunks.length - 1) {
        if (!responseData?.success || !responseData?.chunk_received) {
          throw new Error(responseData?.error || responseData?.message || `Failed to upload chunk ${i + 1}`);
        }
      }
    }

    if (!responseData?.success) {
      const msg = responseData?.error || responseData?.message || 'Transcription failed. Please try again.';
      throw new Error(msg);
    }
    return responseData.transcript as string;
  }

  /**
   * Simple retry wrapper to mirror web makeRequestWithRetry behavior
   */
  private static async requestWithRetry(
    url: string,
    body: any,
    timeout: number = 60000,
    attempts: number = MAX_RETRIES
  ) {
    let lastError: any;
    for (let i = 0; i < attempts; i++) {
      try {
        return await api.post(url, body, {
          timeout,
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (err: any) {
        lastError = err;
        const status = err?.response?.status;
        const retriable = status >= 500 || err?.code === 'ECONNABORTED' || err?.request;
        if (i < attempts - 1 && retriable) {
          const backoff = RETRY_BACKOFF_MS * (i + 1);
          console.warn(`Request failed (attempt ${i + 1}/${attempts}), retrying in ${backoff}ms`, err?.response?.data || err?.message);
          await this.sleep(backoff);
          continue;
        }
        throw err;
      }
    }
    throw lastError;
  }

  private static sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Safe convert with guard for caching fallback
   */
  private static async safeConvertToBase64(audioUri: string): Promise<string> {
    try {
      return await this.convertAudioToBase64(audioUri);
    } catch {
      return '';
    }
  }

  /**
   * Load cached failed payload for resend/retry
   */
  static async getCachedFailedPayload(
    studentId: string,
    testId: string,
    questionId: string
  ): Promise<any | null> {
    const key = this.getFailedPayloadKey(studentId, testId, questionId);
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  /**
   * Retry processing using cached payload (web parity for resend)
   */
  static async retryCachedPayload(
    studentId: string,
    testId: string,
    questionId: string,
    onProgress?: (progress: ProcessingProgress) => void
  ): Promise<AIAnalysis> {
    const cached = await this.getCachedFailedPayload(studentId, testId, questionId);
    const payload = cached?.payload;
    if (!payload?.audio_base64) {
      throw new Error('No cached attempt available to resend. Please re-record.');
    }
    const audioBase64 = payload.audio_base64 as string;
    const audioMimeType = payload.audio_mime_type || 'audio/m4a';
    const audioHash = payload.audio_hash;

    onProgress?.({ step: 'uploading', progress: 20 });
    const analysis = await this.processAudioWithAI(
      audioBase64,
      testId,
      questionId,
      audioMimeType,
      audioHash
    );
    onProgress?.({ step: 'complete', progress: 100 });
    return analysis;
  }
}

export default AIProcessingService;

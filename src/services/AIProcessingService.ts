import { api } from './apiClient';

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
   * Process audio with AI (like web app)
   */
  static async processAudioWithAI(audioBase64: string, testId: string, questionId: string = '1', retryCount: number = 0): Promise<AIAnalysis> {
    try {
      console.log('🎤 Processing audio with AI...', { testId, questionId, audioSize: audioBase64.length, retryCount });
      
      const requestData = {
        test_id: testId,
        question_id: questionId,
        audio_blob: audioBase64,
      };
      
      console.log('🎤 Request data size:', JSON.stringify(requestData).length);
      console.log('🎤 Audio blob size:', audioBase64.length);
      console.log('🎤 Audio format: WebM with AAC (Android compatible)');
      console.log('🎤 Base URL:', api.defaults.baseURL);
      console.log('🎤 Full URL:', `${api.defaults.baseURL}/.netlify/functions/process-speaking-audio-ai`);
      
      // Check if audio blob is too large
      if (audioBase64.length > 10 * 1024 * 1024) { // 10MB limit
        throw new Error('Audio file is too large. Please record a shorter audio clip.');
      }
      
      const response = await api.post('/.netlify/functions/process-speaking-audio-ai', requestData, {
        timeout: 60000, // 60 second timeout
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      console.log('🎤 Response headers:', response.headers);

      console.log('🎤 AI Processing response status:', response.status);
      console.log('🎤 AI Processing response data:', response.data);

      if (!response.data || !response.data.success) {
        const errorMessage = response.data?.error || response.data?.message || 'AI processing failed';
        console.error('🎤 AI Processing failed:', errorMessage);
        throw new Error(errorMessage);
      }

      // Map the AI response to our interface
      const aiResponse = response.data;
      const analysis: AIAnalysis = {
        transcript: aiResponse.transcript || '',
        word_count: aiResponse.word_count || 0,
        overall_score: aiResponse.overall_score || 0,
        grammar_score: aiResponse.grammar_score || 0,
        vocabulary_score: aiResponse.vocabulary_score || 0,
        pronunciation_score: aiResponse.pronunciation_score || 0,
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

      console.log('🎤 Mapped AI analysis:', analysis);
      return analysis;
    } catch (error: any) {
      console.error('Failed to process audio with AI:', error);
      
      if (error.response) {
        // Server responded with error status
        console.error('🎤 Server error response:', error.response.status, error.response.data);
        throw new Error(`Server error: ${error.response.status} - ${error.response.data?.message || 'Unknown server error'}`);
      } else if (error.request) {
        // Request was made but no response received
        console.error('🎤 No response received:', error.request);
        throw new Error('No response from server. Please check your internet connection.');
      } else {
        // Something else happened
        console.error('🎤 Request setup error:', error.message);
        throw new Error(`Request failed: ${error.message}`);
      }
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

      // Step 2: Process with AI
      onProgress?.({ step: 'transcribing', progress: 50 });
      console.log('🎤 Processing with AI...');
      const analysis = await this.processAudioWithAI(audioBase64, testId, questionId);
      console.log('🎤 AI processing complete:', analysis);

      // Step 3: Complete
      onProgress?.({ step: 'complete', progress: 100 });
      
      return analysis;
    } catch (error) {
      console.error('Complete workflow error:', error);
      throw error;
    }
  }

}

export default AIProcessingService;



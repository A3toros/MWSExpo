export type QuestionType =
  | 'true_false'
  | 'multiple_choice'
  | 'input'
  | 'matching'
  | 'word_matching'
  | 'speaking'
  | 'drawing'
  | 'fill_blanks';

export interface TestQuestion {
  id: number | string;
  question_text: string;
  question_type: QuestionType;
  options?: string[];
  correct_answer?: string;
  correct_answers?: string[];
}

export type AnswerValue = string | number | boolean | string[] | Record<string, any> | any[] | null;

export type AnswerMap = Record<string, AnswerValue>;

export interface SubmitTestPayload {
  test_id: number | string;
  type: string;
  answers: AnswerMap;
  time_taken: number; // seconds
}

export interface SubmitResponse {
  success: boolean;
  score?: number;
  message?: string;
}

export interface TestResult {
  id: string;
  test_id: string;
  test_name: string;
  subject: string;
  test_type: string;
  percentage: number;
  passed: boolean;
  submitted_at: string;
  teacher_name?: string;
  retest_score?: number;
}

export interface StudentResult extends TestResult {
  student_id: string;
  student_name: string;
}

export interface Test {
  id: string;
  test_id: string;
  test_name: string;
  test_type: QuestionType;
  subject: string;
  teacher_name: string;
  num_questions: number;
  created_at: string;
  updated_at: string;
  questions?: TestQuestion[];
  due_date?: string;
  is_active?: boolean;
  teacher_id?: string;
  subject_id?: string;
  title?: string;
  points?: number;
  total_points?: number;
}



export type ExamTestType =
  | 'drawing'
  | 'multiple_choice'
  | 'true_false'
  | 'input'
  | 'fill_blanks'
  | 'matching_type'
  | 'matching'
  | 'word_matching'
  | 'speaking';

export const examTestRouteMap: Record<string, (id: number | string) => string> = {
  drawing: (id) => `/tests/drawing/${id}`,
  multiple_choice: (id) => `/tests/multiple-choice/${id}`,
  true_false: (id) => `/tests/true-false/${id}`,
  input: (id) => `/tests/input/${id}`,
  fill_blanks: (id) => `/tests/fill-blanks/${id}`,
  matching_type: (id) => `/tests/matching/${id}`,
  matching: (id) => `/tests/matching/${id}`,
  word_matching: (id) => `/tests/word-matching/${id}`,
  speaking: (id) => `/tests/speaking/${id}`,
};

export const buildExamTestRoute = (testType: string, id: number | string) => {
  const builder = examTestRouteMap[testType];
  if (!builder) return null;
  return builder(id);
};


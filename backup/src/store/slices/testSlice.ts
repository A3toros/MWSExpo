import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AnswerMap, AnswerValue } from '../../types';

type TestSessionState = {
  testId: string | number | null;
  type: string | null;
  answers: AnswerMap;
  startedAt: number | null;
  elapsedSeconds: number;
  currentIndex: number;
  questionOrder: Array<string | number>;
  lastPersistedAt: number | null;
};

const initialState: TestSessionState = {
  testId: null,
  type: null,
  answers: {},
  startedAt: null,
  elapsedSeconds: 0,
  currentIndex: 0,
  questionOrder: [],
  lastPersistedAt: null,
};

const testSlice = createSlice({
  name: 'testSession',
  initialState,
  reducers: {
    startTest(state, action: PayloadAction<{ testId: string | number; type: string; questionOrder?: Array<string | number> }>) {
      state.testId = action.payload.testId;
      state.type = action.payload.type;
      state.startedAt = Date.now();
      state.elapsedSeconds = 0;
      state.answers = {};
      state.currentIndex = 0;
      state.questionOrder = action.payload.questionOrder ?? [];
      state.lastPersistedAt = null;
    },
    setAnswer(state, action: PayloadAction<{ questionId: string | number; value: AnswerValue }>) {
      state.answers[String(action.payload.questionId)] = action.payload.value;
    },
    setIndex(state, action: PayloadAction<number>) {
      state.currentIndex = action.payload;
    },
    tickSecond(state) {
      state.elapsedSeconds += 1;
    },
    hydrateFromStorage(
      state,
      action: PayloadAction<{
        answers: AnswerMap;
        currentIndex: number;
        elapsedSeconds: number;
        startedAt?: number | null;
        questionOrder?: Array<string | number>;
        lastPersistedAt?: number | null;
      }>
    ) {
      state.answers = action.payload.answers ?? state.answers;
      state.currentIndex = action.payload.currentIndex ?? state.currentIndex;
      state.elapsedSeconds = action.payload.elapsedSeconds ?? state.elapsedSeconds;
      state.startedAt = action.payload.startedAt ?? state.startedAt;
      state.questionOrder = action.payload.questionOrder ?? state.questionOrder;
      state.lastPersistedAt = action.payload.lastPersistedAt ?? Date.now();
    },
    resetTest(state) {
      state.testId = null;
      state.type = null;
      state.answers = {};
      state.startedAt = null;
      state.elapsedSeconds = 0;
      state.currentIndex = 0;
      state.questionOrder = [];
      state.lastPersistedAt = null;
    },
  },
});

export const { startTest, setAnswer, setIndex, tickSecond, hydrateFromStorage, resetTest } = testSlice.actions;
export default testSlice.reducer;



import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type AuthUser = {
  student_id: string;
  name: string;
  surname: string;
  grade: string;
  class: string;
  role?: string;
};

type AuthState = {
  token: string | null;
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  initialized: boolean;
};

const initialState: AuthState = {
  token: null,
  user: null,
  loading: false,
  error: null,
  initialized: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    loginStart(state) {
      state.loading = true;
      state.error = null;
    },
    loginSuccess(state, action: PayloadAction<{ token: string; user: AuthUser }>) {
      state.loading = false;
      state.token = action.payload.token;
      state.user = action.payload.user;
    },
    loginFailure(state, action: PayloadAction<string>) {
      state.loading = false;
      state.error = action.payload;
    },
    logout(state) {
      state.token = null;
      state.user = null;
    },
    hydrateStart(state) {
      state.loading = true;
    },
    hydrateSuccess(state, action: PayloadAction<{ token: string | null; user: AuthUser | null }>) {
      state.loading = false;
      state.token = action.payload.token;
      state.user = action.payload.user;
      state.initialized = true;
    },
    hydrateFailure(state) {
      state.loading = false;
      state.initialized = true;
    },
  },
});

export const { loginStart, loginSuccess, loginFailure, logout, hydrateStart, hydrateSuccess, hydrateFailure } = authSlice.actions;
export default authSlice.reducer;



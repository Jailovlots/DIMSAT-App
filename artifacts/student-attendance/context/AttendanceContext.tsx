import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type Account = {
  studentId: string;
  fullName: string;
  password: string;
  yearLevel: string;
  program: string;
  sex: string;
  photoUri?: string;
  photoChanges: number;
  notifications: boolean;
  createdAt: string;
};

export type CertifiedStudent = Omit<Account, 'password' | 'photoUri' | 'photoChanges' | 'notifications' | 'createdAt'>;
export type Session = {
  id: string;
  label: string;
  date: string;
  time: string;
  status: 'Present' | 'Upcoming' | 'Missing';
  detail: string;
};

const STORAGE_KEY = '@attenda/local-state-v1';
export const MAX_PROFILE_PHOTO_CHANGES = 2;

export const CERTIFIED_STUDENTS: CertifiedStudent[] = [
  {
    studentId: 'AT-2026-0042',
    fullName: 'Maya Santos',
    yearLevel: '2nd Year',
    program: 'BA Communication',
    sex: 'Female',
  },
  {
    studentId: 'AT-2026-0118',
    fullName: 'Liam Navarro',
    yearLevel: '1st Year',
    program: 'BS Information Technology',
    sex: 'Male',
  },
];

export const ATTENDANCE_SESSIONS: Session[] = [
  { id: 's1', label: 'Opening Assembly', date: 'August 18, 2026', time: '8:00 AM', status: 'Present', detail: 'Checked in and registered' },
  { id: 's2', label: 'Campus Welcome', date: 'August 18, 2026', time: '10:30 AM', status: 'Present', detail: 'Checked in and registered' },
  { id: 's3', label: 'Student Life Forum', date: 'August 18, 2026', time: '1:30 PM', status: 'Present', detail: 'Checked in and registered' },
  { id: 's4', label: 'Organization Fair', date: 'August 19, 2026', time: '9:00 AM', status: 'Upcoming', detail: 'Session has not started' },
  { id: 's5', label: 'College Meet-up', date: 'August 19, 2026', time: '2:00 PM', status: 'Missing', detail: 'No attendance record' },
  { id: 's6', label: 'Closing Circle', date: 'August 20, 2026', time: '4:00 PM', status: 'Upcoming', detail: 'Session has not started' },
];

type StoredState = { accounts: Account[]; activeStudentId: string | null };
type ContextValue = {
  account: Account | null;
  isReady: boolean;
  sessions: Session[];
  register: (student: CertifiedStudent, password: string) => Promise<{ ok: boolean; error?: string }>;
  login: (studentId: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  updatePhoto: (uri: string) => Promise<{ ok: boolean; error?: string }>;
  setNotifications: (value: boolean) => Promise<void>;
};

const AttendanceContext = createContext<ContextValue | null>(null);

export function AttendanceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StoredState>({ accounts: [], activeStudentId: null });
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          try {
            setState(JSON.parse(raw) as StoredState);
          } catch {
            setState({ accounts: [], activeStudentId: null });
          }
        }
      })
      .finally(() => setIsReady(true));
  }, []);

  const persist = useCallback(async (next: StoredState) => {
    setState(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const register = useCallback(async (student: CertifiedStudent, password: string) => {
    const normalizedId = student.studentId.trim().toUpperCase();
    if (state.accounts.some((item) => item.studentId === normalizedId)) {
      return { ok: false, error: 'This Student ID is already registered.' };
    }
    const account: Account = {
      ...student,
      studentId: normalizedId,
      password,
      photoChanges: 0,
      notifications: true,
      createdAt: new Date().toISOString(),
    };
    await persist({ accounts: [...state.accounts, account], activeStudentId: account.studentId });
    return { ok: true };
  }, [persist, state.accounts]);

  const login = useCallback(async (studentId: string, password: string) => {
    const account = state.accounts.find((item) => item.studentId === studentId.trim().toUpperCase());
    if (!account || account.password !== password) {
      return { ok: false, error: 'Student ID or password is incorrect.' };
    }
    await persist({ ...state, activeStudentId: account.studentId });
    return { ok: true };
  }, [persist, state]);

  const logout = useCallback(async () => {
    await persist({ ...state, activeStudentId: null });
  }, [persist, state]);

  const updatePhoto = useCallback(async (uri: string) => {
    const current = state.accounts.find((item) => item.studentId === state.activeStudentId);
    if (!current) return { ok: false, error: 'Please sign in again.' };
    if (current.photoChanges >= MAX_PROFILE_PHOTO_CHANGES) {
      return { ok: false, error: 'Maximum profile photo changes reached. Please contact the Admin.' };
    }
    const nextAccount = { ...current, photoUri: uri, photoChanges: current.photoChanges + 1 };
    const accounts = state.accounts.map((item) => item.studentId === current.studentId ? nextAccount : item);
    await persist({ accounts, activeStudentId: current.studentId });
    return { ok: true };
  }, [persist, state]);

  const setNotifications = useCallback(async (value: boolean) => {
    if (!state.activeStudentId) return;
    const accounts = state.accounts.map((item) => item.studentId === state.activeStudentId ? { ...item, notifications: value } : item);
    await persist({ accounts, activeStudentId: state.activeStudentId });
  }, [persist, state]);

  const account = state.accounts.find((item) => item.studentId === state.activeStudentId) ?? null;
  const value = useMemo(() => ({
    account, isReady, sessions: ATTENDANCE_SESSIONS, register, login, logout, updatePhoto, setNotifications,
  }), [account, isReady, register, login, logout, updatePhoto, setNotifications]);

  return <AttendanceContext.Provider value={value}>{children}</AttendanceContext.Provider>;
}

export function useAttendance() {
  const context = useContext(AttendanceContext);
  if (!context) throw new Error('useAttendance must be used inside AttendanceProvider');
  return context;
}
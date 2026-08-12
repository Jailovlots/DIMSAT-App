import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { API_URL } from '@/constants/api';

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
  certifiedStudents: CertifiedStudent[];
  register: (student: CertifiedStudent, password: string) => Promise<{ ok: boolean; error?: string }>;
  login: (studentId: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  updatePhoto: (uri: string) => Promise<{ ok: boolean; error?: string }>;
  setNotifications: (value: boolean) => Promise<void>;
  lookupStudent: (studentId: string, fullName: string) => Promise<{ ok: boolean; student?: CertifiedStudent; error?: string }>;
};

const AttendanceContext = createContext<ContextValue | null>(null);

export function AttendanceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StoredState>({ accounts: [], activeStudentId: null });
  const [isReady, setIsReady] = useState(false);
  const [certifiedStudents, setCertifiedStudents] = useState<CertifiedStudent[]>([]);

  // Load local storage state
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

  // Fetch certified students from API on mount
  useEffect(() => {
    fetch(`${API_URL}/students?limit=500`)
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json() as Array<{ studentId: string; fullName: string; yearLevel: string; program: string; sex: string }> | { students?: Array<{ studentId: string; fullName: string; yearLevel: string; program: string; sex: string }> };
        // API returns flat array or wrapped object
        const list = Array.isArray(data) ? data : (data as { students?: typeof data }).students;
        if (Array.isArray(list)) {
          setCertifiedStudents(
            list.map((s) => ({
              studentId: s.studentId,
              fullName: s.fullName,
              yearLevel: s.yearLevel ?? '',
              program: s.program ?? '',
              sex: s.sex ?? '',
            })),
          );
        }
      })
      .catch(() => {
        // Silently ignore – offline or server not reachable
      });
  }, []);

  const persist = useCallback(async (next: StoredState) => {
    setState(next);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  /**
   * Lookup a student from the live certified list via API.
   * Calls the dedicated /auth/student/lookup endpoint (read-only, no side effects).
   * Falls back to locally cached certifiedStudents when offline.
   */
  const lookupStudent = useCallback(async (studentId: string, fullName: string) => {
    const normalizedId = studentId.trim().toUpperCase();
    try {
      const res = await fetch(`${API_URL}/auth/student/lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: normalizedId, fullName: fullName.trim() }),
      });
      const data = await res.json() as { error?: string; student?: CertifiedStudent };
      if (!res.ok) return { ok: false, error: data.error ?? 'Validation failed.' };
      if (data.student) return { ok: true, student: data.student as CertifiedStudent };
    } catch {
      // Server unreachable – fall through to offline cache
    }

    // Offline fallback – check cached certified students
    const found = certifiedStudents.find(
      (s) => s.studentId.toUpperCase() === normalizedId,
    );
    if (!found) return { ok: false, error: 'Student ID is not included in the certified student list. (Offline mode – check your connection)' };
    if (found.fullName.toLowerCase().trim() !== fullName.toLowerCase().trim()) {
      return { ok: false, error: `Full name does not match. Expected "${found.fullName}".` };
    }
    return { ok: true, student: found };
  }, [certifiedStudents]);

  /**
   * Register via API then cache locally.
   */
  const register = useCallback(async (student: CertifiedStudent, password: string) => {
    const normalizedId = student.studentId.trim().toUpperCase();

    // Check local duplicate first
    if (state.accounts.some((item) => item.studentId === normalizedId)) {
      return { ok: false, error: 'This Student ID is already registered.' };
    }

    try {
      const res = await fetch(`${API_URL}/auth/student/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: student.studentId,
          fullName: student.fullName,
          password,
        }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) return { ok: false, error: data.error ?? 'Registration failed.' };
    } catch {
      // If API unreachable allow offline registration
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
  }, [persist, state.accounts, certifiedStudents]);

  /**
   * Login – first validates via API, then falls back to local cache.
   */
  const login = useCallback(async (studentId: string, password: string) => {
    const normalizedId = studentId.trim().toUpperCase();

    // Try API login first
    try {
      const res = await fetch(`${API_URL}/auth/student/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: normalizedId, password }),
      });
      const data = await res.json() as { error?: string; student?: { studentId: string; fullName: string; yearLevel: string; program: string; sex: string; profilePhoto?: string; profileUploadCount?: number } };

      if (!res.ok) return { ok: false, error: data.error ?? 'Invalid credentials.' };

      // Sync/update local account from API response
      if (data.student) {
        const existingIdx = state.accounts.findIndex((a) => a.studentId === normalizedId);
        const updated: Account = existingIdx >= 0
          ? {
              ...state.accounts[existingIdx],
              fullName: data.student.fullName,
              yearLevel: data.student.yearLevel ?? '',
              program: data.student.program ?? '',
              sex: data.student.sex ?? '',
              photoUri: data.student.profilePhoto ?? state.accounts[existingIdx].photoUri,
              password,
            }
          : {
              studentId: normalizedId,
              fullName: data.student.fullName,
              yearLevel: data.student.yearLevel ?? '',
              program: data.student.program ?? '',
              sex: data.student.sex ?? '',
              password,
              photoChanges: data.student.profileUploadCount ?? 0,
              notifications: true,
              createdAt: new Date().toISOString(),
            };

        const accounts = existingIdx >= 0
          ? state.accounts.map((a) => a.studentId === normalizedId ? updated : a)
          : [...state.accounts, updated];

        await persist({ accounts, activeStudentId: normalizedId });
        return { ok: true };
      }
    } catch {
      // Fall through to local
    }

    // Offline fallback: local account
    const account = state.accounts.find((item) => item.studentId === normalizedId);
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
    account, isReady, sessions: ATTENDANCE_SESSIONS, certifiedStudents, register, login, logout, updatePhoto, setNotifications, lookupStudent,
  }), [account, isReady, certifiedStudents, register, login, logout, updatePhoto, setNotifications, lookupStudent]);

  return <AttendanceContext.Provider value={value}>{children}</AttendanceContext.Provider>;
}

export function useAttendance() {
  const context = useContext(AttendanceContext);
  if (!context) throw new Error('useAttendance must be used inside AttendanceProvider');
  return context;
}
import React, { useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { BrandMark, Field, PrimaryButton } from '@/components/AttendaUI';
import { useAttendance } from '@/context/AttendanceContext';
import { useColors } from '@/hooks/useColors';

export default function WelcomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login } = useAttendance();
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const submitLogin = async () => {
    setError('');
    setSuccessMsg('');
    setBusy(true);
    const result = await login(studentId, password);
    setBusy(false);
    if (!result.ok) return setError(result.error ?? '');
    router.replace('/(tabs)');
  };

  const topPad = Platform.OS === 'web' ? Math.max(60, insets.top) : insets.top;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" />

      {/* ── Hero gradient strip ── */}
      <View style={[styles.heroBand, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={[styles.heroInner, { paddingTop: topPad + 10 }]}>
          <View style={styles.topRow}>
            <BrandMark />
            <View style={[styles.badge, { backgroundColor: colors.secondary }]}>
              <Feather name="shield" size={12} color={colors.success} />
              <Text style={[styles.badgeText, { color: colors.success }]}>School-issued</Text>
            </View>
          </View>

          <Text style={[styles.kicker, { color: colors.success }]}>YOUR CAMPUS, ACCOUNTED FOR</Text>
          <Text style={[styles.heroTitle, { color: colors.primary }]}>A calmer way to{'\n'}know you're here.</Text>
          <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>
            DIMSAT keeps your attendance record close, clear, and ready when you need it.
          </Text>
        </View>
      </View>

      {/* ── Scrollable form area ── */}
      <KeyboardAwareScrollViewCompat
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Tab switcher */}
        <View style={[styles.tabBar, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Pressable
            onPress={() => { setMode('login'); setError(''); setSuccessMsg(''); }}
            style={[styles.tabBtn, mode === 'login' && { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.tabLabel, { color: mode === 'login' ? colors.primaryForeground : colors.mutedForeground }]}>
              Log in
            </Text>
          </Pressable>
          <Pressable
            onPress={() => { setMode('register'); setError(''); setSuccessMsg(''); }}
            style={[styles.tabBtn, mode === 'register' && { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.tabLabel, { color: mode === 'register' ? colors.primaryForeground : colors.mutedForeground }]}>
              Register
            </Text>
          </Pressable>
          <Pressable
            onPress={() => { setMode('reset'); setError(''); setSuccessMsg(''); }}
            style={[styles.tabBtn, mode === 'reset' && { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.tabLabel, { color: mode === 'reset' ? colors.primaryForeground : colors.mutedForeground }]}>
              Reset Pwd
            </Text>
          </Pressable>
        </View>

        {successMsg ? (
          <View style={[styles.successBanner, { backgroundColor: `${colors.success}18`, borderColor: colors.success }]}>
            <Feather name="check-circle" size={16} color={colors.success} />
            <Text style={[styles.successBannerText, { color: colors.success }]}>{successMsg}</Text>
          </View>
        ) : null}

        {/* Form card */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {mode === 'login' ? (
            <LoginForm
              studentId={studentId} setStudentId={setStudentId}
              password={password} setPassword={setPassword}
              error={error} busy={busy}
              onForgot={() => { setMode('reset'); setError(''); setSuccessMsg(''); }}
              onSubmit={submitLogin}
              colors={colors}
            />
          ) : mode === 'register' ? (
            <RegisterForm
              name={name} setName={setName}
              studentId={studentId} setStudentId={setStudentId}
              password={password} setPassword={setPassword}
              confirm={confirm} setConfirm={setConfirm}
              error={error} busy={busy}
              setBusy={setBusy} setError={setError}
              colors={colors}
            />
          ) : (
            <ResetPasswordForm
              name={name} setName={setName}
              studentId={studentId} setStudentId={setStudentId}
              password={password} setPassword={setPassword}
              confirm={confirm} setConfirm={setConfirm}
              error={error} busy={busy}
              setBusy={setBusy} setError={setError}
              onSuccess={(msg) => {
                setSuccessMsg(msg);
                setMode('login');
                setPassword('');
                setConfirm('');
              }}
              colors={colors}
            />
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Feather name="lock" size={12} color={colors.mutedForeground} />
          <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
            Your student account stays on this device.
          </Text>
        </View>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

// ── Login form ──────────────────────────────────────────────────────────────
function LoginForm({ studentId, setStudentId, password, setPassword, error, busy, onForgot, onSubmit, colors }: {
  studentId: string; setStudentId: (v: string) => void;
  password: string; setPassword: (v: string) => void;
  error: string; busy: boolean;
  onForgot: () => void;
  onSubmit: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View>
      <View style={styles.formHeader}>
        <View style={[styles.formIcon, { backgroundColor: `${colors.primary}20` }]}>
          <Feather name="log-in" size={18} color={colors.primary} />
        </View>
        <View>
          <Text style={[styles.formTitle, { color: colors.foreground }]}>Welcome back</Text>
          <Text style={[styles.formSub, { color: colors.mutedForeground }]}>Use your certified Student ID</Text>
        </View>
      </View>
      <Field label="Student ID" value={studentId} onChangeText={setStudentId} placeholder="e.g. BSIS-2026-0001" autoCapitalize="characters" autoCorrect={false} />
      <Field label="Password" value={password} onChangeText={setPassword} placeholder="Your password" secureTextEntry onSubmitEditing={onSubmit} error={error} />
      <Pressable onPress={onForgot} style={styles.forgotBtn}>
        <Text style={[styles.forgotBtnText, { color: colors.primary }]}>Forgot or reset your password?</Text>
      </Pressable>
      <PrimaryButton label="Continue to Attenda" icon="arrow-right" onPress={onSubmit} loading={busy} />
    </View>
  );
}

// ── Register form ───────────────────────────────────────────────────────────
function RegisterForm({ name, setName, studentId, setStudentId, password, setPassword, confirm, setConfirm, error, busy, setBusy, setError, colors }: {
  name: string; setName: (v: string) => void;
  studentId: string; setStudentId: (v: string) => void;
  password: string; setPassword: (v: string) => void;
  confirm: string; setConfirm: (v: string) => void;
  error: string; busy: boolean;
  setBusy: (v: boolean) => void; setError: (v: string) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const { register, lookupStudent } = useAttendance();

  const submit = async () => {
    setError('');
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setBusy(true);
    const lookup = await lookupStudent(studentId.trim(), name.trim());
    if (!lookup.ok) { setBusy(false); return setError(lookup.error ?? 'Validation failed.'); }
    const result = await register(lookup.student!, password);
    setBusy(false);
    if (!result.ok) return setError(result.error ?? '');
    router.replace('/(tabs)');
  };

  return (
    <View>
      <View style={styles.formHeader}>
        <View style={[styles.formIcon, { backgroundColor: `${colors.success}20` }]}>
          <Feather name="user-plus" size={18} color={colors.success} />
        </View>
        <View>
          <Text style={[styles.formTitle, { color: colors.foreground }]}>Create your account</Text>
          <Text style={[styles.formSub, { color: colors.mutedForeground }]}>Matched against the certified list</Text>
        </View>
      </View>
      <Field label="Full name" value={name} onChangeText={setName} placeholder="As listed by your school" autoCapitalize="words" />
      <Field label="Student ID" value={studentId} onChangeText={setStudentId} placeholder="e.g. BSIS-2026-0001" autoCapitalize="characters" />
      <Field label="Password" value={password} onChangeText={setPassword} placeholder="At least 6 characters" secureTextEntry />
      <Field label="Confirm password" value={confirm} onChangeText={setConfirm} placeholder="Repeat your password" secureTextEntry error={error} />
      <PrimaryButton label="Create student account" icon="user-plus" onPress={submit} loading={busy} />
    </View>
  );
}

// ── Reset Password form ─────────────────────────────────────────────────────
function ResetPasswordForm({ name, setName, studentId, setStudentId, password, setPassword, confirm, setConfirm, error, busy, setBusy, setError, onSuccess, colors }: {
  name: string; setName: (v: string) => void;
  studentId: string; setStudentId: (v: string) => void;
  password: string; setPassword: (v: string) => void;
  confirm: string; setConfirm: (v: string) => void;
  error: string; busy: boolean;
  setBusy: (v: boolean) => void; setError: (v: string) => void;
  onSuccess: (msg: string) => void;
  colors: ReturnType<typeof useColors>;
}) {
  const { resetPassword, lookupStudent } = useAttendance();

  const submit = async () => {
    setError('');
    if (!studentId.trim()) return setError('Student ID is required.');
    if (!name.trim()) return setError('Full name is required to verify identity.');
    if (password.length < 6) return setError('New password must be at least 6 characters.');
    if (password !== confirm) return setError('Passwords do not match.');

    setBusy(true);
    const lookup = await lookupStudent(studentId.trim(), name.trim());
    if (!lookup.ok) {
      setBusy(false);
      return setError(lookup.error ?? 'Student verification failed.');
    }

    const result = await resetPassword(studentId.trim(), name.trim(), password);
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Failed to reset password.');

    onSuccess('✅ Password reset successful! Please log in with your new password.');
  };

  return (
    <View>
      <View style={styles.formHeader}>
        <View style={[styles.formIcon, { backgroundColor: `${colors.primary}20` }]}>
          <Feather name="key" size={18} color={colors.primary} />
        </View>
        <View>
          <Text style={[styles.formTitle, { color: colors.foreground }]}>Reset your password</Text>
          <Text style={[styles.formSub, { color: colors.mutedForeground }]}>Verify with your certified student record</Text>
        </View>
      </View>
      <Field label="Full name" value={name} onChangeText={setName} placeholder="Your registered full name" autoCapitalize="words" />
      <Field label="Student ID" value={studentId} onChangeText={setStudentId} placeholder="e.g. BSIS-2026-0001" autoCapitalize="characters" />
      <Field label="New Password" value={password} onChangeText={setPassword} placeholder="At least 6 characters" secureTextEntry />
      <Field label="Confirm New Password" value={confirm} onChangeText={setConfirm} placeholder="Repeat new password" secureTextEntry error={error} />
      <PrimaryButton label="Update Password" icon="check" onPress={submit} loading={busy} />
    </View>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1 },

  // Hero band
  heroBand: { borderBottomWidth: 1 },
  heroInner: { paddingHorizontal: 20, paddingBottom: 20 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  kicker: { fontSize: 9, fontWeight: '800', letterSpacing: 1.6, marginBottom: 6, textTransform: 'uppercase' },
  heroTitle: { fontSize: 28, lineHeight: 33, fontWeight: '800', letterSpacing: -1.1, marginBottom: 8 },
  heroSub: { fontSize: 13, lineHeight: 18 },

  // Scroll area
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },

  // Tab switcher
  tabBar: { flexDirection: 'row', padding: 3, borderRadius: 14, borderWidth: 1 },
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 12 },
  tabLabel: { fontSize: 13, fontWeight: '800' },

  // Form card
  card: { borderRadius: 20, borderWidth: 1, padding: 16 },
  formHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 },
  formIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  formTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  formSub: { fontSize: 12, lineHeight: 16, marginTop: 1 },

  // Success banner
  successBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 14, borderWidth: 1, marginHorizontal: 2 },
  successBannerText: { flex: 1, fontSize: 12, fontWeight: '700', lineHeight: 16 },

  // Forgot password button
  forgotBtn: { alignSelf: 'flex-end', marginTop: 4, marginBottom: 12, paddingVertical: 4 },
  forgotBtnText: { fontSize: 12, fontWeight: '700' },

  // Footer
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingVertical: 4 },
  footerText: { fontSize: 11, fontWeight: '600' },
});
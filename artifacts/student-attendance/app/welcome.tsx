import React, { useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { BrandMark, Field, PrimaryButton, Screen, SecondaryButton } from '@/components/AttendaUI';
import { useAttendance } from '@/context/AttendanceContext';
import { useColors } from '@/hooks/useColors';

export default function WelcomeScreen() {
  const colors = useColors();
  const { login } = useAttendance();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submitLogin = async () => {
    setError('');
    setBusy(true);
    const result = await login(studentId, password);
    setBusy(false);
    if (!result.ok) return setError(result.error ?? '');
    router.replace('/(tabs)');
  };

  return <Screen scroll={false} contentStyle={styles.page}>
    <KeyboardAwareScrollViewCompat contentContainerStyle={{ paddingBottom: 12 }} bottomOffset={24}>
      <View style={styles.top}><BrandMark /><View style={[styles.signal, { backgroundColor: colors.secondary }]}><Feather name="shield" size={14} color={colors.success} /><Text style={[styles.signalText, { color: colors.inkSoft }]}>School-issued access</Text></View></View>
      <View style={styles.hero}><Text style={[styles.kicker, { color: colors.success }]}>YOUR CAMPUS, ACCOUNTED FOR</Text><Text style={[styles.title, { color: colors.primary }]}>A calmer way to know you're here.</Text><Text style={[styles.intro, { color: colors.mutedForeground }]}>DIMSAT keeps your attendance record close, clear, and ready when you need it.</Text></View>
      <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.tabs, { backgroundColor: colors.muted }]}><Pressable onPress={() => { setMode('login'); setError(''); }} style={[styles.tab, mode === 'login' && { backgroundColor: colors.primary }]}><Text style={[styles.tabLabel, { color: mode === 'login' ? colors.primaryForeground : colors.mutedForeground }]}>Log in</Text></Pressable><Pressable onPress={() => { setMode('register'); setError(''); }} style={[styles.tab, mode === 'register' && { backgroundColor: colors.primary }]}><Text style={[styles.tabLabel, { color: mode === 'register' ? colors.primaryForeground : colors.mutedForeground }]}>Register</Text></Pressable></View>
        {mode === 'login' ? <View><Text style={[styles.formTitle, { color: colors.foreground }]}>Welcome back</Text><Text style={[styles.formSub, { color: colors.mutedForeground }]}>Use your certified Student ID to continue.</Text><Field label="Student ID" value={studentId} onChangeText={setStudentId} placeholder="e.g. BSIS-2026-0001" autoCapitalize="characters" autoCorrect={false} /><Field label="Password" value={password} onChangeText={setPassword} placeholder="Your password" secureTextEntry onSubmitEditing={submitLogin} error={error} /><PrimaryButton label="Continue to Attenda" icon="arrow-right" onPress={submitLogin} loading={busy} /></View> :
          <RegisterForm name={name} setName={setName} studentId={studentId} setStudentId={setStudentId} password={password} setPassword={setPassword} confirm={confirm} setConfirm={setConfirm} error={error} busy={busy} setBusy={setBusy} setError={setError} />}
      </View>
      <View style={styles.promise}><Feather name="lock" size={14} color={colors.success} /><Text style={[styles.promiseText, { color: colors.mutedForeground }]}>Your student account stays on this device.</Text></View>
    </KeyboardAwareScrollViewCompat>
  </Screen>;
}

function RegisterForm({ name, setName, studentId, setStudentId, password, setPassword, confirm, setConfirm, error, busy, setBusy, setError }: { name: string; setName: (v: string) => void; studentId: string; setStudentId: (v: string) => void; password: string; setPassword: (v: string) => void; confirm: string; setConfirm: (v: string) => void; error: string; busy: boolean; setBusy: (v: boolean) => void; setError: (v: string) => void }) {
  const colors = useColors();
  const { register, lookupStudent } = useAttendance();
  const submit = async () => {
    setError('');
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setBusy(true);
    // Validate Student ID + name against live API certified list
    const lookup = await lookupStudent(studentId.trim(), name.trim());
    if (!lookup.ok) { setBusy(false); return setError(lookup.error ?? 'Validation failed.'); }
    const result = await register(lookup.student!, password);
    setBusy(false);
    if (!result.ok) return setError(result.error ?? '');
    router.replace('/(tabs)');
  };
  return <View><Text style={[styles.formTitle, { color: colors.foreground }]}>Create your account</Text><Text style={[styles.formSub, { color: colors.mutedForeground }]}>Registration is matched against the certified list.</Text><Field label="Full name" value={name} onChangeText={setName} placeholder="As listed by your school" autoCapitalize="words" /><Field label="Student ID" value={studentId} onChangeText={setStudentId} placeholder="e.g. BSIS-2026-0001" autoCapitalize="characters" /><Field label="Password" value={password} onChangeText={setPassword} placeholder="At least 6 characters" secureTextEntry /><Field label="Confirm password" value={confirm} onChangeText={setConfirm} placeholder="Repeat your password" secureTextEntry error={error} /><PrimaryButton label="Create student account" icon="user-plus" onPress={submit} loading={busy} /></View>;
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 20 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  signal: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 20 },
  signalText: { fontSize: 10, fontWeight: '700' },
  hero: { marginTop: 18, marginBottom: 14 },
  kicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 7 },
  title: { fontSize: 28, lineHeight: 32, fontWeight: '800', letterSpacing: -1.2, maxWidth: 300 },
  intro: { fontSize: 13, lineHeight: 18, marginTop: 9, maxWidth: 300 },
  formCard: { borderRadius: 20, borderWidth: 1, padding: 14 },
  tabs: { flexDirection: 'row', padding: 3, borderRadius: 12, marginBottom: 14 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10 },
  tabLabel: { fontSize: 13, fontWeight: '800' },
  formTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  formSub: { fontSize: 12, lineHeight: 16, marginTop: 3, marginBottom: 12 },
  demo: { fontSize: 11, lineHeight: 15, textAlign: 'center', marginTop: 12 },
  promise: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 12 },
  promiseText: { fontSize: 11, fontWeight: '600' },
});
import React, { useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { BrandMark, Field, PrimaryButton, Screen, SecondaryButton } from '@/components/AttendaUI';
import { CERTIFIED_STUDENTS, useAttendance } from '@/context/AttendanceContext';
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
    <KeyboardAwareScrollViewCompat contentContainerStyle={{ paddingBottom: 38 }} bottomOffset={40}>
      <View style={styles.top}><BrandMark /><View style={[styles.signal, { backgroundColor: colors.secondary }]}><Feather name="shield" size={16} color={colors.success} /><Text style={[styles.signalText, { color: colors.inkSoft }]}>School-issued access</Text></View></View>
      <View style={styles.hero}><Text style={[styles.kicker, { color: colors.success }]}>YOUR CAMPUS, ACCOUNTED FOR</Text><Text style={[styles.title, { color: colors.primary }]}>A calmer way to know you're here.</Text><Text style={[styles.intro, { color: colors.mutedForeground }]}>Attenda keeps your attendance record close, clear, and ready when you need reassurance.</Text></View>
      <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.tabs, { backgroundColor: colors.muted }]}><Pressable onPress={() => { setMode('login'); setError(''); }} style={[styles.tab, mode === 'login' && { backgroundColor: colors.primary }]}><Text style={[styles.tabLabel, { color: mode === 'login' ? colors.primaryForeground : colors.mutedForeground }]}>Log in</Text></Pressable><Pressable onPress={() => { setMode('register'); setError(''); }} style={[styles.tab, mode === 'register' && { backgroundColor: colors.primary }]}><Text style={[styles.tabLabel, { color: mode === 'register' ? colors.primaryForeground : colors.mutedForeground }]}>Register</Text></Pressable></View>
        {mode === 'login' ? <View><Text style={[styles.formTitle, { color: colors.foreground }]}>Welcome back</Text><Text style={[styles.formSub, { color: colors.mutedForeground }]}>Use your certified Student ID to continue.</Text><Field label="Student ID" value={studentId} onChangeText={setStudentId} placeholder="AT-2026-0042" autoCapitalize="characters" autoCorrect={false} /><Field label="Password" value={password} onChangeText={setPassword} placeholder="Your password" secureTextEntry onSubmitEditing={submitLogin} error={error} /><PrimaryButton label="Continue to Attenda" icon="arrow-right" onPress={submitLogin} loading={busy} /><Text style={[styles.demo, { color: colors.mutedForeground }]}>Demo certified ID: <Text style={{ fontWeight: '700', color: colors.inkSoft }}>AT-2026-0042</Text> · Maya Santos</Text></View> :
          <RegisterForm name={name} setName={setName} studentId={studentId} setStudentId={setStudentId} password={password} setPassword={setPassword} confirm={confirm} setConfirm={setConfirm} error={error} busy={busy} setBusy={setBusy} setError={setError} />}
      </View>
      <View style={styles.promise}><Feather name="lock" size={16} color={colors.success} /><Text style={[styles.promiseText, { color: colors.mutedForeground }]}>Your student account stays on this device.</Text></View>
    </KeyboardAwareScrollViewCompat>
  </Screen>;
}

function RegisterForm({ name, setName, studentId, setStudentId, password, setPassword, confirm, setConfirm, error, busy, setBusy, setError }: { name: string; setName: (v: string) => void; studentId: string; setStudentId: (v: string) => void; password: string; setPassword: (v: string) => void; confirm: string; setConfirm: (v: string) => void; error: string; busy: boolean; setBusy: (v: boolean) => void; setError: (v: string) => void }) {
  const colors = useColors();
  const { register } = useAttendance();
  const submit = async () => {
    setError('');
    const certified = CERTIFIED_STUDENTS.find((item) => item.studentId === studentId.trim().toUpperCase());
    if (!certified) return setError('Student ID is not included in the certified student list.');
    if (certified.fullName.toLowerCase() !== name.trim().toLowerCase()) return setError('Full name does not match the certified student record.');
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setBusy(true);
    const result = await register(certified, password);
    setBusy(false);
    if (!result.ok) return setError(result.error ?? '');
    router.replace('/(tabs)');
  };
  return <View><Text style={[styles.formTitle, { color: colors.foreground }]}>Create your account</Text><Text style={[styles.formSub, { color: colors.mutedForeground }]}>Registration is matched against the certified list.</Text><Field label="Full name" value={name} onChangeText={setName} placeholder="As listed by your school" autoCapitalize="words" /><Field label="Student ID" value={studentId} onChangeText={setStudentId} placeholder="AT-2026-0042" autoCapitalize="characters" /><Field label="Password" value={password} onChangeText={setPassword} placeholder="At least 6 characters" secureTextEntry /><Field label="Confirm password" value={confirm} onChangeText={setConfirm} placeholder="Repeat your password" secureTextEntry error={error} /><PrimaryButton label="Create student account" icon="user-plus" onPress={submit} loading={busy} /><Text style={[styles.demo, { color: colors.mutedForeground }]}>Try the demo record: <Text style={{ fontWeight: '700', color: colors.inkSoft }}>Maya Santos</Text> with ID AT-2026-0042.</Text></View>;
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 20 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  signal: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 20 },
  signalText: { fontSize: 11, fontWeight: '700' },
  hero: { marginTop: 44, marginBottom: 27 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 1.7, marginBottom: 11 },
  title: { fontSize: 40, lineHeight: 43, fontWeight: '800', letterSpacing: -1.7, maxWidth: 330 },
  intro: { fontSize: 16, lineHeight: 23, marginTop: 15, maxWidth: 330 },
  formCard: { borderRadius: 24, borderWidth: 1, padding: 18 },
  tabs: { flexDirection: 'row', padding: 4, borderRadius: 14, marginBottom: 23 },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 11 },
  tabLabel: { fontSize: 14, fontWeight: '800' },
  formTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  formSub: { fontSize: 13, lineHeight: 19, marginTop: 5, marginBottom: 20 },
  demo: { fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 16 },
  promise: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7, marginTop: 20 },
  promiseText: { fontSize: 12, fontWeight: '600' },
});
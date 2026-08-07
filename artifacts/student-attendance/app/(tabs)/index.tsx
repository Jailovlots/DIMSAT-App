import React from 'react';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar, IconCircle, Screen, SectionTitle } from '@/components/AttendaUI';
import { useAttendance } from '@/context/AttendanceContext';
import { useColors } from '@/hooks/useColors';

export default function Dashboard() {
  const colors = useColors();
  const { account, sessions } = useAttendance();
  if (!account) return null;
  const present = sessions.filter((session) => session.status === 'Present').length;
  const completed = Math.round((present / sessions.length) * 100);
  const today = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
  return <Screen>
    <View style={styles.header}><View><Text style={[styles.greeting, { color: colors.mutedForeground }]}>Good morning,</Text><Text style={[styles.name, { color: colors.primary }]}>{account.fullName.split(' ')[0]}.</Text></View><Pressable onPress={() => router.push('/(tabs)/profile')}><Avatar uri={account.photoUri} name={account.fullName} size={46} /></Pressable></View>
    <View style={[styles.dateLine, { borderBottomColor: colors.border }]}><Feather name="calendar" size={15} color={colors.success} /><Text style={[styles.date, { color: colors.inkSoft }]}>{today}</Text><View style={styles.dot} /><Text style={[styles.live, { color: colors.success }]}>Today</Text></View>
    <View style={[styles.heroCard, { backgroundColor: colors.primary }]}><View style={[styles.heroOrb, { backgroundColor: colors.accent }]} /><Text style={[styles.heroOver, { color: colors.accent }]}>ACCOUNT STATUS</Text><View style={styles.heroRow}><Text style={[styles.heroTitle, { color: colors.primaryForeground }]}>You’re registered{'\n'}and accounted for.</Text><IconCircle icon="shield-checkmark" color={colors.accent} /></View><Text style={[styles.heroCopy, { color: colors.secondary }]}>{account.studentId} · {account.program}</Text></View>
    <SectionTitle eyebrow="Featured event" title="Acquaintance Party 2026" action={<Pressable onPress={() => router.push('/(tabs)/records')}><Text style={[styles.link, { color: colors.success }]}>View all</Text></Pressable>} />
    <View style={[styles.progressCard, { backgroundColor: colors.card, borderColor: colors.border }]}><View style={styles.progressTop}><View><Text style={[styles.progressLabel, { color: colors.mutedForeground }]}>Attendance completion</Text><Text style={[styles.progressNumber, { color: colors.primary }]}>{completed}% <Text style={[styles.progressSmall, { color: colors.mutedForeground }]}>of sessions recorded</Text></Text></View><View style={[styles.checkBadge, { backgroundColor: colors.secondary }]}><Feather name="check" size={19} color={colors.success} /></View></View><View style={[styles.track, { backgroundColor: colors.muted }]}><View style={[styles.fill, { width: `${completed}%`, backgroundColor: colors.success }]} /></View><Text style={[styles.progressHint, { color: colors.mutedForeground }]}>{present} of {sessions.length} sessions have a confirmed attendance record.</Text></View>
    <SectionTitle eyebrow="Quick access" title="Stay in the loop" />
    <View style={styles.quickGrid}><Pressable onPress={() => router.push('/(tabs)/records')} style={({ pressed }) => [styles.quick, { backgroundColor: colors.secondary, opacity: pressed ? 0.7 : 1 }]}><IconCircle icon="list-outline" /><Text style={[styles.quickTitle, { color: colors.primary }]}>Attendance{'\n'}records</Text><Feather name="arrow-up-right" size={16} color={colors.success} /></Pressable><Pressable onPress={() => router.push('/(tabs)/profile')} style={({ pressed }) => [styles.quick, { backgroundColor: colors.cream, opacity: pressed ? 0.7 : 1 }]}><IconCircle icon="person-outline" color={colors.accent} /><Text style={[styles.quickTitle, { color: colors.primary }]}>My student{'\n'}profile</Text><Feather name="arrow-up-right" size={16} color={colors.success} /></Pressable></View>
    <View style={[styles.note, { backgroundColor: colors.muted }]}><Feather name="info" size={17} color={colors.inkSoft} /><Text style={[styles.noteText, { color: colors.inkSoft }]}>Attendance is updated by your campus team. Check back after each session.</Text></View>
  </Screen>;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greeting: { fontSize: 15, fontWeight: '600' }, name: { fontSize: 31, fontWeight: '800', letterSpacing: -1.2, marginTop: 1 },
  dateLine: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 17, borderBottomWidth: 1, marginBottom: 21 }, date: { fontSize: 13, fontWeight: '600' }, dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#8fa39b' }, live: { fontSize: 12, fontWeight: '800' },
  heroCard: { borderRadius: 26, padding: 21, overflow: 'hidden', minHeight: 182, marginBottom: 31 }, heroOrb: { position: 'absolute', width: 180, height: 180, borderRadius: 90, right: -54, top: -75, opacity: 0.2 }, heroOver: { fontSize: 11, fontWeight: '800', letterSpacing: 1.7, marginBottom: 16 }, heroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, heroTitle: { fontSize: 25, lineHeight: 27, fontWeight: '800', letterSpacing: -0.7 }, heroCopy: { fontSize: 12, fontWeight: '600', marginTop: 22 },
  link: { fontSize: 13, fontWeight: '800' }, progressCard: { borderRadius: 21, borderWidth: 1, padding: 17, marginBottom: 30 }, progressTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, progressLabel: { fontSize: 12, fontWeight: '700', marginBottom: 5 }, progressNumber: { fontSize: 27, fontWeight: '800' }, progressSmall: { fontSize: 12, fontWeight: '600' }, checkBadge: { width: 41, height: 41, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, track: { height: 9, borderRadius: 8, marginTop: 18, overflow: 'hidden' }, fill: { height: 9, borderRadius: 8 }, progressHint: { fontSize: 12, lineHeight: 17, marginTop: 11 },
  quickGrid: { flexDirection: 'row', gap: 12 }, quick: { flex: 1, borderRadius: 20, minHeight: 135, padding: 15, justifyContent: 'space-between' }, quickTitle: { fontSize: 17, lineHeight: 20, fontWeight: '800' }, note: { marginTop: 24, padding: 14, borderRadius: 16, flexDirection: 'row', gap: 10, alignItems: 'flex-start' }, noteText: { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: '600' },
});

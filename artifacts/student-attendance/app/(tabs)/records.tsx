import React from 'react';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Screen, SectionTitle, StatusPill } from '@/components/AttendaUI';
import { useAttendance } from '@/context/AttendanceContext';
import { useColors } from '@/hooks/useColors';

export default function Records() {
  const colors = useColors();
  const { sessions } = useAttendance();
  return <Screen><View style={styles.top}><Pressable onPress={() => router.push('/(tabs)')}><Feather name="arrow-left" size={21} color={colors.primary} /></Pressable><Text style={[styles.title, { color: colors.primary }]}>Attendance records</Text><View style={{ width: 21 }} /></View><Text style={[styles.subtitle, { color: colors.mutedForeground }]}>One event, six moments to be present.</Text><View style={[styles.eventCard, { backgroundColor: colors.primary }]}><Text style={[styles.eventEyebrow, { color: colors.accent }]}>EVENT RECORD</Text><Text style={[styles.eventTitle, { color: colors.primaryForeground }]}>Acquaintance Party 2026</Text><Text style={[styles.eventMeta, { color: colors.secondary }]}>August 18–20, 2026 · Student orientation</Text><View style={[styles.eventRule, { backgroundColor: colors.inkSoft }]} /><View style={styles.eventStats}><View><Text style={[styles.statNumber, { color: colors.primaryForeground }]}>{sessions.filter((s) => s.status === 'Present').length}</Text><Text style={[styles.statLabel, { color: colors.secondary }]}>present</Text></View><View><Text style={[styles.statNumber, { color: colors.primaryForeground }]}>{sessions.length}</Text><Text style={[styles.statLabel, { color: colors.secondary }]}>total sessions</Text></View></View></View><SectionTitle eyebrow="Session by session" title="Your record" />{sessions.map((session, index) => <View key={session.id} style={[styles.row, { borderBottomColor: colors.border }]}><View style={[styles.index, { backgroundColor: session.status === 'Present' ? colors.secondary : colors.muted }]}><Text style={[styles.indexText, { color: session.status === 'Present' ? colors.success : colors.mutedForeground }]}>{String(index + 1).padStart(2, '0')}</Text></View><View style={styles.sessionInfo}><Text style={[styles.sessionLabel, { color: colors.foreground }]}>{session.label}</Text><Text style={[styles.sessionMeta, { color: colors.mutedForeground }]}>{session.date} · {session.time}</Text><Text style={[styles.detail, { color: colors.mutedForeground }]}>{session.detail}</Text></View><StatusPill status={session.status} /></View>)}</Screen>;
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  title: { fontSize: 21, fontWeight: '800' },
  subtitle: { fontSize: 14, marginBottom: 22 },
  eventCard: { borderRadius: 23, padding: 19, marginBottom: 30 },
  eventEyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  eventTitle: { fontSize: 24, fontWeight: '800', marginTop: 13, letterSpacing: -0.6 },
  eventMeta: { fontSize: 12, marginTop: 8 },
  eventRule: { height: 1, marginVertical: 18, opacity: 0.6 },
  eventStats: { flexDirection: 'row', gap: 42 },
  statNumber: { fontSize: 28, fontWeight: '800' },
  statLabel: { fontSize: 11, fontWeight: '700', marginTop: -2 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, gap: 11 },
  index: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  indexText: { fontSize: 11, fontWeight: '800' },
  sessionInfo: { flex: 1 },
  sessionLabel: { fontSize: 15, fontWeight: '800' },
  sessionMeta: { fontSize: 11, marginTop: 4 },
  detail: { fontSize: 11, marginTop: 3 },
});
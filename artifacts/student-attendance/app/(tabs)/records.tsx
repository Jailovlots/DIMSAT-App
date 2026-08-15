import React from 'react';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Screen, SectionTitle, StatusPill } from '@/components/AttendaUI';
import { useAttendance } from '@/context/AttendanceContext';
import { useColors } from '@/hooks/useColors';
import { useStudentAttendance } from '@/hooks/useStudentAttendance';

export default function Records() {
  const colors = useColors();
  const { account } = useAttendance();
  const { events, loading, error, refresh } = useStudentAttendance(account?.studentId);

  // Aggregate totals across all events
  const totalPresent = events.reduce((sum, e) => sum + e.presentCount, 0);
  const totalSessions = events.reduce((sum, e) => sum + e.totalSessions, 0);
  const completionPct = totalSessions > 0 ? Math.round((totalPresent / totalSessions) * 100) : 0;

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    } catch { return dateStr; }
  };

  const formatTime = (isoStr: string) => {
    try {
      return new Date(isoStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } catch { return ''; }
  };

  const sessionStatusColor = (status: string) => {
    if (status === 'Present') return colors.success;
    if (status === 'Late') return colors.warning;
    if (status === 'Absent') return colors.destructive;
    return colors.mutedForeground;
  };

  const sessionStatusIcon = (status: string): keyof typeof Feather.glyphMap => {
    if (status === 'Present') return 'check-circle';
    if (status === 'Late') return 'clock';
    if (status === 'Absent') return 'x-circle';
    return 'circle';
  };

  return (
    <Screen>
      {/* Header */}
      <View style={styles.top}>
        <Pressable onPress={() => router.push('/(tabs)')}>
          <Feather name="arrow-left" size={21} color={colors.primary} />
        </Pressable>
        <Text style={[styles.title, { color: colors.primary }]}>Attendance records</Text>
        <Pressable onPress={refresh}>
          <Feather name="refresh-cw" size={18} color={colors.success} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading your records…</Text>
        </View>
      ) : error ? (
        <View style={[styles.errorCard, { backgroundColor: `${colors.destructive}15`, borderColor: `${colors.destructive}30` }]}>
          <Feather name="wifi-off" size={20} color={colors.destructive} />
          <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
          <Pressable onPress={refresh} style={[styles.retryBtn, { borderColor: colors.destructive }]}>
            <Text style={[styles.retryText, { color: colors.destructive }]}>Retry</Text>
          </Pressable>
        </View>
      ) : events.length === 0 ? (
        <View style={styles.center}>
          <Feather name="calendar" size={36} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No events yet</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Your attendance records will appear here once events are created by your admin.</Text>
        </View>
      ) : (
        <>
          {/* Overall summary card */}
          {(() => {
            const isPrimaryAccentSame = colors.primary === colors.accent;
            const cardContrastColor = isPrimaryAccentSame ? colors.accentForeground : colors.accent;
            const cardSubColor = isPrimaryAccentSame ? colors.accentForeground : colors.secondary;
            return (
              <View style={[styles.summaryCard, { backgroundColor: colors.primary }]}>
                <View style={[styles.heroOrb, { backgroundColor: cardContrastColor }]} />
                <Text style={[styles.summaryEyebrow, { color: cardContrastColor }]}>OVERALL ATTENDANCE</Text>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryTitle, { color: colors.primaryForeground }]}>
                    {completionPct}% completion
                  </Text>
                  <Feather name="shield" size={22} color={cardContrastColor} />
                </View>
                <View style={[styles.trackBg, { backgroundColor: `${colors.primaryForeground}25` }]}>
                  <View style={[styles.trackFill, { width: `${completionPct}%`, backgroundColor: cardContrastColor }]} />
                </View>
                <Text style={[styles.summarySub, { color: cardSubColor }]}>
                  {totalPresent} of {totalSessions} sessions recorded across {events.length} event{events.length !== 1 ? 's' : ''}
                </Text>
              </View>
            );
          })()}

          {/* Per-event records */}
          {events.map((event) => (
            <View key={event.eventId} style={styles.eventBlock}>
              <View style={[styles.eventHeader, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.eventName, { color: colors.foreground }]}>{event.eventName}</Text>
                  <Text style={[styles.eventMeta, { color: colors.mutedForeground }]}>
                    {formatDate(event.eventDate)} · {event.venue}
                  </Text>
                </View>
                <View style={[styles.eventBadge, { backgroundColor: event.presentCount === event.totalSessions ? `${colors.success}20` : `${colors.warning}18` }]}>
                  <Text style={[styles.eventBadgeText, { color: event.presentCount === event.totalSessions ? colors.success : colors.warning }]}>
                    {event.presentCount}/{event.totalSessions}
                  </Text>
                </View>
              </View>

              {event.sessions.map((session, idx) => (
                <View key={idx} style={[styles.sessionRow, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
                  <View style={[styles.sessionIcon, { backgroundColor: `${sessionStatusColor(session.status)}18` }]}>
                    <Feather name={sessionStatusIcon(session.status)} size={15} color={sessionStatusColor(session.status)} />
                  </View>
                  <View style={styles.sessionInfo}>
                    <Text style={[styles.sessionLabel, { color: colors.foreground }]}>{session.sessionName}</Text>
                    {session.scannedAt && (
                      <Text style={[styles.sessionTime, { color: colors.mutedForeground }]}>
                        Scanned at {formatTime(session.scannedAt)}
                      </Text>
                    )}
                    {!session.scannedAt && session.status !== 'Upcoming' && (
                      <Text style={[styles.sessionTime, { color: colors.mutedForeground }]}>No attendance recorded</Text>
                    )}
                    {session.status === 'Upcoming' && (
                      <Text style={[styles.sessionTime, { color: colors.mutedForeground }]}>Session not started yet</Text>
                    )}
                  </View>
                  <View style={[styles.pill, { backgroundColor: `${sessionStatusColor(session.status)}18` }]}>
                    <Text style={[styles.pillText, { color: sessionStatusColor(session.status) }]}>{session.status}</Text>
                  </View>
                </View>
              ))}
            </View>
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  title: { fontSize: 21, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 14, paddingHorizontal: 20 },
  loadingText: { fontSize: 13, fontWeight: '600' },
  errorCard: { borderRadius: 16, borderWidth: 1, padding: 18, gap: 10, alignItems: 'center' },
  errorText: { fontSize: 13, fontWeight: '600', textAlign: 'center', lineHeight: 19 },
  retryBtn: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 8, marginTop: 4 },
  retryText: { fontSize: 13, fontWeight: '800' },
  emptyTitle: { fontSize: 20, fontWeight: '800', marginTop: 4 },
  emptyText: { fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 4 },
  summaryCard: { borderRadius: 24, padding: 20, marginBottom: 26, overflow: 'hidden' },
  heroOrb: { position: 'absolute', width: 200, height: 200, borderRadius: 100, right: -60, top: -80, opacity: 0.18 },
  summaryEyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.6, marginBottom: 14 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryTitle: { fontSize: 28, fontWeight: '800', letterSpacing: -0.7 },
  trackBg: { height: 8, borderRadius: 6, marginTop: 16, overflow: 'hidden' },
  trackFill: { height: 8, borderRadius: 6 },
  summarySub: { fontSize: 12, fontWeight: '600', marginTop: 12 },
  eventBlock: { marginBottom: 20 },
  eventHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 16, borderWidth: 1, marginBottom: 2 },
  eventName: { fontSize: 15, fontWeight: '800' },
  eventMeta: { fontSize: 11, marginTop: 3 },
  eventBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  eventBadgeText: { fontSize: 13, fontWeight: '800' },
  sessionRow: { flexDirection: 'row', alignItems: 'center', padding: 13, gap: 10, borderBottomWidth: 1, marginLeft: 0 },
  sessionIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  sessionInfo: { flex: 1 },
  sessionLabel: { fontSize: 14, fontWeight: '700' },
  sessionTime: { fontSize: 11, marginTop: 2 },
  pill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 9 },
  pillText: { fontSize: 11, fontWeight: '800' },
});
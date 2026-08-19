import React, { useState } from 'react';
import { Feather, Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar, IconCircle, Screen, SectionTitle } from '@/components/AttendaUI';
import { useAttendance } from '@/context/AttendanceContext';
import { useColors } from '@/hooks/useColors';
import { useStudentAttendance } from '@/hooks/useStudentAttendance';

export default function Dashboard() {
  const colors = useColors();
  const { account } = useAttendance();
  const { events, loading } = useStudentAttendance(account?.studentId);
  const [showQrModal, setShowQrModal] = useState(false);

  if (!account) return null;

  // Aggregate totals across all events
  const totalPresent = events.reduce((sum, e) => sum + e.presentCount, 0);
  const totalSessions = events.reduce((sum, e) => sum + e.totalSessions, 0);
  const completed = totalSessions > 0 ? Math.round((totalPresent / totalSessions) * 100) : 0;

  // Pick the most recent/active event for the dashboard card
  const featuredEvent = events[0];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning,' : hour < 18 ? 'Good afternoon,' : 'Good evening,';
  const today = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());

  const qrData = `ZDSPGC_PERMANENT_QR_01:${account.studentId}`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=350x350&data=${encodeURIComponent(qrData)}&margin=12&format=png`;

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text style={[styles.greeting, { color: colors.mutedForeground }]}>{greeting}</Text>
          <Text style={[styles.name, { color: colors.primary }]}>{account.fullName.split(' ')[0]}.</Text>
        </View>
        <Pressable onPress={() => router.push('/(tabs)/profile')}>
          <Avatar uri={account.photoUri} name={account.fullName} size={46} />
        </Pressable>
      </View>

      <View style={[styles.dateLine, { borderBottomColor: colors.border }]}>
        <Feather name="calendar" size={15} color={colors.success} />
        <Text style={[styles.date, { color: colors.inkSoft }]}>{today}</Text>
        <View style={styles.dot} />
        <Text style={[styles.live, { color: colors.success }]}>Live</Text>
      </View>

      {/* Identity/Status card with Show QR Pass Button */}
      {(() => {
        const isPrimaryAccentSame = colors.primary === colors.accent;
        const heroContrastColor = isPrimaryAccentSame ? colors.accentForeground : colors.accent;
        const heroSubColor = isPrimaryAccentSame ? colors.accentForeground : colors.secondary;
        const heroIconBg = isPrimaryAccentSame ? colors.secondary : colors.accent;
        return (
          <View style={[styles.heroCard, { backgroundColor: colors.primary }]}>
            <View style={[styles.heroOrb, { backgroundColor: heroContrastColor }]} />
            <Text style={[styles.heroOver, { color: heroContrastColor }]}>ACCOUNT STATUS</Text>
            <View style={styles.heroRow}>
              <Text style={[styles.heroTitle, { color: colors.primaryForeground }]}>
                You're registered{'\n'}and accounted for.
              </Text>
              <IconCircle icon="shield-checkmark" color={heroIconBg} />
            </View>
            <View style={styles.heroBottomRow}>
              <Text style={[styles.heroCopy, { color: heroSubColor }]}>
                {account.studentId} · {account.program}
              </Text>
              <Pressable
                onPress={() => setShowQrModal(true)}
                style={({ pressed }) => [
                  styles.qrHeroButton,
                  { backgroundColor: colors.accent, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Ionicons name="qr-code-outline" size={16} color={colors.accentForeground || '#000'} />
                <Text style={[styles.qrHeroButtonText, { color: colors.accentForeground || '#000' }]}>
                  My QR Pass
                </Text>
              </Pressable>
            </View>
          </View>
        );
      })()}

      {/* Featured Event */}
      <SectionTitle
        eyebrow="Events"
        title={featuredEvent ? featuredEvent.eventName : 'No active events'}
        action={
          <Pressable onPress={() => router.push('/(tabs)/records')}>
            <Text style={[styles.link, { color: colors.success }]}>View all</Text>
          </Pressable>
        }
      />

      {/* Attendance progress */}
      <View style={[styles.progressCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.progressTop}>
          <View>
            <Text style={[styles.progressLabel, { color: colors.mutedForeground }]}>Attendance completion</Text>
            {loading ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 6 }} />
            ) : (
              <Text style={[styles.progressNumber, { color: colors.primary }]}>
                {completed}%{' '}
                <Text style={[styles.progressSmall, { color: colors.mutedForeground }]}>of sessions recorded</Text>
              </Text>
            )}
          </View>
          <View style={[styles.checkBadge, { backgroundColor: colors.secondary }]}>
            <Feather name="check" size={19} color={colors.success} />
          </View>
        </View>
        <View style={[styles.track, { backgroundColor: colors.muted }]}>
          <View style={[styles.fill, { width: `${completed}%`, backgroundColor: colors.success }]} />
        </View>
        <Text style={[styles.progressHint, { color: colors.mutedForeground }]}>
          {totalPresent} of {totalSessions} sessions have a confirmed attendance record.
        </Text>
      </View>

      {/* Quick access */}
      <SectionTitle eyebrow="Quick access" title="Stay in the loop" />
      <View style={styles.quickGrid}>
        <Pressable
          onPress={() => setShowQrModal(true)}
          style={({ pressed }) => [styles.quick, { backgroundColor: colors.secondary, opacity: pressed ? 0.7 : 1 }]}
        >
          <IconCircle icon="qr-code" />
          <Text style={[styles.quickTitle, { color: colors.primary }]}>Student{'\n'}QR Pass</Text>
          <Feather name="arrow-up-right" size={16} color={colors.success} />
        </Pressable>
        <Pressable
          onPress={() => router.push('/(tabs)/records')}
          style={({ pressed }) => [styles.quick, { backgroundColor: colors.secondary, opacity: pressed ? 0.7 : 1 }]}
        >
          <IconCircle icon="list-outline" />
          <Text style={[styles.quickTitle, { color: colors.primary }]}>Attendance{'\n'}records</Text>
          <Feather name="arrow-up-right" size={16} color={colors.success} />
        </Pressable>
        <Pressable
          onPress={() => router.push('/(tabs)/profile')}
          style={({ pressed }) => [styles.quick, { backgroundColor: colors.cream, opacity: pressed ? 0.7 : 1 }]}
        >
          <IconCircle icon="person-outline" color={colors.accent} />
          <Text style={[styles.quickTitle, { color: colors.primary }]}>My student{'\n'}profile</Text>
          <Feather name="arrow-up-right" size={16} color={colors.success} />
        </Pressable>
      </View>

      <View style={[styles.note, { backgroundColor: colors.muted }]}>
        <Feather name="info" size={17} color={colors.inkSoft} />
        <Text style={[styles.noteText, { color: colors.inkSoft }]}>
          Show your Student QR Pass to event officers for instant attendance verification.
        </Text>
      </View>

      {/* STUDENT QR PASS MODAL — MATCHES OFFICIAL SEMESTER PASS */}
      <Modal
        visible={showQrModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowQrModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalTop}>
              <View style={styles.modalHeaderLeft}>
                <View style={styles.badgeRow}>
                  <Ionicons name="shield-checkmark" size={14} color={colors.success} />
                  <Text style={[styles.modalSub, { color: colors.success }]}>OFFICIAL DIGITAL PASS</Text>
                </View>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>Semester QR Pass</Text>
              </View>
              <Pressable onPress={() => setShowQrModal(false)} style={styles.closeBtn}>
                <Feather name="x" size={20} color={colors.foreground} />
              </Pressable>
            </View>

            {/* Official Semester Pass Card Replica */}
            <View style={styles.semesterCard}>
              {/* Card Header Ribbon */}
              <View style={styles.cardHeaderRibbon}>
                <View>
                  <Text style={styles.cardSchoolName}>ZDSPGC – DIMATALING CAMPUS</Text>
                  <Text style={styles.cardAppName}>DIMSAT SID</Text>
                </View>
                <View style={styles.semesterBadge}>
                  <Text style={styles.semesterBadgeText}>SEMESTER PASS</Text>
                </View>
              </View>

              {/* Card Body */}
              <View style={styles.cardBody}>
                <View style={styles.cardStudentInfo}>
                  <Text style={styles.cardFieldLabel}>STUDENT NAME</Text>
                  <Text style={styles.cardStudentName} numberOfLines={2}>
                    {account.fullName}
                  </Text>

                  <View style={styles.cardMetaGrid}>
                    <View style={styles.cardMetaCol}>
                      <Text style={styles.cardMetaItem}>
                        <Text style={styles.cardMetaKey}>ID: </Text>
                        <Text style={styles.cardMetaVal}>{account.studentId}</Text>
                      </Text>
                      <Text style={styles.cardMetaItem}>
                        <Text style={styles.cardMetaKey}>PROG: </Text>
                        <Text style={styles.cardMetaVal}>{account.program || 'BSIS'}</Text>
                      </Text>
                    </View>
                    <View style={styles.cardMetaCol}>
                      <Text style={styles.cardMetaItem}>
                        <Text style={styles.cardMetaKey}>YR: </Text>
                        <Text style={styles.cardMetaVal}>Lvl {account.yearLevel || '1'}</Text>
                      </Text>
                      <Text style={styles.cardMetaItem}>
                        <Text style={styles.cardMetaKey}>SEX: </Text>
                        <Text style={styles.cardMetaVal}>{account.sex || 'Female'}</Text>
                      </Text>
                    </View>
                  </View>
                </View>

                {/* High-contrast QR Container */}
                <View style={styles.cardQrContainer}>
                  <Image
                    source={{ uri: qrImageUrl }}
                    style={styles.cardQrImage}
                    resizeMode="contain"
                  />
                </View>
              </View>

              {/* Card Footer */}
              <View style={styles.cardFooter}>
                <Text style={styles.cardFooterText}>OFFICIAL STUDENT ATTENDANCE PASS</Text>
                <Text style={styles.cardFooterText}>REUSABLE ALL SEMESTER</Text>
              </View>
            </View>

            {/* Permanent Pass Reassurance Banner */}
            <View style={[styles.passNotice, { backgroundColor: colors.muted }]}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <Text style={[styles.passNoticeText, { color: colors.inkSoft }]}>
                Permanent pass encoded. Use this digital pass if you misplace your printed card.
              </Text>
            </View>

            <Pressable
              onPress={() => setShowQrModal(false)}
              style={[styles.doneBtn, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.doneBtnText, { color: colors.primaryForeground }]}>Close Pass</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greeting: { fontSize: 15, fontWeight: '600' },
  name: { fontSize: 31, fontWeight: '800', letterSpacing: -1.2, marginTop: 1 },
  dateLine: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 17, borderBottomWidth: 1, marginBottom: 21 },
  date: { fontSize: 13, fontWeight: '600' },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#8fa39b' },
  live: { fontSize: 12, fontWeight: '800' },
  heroCard: { borderRadius: 26, padding: 21, overflow: 'hidden', minHeight: 182, marginBottom: 31 },
  heroOrb: { position: 'absolute', width: 180, height: 180, borderRadius: 90, right: -54, top: -75, opacity: 0.2 },
  heroOver: { fontSize: 11, fontWeight: '800', letterSpacing: 1.7, marginBottom: 16 },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroTitle: { fontSize: 25, lineHeight: 27, fontWeight: '800', letterSpacing: -0.7 },
  heroBottomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20 },
  heroCopy: { fontSize: 12, fontWeight: '600' },
  qrHeroButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  qrHeroButtonText: { fontSize: 12, fontWeight: '800' },
  link: { fontSize: 13, fontWeight: '800' },
  progressCard: { borderRadius: 21, borderWidth: 1, padding: 17, marginBottom: 30 },
  progressTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  progressLabel: { fontSize: 12, fontWeight: '700', marginBottom: 5 },
  progressNumber: { fontSize: 27, fontWeight: '800' },
  progressSmall: { fontSize: 12, fontWeight: '600' },
  checkBadge: { width: 41, height: 41, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  track: { height: 9, borderRadius: 8, marginTop: 18, overflow: 'hidden' },
  fill: { height: 9, borderRadius: 8 },
  progressHint: { fontSize: 12, lineHeight: 17, marginTop: 11 },
  quickGrid: { flexDirection: 'row', gap: 10 },
  quick: { flex: 1, borderRadius: 18, minHeight: 130, padding: 13, justifyContent: 'space-between' },
  quickTitle: { fontSize: 15, lineHeight: 18, fontWeight: '800' },
  note: { marginTop: 24, padding: 14, borderRadius: 16, flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  noteText: { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalBox: { width: '100%', maxWidth: 380, borderRadius: 24, borderWidth: 1, padding: 18, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.35, shadowRadius: 24, elevation: 12 },
  modalTop: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  modalHeaderLeft: { gap: 2 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  modalTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.4 },
  modalSub: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2 },
  closeBtn: { padding: 4 },

  /* Official Semester Pass Card Styles */
  semesterCard: { width: '100%', backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 2, borderColor: '#0f172a', padding: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 8, elevation: 6 },
  cardHeaderRibbon: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1.5, borderBottomColor: '#0f172a', paddingBottom: 6, marginBottom: 8 },
  cardSchoolName: { fontSize: 8.5, fontWeight: '900', color: '#047857', letterSpacing: 0.8, textTransform: 'uppercase' },
  cardAppName: { fontSize: 10.5, fontWeight: '900', color: '#0f172a', letterSpacing: -0.2, textTransform: 'uppercase', marginTop: 1 },
  semesterBadge: { backgroundColor: '#0f172a', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 4 },
  semesterBadgeText: { color: '#ffffff', fontSize: 8, fontWeight: '900', letterSpacing: 0.8, textTransform: 'uppercase' },
  cardBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginVertical: 4 },
  cardStudentInfo: { flex: 1, minWidth: 0 },
  cardFieldLabel: { fontSize: 7, fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 },
  cardStudentName: { fontSize: 12, fontWeight: '900', color: '#0f172a', textTransform: 'uppercase', letterSpacing: -0.3, marginTop: 1, marginBottom: 6 },
  cardMetaGrid: { flexDirection: 'row', gap: 8 },
  cardMetaCol: { gap: 3 },
  cardMetaItem: { fontSize: 8.5, lineHeight: 11 },
  cardMetaKey: { color: '#64748b', fontWeight: '700' },
  cardMetaVal: { color: '#0f172a', fontWeight: '900' },
  cardQrContainer: { width: 88, height: 88, borderRadius: 8, borderWidth: 1.5, borderColor: '#0f172a', backgroundColor: '#ffffff', padding: 2, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  cardQrImage: { width: 80, height: 80 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 5, marginTop: 6 },
  cardFooterText: { fontSize: 6.5, fontWeight: '800', color: '#64748b', letterSpacing: 0.4, textTransform: 'uppercase' },

  passNotice: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12, width: '100%', marginTop: 12, marginBottom: 14 },
  passNoticeText: { flex: 1, fontSize: 10.5, lineHeight: 14, fontWeight: '600' },
  doneBtn: { width: '100%', paddingVertical: 12, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  doneBtnText: { fontSize: 13, fontWeight: '800' },
});

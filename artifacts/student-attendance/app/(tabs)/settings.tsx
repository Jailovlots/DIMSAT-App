import React, { useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, Modal, Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Field, PrimaryButton, Screen, SectionTitle } from '@/components/AttendaUI';
import { useAttendance } from '@/context/AttendanceContext';
import { useColors } from '@/hooks/useColors';

export default function Settings() {
  const colors = useColors();
  const { account, setNotifications, logout, resetPassword } = useAttendance();
  const [showPwdModal, setShowPwdModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  if (!account) return null;

  const performLogout = async () => {
    await logout();
    router.replace('/welcome');
  };

  const signOut = () => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.confirm('Log out of DIMSAT?\n\nYour saved records will stay on this device.')) {
        performLogout();
      }
    } else {
      Alert.alert('Log out of DIMSAT?', 'Your saved records will stay on this device.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Log out', style: 'destructive', onPress: performLogout },
      ]);
    }
  };

  const handleUpdatePassword = async () => {
    setPwdError('');
    setPwdSuccess('');
    if (!newPassword || newPassword.length < 6) {
      return setPwdError('Password must be at least 6 characters.');
    }
    if (newPassword !== confirmPassword) {
      return setPwdError('Passwords do not match.');
    }

    setBusy(true);
    const res = await resetPassword(account.studentId, account.fullName, newPassword);
    setBusy(false);

    if (!res.ok) {
      return setPwdError(res.error ?? 'Failed to update password.');
    }

    setPwdSuccess('Password updated successfully!');
    setNewPassword('');
    setConfirmPassword('');
    setTimeout(() => {
      setShowPwdModal(false);
      setPwdSuccess('');
    }, 1200);
  };

  return (
    <Screen>
      <View style={styles.top}>
        <Text style={[styles.title, { color: colors.primary }]}>Account settings</Text>
        <Feather name="settings" size={22} color={colors.success} />
      </View>
      <SectionTitle eyebrow="Preferences" title="Keep Attenda useful" />
      <View style={[styles.setting, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.settingIcon, { backgroundColor: colors.secondary }]}>
          <Feather name="bell" size={18} color={colors.success} />
        </View>
        <View style={styles.settingCopy}>
          <Text style={[styles.settingTitle, { color: colors.foreground }]}>Attendance reminders</Text>
          <Text style={[styles.settingSub, { color: colors.mutedForeground }]}>Get a gentle reminder when a session is coming up.</Text>
        </View>
        <Switch value={account.notifications} onValueChange={setNotifications} trackColor={{ false: colors.muted, true: colors.secondary }} thumbColor={account.notifications ? colors.success : colors.mutedForeground} />
      </View>
      <SectionTitle eyebrow="Account details" title="Your sign-in" />
      <View style={[styles.accountCard, { backgroundColor: colors.secondary }]}>
        <View>
          <Text style={[styles.accountLabel, { color: colors.mutedForeground }]}>Student ID</Text>
          <Text style={[styles.accountValue, { color: colors.primary }]}>{account.studentId}</Text>
        </View>
        <View style={[styles.rule, { backgroundColor: colors.border }]} />
        <View style={styles.pwdRow}>
          <View>
            <Text style={[styles.accountLabel, { color: colors.mutedForeground }]}>Password</Text>
            <Text style={[styles.accountValue, { color: colors.primary }]}>••••••••</Text>
          </View>
          <Pressable
            onPress={() => { setShowPwdModal(true); setPwdError(''); setPwdSuccess(''); setNewPassword(''); setConfirmPassword(''); }}
            style={({ pressed }) => [styles.resetPwdBtn, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}
          >
            <Feather name="key" size={13} color={colors.primary} />
            <Text style={[styles.resetPwdBtnText, { color: colors.primary }]}>Reset Password</Text>
          </Pressable>
        </View>
      </View>
      <Pressable onPress={signOut} style={({ pressed }) => [styles.logout, { borderColor: colors.destructive, opacity: pressed ? 0.7 : 1 }]}>
        <Feather name="log-out" size={17} color={colors.destructive} />
        <Text style={[styles.logoutText, { color: colors.destructive }]}>Log out of this device</Text>
      </Pressable>
      <Text style={[styles.version, { color: colors.mutedForeground }]}>Attenda · Student companion · v1.0</Text>

      {/* Password Reset Modal */}
      <Modal visible={showPwdModal} transparent animationType="fade" onRequestClose={() => setShowPwdModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <View style={[styles.modalIcon, { backgroundColor: `${colors.primary}20` }]}>
                  <Feather name="key" size={18} color={colors.primary} />
                </View>
                <View>
                  <Text style={[styles.modalTitle, { color: colors.foreground }]}>Reset Password</Text>
                  <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>{account.studentId}</Text>
                </View>
              </View>
              <Pressable onPress={() => setShowPwdModal(false)} style={styles.closeBtn}>
                <Feather name="x" size={20} color={colors.foreground} />
              </Pressable>
            </View>

            {pwdSuccess ? (
              <View style={[styles.successBox, { backgroundColor: `${colors.success}18` }]}>
                <Feather name="check-circle" size={16} color={colors.success} />
                <Text style={[styles.successBoxText, { color: colors.success }]}>{pwdSuccess}</Text>
              </View>
            ) : null}

            <Field label="New Password" value={newPassword} onChangeText={setNewPassword} placeholder="Min. 6 characters" secureTextEntry />
            <Field label="Confirm New Password" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Repeat new password" secureTextEntry error={pwdError} />

            <View style={styles.modalActions}>
              <PrimaryButton label="Save New Password" icon="check" onPress={handleUpdatePassword} loading={busy} />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 33 },
  title: { fontSize: 29, fontWeight: '800', letterSpacing: -1 },
  setting: { borderWidth: 1, borderRadius: 20, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 30 },
  settingIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  settingCopy: { flex: 1 },
  settingTitle: { fontSize: 14, fontWeight: '800' },
  settingSub: { fontSize: 11, lineHeight: 16, marginTop: 3 },
  accountCard: { borderRadius: 20, padding: 17, gap: 14 },
  accountLabel: { fontSize: 11, fontWeight: '700' },
  accountValue: { fontSize: 16, fontWeight: '800', marginTop: 4 },
  rule: { height: 1 },
  pwdRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resetPwdBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1 },
  resetPwdBtnText: { fontSize: 12, fontWeight: '800' },
  logout: { marginTop: 32, borderWidth: 1, borderRadius: 15, height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  logoutText: { fontSize: 14, fontWeight: '800' },
  version: { textAlign: 'center', fontSize: 11, marginTop: 23 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalBox: { width: '100%', maxWidth: 360, borderRadius: 22, borderWidth: 1, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 10 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  modalSub: { fontSize: 11, fontWeight: '600' },
  closeBtn: { padding: 4 },
  modalActions: { marginTop: 8 },
  successBox: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, marginBottom: 12 },
  successBoxText: { fontSize: 12, fontWeight: '700' },
});
import React from 'react';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Screen, SectionTitle } from '@/components/AttendaUI';
import { useAttendance } from '@/context/AttendanceContext';
import { useColors } from '@/hooks/useColors';

export default function Settings() {
  const colors = useColors();
  const { account, setNotifications, logout } = useAttendance();
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
        <View>
          <Text style={[styles.accountLabel, { color: colors.mutedForeground }]}>Password</Text>
          <Text style={[styles.accountValue, { color: colors.primary }]}>••••••••</Text>
        </View>
      </View>
      <Pressable onPress={signOut} style={({ pressed }) => [styles.logout, { borderColor: colors.destructive, opacity: pressed ? 0.7 : 1 }]}>
        <Feather name="log-out" size={17} color={colors.destructive} />
        <Text style={[styles.logoutText, { color: colors.destructive }]}>Log out of this device</Text>
      </Pressable>
      <Text style={[styles.version, { color: colors.mutedForeground }]}>Attenda · Student companion · v1.0</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({ top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 33 }, title: { fontSize: 29, fontWeight: '800', letterSpacing: -1 }, setting: { borderWidth: 1, borderRadius: 20, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 30 }, settingIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, settingCopy: { flex: 1 }, settingTitle: { fontSize: 14, fontWeight: '800' }, settingSub: { fontSize: 11, lineHeight: 16, marginTop: 3 }, accountCard: { borderRadius: 20, padding: 17, gap: 14 }, accountLabel: { fontSize: 11, fontWeight: '700' }, accountValue: { fontSize: 16, fontWeight: '800', marginTop: 4 }, rule: { height: 1 }, logout: { marginTop: 32, borderWidth: 1, borderRadius: 15, height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, logoutText: { fontSize: 14, fontWeight: '800' }, version: { textAlign: 'center', fontSize: 11, marginTop: 23 } });
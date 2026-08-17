import React, { useState } from 'react';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar, PrimaryButton, Screen } from '@/components/AttendaUI';
import { MAX_PROFILE_PHOTO_CHANGES, useAttendance } from '@/context/AttendanceContext';
import { useColors } from '@/hooks/useColors';

export default function Photo() {
  const colors = useColors();
  const { account, updatePhoto } = useAttendance();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (!account) return null;
  const choose = async () => {
    setError('');
    if (account.photoChanges >= MAX_PROFILE_PHOTO_CHANGES) return setError('Maximum profile photo changes reached. Please contact the Admin.');
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return setError('Photo access is needed to choose a profile photo.');
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.85, base64: true });
    if (result.canceled || !result.assets[0]?.uri) return;
    // Build a browser-compatible data URL so the admin web console can display the image.
    // The raw local device URI (file:///...) is only accessible on the mobile device itself.
    const asset = result.assets[0];
    const photoDataUrl = asset.base64
      ? `data:image/jpeg;base64,${asset.base64}`
      : asset.uri; // fallback to URI if base64 is unavailable
    setBusy(true);
    const saved = await updatePhoto(photoDataUrl);
    setBusy(false);
    if (!saved.ok) return setError(saved.error ?? '');
    router.back();
  };
  return <Screen><Pressable onPress={() => router.back()} style={styles.back}><Feather name="arrow-left" size={21} color={colors.primary} /><Text style={[styles.backText, { color: colors.primary }]}>My profile</Text></Pressable><View style={styles.center}><Text style={[styles.title, { color: colors.primary }]}>Profile photo</Text><Text style={[styles.sub, { color: colors.mutedForeground }]}>Choose a clear photo your campus team can recognize.</Text><View style={[styles.photoRing, { borderColor: colors.accent }]}><Avatar uri={account.photoUri} name={account.fullName} size={150} /></View><Text style={[styles.count, { color: colors.inkSoft }]}>{account.photoChanges} of {MAX_PROFILE_PHOTO_CHANGES} changes used</Text>{error && <View style={[styles.error, { backgroundColor: `${colors.destructive}18` }]}><Feather name="alert-circle" size={16} color={colors.destructive} /><Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text></View>}<PrimaryButton label={account.photoUri ? 'Choose a different photo' : 'Choose from gallery'} icon="image" onPress={choose} loading={busy} disabled={account.photoChanges >= MAX_PROFILE_PHOTO_CHANGES} /><Text style={[styles.note, { color: colors.mutedForeground }]}>You can update this twice. The selected image stays on this device.</Text></View></Screen>;
}
const styles = StyleSheet.create({ back: { flexDirection: 'row', alignItems: 'center', gap: 8 }, backText: { fontSize: 14, fontWeight: '800' }, center: { alignItems: 'center', marginTop: 45 }, title: { fontSize: 30, fontWeight: '800' }, sub: { fontSize: 14, textAlign: 'center', lineHeight: 21, marginTop: 8, maxWidth: 290 }, photoRing: { padding: 6, borderWidth: 2, borderRadius: 90, marginTop: 32 }, count: { fontSize: 12, fontWeight: '700', marginTop: 15, marginBottom: 25 }, error: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: 14, marginBottom: 15, alignItems: 'flex-start', width: '100%' }, errorText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '700' }, note: { fontSize: 12, textAlign: 'center', lineHeight: 18, marginTop: 15, maxWidth: 285 } });
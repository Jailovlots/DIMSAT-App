import React, { useState } from 'react';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar, PrimaryButton, Screen } from '@/components/AttendaUI';
import { MAX_PROFILE_PHOTO_CHANGES, useAttendance } from '@/context/AttendanceContext';
import { useColors } from '@/hooks/useColors';

async function convertAssetToDataUrl(asset: ImagePicker.ImagePickerAsset): Promise<string> {
  if (asset.base64) {
    // If base64 already has a data prefix or is raw base64
    return asset.base64.startsWith('data:image/')
      ? asset.base64
      : `data:image/jpeg;base64,${asset.base64}`;
  }
  if (asset.uri && asset.uri.startsWith('data:image/')) {
    return asset.uri;
  }
  if (Platform.OS === 'web' && asset.uri) {
    try {
      const res = await fetch(asset.uri);
      const blob = await res.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') resolve(reader.result);
          else reject(new Error('Failed to read image as base64'));
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      return asset.uri;
    }
  }
  return asset.uri;
}

export default function Photo() {
  const colors = useColors();
  const { account, updatePhoto } = useAttendance();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!account) return null;

  const choose = async () => {
    setError('');
    if (account.photoChanges >= MAX_PROFILE_PHOTO_CHANGES) {
      return setError('Maximum profile photo changes reached. Please contact the Admin.');
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return setError('Photo access is needed to choose a profile photo.');
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.75,
      base64: true,
    });
    if (result.canceled || !result.assets[0]) return;

    setBusy(true);
    try {
      const photoDataUrl = await convertAssetToDataUrl(result.assets[0]);
      const saved = await updatePhoto(photoDataUrl);
      if (!saved.ok) {
        setError(saved.error ?? 'Failed to update profile photo.');
      } else {
        router.back();
      }
    } catch (e: any) {
      setError(e?.message || 'Error processing photo. Please try another image.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Pressable onPress={() => router.back()} style={styles.back}>
        <Feather name="arrow-left" size={21} color={colors.primary} />
        <Text style={[styles.backText, { color: colors.primary }]}>My profile</Text>
      </Pressable>
      <View style={styles.center}>
        <Text style={[styles.title, { color: colors.primary }]}>Profile photo</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground }]}>
          Choose a clear photo your campus team and officers can recognize when scanning your QR code.
        </Text>
        <View style={[styles.photoRing, { borderColor: colors.accent }]}>
          <Avatar uri={account.photoUri} name={account.fullName} size={150} />
        </View>
        <Text style={[styles.count, { color: colors.inkSoft }]}>
          {account.photoChanges} of {MAX_PROFILE_PHOTO_CHANGES} changes used
        </Text>
        {error ? (
          <View style={[styles.error, { backgroundColor: `${colors.destructive}18` }]}>
            <Feather name="alert-circle" size={16} color={colors.destructive} />
            <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
          </View>
        ) : null}
        <PrimaryButton
          label={account.photoUri ? 'Choose a different photo' : 'Choose from gallery'}
          icon="image"
          onPress={choose}
          loading={busy}
          disabled={account.photoChanges >= MAX_PROFILE_PHOTO_CHANGES}
        />
        <Text style={[styles.note, { color: colors.mutedForeground }]}>
          You can update this up to {MAX_PROFILE_PHOTO_CHANGES} times. Your photo syncs instantly to officers & admin.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  backText: { fontSize: 14, fontWeight: '800' },
  center: { alignItems: 'center', marginTop: 45 },
  title: { fontSize: 30, fontWeight: '800' },
  sub: { fontSize: 14, textAlign: 'center', lineHeight: 21, marginTop: 8, maxWidth: 290 },
  photoRing: { padding: 6, borderWidth: 2, borderRadius: 90, marginTop: 32 },
  count: { fontSize: 12, fontWeight: '700', marginTop: 15, marginBottom: 25 },
  error: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: 14, marginBottom: 15, alignItems: 'flex-start', width: '100%' },
  errorText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '700' },
  note: { fontSize: 12, textAlign: 'center', lineHeight: 18, marginTop: 15, maxWidth: 285 },
});
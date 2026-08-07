import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAttendance } from '@/context/AttendanceContext';
import { useColors } from '@/hooks/useColors';

export default function Entry() {
  const colors = useColors();
  const { account, isReady } = useAttendance();
  if (!isReady) return <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.primary} /></View>;
  return <Redirect href={account ? '/(tabs)' : '/welcome'} />;
}
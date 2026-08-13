import React, { useEffect } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { router, Tabs } from 'expo-router';
import { useAttendance } from '@/context/AttendanceContext';

// IMPORTANT: iOS 26 uses NativeTabs for native tabs with liquid glass support.
// NativeTabs intentionally does NOT use custom design tokens — liquid glass
// is a system-level appearance provided by iOS and cannot be overridden.
// Custom brand colors are applied only on the ClassicTabLayout path (older iOS / Android / web).
function TopKebabHeaderMenu() {
  const colors = useColors();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const { account, logout } = useAttendance();

  return (
    <>
      <Pressable
        onPress={() => setMenuOpen(true)}
        style={{ marginRight: 16, padding: 6, borderRadius: 8 }}
        hitSlop={10}
      >
        <Feather name="more-vertical" size={20} color={colors.primary} />
      </Pressable>

      <Modal
        visible={menuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuOpen(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-start', alignItems: 'flex-end', paddingTop: 56, paddingRight: 16 }}
          onPress={() => setMenuOpen(false)}
        >
          <View style={{ width: 240, borderRadius: 16, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, padding: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 8 }}>
            <View style={{ paddingBottom: 8, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.foreground }}>{account?.fullName || 'Student Portal'}</Text>
              <Text style={{ fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: colors.mutedForeground, marginTop: 2 }}>{account?.studentId || 'Certified Roster'}</Text>
            </View>

            <Text style={{ fontSize: 9, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontWeight: '700', color: colors.mutedForeground, marginBottom: 6, textTransform: 'uppercase' }}>
              Choices for Officer & Student
            </Text>

            <Pressable
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 8, borderRadius: 8 }}
              onPress={() => { setMenuOpen(false); router.push('/(tabs)'); }}
            >
              <Feather name="home" size={16} color={colors.primary} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.foreground }}>Home Dashboard</Text>
            </Pressable>

            <Pressable
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 8, borderRadius: 8 }}
              onPress={() => { setMenuOpen(false); router.push('/(tabs)/profile'); }}
            >
              <Feather name="user" size={16} color={colors.success} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.foreground }}>Student QR Pass</Text>
            </Pressable>

            <Pressable
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 8, borderRadius: 8 }}
              onPress={() => { setMenuOpen(false); router.push('/(tabs)/records'); }}
            >
              <Feather name="list" size={16} color={colors.accent} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.foreground }}>Attendance Records</Text>
            </Pressable>

            <Pressable
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 8, borderRadius: 8 }}
              onPress={() => { setMenuOpen(false); router.push('/(tabs)/settings'); }}
            >
              <Feather name="sliders" size={16} color={colors.inkSoft} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.foreground }}>App Settings</Text>
            </Pressable>

            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 8 }} />

            <Pressable
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 8, borderRadius: 8 }}
              onPress={() => { setMenuOpen(false); logout(); }}
            >
              <Feather name="log-out" size={16} color="#ef4444" />
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#ef4444' }}>Sign Out</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: true,
        headerRight: () => <TopKebabHeaderMenu />,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: isIOS ? 'transparent' : colors.background,
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: colors.border,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint={isDark ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
          ) : isWeb ? (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: colors.background },
              ]}
            />
          ) : null,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Feather name="home" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="records"
        options={{
          title: 'Records',
          tabBarIcon: ({ color }) => <Feather name="list" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <Feather name="user" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <Feather name="sliders" size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}

/**
 * Auth guard wrapper: if account is null (logged out), redirect immediately to /welcome.
 * This makes the logout button functional — as soon as the context clears activeStudentId,
 * this effect fires and navigates away from the protected tabs.
 */
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { account, isReady } = useAttendance();

  useEffect(() => {
    if (isReady && !account) {
      router.replace('/welcome');
    }
  }, [account, isReady]);

  if (!isReady || !account) return null;
  return <>{children}</>;
}

export default function TabLayout() {
  return (
    <AuthGuard>
      <ClassicTabLayout />
    </AuthGuard>
  );
}

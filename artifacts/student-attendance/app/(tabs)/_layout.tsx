import React, { useEffect } from 'react';
import { Appearance, Modal, Platform, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
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
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [menuOpen, setMenuOpen] = React.useState(false);
  const { account, logout } = useAttendance();

  const toggleTheme = () => {
    Appearance.setColorScheme(isDark ? 'light' : 'dark');
  };

  const handleSignOut = async () => {
    setMenuOpen(false);
    await logout();
  };

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
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'flex-start',
            alignItems: 'flex-end',
            paddingTop: Platform.OS === 'ios' ? 56 : 48,
            paddingRight: 16,
          }}
          onPress={() => setMenuOpen(false)}
        >
          <View
            style={{
              width: 250,
              borderRadius: 16,
              backgroundColor: colors.card,
              borderWidth: 1,
              borderColor: colors.border,
              padding: 12,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.25,
              shadowRadius: 10,
              elevation: 10,
            }}
          >
            {/* User Header */}
            <View style={{ paddingBottom: 10, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: colors.primary }}>
                    {account?.fullName?.[0] || 'S'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: colors.foreground }} numberOfLines={1}>
                    {account?.fullName || 'Student Portal'}
                  </Text>
                  <Text style={{ fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', color: colors.mutedForeground, marginTop: 1 }}>
                    {account?.studentId || 'Certified Roster'}
                  </Text>
                </View>
              </View>
            </View>

            {/* References & Roster Access Section */}
            <Text style={{ fontSize: 9, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontWeight: '800', color: colors.mutedForeground, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              References & Roster Access
            </Text>

            <Pressable
              style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 8, backgroundColor: pressed ? colors.muted : 'transparent' }]}
              onPress={() => { setMenuOpen(false); router.push('/(tabs)/profile'); }}
            >
              <Feather name="credit-card" size={16} color={colors.primary} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.foreground, flex: 1 }}>Student Digital QR Pass</Text>
              <View style={{ backgroundColor: `${colors.primary}20`, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 }}>
                <Text style={{ fontSize: 9, fontWeight: '800', color: colors.primary }}>CARD</Text>
              </View>
            </Pressable>

            <Pressable
              style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 8, backgroundColor: pressed ? colors.muted : 'transparent' }]}
              onPress={() => { setMenuOpen(false); router.push('/(tabs)/records'); }}
            >
              <Feather name="list" size={16} color={colors.success} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.foreground }}>Attendance Records</Text>
            </Pressable>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 8, marginTop: 2, marginBottom: 6, backgroundColor: colors.secondary, borderRadius: 8 }}>
              <Feather name="check-circle" size={13} color={colors.success} />
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.success }}>Certified Active Student</Text>
            </View>

            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 6 }} />

            {/* Preferences Section */}
            <Text style={{ fontSize: 9, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontWeight: '800', color: colors.mutedForeground, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              Preferences
            </Text>

            <Pressable
              style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 8, backgroundColor: pressed ? colors.muted : 'transparent' }]}
              onPress={toggleTheme}
            >
              <Feather name={isDark ? 'sun' : 'moon'} size={16} color={isDark ? '#f59e0b' : '#6366f1'} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.foreground }}>
                {isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              </Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 8, backgroundColor: pressed ? colors.muted : 'transparent' }]}
              onPress={() => { setMenuOpen(false); router.push('/(tabs)/settings'); }}
            >
              <Feather name="sliders" size={16} color={colors.mutedForeground} />
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.foreground }}>System Settings</Text>
            </Pressable>

            <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 6 }} />

            {/* Sign Out */}
            <Pressable
              style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 8, backgroundColor: pressed ? 'rgba(239,68,68,0.1)' : 'transparent' }]}
              onPress={handleSignOut}
            >
              <Feather name="log-out" size={16} color="#ef4444" />
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#ef4444' }}>Sign out</Text>
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

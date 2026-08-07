import { Feather, Ionicons } from '@expo/vector-icons';
import React, { ReactNode } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

export function Screen({ children, scroll = true, contentStyle }: { children: ReactNode; scroll?: boolean; contentStyle?: object }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const top = Platform.OS === 'web' ? Math.max(67, insets.top) : insets.top;
  const bottom = Platform.OS === 'web' ? Math.max(34, insets.bottom) : insets.bottom;
  const styles = uiStyles;
  const content = <View style={[styles.content, { paddingTop: top + 18, paddingBottom: bottom + 100 }, contentStyle]}>{children}</View>;
  return <View style={[styles.screen, { backgroundColor: colors.background }]}>{scroll ? <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>{content}</ScrollView> : content}</View>;
}

export function BrandMark({ compact = false }: { compact?: boolean }) {
  const colors = useColors();
  return (
    <View style={styles.markRow}>
      <Image source={require('@/assets/images/attenda-icon.png')} style={[styles.mark, compact && styles.markCompact]} />
      {!compact && <View><Text style={[styles.brand, { color: colors.primary }]}>attenda</Text><Text style={[styles.brandSub, { color: colors.mutedForeground }]}>campus attendance</Text></View>}
    </View>
  );
}

export function SectionTitle({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) {
  const colors = useColors();
  return <View style={styles.sectionHeader}><View>{eyebrow && <Text style={[styles.eyebrow, { color: colors.success }]}>{eyebrow.toUpperCase()}</Text>}<Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text></View>{action}</View>;
}

export function PrimaryButton({ label, onPress, disabled = false, loading = false, icon }: { label: string; onPress: () => void; disabled?: boolean; loading?: boolean; icon?: keyof typeof Feather.glyphMap }) {
  const colors = useColors();
  return (
    <Pressable
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        {
          backgroundColor: disabled ? colors.muted : colors.primary,
          opacity: pressed ? 0.82 : 1,
        },
        (disabled || loading) && styles.disabledButton,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={colors.primaryForeground} />
      ) : (
        <View style={styles.buttonContent}>
          {icon ? (
            <Feather
              name={icon}
              size={17}
              color={colors.primaryForeground}
            />
          ) : null}
          <Text style={[styles.primaryLabel, { color: colors.primaryForeground }]}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress, icon, disabled = false }: { label: string; onPress: () => void; icon?: keyof typeof Feather.glyphMap; disabled?: boolean }) {
  const colors = useColors();
  return <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.secondaryButton, { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.72 : disabled ? 0.45 : 1 }]}>{icon && <Feather name={icon} size={17} color={colors.primary} />}<Text style={[styles.secondaryLabel, { color: colors.primary }]}>{label}</Text></Pressable>;
}

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  const colors = useColors();
  return <View style={styles.field}><Text style={[styles.fieldLabel, { color: colors.inkSoft }]}>{label}</Text><TextInput {...props} placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, backgroundColor: colors.card, borderColor: error ? colors.destructive : colors.input }]} />{error ? <Text style={[styles.fieldError, { color: colors.destructive }]}>{error}</Text> : null}</View>;
}

export function StatusPill({ status }: { status: 'Present' | 'Upcoming' | 'Missing' }) {
  const colors = useColors();
  const color = status === 'Present' ? colors.success : status === 'Missing' ? colors.destructive : colors.warning;
  const icon = status === 'Present' ? 'check-circle' : status === 'Missing' ? 'minus-circle' : 'clock';
  return <View style={[styles.pill, { backgroundColor: `${color}18` }]}><Feather name={icon} size={13} color={color} /><Text style={[styles.pillText, { color }]}>{status}</Text></View>;
}

export function Avatar({ uri, name, size = 62 }: { uri?: string; name: string; size?: number }) {
  const colors = useColors();
  return uri ? <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} /> : <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.secondary }]}><Text style={[styles.avatarText, { color: colors.primary, fontSize: size * 0.3 }]}>{name.split(' ').map((word) => word[0]).join('').slice(0, 2)}</Text></View>;
}

export function IconCircle({ icon, color }: { icon: keyof typeof Ionicons.glyphMap; color?: string }) {
  const colors = useColors();
  return <View style={[styles.iconCircle, { backgroundColor: color ?? colors.secondary }]}><Ionicons name={icon} size={19} color={colors.primary} /></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 20 },
  markRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: { width: 50, height: 50, borderRadius: 15 },
  markCompact: { width: 35, height: 35, borderRadius: 11 },
  brand: { fontSize: 26, fontWeight: '700', letterSpacing: -1.2 },
  brandSub: { fontSize: 10, letterSpacing: 1.1, textTransform: 'uppercase', marginTop: -2 },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14 },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: 4 },
  sectionTitle: { fontSize: 23, fontWeight: '700', letterSpacing: -0.5 },
  primaryButton: { height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 9, paddingHorizontal: 18 },
  buttonContent: { alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 9 },
  disabledButton: { opacity: 0.55 },
  primaryLabel: { fontSize: 16, fontWeight: '700' },
  secondaryButton: { minHeight: 50, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, paddingHorizontal: 16 },
  secondaryLabel: { fontSize: 15, fontWeight: '700' },
  field: { gap: 7, marginBottom: 15 },
  fieldLabel: { fontSize: 13, fontWeight: '700', letterSpacing: 0.1 },
  input: { height: 53, borderRadius: 15, borderWidth: 1, paddingHorizontal: 16, fontSize: 16 },
  fieldError: { fontSize: 12, lineHeight: 17, marginTop: -2 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start' },
  pillText: { fontSize: 12, fontWeight: '700' },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontWeight: '800' },
  iconCircle: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});

export const uiStyles = styles;
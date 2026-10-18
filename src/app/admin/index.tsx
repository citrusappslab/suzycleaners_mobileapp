import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Alert } from '@/lib/dialog';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UpdateStatusSheet } from '@/components/admin/UpdateStatusSheet';
import { StatusBadge } from '@/components/orders/StatusBadge';
import { AppText, Button, EmptyState, Icon, IconButton } from '@/components/ui';
import { STATUS_META, type StatusMeta } from '@/config/orderStatus';
import { useAdminConversations, useAdminOrders } from '@/hooks/data';
import { digitsOnly, formatDay, money } from '@/lib/format';
import { useAuth } from '@/providers/AuthProvider';
import { colors, fonts, radius, shadow, spacing } from '@/theme';
import type { Order } from '@/types';

type Filter = 'all' | StatusMeta['bucket'];

const STATS: { key: Filter | 'messages'; label: string; icon: string; color: string }[] = [
  { key: 'new', label: 'New', icon: 'file-document-outline', color: '#3B8BEB' },
  { key: 'scheduled', label: 'Scheduled', icon: 'calendar-month', color: colors.orange },
  { key: 'cleaning', label: 'In Cleaning', icon: 'hanger', color: '#2F7FE0' },
  { key: 'ready', label: 'Ready', icon: 'check-bold', color: colors.success },
  { key: 'messages', label: 'Messages', icon: 'message-processing', color: '#F2B705' },
  { key: 'active', label: 'Active', icon: 'truck-fast-outline', color: '#7A5AF8' },
  { key: 'completed', label: 'Completed', icon: 'star-outline', color: colors.gold },
  { key: 'cancelled', label: 'Cancelled', icon: 'close', color: colors.danger },
  { key: 'all', label: 'All', icon: 'view-list', color: colors.navy700 },
];

export default function AdminDashboard() {
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const { orders, refresh } = useAdminOrders();
  const { conversations } = useAdminConversations();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: orders.length };
    orders.forEach((o) => {
      const b = STATUS_META[o.status].bucket;
      c[b] = (c[b] ?? 0) + 1;
    });
    c.messages = conversations.reduce((s, x) => s + x.unread, 0);
    return c;
  }, [orders, conversations]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const qd = digitsOnly(q);
    return orders.filter((o) => {
      if (filter !== 'all' && STATUS_META[o.status].bucket !== filter) return false;
      if (!q) return true;
      return (
        o.customerName.toLowerCase().includes(q) ||
        o.customerEmail.toLowerCase().includes(q) ||
        String(o.number).includes(q) ||
        (qd.length >= 3 && digitsOnly(o.customerPhone).includes(qd))
      );
    });
  }, [orders, filter, query]);

  const selectedOrder = orders.find((o) => o.id === selected) ?? null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.xs }]}>
        <View style={styles.headerTop}>
          <IconButton
            icon="logout"
            label="Sign out"
            tone="dark"
            onPress={() =>
              Alert.alert('Sign out of the dashboard?', undefined, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign out', style: 'destructive', onPress: () => signOut().then(() => router.replace('/')) },
              ])
            }
          />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <IconButton icon="account-group-outline" label="Customers" tone="dark" onPress={() => router.push('/admin/customers')} />
            <IconButton icon="message-processing-outline" label="Messages" tone="dark" onPress={() => router.push('/admin/messages')} />
            <IconButton icon="cog-outline" label="Settings" tone="dark" onPress={() => router.push('/admin/settings')} />
          </View>
        </View>
        <View>
          <AppText style={styles.title} numberOfLines={1} adjustsFontSizeToFit>
            Admin Dashboard
          </AppText>
          <View style={styles.titleRow}>
            <AppText style={styles.subtitle}>Suzy’s Cleaners</AppText>
            <AppText style={styles.motto}>Keeping Burbank Looking Its Best</AppText>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stats} style={{ marginHorizontal: -spacing.md }}>
          {STATS.map((s) => {
            const on = filter === s.key;
            return (
              <Pressable
                key={s.key}
                accessibilityRole="button"
                accessibilityLabel={`${s.label}: ${counts[s.key] ?? 0}`}
                onPress={() => (s.key === 'messages' ? router.push('/admin/messages') : setFilter(on ? 'all' : (s.key as Filter)))}
                style={[styles.stat, on && styles.statOn]}
              >
                <View style={[styles.statIcon, { backgroundColor: s.color }]}>
                  <Icon name={s.icon} size={18} color={colors.white} />
                </View>
                <AppText style={styles.statLabel} numberOfLines={1}>
                  {s.label}
                </AppText>
                <AppText style={styles.statValue}>{counts[s.key] ?? 0}</AppText>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.search}>
          <Icon name="magnify" size={22} color="rgba(255,255,255,0.7)" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search customers, phone or order #"
            placeholderTextColor="rgba(255,255,255,0.6)"
            style={styles.searchInput}
            autoCapitalize="none"
            accessibilityLabel="Search customers"
          />
          {query ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Clear search">
              <Icon name="close-circle" size={18} color="rgba(255,255,255,0.7)" />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: insets.bottom + 110, gap: 10 }} showsVerticalScrollIndicator={false}>
        <View style={styles.listHead}>
          <AppText variant="caption">
            {filter === 'all' ? 'All orders' : STATS.find((s) => s.key === filter)?.label} · {visible.length}
          </AppText>
          <Pressable onPress={refresh} hitSlop={8}>
            <AppText variant="smallStrong" style={{ color: colors.royal }}>
              Refresh
            </AppText>
          </Pressable>
        </View>
        {visible.length === 0 ? <EmptyState icon="clipboard-text-search-outline" title="No matching orders" /> : null}
        {visible.map((o) => (
          <OrderRow key={o.id} order={o} selected={o.id === selected} onSelect={() => setSelected(o.id === selected ? null : o.id)} />
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.sm }]}>
        <Button
          title={selectedOrder ? `Update & Notify ${selectedOrder.customerName.split(' ')[0]}` : 'Update & Notify Customer'}
          icon="bullhorn-outline"
          disabled={!selectedOrder}
          accessibilityHint="Select an order first"
          onPress={() => setSheetOpen(true)}
        />
        {!selectedOrder ? (
          <AppText variant="small" style={{ textAlign: 'center', marginTop: 6 }}>
            Tap an order to select it · tap › to open details
          </AppText>
        ) : null}
      </View>

      <UpdateStatusSheet order={selectedOrder} visible={sheetOpen} onClose={() => setSheetOpen(false)} />
    </View>
  );
}

function OrderRow({ order, selected, onSelect }: { order: Order; selected: boolean; onSelect(): void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${order.customerName}, order ${order.number}, ${STATUS_META[order.status].label}`}
      onPress={onSelect}
      style={({ pressed }) => [styles.row, shadow(1), selected && styles.rowSelected, pressed && { opacity: 0.9 }]}
    >
      <View style={{ flex: 1, gap: 4 }}>
        <AppText style={styles.name} numberOfLines={1}>
          {order.customerName}
        </AppText>
        <AppText style={styles.phone}>
          {order.customerPhone} · #{order.number}
        </AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <StatusBadge status={order.status} />
          <AppText variant="small">
            {formatDay(order.pickupDate)} · {order.timeWindow}
          </AppText>
        </View>
      </View>
      <AppText style={styles.amount}>{order.finalTotal != null ? money(order.finalTotal) : 'Invoice pending'}</AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open order ${order.number}`}
        hitSlop={12}
        onPress={() => router.push({ pathname: '/admin/order/[id]', params: { id: order.id } })}
        style={styles.open}
      >
        <Icon name="chevron-right" size={26} color={colors.muted} />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: colors.navy, paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.sm, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { fontFamily: fonts.bold, fontSize: 30, lineHeight: 36, color: colors.white, letterSpacing: -0.4 },
  subtitle: { fontFamily: fonts.regular, fontSize: 15, color: 'rgba(255,255,255,0.75)' },
  motto: { flexShrink: 1, fontFamily: fonts.regular, fontSize: 12.5, color: 'rgba(255,255,255,0.7)', textAlign: 'right' },
  stats: { gap: 8, paddingHorizontal: spacing.md, paddingVertical: 4 },
  stat: { width: 80, backgroundColor: colors.white, borderRadius: radius.lg, alignItems: 'center', paddingVertical: 10, gap: 3, borderWidth: 2, borderColor: 'transparent' },
  statOn: { borderColor: colors.sunshine },
  statIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  statLabel: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.navy900 },
  statValue: { fontFamily: fonts.bold, fontSize: 24, color: colors.navy900, lineHeight: 28 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: radius.md, paddingHorizontal: 14, height: 48 },
  searchInput: { flex: 1, color: colors.white, fontFamily: fonts.regular, fontSize: 16 },
  listHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.md, borderWidth: 2, borderColor: 'transparent' },
  rowSelected: { borderColor: colors.orange, backgroundColor: colors.ivory },
  name: { fontFamily: fonts.bold, fontSize: 18, color: colors.navy900 },
  phone: { fontFamily: fonts.regular, fontSize: 14, color: colors.muted },
  amount: { fontFamily: fonts.bold, fontSize: 20, color: colors.navy900 },
  open: { paddingLeft: 4, paddingVertical: 8 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.md, paddingTop: spacing.sm, backgroundColor: 'rgba(250,246,238,0.97)', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});

import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { StatusBadge } from '@/components/orders/StatusBadge';
import { AppText, Avatar, Button, Card, Divider, EmptyState, ListRow, Screen, ScreenHeader, SectionHeader } from '@/components/ui';
import { useAdminCustomer, useAdminMessages, useAdminOrders } from '@/hooks/data';
import { callBusiness, emailBusiness } from '@/lib/contact';
import { formatDateTime, formatDay, fullAddress, money } from '@/lib/format';
import { colors, fonts, spacing } from '@/theme';

export default function AdminCustomerProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: c, loading } = useAdminCustomer(id);
  const { orders } = useAdminOrders();
  const { messages } = useAdminMessages(id);
  const theirs = orders.filter((o) => o.customerId === id);
  const recent = messages.filter((m) => m.sender !== 'system').slice(-3);

  if (!c) {
    return (
      <Screen>
        <ScreenHeader title="Customer" />
        {!loading ? <EmptyState icon="account-question-outline" title="Customer not found" /> : null}
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title={c.name} subtitle={`Customer since ${formatDay(c.createdAt)}`} />
      <Card style={styles.summary}>
        <Avatar name={c.name} size={60} />
        <View style={styles.metrics}>
          <Metric label="Orders" value={String(c.orderCount)} />
          <Metric label="Lifetime" value={money(c.lifetimeValue)} />
          <Metric label="Points" value={String(c.rewardPoints)} />
          <Metric label="Unread" value={String(c.unreadForAdmin)} />
        </View>
      </Card>

      <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
        <Button title="Call" icon="phone" size="md" variant="dark" onPress={() => callBusiness(c.phone)} style={{ flex: 1 }} />
        <Button title="Message" icon="message-processing-outline" size="md" variant="gold" onPress={() => router.push({ pathname: '/admin/chat/[id]', params: { id: c.id } })} style={{ flex: 1 }} />
      </View>

      <SectionHeader title="Contact" />
      <Card padded={false} style={styles.card}>
        <ListRow icon="phone-outline" title={c.phone || '—'} onPress={() => callBusiness(c.phone)} />
        <Divider />
        <ListRow icon="email-outline" title={c.email} onPress={() => emailBusiness(c.email, "Suzy's Cleaners")} />
        <Divider />
        <ListRow icon="bell-outline" title={c.notificationsEnabled ? 'Push notifications on' : 'Push notifications off'} subtitle={c.pushToken ? 'Device registered' : 'No device token yet'} />
      </Card>

      <SectionHeader title="Saved addresses" />
      <Card padded={false} style={styles.card}>
        {c.addresses.length === 0 ? <ListRow icon="map-marker-off-outline" title="No saved addresses" /> : null}
        {c.addresses.map((a, i) => (
          <View key={a.id}>
            {i > 0 ? <Divider /> : null}
            <ListRow icon={a.label === 'Office' ? 'office-building-outline' : 'home-outline'} title={a.label + (c.defaultAddressId === a.id ? ' · Default' : '')} subtitle={fullAddress(a)} />
          </View>
        ))}
      </Card>

      <SectionHeader title="Order history" />
      <View style={{ gap: 8 }}>
        {theirs.length === 0 ? <AppText variant="small">No orders yet.</AppText> : null}
        {theirs.map((o) => (
          <Card key={o.id} onPress={() => router.push({ pathname: '/admin/order/[id]', params: { id: o.id } })} style={styles.order}>
            <View style={{ flex: 1, gap: 4 }}>
              <AppText variant="bodyStrong">
                #{o.number} · {formatDay(o.pickupDate)}
              </AppText>
              <StatusBadge status={o.status} />
            </View>
            <AppText style={styles.amount}>{o.finalTotal != null ? money(o.finalTotal) : 'Invoice pending'}</AppText>
          </Card>
        ))}
      </View>

      <SectionHeader title="Recent messages" action="Open" onAction={() => router.push({ pathname: '/admin/chat/[id]', params: { id: c.id } })} />
      <Card padded={false} style={styles.card}>
        {recent.length === 0 ? <ListRow icon="message-outline" title="No messages yet" /> : null}
        {recent.map((m, i) => (
          <Pressable key={m.id} onPress={() => router.push({ pathname: '/admin/chat/[id]', params: { id: c.id } })}>
            {i > 0 ? <Divider /> : null}
            <ListRow icon={m.sender === 'customer' ? 'account-outline' : 'store-outline'} title={m.body} subtitle={`${m.sender === 'customer' ? c.name : "Suzy's"} · ${formatDateTime(m.createdAt)}`} />
          </Pressable>
        ))}
      </Card>
    </Screen>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <AppText style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.navy900 }}>{value}</AppText>
      <AppText variant="small">{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  metrics: { flex: 1, flexDirection: 'row' },
  card: { paddingHorizontal: spacing.md },
  order: { flexDirection: 'row', alignItems: 'center', padding: spacing.md },
  amount: { fontFamily: fonts.bold, fontSize: 18, color: colors.navy900 },
});

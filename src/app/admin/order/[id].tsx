import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UpdateStatusSheet } from '@/components/admin/UpdateStatusSheet';
import { OrderLines } from '@/components/orders/OrderLines';
import { StatusBadge } from '@/components/orders/StatusBadge';
import { AppText, Button, Card, Divider, EmptyState, ListRow, Screen, ScreenHeader, SectionHeader } from '@/components/ui';
import { STATUS_META } from '@/config/orderStatus';
import { useAdminOrder } from '@/hooks/data';
import { callBusiness, emailBusiness } from '@/lib/contact';
import { formatDateTime, formatDay, fullAddress } from '@/lib/format';
import { colors, spacing } from '@/theme';

export default function AdminOrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: order, loading } = useAdminOrder(id);
  const [sheet, setSheet] = useState(false);
  const insets = useSafeAreaInsets();

  if (!order) {
    return (
      <Screen>
        <ScreenHeader title="Order" />
        {!loading ? <EmptyState icon="file-search-outline" title="Order not found" /> : null}
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Screen contentStyle={{ paddingBottom: 120 + insets.bottom }}>
        <ScreenHeader title={`Order #${order.number}`} subtitle={`Placed ${formatDateTime(order.createdAt)}`} />
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <StatusBadge status={order.status} />
          <AppText variant="small">Updated {formatDateTime(order.updatedAt)}</AppText>
        </View>

        <SectionHeader title="Customer" action="Profile" onAction={() => router.push({ pathname: '/admin/customer/[id]', params: { id: order.customerId } })} />
        <Card padded={false} style={styles.card}>
          <ListRow icon="account-outline" title={order.customerName} subtitle="Customer" />
          <Divider />
          <ListRow icon="phone-outline" title={order.customerPhone} subtitle="Tap to call" onPress={() => callBusiness(order.customerPhone)} />
          <Divider />
          <ListRow icon="email-outline" title={order.customerEmail} subtitle="Tap to email" onPress={() => emailBusiness(order.customerEmail, `Your Suzy's Cleaners order #${order.number}`)} />
        </Card>

        <SectionHeader title="Pickup & delivery" />
        <Card padded={false} style={styles.card}>
          <ListRow icon="calendar-clock" title={`${formatDay(order.pickupDate)} · ${order.timeWindow}`} subtitle="Requested pickup" />
          {order.nextDayServiceRequested ? <><Divider /><ListRow icon="clock-fast" title="Next-day service requested" subtitle="Confirm availability with customer" /></> : null}
          {order.rewardRedemptionRequested ? <><Divider /><ListRow icon="star-four-points-outline" title="$100 reward requested" subtitle={order.rewardDiscount > 0 ? 'Reward discount applied' : 'Apply when setting final invoice (minimum $100)'} /></> : null}
          <Divider />
          <ListRow icon="map-marker-outline" title="Pickup address" subtitle={fullAddress(order.pickupAddress)} />
          <Divider />
          <ListRow icon="home-outline" title="Delivery address" subtitle={fullAddress(order.deliveryAddress)} />
          <Divider />
          <ListRow icon="note-text-outline" title="Special instructions" subtitle={order.instructions || 'None'} />
        </Card>

        <SectionHeader title="Services" />
        <OrderLines order={order} />
        <AppText variant="small" style={{ marginTop: 6 }}>
          {order.finalTotal != null ? `Invoice amount due: $${order.finalTotal}` : 'No customer-facing price · Final invoice not set'}
        </AppText>

        <SectionHeader title="Status history" />
        <Card padded={false} style={styles.card}>
          {[...order.history].reverse().map((h, i) => (
            <View key={`${h.status}-${h.at}`}>
              {i > 0 ? <Divider /> : null}
              <ListRow
                icon={STATUS_META[h.status].icon}
                title={STATUS_META[h.status].label}
                subtitle={`${formatDateTime(h.at)} · by ${h.by}${h.note ? ` · ${h.note}` : ''}`}
              />
            </View>
          ))}
        </Card>

        <Button
          title="Message Customer"
          icon="message-processing-outline"
          variant="outline"
          size="md"
          onPress={() => router.push({ pathname: '/admin/chat/[id]', params: { id: order.customerId, orderId: order.id } })}
          style={{ marginTop: spacing.lg }}
        />
      </Screen>
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.sm }]}>
        <Button title="Update & Notify Customer" icon="bullhorn-outline" onPress={() => setSheet(true)} />
      </View>
      <UpdateStatusSheet order={order} visible={sheet} onClose={() => setSheet(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { paddingHorizontal: spacing.md },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.md, paddingTop: spacing.sm, backgroundColor: 'rgba(250,246,238,0.97)', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});

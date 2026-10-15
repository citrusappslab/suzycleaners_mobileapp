import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Alert } from '@/lib/dialog';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { OrderLines } from '@/components/orders/OrderLines';
import { StatusTimeline } from '@/components/orders/StatusTimeline';
import { AppText, Button, Card, Divider, EmptyState, Icon, IconButton, ListRow, Screen } from '@/components/ui';
import { STATUS_META } from '@/config/orderStatus';
import { useMyOrder } from '@/hooks/data';
import { formatDay, fullAddress } from '@/lib/format';
import { backend } from '@/services/backend';
import { colors, fonts, radius, spacing } from '@/theme';
import type { Order } from '@/types';

const headline = (o: Order) => {
  switch (o.status) {
    case 'request_received':
      return `Pickup requested for ${formatDay(o.pickupDate)}`;
    case 'pickup_confirmed':
      return `Pickup ${formatDay(o.pickupDate)}, ${o.timeWindow}`;
    case 'driver_on_the_way':
      return 'Your driver is on the way';
    case 'picked_up':
    case 'cleaning_in_progress':
      return "We'll notify you when it's ready";
    case 'ready_for_pickup':
      return 'Ready at our Burbank studio';
    case 'ready_for_delivery':
      return 'Delivery being scheduled';
    case 'out_for_delivery':
      return 'Arriving today';
    case 'completed':
      return 'Thank you for choosing Suzy’s';
    case 'cancelled':
      return 'This order was cancelled';
  }
};

export default function OrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: order, loading } = useMyOrder(id);
  const [cancelling, setCancelling] = useState(false);

  if (!order) {
    return (
      <Screen>
        <View style={{ marginTop: spacing.md }}>
          <IconButton icon="chevron-left" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/orders'))} />
        </View>
        {!loading ? <EmptyState icon="file-search-outline" title="Order not found" action="View my orders" onAction={() => router.replace('/orders')} /> : null}
      </Screen>
    );
  }

  const cancellable = order.status === 'request_received' || order.status === 'pickup_confirmed';
  const cancel = () =>
    Alert.alert('Cancel this pickup?', 'You can always schedule a new one.', [
      { text: 'Keep order', style: 'cancel' },
      {
        text: 'Cancel pickup',
        style: 'destructive',
        onPress: async () => {
          setCancelling(true);
          try {
            await backend.orders.cancelMine(order.id);
          } catch (e) {
            Alert.alert('Unable to cancel', (e as Error).message);
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);

  return (
    <Screen background="sky">
      <View style={styles.top}>
        <IconButton icon="chevron-left" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/orders'))} />
        <BrandLogo width={150} />
        <View style={{ width: 42 }} />
      </View>

      <Card tone="navy" style={styles.hero}>
        <View style={styles.heroRow}>
          <AppText style={styles.heroMeta}>Order #{order.number}</AppText>
          <AppText style={styles.heroMeta}>
            {order.pickupAddress.city}, {order.pickupAddress.state}
          </AppText>
        </View>
        <View style={styles.heroRow}>
          <View style={{ flex: 1, gap: 4 }}>
            <AppText style={styles.heroTitle}>{STATUS_META[order.status].label}</AppText>
            <AppText style={styles.heroSub}>{headline(order)}</AppText>
          </View>
          <Icon name={STATUS_META[order.status].icon} size={44} color="#7FA2E8" />
        </View>
      </Card>

      <View style={{ paddingHorizontal: spacing.xs, marginTop: spacing.lg }}>
        <StatusTimeline order={order} />
      </View>

      <View style={{ marginTop: spacing.lg }}>
        <OrderLines order={order} />
      </View>

      <Card style={{ marginTop: spacing.md }}>
        <ListRow icon="calendar-clock" title={`${formatDay(order.pickupDate)} · ${order.timeWindow}`} subtitle="Requested pickup" />
        {order.nextDayServiceRequested ? <><Divider /><ListRow icon="clock-fast" title="Next-day service requested" subtitle="Our representative will confirm availability" /></> : null}
        {order.rewardRedemptionRequested ? <><Divider /><ListRow icon="star-four-points-outline" title="$100 reward requested" subtitle={order.rewardDiscount > 0 ? 'Applied to your final invoice' : 'Will be applied when the representative sends your invoice'} /></> : null}
        <Divider />
        <ListRow icon="map-marker-outline" title="Pickup" subtitle={fullAddress(order.pickupAddress)} />
        <Divider />
        <ListRow
          icon="home-outline"
          title="Delivery"
          subtitle={order.deliveryAddress.id === order.pickupAddress.id ? 'Same as pickup' : fullAddress(order.deliveryAddress)}
        />
        {order.instructions ? (
          <>
            <Divider />
            <ListRow icon="note-text-outline" title="Special instructions" subtitle={order.instructions} />
          </>
        ) : null}
      </Card>

      <Button
        title="Message Suzy’s Cleaners"
        icon="message-processing-outline"
        variant="outline"
        onPress={() => router.push({ pathname: '/messages', params: { orderId: order.id } })}
        style={{ marginTop: spacing.lg, borderRadius: radius.xxl }}
      />
      {cancellable ? (
        <Button title="Cancel Pickup" variant="ghost" size="sm" onPress={cancel} loading={cancelling} style={{ marginTop: spacing.sm }} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xs },
  hero: { gap: spacing.sm, marginTop: spacing.xs, borderRadius: radius.lg },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroMeta: { fontFamily: fonts.medium, fontSize: 15, color: '#9DB4E6' },
  heroTitle: { fontFamily: fonts.bold, fontSize: 27, color: colors.white, letterSpacing: -0.3 },
  heroSub: { fontFamily: fonts.semibold, fontSize: 17, color: colors.sunshine },
});

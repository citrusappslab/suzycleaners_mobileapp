import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { AppText, Card, Icon } from '@/components/ui';
import { STATUS_META } from '@/config/orderStatus';
import { formatDay, money } from '@/lib/format';
import { colors, spacing } from '@/theme';
import type { Order } from '@/types';
import { StatusBadge } from './StatusBadge';

export function OrderCard({ order }: { order: Order }) {
  return (
    <Card
      accessibilityLabel={`Order ${order.number}, ${STATUS_META[order.status].label}`}
      onPress={() => router.push({ pathname: '/order/[id]', params: { id: order.id } })}
      style={{ gap: spacing.sm }}
    >
      <View style={styles.top}>
        <AppText variant="caption">Order #{order.number}</AppText>
        <AppText variant="bodyStrong" style={{ color: colors.navy900 }}>
          {order.finalTotal != null ? money(order.finalTotal) : 'Invoice pending'}
        </AppText>
      </View>
      <AppText variant="h3" numberOfLines={1}>
        {order.lines.map((l) => `${l.quantity} × ${l.name}`).join(' · ')}
      </AppText>
      <View style={styles.top}>
        <StatusBadge status={order.status} />
        <View style={styles.when}>
          <Icon name="calendar-blank-outline" size={15} color={colors.muted} />
          <AppText variant="small">
            {formatDay(order.pickupDate)} · {order.timeWindow}
          </AppText>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  when: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});

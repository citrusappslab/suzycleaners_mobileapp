import { StyleSheet, View } from 'react-native';
import { AppText, Card, Divider, Icon } from '@/components/ui';
import { DEFAULT_SERVICES } from '@/config/business';
import { money } from '@/lib/format';
import { colors, spacing } from '@/theme';
import type { Order } from '@/types';

const iconFor = (serviceId: string) => DEFAULT_SERVICES.find((s) => s.id === serviceId)?.icon ?? 'hanger';

export function OrderLines({ order }: { order: Order }) {
  return (
    <Card padded={false} style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.xs }}>
      {order.lines.map((l) => (
        <View key={l.serviceId}>
          <View style={styles.row}>
            <View style={styles.icon}>
              <Icon name={iconFor(l.serviceId)} size={22} color={colors.navy900} />
            </View>
            <AppText variant="body" style={{ flex: 1 }}>
              {l.quantity} × {l.name}
            </AppText>
          </View>
          <Divider style={{ marginLeft: 58 }} />
        </View>
      ))}
      {order.finalTotal != null && order.rewardDiscount > 0 ? (
        <View style={styles.row}>
          <View style={styles.icon}><Icon name="receipt-text-outline" size={22} color={colors.navy900} /></View>
          <AppText variant="bodyStrong" style={{ flex: 1 }}>Invoice subtotal</AppText>
          <AppText variant="bodyStrong">{money(order.finalTotal + order.rewardDiscount)}</AppText>
        </View>
      ) : null}
      {order.rewardDiscount > 0 ? (
        <View style={styles.row}>
          <View style={styles.icon}><Icon name="star-four-points-outline" size={22} color={colors.navy900} /></View>
          <AppText variant="bodyStrong" style={{ flex: 1 }}>Rewards discount</AppText>
          <AppText variant="bodyStrong">−{money(order.rewardDiscount)}</AppText>
        </View>
      ) : null}
      <View style={styles.row}>
        <View style={styles.icon}>
          <Icon name="receipt-text-outline" size={22} color={colors.navy900} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="bodyStrong">{order.finalTotal != null ? (order.rewardDiscount > 0 ? 'Amount due' : 'Final invoice') : 'Invoice pending'}</AppText>
          {order.finalTotal == null ? <AppText variant="small">A representative will send it after inspection.</AppText> : null}
        </View>
        <AppText variant="h2" style={{ fontFamily: 'Inter_700Bold', fontSize: 22 }}>
          {order.finalTotal != null ? money(order.finalTotal) : '—'}
        </AppText>
      </View>
      {order.pointsAwarded > 0 ? <AppText variant="small" style={{ paddingVertical: spacing.xs }}>{order.pointsAwarded} reward points earned</AppText> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  icon: { width: 46, height: 46, borderRadius: 12, backgroundColor: colors.skySoft, alignItems: 'center', justifyContent: 'center' },
});

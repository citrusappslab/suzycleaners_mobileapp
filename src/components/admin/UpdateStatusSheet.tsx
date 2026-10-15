import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Alert } from '@/lib/dialog';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Button, Icon, IconButton, TextField, Toggle } from '@/components/ui';
import { STATUS_META } from '@/config/orderStatus';
import { useSettings } from '@/hooks/data';
import { useToast } from '@/providers/NotificationProvider';
import { backend } from '@/services/backend';
import { colors, fonts, radius, spacing } from '@/theme';
import { ORDER_STATUSES, type Order, type OrderStatus } from '@/types';
import { toneColors } from '@/components/orders/StatusBadge';

const nextStatus = (current: OrderStatus): OrderStatus => {
  if (current === 'completed' || current === 'cancelled') return current;
  if (current === 'ready_for_pickup' || current === 'out_for_delivery') return 'completed';
  return ORDER_STATUSES[ORDER_STATUSES.indexOf(current) + 1]!;
};

/** Change an order's status and push the update to the customer. */
export function UpdateStatusSheet({ order, visible, onClose }: { order: Order | null; visible: boolean; onClose(): void }) {
  // The form mounts fresh each time the sheet opens, so it always starts from the order's current state.
  return (
    <Modal visible={visible && !!order} animationType="slide" transparent onRequestClose={onClose}>
      {order && visible ? <SheetContent order={order} onClose={onClose} /> : null}
    </Modal>
  );
}

function SheetContent({ order, onClose }: { order: Order; onClose(): void }) {
  const insets = useSafeAreaInsets();
  const { settings } = useSettings();
  const toast = useToast();
  const [status, setStatusRaw] = useState<OrderStatus>(() => nextStatus(order.status));
  const [notify, setNotify] = useState(true);
  // Custom wording; `null` means "use the template for the selected status".
  const [customTitle, setTitle] = useState<string | null>(null);
  const [customBody, setBody] = useState<string | null>(null);
  const [total, setTotal] = useState(order.finalTotal != null ? String(order.finalTotal) : '');
  const [busy, setBusy] = useState(false);

  const template = settings.notificationTemplates[status];
  const title = customTitle ?? template.title;
  const body = customBody ?? template.body;
  const setStatus = (s: OrderStatus) => {
    setStatusRaw(s);
    setTitle(null);
    setBody(null);
  };


  const submit = async () => {
    const parsed = total.trim() ? Number(total.replace(/[$,]/g, '')) : null;
    if (parsed !== null && (Number.isNaN(parsed) || parsed < 0)) return Alert.alert('Final total must be a number.');
    if (parsed !== null && !['cleaning_in_progress', 'ready_for_pickup', 'ready_for_delivery', 'out_for_delivery', 'completed'].includes(status)) return Alert.alert('Send the final invoice after the items have been inspected.');
    if (order.rewardRedemptionRequested && order.rewardDiscount === 0 && parsed !== null && parsed < 100) return Alert.alert('The invoice must be at least $100 before applying the reward.');
    const sendingInvoice = parsed !== null && order.finalTotal == null;
    setBusy(true);
    try {
      await backend.admin.updateOrder(
        order.id,
        { status, finalTotal: parsed === null ? (order.finalTotal ?? null) : parsed },
        notify
          ? {
              title: customTitle?.trim() || (sendingInvoice ? 'Your final invoice is ready' : template.title),
              body: customBody?.trim() || (sendingInvoice ? `Your final invoice is ready. Open order #${order.number} in the app to review the amount due.` : template.body),
            }
          : null,
      );
      toast.show({
        title: notify ? `${order.customerName.split(' ')[0]} notified` : 'Order updated',
        body: `Order #${order.number} → ${STATUS_META[status].label}`,
        icon: notify ? 'bell-check-outline' : 'check-circle-outline',
      });
      onClose();
    } catch (e) {
      Alert.alert('Update failed', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
          <View style={styles.grabber} />
          <View style={styles.head}>
            <View style={{ flex: 1 }}>
              <AppText variant="caption">
                Order #{order.number} · {order.customerName}
              </AppText>
              <AppText variant="h2">Update & Notify</AppText>
            </View>
            <IconButton icon="close" label="Close" onPress={onClose} />
          </View>
          <ScrollView style={{ flexShrink: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.sm }}>
            <View style={styles.grid}>
              {ORDER_STATUSES.map((s) => {
                const meta = STATUS_META[s];
                const on = s === status;
                const c = toneColors[meta.tone];
                return (
                  <Pressable
                    key={s}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: on }}
                    onPress={() => setStatus(s)}
                    style={[styles.status, on && { backgroundColor: c.bg, borderColor: c.fg }]}
                  >
                    <Icon name={meta.icon} size={18} color={on ? c.fg : colors.muted} />
                    <AppText style={[styles.statusText, on && { color: c.fg, fontFamily: fonts.semibold }]} numberOfLines={1}>
                      {meta.label}
                    </AppText>
                    {s === order.status ? <View style={styles.current} accessibilityLabel="current status" /> : null}
                  </Pressable>
                );
              })}
            </View>

            <TextField label={order.rewardRedemptionRequested && order.rewardDiscount === 0 ? 'Invoice subtotal before reward' : 'Final invoice amount'} icon="currency-usd" value={total} onChangeText={setTotal} keyboardType="decimal-pad" placeholder="Enter after inspecting items" />
            {order.rewardRedemptionRequested && order.rewardDiscount === 0 ? <AppText variant="small">If the invoice is at least $100, $100 will be deducted automatically when saved.</AppText> : null}

            <View style={styles.notifyRow}>
              <Icon name="bell-ring-outline" />
              <View style={{ flex: 1 }}>
                <AppText variant="bodyStrong">Notify customer</AppText>
                <AppText variant="small">Push notification + message in their inbox</AppText>
              </View>
              <Toggle value={notify} onValueChange={setNotify} />
            </View>
            {notify ? (
              <View style={{ gap: spacing.sm }}>
                <TextField label="Notification title" value={title} onChangeText={setTitle} maxLength={60} />
                <TextField label="Message" value={body} onChangeText={setBody} multiline maxLength={300} counter={300} />
              </View>
            ) : null}
          </ScrollView>
          <Button title={notify ? 'Update & Notify Customer' : 'Update Order'} icon={notify ? 'bullhorn-outline' : 'content-save-outline'} onPress={submit} loading={busy} />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  wrap: { maxHeight: '92%' },
  sheet: { flexShrink: 1, backgroundColor: colors.cream, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: spacing.md, paddingTop: spacing.xs },
  grabber: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: colors.sand, marginBottom: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md, gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  status: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.hairline,
  },
  statusText: { flex: 1, fontFamily: fonts.medium, fontSize: 12.5, color: colors.text },
  current: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.gold },
  notifyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.white, padding: spacing.md, borderRadius: radius.lg },
});

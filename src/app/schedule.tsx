import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Alert } from '@/lib/dialog';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AddressSheet } from '@/components/AddressSheet';
import { AuthGate } from '@/components/AuthGate';
import { AppText, Button, Card, Checkbox, Chip, Divider, Icon, IconButton, Stepper, TextField } from '@/components/ui';
import { useMyOrders, useRewardsBalance, useServices, useSettings } from '@/hooks/data';
import { addressLine, dayName, parseDay, toDayKey } from '@/lib/format';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/NotificationProvider';
import { backend } from '@/services/backend';
import { checkServiceArea, locateAddress, type ServiceAreaResult } from '@/services/serviceArea';
import { colors, fonts, radius, spacing } from '@/theme';
import type { Address } from '@/types';

const SAME_DAY_CUTOFF_HOUR = 12;

export default function SchedulePickup() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: Platform.OS === 'android' ? insets.top : spacing.sm }]}>
      <View style={styles.grabber} />
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <AppText variant="h1">Schedule a Pickup</AppText>
          <AppText variant="small" style={{ fontSize: 14 }}>
            We’ll pick up your items and take care of the rest.
          </AppText>
        </View>
        <IconButton icon="close" label="Close" onPress={() => router.back()} />
      </View>
      <AuthGate title="Sign in to book" body="Create a free account to schedule pickups, track orders and message our team.">
        <ScheduleForm />
      </AuthGate>
    </View>
  );
}

function ScheduleForm() {
  const params = useLocalSearchParams<{ service?: string }>();
  const insets = useSafeAreaInsets();
  const { user, updateProfile } = useAuth();
  const { settings } = useSettings();
  const { services } = useServices();
  const { points } = useRewardsBalance();
  const { orders: myOrders } = useMyOrders();
  const toast = useToast();
  const bookable = services.filter((s) => s.bookable);

  const [qty, setQty] = useState<Record<string, number>>(() => (params.service ? { [params.service]: 1 } : {}));
  const defaultAddr = user?.addresses.find((a) => a.id === user.defaultAddressId) ?? user?.addresses[0];
  const [pickup, setPickup] = useState<Address | undefined>(defaultAddr);
  const [delivery, setDelivery] = useState<Address | undefined>(undefined); // undefined = same as pickup
  const [sheet, setSheet] = useState<'pickup' | 'delivery' | null>(null);
  const [instructions, setInstructions] = useState('');
  const [nextDayServiceRequested, setNextDayServiceRequested] = useState(false);
  const [rewardRedemptionRequested, setRewardRedemptionRequested] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // Radius check result, tagged with the addresses it was computed for.
  const [areaCheck, setAreaCheck] = useState<{ key: string; result: ServiceAreaResult } | null>(null);

  const dates = useMemo(() => {
    const out: string[] = [];
    const now = new Date();
    for (let i = 0; out.length < settings.bookingDaysAhead && i < 21; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      const hours = settings.hours.find((h) => h.day === dayName(d));
      if (hours?.closed) continue;
      if (i === 0 && now.getHours() >= SAME_DAY_CUTOFF_HOUR) continue;
      out.push(toDayKey(d));
    }
    return out;
  }, [settings.bookingDaysAhead, settings.hours]);

  // Default to the first available date / window until the customer picks one.
  const [pickedDate, setDate] = useState<string | undefined>(undefined);
  const [pickedWindow, setTimeWindow] = useState<string | undefined>(undefined);
  const date = pickedDate && dates.includes(pickedDate) ? pickedDate : dates[0];
  const timeWindow = pickedWindow && settings.timeWindows.includes(pickedWindow) ? pickedWindow : settings.timeWindows[0];

  // Validate the service radius whenever the pickup / delivery address changes.
  const areaKey = `${pickup?.id ?? ''}|${delivery?.id ?? ''}|${settings.serviceRadiusMiles}`;
  useEffect(() => {
    if (!pickup) return;
    let cancelled = false;
    const radius = settings.serviceRadiusMiles;
    Promise.all([checkServiceArea(pickup, radius), delivery ? checkServiceArea(delivery, radius) : null]).then(([a, b]) => {
      if (!cancelled) setAreaCheck({ key: areaKey, result: b && b.status === 'outside' ? b : a });
    });
    return () => {
      cancelled = true;
    };
  }, [pickup, delivery, settings.serviceRadiusMiles, areaKey]);
  const area = pickup && areaCheck?.key === areaKey ? areaCheck.result : null;

  const lines = bookable.filter((s) => (qty[s.id] ?? 0) > 0).map((s) => ({ service: s, quantity: qty[s.id]! }));
  const pieceCount = lines.reduce((sum, l) => sum + l.quantity, 0);
  const reservedPoints = myOrders.filter((o) => o.rewardRedemptionRequested && o.rewardDiscount === 0 && o.status !== 'cancelled').length * 1000;
  const availablePoints = Math.max(0, points - reservedPoints);
  const minMet = pieceCount >= 10;
  const outside = area?.status === 'outside';
  const canSubmit = lines.length > 0 && minMet && !!pickup && !!date && !!timeWindow && !outside && (!rewardRedemptionRequested || availablePoints >= 1000);

  const toggle = (id: string) => setQty((q) => ({ ...q, [id]: q[id] ? 0 : 1 }));

  const addAddress = async (a: Address) => {
    if (!user) return;
    await updateProfile({ addresses: [...user.addresses, a], defaultAddressId: user.defaultAddressId ?? a.id });
  };

  const submit = async () => {
    if (!canSubmit || !pickup || !date || !timeWindow) return;
    setSubmitting(true);
    try {
      // Attach coordinates so the server can re-check the service radius.
      const withCoords = async (a: Address): Promise<Address> => {
        const c = await locateAddress(a);
        return c ? { ...a, ...c } : a;
      };
      const pickupAddress = await withCoords(pickup);
      const order = await backend.orders.create({
        pickupAddress,
        deliveryAddress: delivery ? await withCoords(delivery) : pickupAddress,
        pickupDate: date,
        timeWindow,
        lines: lines.map((l) => ({ serviceId: l.service.id, quantity: l.quantity })),
        instructions: instructions.trim(),
        nextDayServiceRequested,
        rewardRedemptionRequested,
      });
      router.replace({ pathname: '/order/[id]', params: { id: order.id } });
      toast.show({ title: 'Pickup requested', body: `Order #${order.number} is in. We'll confirm shortly.`, icon: 'check-circle-outline' });
    } catch (e) {
      Alert.alert('Could not submit', (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ paddingBottom: 130, gap: spacing.md }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Services */}
        <Card padded={false} style={styles.group}>
          {bookable.map((s, i) => {
            const on = (qty[s.id] ?? 0) > 0;
            return (
              <View key={s.id}>
                {i > 0 ? <Divider style={{ marginLeft: 56 }} /> : null}
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={s.name}
                  onPress={() => toggle(s.id)}
                  style={styles.serviceRow}
                >
                  <Checkbox checked={on} />
                  <Icon name={s.icon} size={24} color={colors.navy} />
                  <View style={{ flex: 1 }}>
                    <AppText style={styles.serviceName}>{s.name}</AppText>
                    <AppText variant="small">Add the number of pieces for this service</AppText>
                  </View>
                  {on ? <Stepper value={qty[s.id]!} min={1} onChange={(n) => setQty((q) => ({ ...q, [s.id]: n }))} /> : null}
                </Pressable>
              </View>
            );
          })}
        </Card>

        <Card padded={false} style={{ gap: spacing.sm, padding: spacing.md }}>
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: nextDayServiceRequested }} onPress={() => setNextDayServiceRequested((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Checkbox checked={nextDayServiceRequested} />
            <View style={{ flex: 1 }}>
              <AppText variant="bodyStrong">Request next-day service</AppText>
              <AppText variant="small">Our team will confirm next-day turnaround availability.</AppText>
            </View>
          </Pressable>
        </Card>

        <Card padded={false} style={{ gap: spacing.xs, padding: spacing.md }}>
          <AppText variant="bodyStrong">Pickup minimum: 10 pieces</AppText>
          <AppText variant="small">No prices are shown at booking. A Suzy’s representative will inspect your items and send your final invoice.</AppText>
        </Card>

        <Card tone="navy" style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ width: 38, height: 38, borderRadius: 13, backgroundColor: colors.sunshine, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="star-four-points-outline" size={21} color={colors.navy900} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="bodyStrong" style={{ color: colors.white }}>Suzy’s Rewards</AppText>
              <AppText variant="small" style={{ color: '#DCE6FA' }}>{availablePoints.toLocaleString()} available points</AppText>
            </View>
          </View>
          <AppText variant="small" style={{ color: colors.white }}>
            Earn 10 points for each full $100 on a completed invoice. Example: a $250 invoice earns 20 points.
          </AppText>
          <AppText variant="small" style={{ color: '#FFF4CC' }}>
            1,000 points = $100 off an invoice of $100 or more.
          </AppText>
          {availablePoints >= 1000 ? (
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: rewardRedemptionRequested }} onPress={() => setRewardRedemptionRequested((v) => !v)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: radius.md, padding: spacing.sm }}>
              <Checkbox checked={rewardRedemptionRequested} />
              <View style={{ flex: 1 }}>
                <AppText variant="bodyStrong" style={{ color: colors.white }}>Use 1,000 points for $100 off</AppText>
                <AppText variant="small" style={{ color: '#DCE6FA' }}>Your representative applies it to the final invoice.</AppText>
              </View>
            </Pressable>
          ) : reservedPoints > 0 ? (
            <AppText variant="small" style={{ color: '#DCE6FA' }}>Your points are reserved for an open pickup and will be released if you cancel.</AppText>
          ) : null}
        </Card>

        {/* Addresses */}
        <Card padded={false} style={styles.group}>
          <Pressable accessibilityRole="button" onPress={() => setSheet('pickup')} style={styles.addrRow}>
            <Icon name="map-marker-outline" size={22} />
            <AppText style={styles.addrText} numberOfLines={1}>
              <AppText style={styles.addrLabel}>Pickup: </AppText>
              {pickup ? addressLine(pickup) : 'Add an address'}
            </AppText>
            <Icon name="chevron-right" size={22} color={colors.faint} />
          </Pressable>
          <Divider style={{ marginLeft: 50 }} />
          <Pressable accessibilityRole="button" onPress={() => setSheet('delivery')} style={styles.addrRow}>
            <Icon name="home-outline" size={22} />
            <AppText style={styles.addrText} numberOfLines={1}>
              <AppText style={styles.addrLabel}>Delivery: </AppText>
              {delivery ? addressLine(delivery) : 'Same as pickup'}
            </AppText>
            <Icon name="chevron-right" size={22} color={colors.faint} />
          </Pressable>
        </Card>
        {area?.status === 'outside' ? (
          <Notice tone="danger" icon="map-marker-off-outline">
            This address is about {Math.round(area.miles!)} miles away — outside our {settings.serviceRadiusMiles}-mile pickup & delivery area. Message us and
            we’ll see what we can do, or visit our Burbank studio.
          </Notice>
        ) : area?.status === 'inside' ? (
          <Notice tone="success" icon="map-marker-check-outline">
            Great — you’re within our service area ({area.miles! < 1 ? 'under 1' : Math.round(area.miles!)} mi from our studio).
          </Notice>
        ) : area?.status === 'unknown' ? (
          <Notice tone="info" icon="map-marker-question-outline">
            We’ll confirm this address is within our {settings.serviceRadiusMiles}-mile area when we confirm your pickup.
          </Notice>
        ) : null}

        {/* Date & time */}
        <Card padded={false} style={[styles.group, { padding: spacing.sm, gap: spacing.sm }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {dates.map((d) => {
              const pd = parseDay(d);
              const label = d === toDayKey(new Date()) ? 'Today' : `${dayName(pd)} ${pd.getDate()}`;
              return <Chip key={d} label={label} selected={d === date} onPress={() => setDate(d)} style={styles.dateChip} />;
            })}
          </ScrollView>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {settings.timeWindows.map((w) => (
              <Chip key={w} label={w} selected={w === timeWindow} onPress={() => setTimeWindow(w)} style={{ flex: 1 }} />
            ))}
          </View>
        </Card>

        <TextField
          placeholder="Special instructions (gate code, concierge, stains, tailoring notes…)"
          multiline
          value={instructions}
          onChangeText={(t) => setInstructions(t.slice(0, 500))}
          counter={500}
          accessibilityLabel="Special instructions"
        />

        <View style={[styles.estimate, !minMet && lines.length > 0 && { backgroundColor: colors.warningSoft }]}>
          <Icon name="hanger" size={22} color={colors.navy} />
          <AppText style={styles.estimateText}>
            {lines.length === 0 ? 'Select services · 10-piece minimum' : minMet ? `${pieceCount} pieces selected · Minimum met` : `${pieceCount} of 10 pieces selected`}
          </AppText>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.sm }]}>
        <Button title="Submit Pickup Request" onPress={submit} loading={submitting} disabled={!canSubmit} />
      </View>

      <AddressSheet
        visible={sheet === 'pickup'}
        title="Pickup address"
        addresses={user?.addresses ?? []}
        selectedId={pickup?.id}
        onClose={() => setSheet(null)}
        onSelect={(a) => {
          setPickup(a);
          setSheet(null);
        }}
        onCreate={addAddress}
      />
      <AddressSheet
        visible={sheet === 'delivery'}
        title="Delivery address"
        addresses={user?.addresses ?? []}
        selectedId={delivery?.id ?? pickup?.id}
        onClose={() => setSheet(null)}
        onSelect={(a) => {
          setDelivery(a.id === pickup?.id ? undefined : a);
          setSheet(null);
        }}
        onCreate={addAddress}
      />
    </KeyboardAvoidingView>
  );
}

function Notice({ tone, icon, children }: { tone: 'danger' | 'success' | 'info'; icon: string; children: React.ReactNode }) {
  const c = {
    danger: [colors.danger, colors.dangerSoft],
    success: [colors.success, colors.successSoft],
    info: [colors.info, colors.infoSoft],
  }[tone];
  return (
    <View style={[styles.notice, { backgroundColor: c[1] }]}>
      <Icon name={icon} size={20} color={c[0]} />
      <AppText variant="small" style={{ flex: 1, color: c[0] }}>
        {children}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream, paddingHorizontal: spacing.md },
  grabber: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: colors.sand, marginBottom: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.md },
  group: { borderRadius: radius.xl, overflow: 'hidden' },
  serviceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, minHeight: 64, paddingVertical: 8 },
  serviceName: { fontFamily: fonts.semibold, fontSize: 16, color: colors.navy900 },
  addrRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, minHeight: 56 },
  addrText: { flex: 1, fontFamily: fonts.medium, fontSize: 15.5, color: colors.navy900 },
  addrLabel: { fontFamily: fonts.semibold, fontSize: 15.5, color: colors.navy900 },
  dateChip: { minWidth: 92 },
  estimate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.sky,
  },
  estimateText: { flex: 1, fontFamily: fonts.medium, fontSize: 14.5, color: colors.navy900 },
  notice: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', padding: spacing.sm, borderRadius: radius.md, marginTop: -4 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingTop: spacing.sm, backgroundColor: 'rgba(250,246,238,0.97)' },
});

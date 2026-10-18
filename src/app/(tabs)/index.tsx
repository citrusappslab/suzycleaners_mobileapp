import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { AppText, Button, Card, Icon, Screen } from '@/components/ui';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { ChamberCard, ComingSoonCard, ServiceTile, TaglineBanner, TrustBar } from '@/components/brand/sections';
import { STATUS_META, isOpenStatus } from '@/config/orderStatus';
import { useMyNotifications, useMyOrders, useServices, useSettings } from '@/hooks/data';
import { dayName, formatDay } from '@/lib/format';
import { useAuth } from '@/providers/AuthProvider';
import { colors, fonts, radius, spacing } from '@/theme';
import { callUs, openDirections } from '@/lib/contact';

export default function Home() {
  const { user } = useAuth();
  const { settings } = useSettings();
  const { services } = useServices();
  const { orders } = useMyOrders();
  const { notifications } = useMyNotifications();
  const { width } = useWindowDimensions();
  const unread = notifications.filter((n) => !n.read).length;
  const active = orders.find((o) => isOpenStatus(o.status));
  const today = settings.hours.find((h) => h.day === dayName(new Date()));
  const tileWidth = Math.min(118, (Math.min(width, 520) - spacing.md * 2 - 8 * 4) / 5);

  return (
    <Screen background="sky" tabBarSpace>
      <View style={styles.topBar}>
        <AppText variant="caption" style={{ color: colors.navy700 }}>
          {user ? `Welcome back, ${user.name.split(' ')[0]}` : 'Burbank · Est. 1996'}
        </AppText>
        {user ? (
          <Pressable accessibilityLabel={`Notifications, ${unread} unread`} onPress={() => router.push('/notifications')} hitSlop={10} style={styles.bell}>
            <Icon name={unread ? 'bell-badge-outline' : 'bell-outline'} size={22} color={colors.navy} />
            {unread ? <View style={styles.bellDot} /> : null}
          </Pressable>
        ) : null}
      </View>

      <BrandLogo width={Math.min(300, width * 0.7)} />

      <View style={styles.heroText}>
        <AppText variant="hero" style={{ textAlign: 'center' }}>
          {settings.tagline}
        </AppText>
        <AppText variant="body" style={styles.sub}>
          Pickup & delivery. Next-day service available on request.
        </AppText>
      </View>

      <Button
        title="Schedule a Pickup"
        icon="calendar-month-outline"
        onPress={() => router.push('/schedule')}
        style={{ marginTop: spacing.lg }}
        accessibilityHint="Pickup requests require at least 10 pieces. Final invoice sent after inspection."
      />

      {active ? (
        <Card tone="navy" onPress={() => router.push({ pathname: '/order/[id]', params: { id: active.id } })} style={styles.activeCard}>
          <View style={{ flex: 1, gap: 4 }}>
            <AppText style={styles.activeEyebrow}>Order #{active.number} · In progress</AppText>
            <AppText style={styles.activeTitle}>{STATUS_META[active.status].label}</AppText>
            <AppText style={styles.activeSub}>
              Pickup {formatDay(active.pickupDate)} · {active.timeWindow}
            </AppText>
          </View>
          <View style={styles.activeIcon}>
            <Icon name={STATUS_META[active.status].icon} size={26} color={colors.sunshine} />
          </View>
        </Card>
      ) : null}

      <TrustBar />
      <TaglineBanner />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tiles} style={{ marginHorizontal: -spacing.md }}>
        {services.map((s) => (
          <ServiceTile key={s.id} service={s} width={tileWidth} />
        ))}
      </ScrollView>

      <View style={styles.duo}>
        {settings.chamberMember ? <ChamberCard compact /> : null}
        <ComingSoonCard locations={settings.locations} compact />
      </View>

      <Card style={{ marginTop: spacing.md, gap: spacing.sm }}>
        <View style={styles.visitHead}>
          <View style={{ flex: 1 }}>
            <AppText variant="caption" style={{ color: colors.gold }}>
              Visit our studio
            </AppText>
            <AppText variant="h3">540 N Glenoaks Blvd, Burbank</AppText>
            <AppText variant="small">
              {today?.closed ? 'Closed today' : today ? `Open today ${today.open} – ${today.close}` : ''}
            </AppText>
          </View>
        </View>
        <View style={styles.visitActions}>
          <Button title="Call" icon="phone-outline" size="sm" variant="outline" onPress={() => callUs(settings)} style={{ flex: 1 }} />
          <Button title="Directions" icon="map-marker-outline" size="sm" variant="outline" onPress={() => openDirections(settings.locations[0]!)} style={{ flex: 1 }} />
          <Button title="Hours" icon="clock-outline" size="sm" variant="outline" onPress={() => router.push('/contact')} style={{ flex: 1 }} />
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 40, marginTop: spacing.xs },
  bell: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.8)', alignItems: 'center', justifyContent: 'center' },
  bellDot: { position: 'absolute', top: 9, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.orange },
  heroText: { gap: 6, marginTop: spacing.xs },
  sub: { textAlign: 'center', color: colors.navy700, fontSize: 17 },
  activeCard: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md, gap: spacing.md },
  activeEyebrow: { fontFamily: fonts.medium, fontSize: 13, color: '#9DB4E6' },
  activeTitle: { fontFamily: fonts.display, fontSize: 22, color: colors.white },
  activeSub: { fontFamily: fonts.semibold, fontSize: 14, color: colors.sunshine },
  activeIcon: { width: 52, height: 52, borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  tiles: { gap: 8, paddingHorizontal: spacing.md, paddingTop: spacing.md },
  duo: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  visitHead: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  visitActions: { flexDirection: 'row', gap: 8 },
});

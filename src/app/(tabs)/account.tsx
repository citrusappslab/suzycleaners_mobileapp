import Constants from 'expo-constants';
import { Link, router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Alert } from '@/lib/dialog';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { AppText, Avatar, Button, Card, Divider, Icon, ListRow, Screen, Toggle } from '@/components/ui';
import { useMyOrders, useRewardsBalance, useSettings } from '@/hooks/data';
import { businessPhones, callBusiness, emailBusiness, openDirections } from '@/lib/contact';
import { useAuth } from '@/providers/AuthProvider';
import { requestPermission } from '@/services/push';
import { colors, fonts, radius, spacing } from '@/theme';

export default function Account() {
  const { user, signOut, updateProfile, deleteAccount } = useAuth();
  const { settings } = useSettings();
  const { points } = useRewardsBalance();
  const { orders } = useMyOrders();
  const reservedOrders = orders.filter((o) => o.rewardRedemptionRequested && o.rewardDiscount === 0 && o.status !== 'cancelled');
  const availablePoints = Math.max(0, points - reservedOrders.length * 1000);
  const readyRewards = Math.floor(availablePoints / 1000);
  const progressPoints = availablePoints % 1000;
  const progress = readyRewards > 0 ? progressPoints / 1000 : availablePoints / 1000;

  return (
    <Screen tabBarSpace>
      <View style={{ alignItems: 'center', marginTop: spacing.md, marginBottom: spacing.sm }}>
        <BrandLogo width={180} />
        <AppText variant="smallStrong" style={{ color: colors.success, marginTop: 2 }}>Open 7 days a week</AppText>
      </View>
      <View style={{ marginTop: spacing.md, gap: 4 }}>
        <AppText variant="caption" style={{ color: colors.gold }}>
          Your concierge
        </AppText>
        <AppText variant="h1">Account</AppText>
      </View>

      {user ? (
        <Card style={styles.profile} onPress={() => router.push('/profile')} accessibilityLabel="Edit profile">
          <Avatar name={user.name} size={56} />
          <View style={{ flex: 1 }}>
            <AppText variant="h3">{user.name}</AppText>
            <AppText variant="small">{user.email}</AppText>
            <AppText variant="small">{user.phone}</AppText>
          </View>
          <AppText variant="smallStrong" style={{ color: colors.royal }}>
            Edit
          </AppText>
        </Card>
      ) : (
        <Card style={{ gap: spacing.sm, marginTop: spacing.md }}>
          <AppText variant="h2" style={{ textAlign: 'center' }}>
            Welcome to Suzy’s
          </AppText>
          <AppText variant="body" style={{ textAlign: 'center', color: colors.muted }}>
            Create an account to book pickups, track orders and chat with our team.
          </AppText>
          <Button title="Sign In" variant="dark" size="md" onPress={() => router.push('/auth/sign-in')} />
          <Button title="Create an Account" variant="outline" size="md" onPress={() => router.push('/auth/sign-up')} />
        </Card>
      )}

      {user ? (
        <Card tone="navy" style={styles.rewardsCard}>
          <View style={styles.rewardsHeader}>
            <View style={styles.rewardsMark}><Icon name="star-four-points-outline" size={24} color={colors.navy900} /></View>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="caption" style={{ color: colors.sunshine }}>Loyalty club</AppText>
              <AppText style={styles.rewardsTitle}>Suzy’s Rewards</AppText>
            </View>
            {readyRewards > 0 ? (
              <View style={styles.readyBadge}>
                <Icon name="gift-outline" size={15} color={colors.navy900} />
                <AppText style={styles.readyBadgeText}>{readyRewards} ready</AppText>
              </View>
            ) : null}
          </View>

          <View style={styles.pointsPanel}>
            <AppText style={styles.balanceLabel}>AVAILABLE POINTS</AppText>
            <View style={styles.balanceRow}>
              <AppText style={styles.balance}>{availablePoints.toLocaleString()}</AppText>
              <AppText style={styles.pointsWord}>points</AppText>
            </View>
            <AppText style={styles.pointsHint}>
              {readyRewards > 0
                ? `${readyRewards} $100 reward${readyRewards === 1 ? '' : 's'} ready${progressPoints > 0 ? ` · ${progressPoints}/1,000 toward the next` : ''}`
                : `${availablePoints.toLocaleString()} of 1,000 points toward your first $100 reward`}
            </AppText>
            <View style={styles.progressTrack} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 1000, now: readyRewards > 0 ? progressPoints : availablePoints }}>
              <View style={[styles.progressFill, { width: `${Math.min(100, progress * 100)}%` }]} />
            </View>
          </View>

          <View style={styles.earnPanel}>
            <View style={styles.earnRow}>
              <Icon name="receipt-text-check-outline" size={19} color={colors.sunshine} />
              <AppText style={styles.earnText}>Earn 10 points for each full $100 on your final invoice.</AppText>
            </View>
            <AppText style={styles.exampleText}>Example: a completed $250 invoice earns 20 points. Points post when your order is marked complete.</AppText>
            <View style={styles.earnRow}>
              <Icon name="ticket-percent-outline" size={19} color={colors.sunshine} />
              <AppText style={styles.earnText}>1,000 points = $100 off an invoice of $100 or more.</AppText>
            </View>
          </View>

          {reservedOrders.length > 0 ? (
            <View style={styles.reservedNotice}>
              <Icon name="lock-clock-outline" size={18} color={colors.sunshine} />
              <AppText style={styles.reservedText}>{reservedOrders.length * 1000} points reserved for an open pickup. They’ll be released if you cancel.</AppText>
            </View>
          ) : null}

          {readyRewards > 0 ? <Button title="Use a $100 reward" icon="star-four-points-outline" size="md" variant="gold" onPress={() => router.push('/schedule')} /> : null}
        </Card>
      ) : null}

      {user ? (
        <Card padded={false} style={styles.group}>
          <ListRow icon="map-marker-multiple-outline" title="Saved addresses" subtitle={`${user.addresses.length} saved`} onPress={() => router.push('/profile')} />
          <Divider />
          <ListRow icon="bell-outline" title="Notification inbox" onPress={() => router.push('/notifications')} />
          <Divider />
          <ListRow
            icon="bell-ring-outline"
            title="Order update alerts"
            subtitle="Pickup, cleaning, ready & delivery updates"
            right={
              <Toggle
                value={user.notificationsEnabled}
                onValueChange={async (v) => {
                  if (v) await requestPermission();
                  await updateProfile({ notificationsEnabled: v });
                }}
              />
            }
          />
        </Card>
      ) : null}

      <Card padded={false} style={styles.group}>
        <ListRow icon="star-four-points-outline" title="About Suzy's Cleaners" onPress={() => router.push('/about')} />
        <Divider />
        <ListRow icon="clock-outline" title="Contact, hours & locations" onPress={() => router.push('/contact')} />
        <Divider />
        {businessPhones(settings).map((p, i) => (
          <View key={p}>
            {i > 0 ? <Divider /> : null}
            <ListRow icon="phone-outline" title={i === 0 ? 'Call us' : 'Call us (second line)'} subtitle={p} onPress={() => callBusiness(p)} />
          </View>
        ))}
        <Divider />
        <ListRow icon="email-outline" title="Email us" subtitle={settings.email} onPress={() => emailBusiness(settings.email)} />
        <Divider />
        <ListRow icon="directions" title="Directions" subtitle="540 N Glenoaks Blvd, Burbank" onPress={() => openDirections(settings.locations[0]!)} />
      </Card>

      {user ? (
        <Card padded={false} style={styles.group}>
          <ListRow
            icon="logout"
            title="Sign out"
            danger
            chevron={false}
            onPress={() =>
              Alert.alert('Sign out?', undefined, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign out', style: 'destructive', onPress: signOut },
              ])
            }
          />
          {user.role === 'customer' ? (
            <>
              <Divider />
              <ListRow
                icon="account-remove-outline"
                title="Delete account"
                subtitle="Permanently remove your account and order history"
                danger
                chevron={false}
                onPress={() =>
                  Alert.alert(
                    'Delete your account?',
                    'This permanently deletes your account, saved addresses, orders, messages and reward points. This can’t be undone.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () =>
                          deleteAccount().catch((e: Error) => Alert.alert('Couldn’t delete your account', e.message)),
                      },
                    ],
                  )
                }
              />
            </>
          ) : null}
        </Card>
      ) : null}

      {/* Staff entry is intentionally hidden: long-press the version label (or open suzyscleaners://staff-login). */}
      <View style={styles.footer}>
        <Pressable onLongPress={() => router.push('/staff-login')} delayLongPress={1200} accessible={false}>
          <AppText variant="small" style={{ textAlign: 'center', color: colors.faint }}>
            Suzy’s Cleaners · Est. 1996 · v{Constants.expoConfig?.version ?? '1.0.0'}
          </AppText>
        </Pressable>
        <AppText variant="small" style={styles.credit}>
          App Developed by{' '}
          <Link href="https://citrusappslab.com" accessibilityRole="link" accessibilityLabel="Visit Citrus Apps Lab" style={styles.creditLink}>
            Citrus Apps Lab
          </Link>
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md },
  rewardsCard: { marginTop: spacing.md, padding: spacing.md, gap: spacing.md, overflow: 'hidden' },
  rewardsHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rewardsMark: { width: 44, height: 44, borderRadius: 15, backgroundColor: colors.sunshine, alignItems: 'center', justifyContent: 'center' },
  rewardsTitle: { fontFamily: fonts.display, fontSize: 21, lineHeight: 26, color: colors.white },
  readyBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.sunshine, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
  readyBadgeText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.navy900 },
  pointsPanel: { padding: spacing.md, borderRadius: radius.lg, backgroundColor: 'rgba(255,255,255,0.09)', gap: 5 },
  balanceLabel: { fontFamily: fonts.semibold, fontSize: 10, letterSpacing: 1.2, color: '#C8D6F2' },
  balanceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  balance: { fontFamily: fonts.bold, fontSize: 38, lineHeight: 44, color: colors.white },
  pointsWord: { fontFamily: fonts.medium, fontSize: 15, color: '#DCE6FA' },
  pointsHint: { fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 18, color: '#DCE6FA' },
  progressTrack: { height: 8, borderRadius: radius.pill, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.18)', marginTop: 4 },
  progressFill: { height: '100%', borderRadius: radius.pill, backgroundColor: colors.sunshine },
  earnPanel: { gap: spacing.xs },
  earnRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  earnText: { flex: 1, fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 18, color: colors.white },
  exampleText: { marginLeft: 27, fontFamily: fonts.regular, fontSize: 11.5, lineHeight: 16, color: '#C8D6F2' },
  reservedNotice: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs, padding: spacing.sm, borderRadius: radius.md, backgroundColor: 'rgba(255,210,63,0.12)' },
  reservedText: { flex: 1, fontFamily: fonts.medium, fontSize: 12, lineHeight: 17, color: '#FFF4CC' },
  group: { marginTop: spacing.md, paddingHorizontal: spacing.md },
  footer: { alignItems: 'center', paddingVertical: spacing.lg, marginTop: spacing.md, gap: spacing.xs },
  credit: { textAlign: 'center', color: colors.faint },
  creditLink: { color: colors.royal, fontFamily: fonts.semibold, textDecorationLine: 'underline' },
});

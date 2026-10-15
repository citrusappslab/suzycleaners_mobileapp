import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Alert } from '@/lib/dialog';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { AppText, Avatar, Button, Card, Divider, ListRow, Screen, Toggle } from '@/components/ui';
import { useMyOrders, useRewardsBalance, useSettings } from '@/hooks/data';
import { businessPhones, callBusiness, emailBusiness, openDirections } from '@/lib/contact';
import { useAuth } from '@/providers/AuthProvider';
import { requestPermission } from '@/services/push';
import { colors, spacing } from '@/theme';

export default function Account() {
  const { user, signOut, updateProfile } = useAuth();
  const { settings } = useSettings();
  const { points } = useRewardsBalance();
  const { orders } = useMyOrders();
  const reservedOrders = orders.filter((o) => o.rewardRedemptionRequested && o.rewardDiscount === 0 && o.status !== 'cancelled');
  const availablePoints = Math.max(0, points - reservedOrders.length * 1000);

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
        <Card tone="navy" style={{ marginTop: spacing.md, gap: spacing.xs }}>
          <AppText variant="caption" style={{ color: colors.sunshine }}>Suzy’s Rewards</AppText>
          <AppText style={{ color: colors.white, fontFamily: 'Inter_700Bold', fontSize: 30 }}>{availablePoints.toLocaleString()} available points</AppText>
          <AppText variant="small" style={{ color: '#DCE6FA' }}>
            {reservedOrders.length > 0 ? `${reservedOrders.length * 1000} points reserved for an open pickup${availablePoints >= 1000 ? ` · ${availablePoints} more available` : ''}.` : availablePoints >= 1000 ? 'Redeem 1,000 points for $100 off your next invoice.' : `${1000 - availablePoints} points until $100 off · Earn 10 points per $100 invoice.`}
          </AppText>
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
        </Card>
      ) : null}

      {/* Staff entry is intentionally hidden: long-press the version label (or open suzyscleaners://staff-login). */}
      <Pressable onLongPress={() => router.push('/staff-login')} delayLongPress={1200} accessible={false} style={styles.footer}>
        <AppText variant="small" style={{ textAlign: 'center', color: colors.faint }}>
          Suzy’s Cleaners · Est. 1996 · v{Constants.expoConfig?.version ?? '1.0.0'}
        </AppText>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.md },
  group: { marginTop: spacing.md, paddingHorizontal: spacing.md },
  footer: { paddingVertical: spacing.lg, marginTop: spacing.md },
});

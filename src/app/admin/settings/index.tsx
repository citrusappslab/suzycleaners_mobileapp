import { router } from 'expo-router';
import { Alert } from '@/lib/dialog';
import { AppText, Card, Divider, ListRow, Screen, ScreenHeader, SectionHeader } from '@/components/ui';
import { useServices, useSettings } from '@/hooks/data';
import { demoTools } from '@/services/backend';
import { spacing } from '@/theme';

export default function AdminSettings() {
  const { settings } = useSettings();
  const { allServices } = useServices();
  const open = settings.locations.filter((l) => l.status === 'open').length;
  const soon = settings.locations.filter((l) => l.status === 'coming_soon').length;

  return (
    <Screen>
      <ScreenHeader title="Settings" subtitle="Changes apply to the customer app immediately." />
      <Card padded={false} style={{ paddingHorizontal: spacing.md }}>
        <ListRow icon="hanger" title="Services & pricing" subtitle={`${allServices.filter((s) => s.active).length} active services`} onPress={() => router.push('/admin/settings/services')} />
        <Divider />
        <ListRow
          icon="map-marker-radius-outline"
          title="Pickup & delivery rules"
          subtitle={`10-piece minimum · ${settings.serviceRadiusMiles} mi radius · ${settings.timeWindows.length} time windows`}
          onPress={() => router.push('/admin/settings/rules')}
        />
        <Divider />
        <ListRow icon="clock-outline" title="Business hours" onPress={() => router.push('/admin/settings/hours')} />
        <Divider />
        <ListRow icon="store-marker-outline" title="Locations & Coming Soon" subtitle={`${open} open · ${soon} coming soon`} onPress={() => router.push('/admin/settings/locations')} />
        <Divider />
        <ListRow icon="bell-cog-outline" title="Notification messages" subtitle="Text sent for each order status" onPress={() => router.push('/admin/settings/notifications')} />
        <Divider />
        <ListRow icon="card-account-details-outline" title="Business profile" subtitle="Phone, email, tagline, About Us" onPress={() => router.push('/admin/settings/business')} />
      </Card>

      {demoTools ? (
        <>
          <SectionHeader title="Demo" />
          <Card padded={false} style={{ paddingHorizontal: spacing.md }}>
            <ListRow
              icon="database-refresh-outline"
              title="Reset demo data"
              subtitle="Restore sample customers, orders and messages"
              danger
              onPress={() =>
                Alert.alert('Reset all demo data?', 'This removes every change made on this device.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Reset', style: 'destructive', onPress: () => demoTools?.resetDemoData() },
                ])
              }
            />
          </Card>
          <AppText variant="small" style={{ marginTop: spacing.sm }}>
            Running on the on-device demo backend. Connect Supabase or Firebase for shared, multi-device data (see docs/BACKEND.md).
          </AppText>
        </>
      ) : null}
    </Screen>
  );
}

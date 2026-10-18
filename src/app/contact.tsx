import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { ChamberCard } from '@/components/brand/sections';
import { AppText, Button, Card, Divider, Icon, ListRow, Screen, ScreenHeader, SectionHeader } from '@/components/ui';
import { useSettings } from '@/hooks/data';
import { businessPhones, callBusiness, callUs, emailBusiness, openDirections, openWebsite } from '@/lib/contact';
import { dayName } from '@/lib/format';
import { colors, fonts, spacing } from '@/theme';

export default function Contact() {
  const { settings } = useSettings();
  const today = dayName(new Date());
  const open = settings.locations.filter((l) => l.status === 'open');
  const soon = settings.locations.filter((l) => l.status === 'coming_soon');

  return (
    <Screen>
      <ScreenHeader title="Contact Us" subtitle="We'd love to hear from you." />

      <View style={styles.quick}>
        <Button title="Call" icon="phone" size="md" variant="dark" onPress={() => callUs(settings)} style={{ flex: 1 }} />
        <Button title="Email" icon="email-outline" size="md" variant="outline" onPress={() => emailBusiness(settings.email)} style={{ flex: 1 }} />
      </View>
      <Button title="Message Us in the App" icon="message-processing-outline" size="md" variant="gold" onPress={() => router.push('/messages')} style={{ marginTop: spacing.sm }} />

      <SectionHeader title="Locations" />
      {open.map((l) => (
        <Card key={l.id} style={{ gap: spacing.xs }}>
          <AppText variant="caption" style={{ color: colors.gold }}>
            Now open
          </AppText>
          <AppText variant="h2">{l.name}</AppText>
          <AppText variant="body">
            {l.address}, {l.city}, {l.state} {l.zip}
          </AppText>
          <Divider style={{ marginVertical: spacing.xs }} />
          <ListRow icon="directions" title="Get directions" onPress={() => openDirections(l)} />
          {(l.phone ? [l.phone, ...businessPhones(settings).filter((p) => p !== l.phone)] : businessPhones(settings)).map((p) => (
            <ListRow key={p} icon="phone-outline" title={p} onPress={() => callBusiness(p)} />
          ))}
          <ListRow icon="web" title="suzyscleaners.com" onPress={() => openWebsite(settings.website)} />
        </Card>
      ))}
      {soon.length ? (
        <Card tone="sky" style={{ marginTop: spacing.sm, gap: spacing.xs }}>
          <AppText variant="caption" style={{ color: colors.navy700 }}>
            Coming soon
          </AppText>
          {soon.map((l) => (
            <View key={l.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name="map-marker" size={18} color={colors.orange} />
              <AppText variant="h3">{l.name}</AppText>
            </View>
          ))}
          <AppText variant="small">More locations coming soon!</AppText>
        </Card>
      ) : null}

      <SectionHeader title="Business hours" />
      <Card>
        {settings.hours.map((h) => (
          <View key={h.day} style={[styles.hour, h.day === today && styles.today]}>
            <AppText style={[styles.day, h.day === today && { fontFamily: fonts.bold }]}>{h.day}</AppText>
            <AppText style={[styles.time, h.closed && { color: colors.muted }]}>{h.closed ? 'Closed' : `${h.open} – ${h.close}`}</AppText>
          </View>
        ))}
      </Card>

      <SectionHeader title="Pickup & delivery" />
      <Card style={{ gap: 6 }}>
        <ListRow icon="map-marker-radius-outline" title={`Within ~${settings.serviceRadiusMiles} miles of Burbank`} subtitle="Burbank, Glendale, Pasadena, North Hollywood, Studio City & nearby" />
        <ListRow icon="hanger" title="10-piece pickup minimum" subtitle="Final invoice sent after inspection" />
      </Card>

      <View style={{ marginTop: spacing.md }}>
        {settings.chamberMember ? <ChamberCard /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  quick: { flexDirection: 'row', gap: spacing.sm },
  hour: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, paddingHorizontal: 8, borderRadius: 10 },
  today: { backgroundColor: colors.sunshineSoft },
  day: { fontFamily: fonts.medium, fontSize: 15, color: colors.navy900 },
  time: { fontFamily: fonts.regular, fontSize: 15, color: colors.text },
});

import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { serviceImages } from '@/components/brand/images';
import { AppText, Button, Card, Icon, Screen } from '@/components/ui';
import { useServices } from '@/hooks/data';
import { colors, radius, spacing } from '@/theme';

export default function Services() {
  const { services } = useServices();
  return (
    <Screen tabBarSpace>
      <View style={styles.head}>
        <AppText variant="caption" style={{ color: colors.gold }}>
          The Suzy’s standard
        </AppText>
        <AppText variant="h1">Our Services</AppText>
        <AppText variant="body" style={{ color: colors.muted }}>
          Hand-finished garment care from Burbank’s family studio, with concierge pickup & delivery.
        </AppText>
      </View>

      <View style={{ gap: spacing.md }}>
        {services.map((s) => (
          <Card key={s.id} padded={false} onPress={() => router.push({ pathname: '/service/[id]', params: { id: s.id } })} accessibilityLabel={s.name} style={styles.card}>
            <Image source={serviceImages[s.image]} style={styles.img} contentFit="cover" transition={250} />
            <View style={styles.body}>
              <AppText variant="h3">{s.name}</AppText>
              <AppText variant="small" numberOfLines={2}>
                {s.tagline}
              </AppText>
              <View style={styles.invoiceRow}>
                <AppText variant="smallStrong" style={{ color: colors.navy }}>Final invoice sent after item inspection</AppText>
                <Icon name="arrow-right" size={18} color={colors.gold} />
              </View>
            </View>
          </Card>
        ))}
      </View>

      <Button title="Schedule a Pickup" icon="calendar-month-outline" onPress={() => router.push('/schedule')} style={{ marginTop: spacing.xl }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: 6, marginTop: spacing.md, marginBottom: spacing.lg },
  card: { flexDirection: 'row', overflow: 'hidden', minHeight: 128 },
  img: { width: 108, alignSelf: 'stretch', borderTopLeftRadius: radius.xl, borderBottomLeftRadius: radius.xl },
  body: { flex: 1, padding: spacing.md, gap: 4, justifyContent: 'center' },
  invoiceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
});

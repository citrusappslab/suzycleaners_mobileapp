import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { serviceImages } from '@/components/brand/images';
import { AppText, Button, Card, EmptyState, Icon, IconButton } from '@/components/ui';
import { useServices, useSettings } from '@/hooks/data';
import { colors, radius, spacing } from '@/theme';

export default function ServiceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { allServices } = useServices();
  const { settings } = useSettings();
  const insets = useSafeAreaInsets();
  const s = allServices.find((x) => x.id === id);
  if (!s) return <EmptyState icon="hanger" title="Service not found" action="Back" onAction={() => router.back()} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.cream }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }} showsVerticalScrollIndicator={false}>
        <View>
          <Image source={serviceImages[s.image]} style={styles.hero} contentFit="cover" transition={300} />
          <LinearGradient colors={['rgba(10,31,68,0.35)', 'transparent', colors.cream]} style={StyleSheet.absoluteFill} />
          <View style={[styles.back, { top: insets.top + 8 }]}>
            <IconButton icon="chevron-left" label="Back" onPress={() => router.back()} />
          </View>
        </View>
        <View style={styles.content}>
          <AppText variant="caption" style={{ color: colors.gold }}>
            {s.tagline}
          </AppText>
          <AppText variant="hero">{s.name}</AppText>
          <AppText variant="body" style={{ color: colors.text, fontSize: 16, lineHeight: 24 }}>
            {s.description}
          </AppText>

          <Card style={{ gap: spacing.sm, marginTop: spacing.md }}>
            {s.highlights.map((h) => (
              <View key={h} style={styles.hl}>
                <View style={styles.hlIcon}>
                  <Icon name="check" size={15} color={colors.navy900} />
                </View>
                <AppText variant="bodyStrong">{h}</AppText>
              </View>
            ))}
          </Card>

          <Card tone="sky" style={styles.invoiceSummary}>
            <Icon name="receipt-text-outline" size={22} />
            <AppText variant="bodyStrong" style={{ flex: 1 }}>Your representative will send the final invoice after inspecting your items.</AppText>
          </Card>
          <AppText variant="small" style={{ marginTop: spacing.xs }}>
            Pickup & delivery available within ~{settings.serviceRadiusMiles} miles of our Burbank studio. Pickup requires at least 10 pieces. Next-day turnaround is available on request and subject to confirmation.
          </AppText>
        </View>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.sm }]}>
        <Button
          title="Schedule a Pickup"
          icon="calendar-month-outline"
          onPress={() => router.push(s.bookable ? { pathname: '/schedule', params: { service: s.id } } : '/schedule')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { width: '100%', height: 340 },
  back: { position: 'absolute', left: spacing.md },
  content: { paddingHorizontal: spacing.md, gap: spacing.xs, marginTop: -40 },
  hl: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  hlIcon: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.sunshine, alignItems: 'center', justifyContent: 'center' },
  invoiceSummary: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, borderRadius: radius.lg },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.md, paddingTop: spacing.sm, backgroundColor: 'rgba(250,246,238,0.96)' },
});

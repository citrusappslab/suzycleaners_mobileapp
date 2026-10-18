import { View } from 'react-native';
import { AppText, Button, Card, Chip, Screen, ScreenHeader, SectionHeader, TextField } from '@/components/ui';
import { useSettingsDraft } from '@/hooks/useSettingsDraft';
import { spacing } from '@/theme';

const RADII = [5, 10, 15, 20];

export default function Rules() {
  const { draft, setDraft, save, saving } = useSettingsDraft();
  return (
    <Screen>
      <ScreenHeader title="Pickup & delivery rules" />
      <Card style={{ gap: spacing.md }}>
        <View style={{ gap: 4 }}>
          <AppText variant="bodyStrong">Minimum pickup: 10 pieces</AppText>
          <AppText variant="small">This required minimum is enforced by the app and database.</AppText>
        </View>
        <View style={{ gap: 6 }}>
          <AppText variant="caption">Service radius (miles from Burbank studio)</AppText>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {RADII.map((r) => (
              <Chip key={r} label={`${r} mi`} selected={draft.serviceRadiusMiles === r} onPress={() => setDraft({ ...draft, serviceRadiusMiles: r })} style={{ flex: 1 }} />
            ))}
          </View>
          <TextField
            value={String(draft.serviceRadiusMiles)}
            onChangeText={(t) => setDraft({ ...draft, serviceRadiusMiles: Number(t.replace(/[^\d.]/g, '')) || 0 })}
            keyboardType="decimal-pad"
            hint="Custom radius"
          />
        </View>
        <TextField
          label="Days customers can book ahead"
          value={String(draft.bookingDaysAhead)}
          onChangeText={(t) => setDraft({ ...draft, bookingDaysAhead: Math.min(30, Number(t.replace(/\D/g, '')) || 1) })}
          keyboardType="number-pad"
        />
      </Card>
      <SectionHeader title="Pickup time windows" />
      <Card>
        <TextField
          label="One window per line"
          value={draft.timeWindows.join('\n')}
          onChangeText={(t) => setDraft({ ...draft, timeWindows: t.split('\n').filter((x, i, a) => x.trim() || i === a.length - 1) })}
          multiline
        />
      </Card>
      <Button
        title="Save Rules"
        variant="dark"
        onPress={() => save({ ...draft, timeWindows: draft.timeWindows.map((w) => w.trim()).filter(Boolean) })}
        loading={saving}
        style={{ marginTop: spacing.lg }}
      />
    </Screen>
  );
}

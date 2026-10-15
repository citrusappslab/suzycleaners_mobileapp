import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Alert } from '@/lib/dialog';
import { AppText, Button, Card, Icon, Screen, ScreenHeader, TextField, Toggle } from '@/components/ui';
import { useServices } from '@/hooks/data';
import { backend } from '@/services/backend';
import { spacing } from '@/theme';
import type { ServiceItem } from '@/types';

export default function ManageServices() {
  const { allServices } = useServices();
  // `null` until the first edit, so the form shows the saved services once they load.
  const [edited, setEdited] = useState<ServiceItem[] | null>(null);
  const draft = edited ?? allServices;
  const [saving, setSaving] = useState(false);

  const patch = (id: string, p: Partial<ServiceItem>) => setEdited(draft.map((s) => (s.id === id ? { ...s, ...p } : s)));

  const save = async () => {
    if (draft.some((s) => !s.name.trim())) return Alert.alert('Every service needs a name.');
    setSaving(true);
    try {
      await backend.admin.saveServices(draft);
      router.back();
    } catch (e) {
      Alert.alert('Could not save', (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <ScreenHeader title="Services" subtitle="Manage the services customers can request." />
      <View style={{ gap: spacing.md }}>
        {draft.map((s) => (
          <Card key={s.id} style={{ gap: spacing.sm }}>
            <View style={styles.head}>
              <Icon name={s.icon} />
              <AppText variant="h3" style={{ flex: 1 }}>
                {s.name || 'Untitled'}
              </AppText>
              <AppText variant="small">{s.active ? 'Visible' : 'Hidden'}</AppText>
              <Toggle value={s.active} onValueChange={(active) => patch(s.id, { active })} />
            </View>
            <TextField label="Name" value={s.name} onChangeText={(name) => patch(s.id, { name })} />
            <TextField label="Tagline" value={s.tagline} onChangeText={(tagline) => patch(s.id, { tagline })} />
            <TextField label="Description" value={s.description} onChangeText={(description) => patch(s.id, { description })} multiline />
            <TextField
              label="Highlights (one per line)"
              value={s.highlights.join('\n')}
              onChangeText={(t) => patch(s.id, { highlights: t.split('\n').filter((x, i, a) => x.trim() || i === a.length - 1) })}
              multiline
            />
          </Card>
        ))}
        <Button title="Save Services" variant="dark" onPress={save} loading={saving} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});

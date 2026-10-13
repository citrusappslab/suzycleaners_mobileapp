import Constants from 'expo-constants';

/**
 * Runtime configuration.
 *
 * Supabase turns on automatically when EXPO_PUBLIC_SUPABASE_URL and a client
 * key are set (see .env). EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is Supabase's
 * new key format; EXPO_PUBLIC_SUPABASE_ANON_KEY (legacy) works too. Set
 * EXPO_PUBLIC_BACKEND=local to force the on-device demo backend.
 */
type BackendKind = 'local' | 'supabase';

const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || undefined;
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || undefined;

const requested = (process.env.EXPO_PUBLIC_BACKEND || undefined) as BackendKind | undefined;

export const env = {
  backend: (requested ?? (supabaseUrl && supabaseAnonKey ? 'supabase' : 'local')) as BackendKind,
  easProjectId: (extra.eas as { projectId?: string } | undefined)?.projectId || undefined,
  supabaseUrl,
  supabaseAnonKey,
  /**
   * Local demo only: the admin device calls Expo's push API directly. With
   * Supabase, pushes are sent by the database (push_notification trigger).
   */
  clientSidePush: true,
};

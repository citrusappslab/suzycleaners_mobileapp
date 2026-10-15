import { env } from '@/config/env';
import { LocalBackend } from './local/LocalBackend';
import { SupabaseBackend } from './supabase/SupabaseBackend';
import type { Backend } from './types';

export * from './types';

/**
 * Adapter selection. Screens and components only use the `Backend` contract,
 * so switching between the demo and Supabase needs no UI changes.
 */
function createBackend(): Backend {
  if (env.backend === 'supabase') {
    if (!env.supabaseUrl || !env.supabaseAnonKey) {
      throw new Error('EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set to use the Supabase backend.');
    }
    return new SupabaseBackend(env.supabaseUrl, env.supabaseAnonKey);
  }
  return new LocalBackend();
}

export const backend = createBackend();

/** Demo-only helpers that exist on the local adapter. */
export const demoTools = backend instanceof LocalBackend ? backend : null;

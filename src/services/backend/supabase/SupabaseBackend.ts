import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { DEFAULT_SETTINGS } from '@/config/business';
import { isEmail } from '@/lib/format';
import type { BusinessSettings, ServiceItem, User } from '@/types';
import {
  AuthError,
  type AuthResult,
  type Backend,
  type ChangeTopic,
  type ConversationSummary,
  type CreateOrderInput,
  ForbiddenError,
  type NotifyPayload,
  type OrderUpdate,
  type ProfilePatch,
  type SignUpInput,
} from '../types';
import { createSupabaseClient } from './client';
import { fromService, toCustomer, toMessage, toNotification, toOrder, toService, toUser } from './mappers';

const BAD_LOGIN = 'That email and password don’t match our records.';
const NOT_SET_UP =
  'Sign-in isn’t available yet: the Suzy’s Cleaners database hasn’t been set up. (Staff: run supabase/setup.sql in the Supabase SQL Editor.)';
const OFFLINE = 'Can’t reach Suzy’s Cleaners right now. Check your internet connection and try again.';

const looksOffline = (e: { name?: string; message?: string; status?: number } | null | undefined) =>
  !!e && (e.name === 'AuthRetryableFetchError' || e.status === 0 || /network request failed|failed to fetch|load failed/i.test(e.message ?? ''));

const TABLE_TOPICS: Record<string, ChangeTopic> = {
  orders: 'orders',
  messages: 'messages',
  notifications: 'notifications',
  profiles: 'users',
  services: 'catalog',
  settings: 'catalog',
};

/** Turn PostgREST / Postgres errors into readable app errors. */
function check<T>(res: { data: T; error: PostgrestError | null }): T {
  if (res.error) {
    if (res.error.code === '42501') throw new ForbiddenError(res.error.message);
    throw new Error(res.error.message);
  }
  return res.data;
}

/**
 * Production adapter backed by Supabase (Postgres + Auth + Realtime).
 *
 * All writes to orders, messages and notifications go through the
 * SECURITY DEFINER functions in supabase/migrations, which enforce roles,
 * item-count minimum and the service radius on the server; staff sets the
 * final invoice after inspection. Row-level
 * security limits every read to the caller's own rows unless they are admin.
 */
export class SupabaseBackend implements Backend {
  private sb: SupabaseClient;
  private listeners = new Set<(topic: ChangeTopic) => void>();
  private channel: ReturnType<SupabaseClient['channel']> | null = null;

  constructor(url: string, anonKey: string) {
    this.sb = createSupabaseClient(url, anonKey);
    this.sb.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        // Re-open the realtime channel so it uses the new user's permissions.
        this.reconnect();
        this.emit('session');
      }
    });
  }

  // ───────────────────────────── realtime

  private emit(topic: ChangeTopic) {
    this.listeners.forEach((l) => l(topic));
  }

  private connect() {
    if (this.channel) return;
    let channel = this.sb.channel('suzys-changes');
    for (const table of Object.keys(TABLE_TOPICS)) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => this.emit(TABLE_TOPICS[table]!));
    }
    this.channel = channel.subscribe();
  }

  private reconnect() {
    if (!this.channel) return;
    this.sb.removeChannel(this.channel);
    this.channel = null;
    if (this.listeners.size) this.connect();
  }

  subscribe(listener: (topic: ChangeTopic) => void) {
    this.listeners.add(listener);
    this.connect();
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Writes made by this device emit immediately instead of waiting for the realtime echo. */
  private changed(...topics: ChangeTopic[]) {
    topics.forEach((t) => this.emit(t));
  }

  // ───────────────────────────── helpers

  private async uid() {
    const { data } = await this.sb.auth.getSession();
    return data.session?.user.id ?? null;
  }

  private async profile(id: string): Promise<User> {
    const row = check(await this.sb.from('profiles').select('*').eq('id', id).single());
    return toUser(row);
  }

  /**
   * When sign-in fails, tell a setup or connection problem apart from a wrong
   * password. Reads the public `settings` table, which exists once setup.sql has run.
   */
  private async setupProblem(): Promise<string | null> {
    const { error } = await this.sb.from('settings').select('id').limit(1);
    if (!error) return null;
    if (looksOffline(error)) return OFFLINE;
    // PGRST205 / 42P01: table not found → the migrations haven't been run.
    if (error.code === 'PGRST205' || error.code === '42P01' || /schema cache|does not exist/i.test(error.message)) return NOT_SET_UP;
    return null;
  }

  /** Load the profile for a freshly signed-in user, explaining setup problems. */
  private async profileAfterAuth(id: string): Promise<User> {
    try {
      return await this.profile(id);
    } catch (e) {
      const problem = await this.setupProblem();
      if (problem) {
        await this.sb.auth.signOut();
        throw new AuthError(problem);
      }
      throw e;
    }
  }

  private async signInWithRole(email: string, password: string, role: User['role']): Promise<AuthResult> {
    const { data, error } = await this.sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
    if (error || !data.session) {
      if (looksOffline(error)) throw new AuthError(OFFLINE);
      if (error?.message?.toLowerCase().includes('email not confirmed')) {
        throw new AuthError('Please confirm your email address first — check your inbox for the link.');
      }
      throw new AuthError((await this.setupProblem()) ?? BAD_LOGIN);
    }
    const user = await this.profileAfterAuth(data.session.user.id);
    if (user.role !== role) {
      // Same message as a bad password so neither screen reveals which emails exist.
      await this.sb.auth.signOut();
      throw new AuthError(BAD_LOGIN);
    }
    return { session: { userId: user.id, role: user.role, token: data.session.access_token, issuedAt: new Date().toISOString() }, user };
  }

  // ───────────────────────────── auth

  auth = {
    restoreSession: async (): Promise<AuthResult | null> => {
      const { data } = await this.sb.auth.getSession();
      const s = data.session;
      if (!s) return null;
      try {
        const user = await this.profile(s.user.id);
        return { session: { userId: user.id, role: user.role, token: s.access_token, issuedAt: new Date().toISOString() }, user };
      } catch {
        await this.sb.auth.signOut();
        return null;
      }
    },

    signUp: async (input: SignUpInput): Promise<AuthResult> => {
      const email = input.email.trim().toLowerCase();
      if (!input.name.trim()) throw new AuthError('Please enter your name.');
      if (!isEmail(email)) throw new AuthError('Please enter a valid email address.');
      if (input.password.length < 8) throw new AuthError('Password must be at least 8 characters.');
      const { data, error } = await this.sb.auth.signUp({
        email,
        password: input.password,
        options: { data: { name: input.name.trim(), phone: input.phone.trim() } },
      });
      if (error) throw new AuthError(looksOffline(error) ? OFFLINE : ((await this.setupProblem()) ?? error.message));
      if (!data.session) {
        throw new AuthError('Almost there! We sent a confirmation link to your email. Tap it, then sign in.');
      }
      const user = await this.profileAfterAuth(data.session.user.id);
      return { session: { userId: user.id, role: user.role, token: data.session.access_token, issuedAt: new Date().toISOString() }, user };
    },

    signIn: (email: string, password: string) => this.signInWithRole(email, password, 'customer'),
    signInStaff: (email: string, password: string) => this.signInWithRole(email, password, 'admin'),

    signOut: async () => {
      await this.sb.auth.signOut();
    },

    deleteAccount: async () => {
      check(await this.sb.rpc('delete_my_account'));
      // The server session is gone with the user; clear the local one without calling the API.
      await this.sb.auth.signOut({ scope: 'local' });
    },

    updateProfile: async (patch: ProfilePatch) => {
      const id = await this.uid();
      if (!id) throw new AuthError('Please sign in to continue.');
      const row: Record<string, unknown> = {};
      if (patch.name !== undefined) row.name = patch.name;
      if (patch.phone !== undefined) row.phone = patch.phone;
      if (patch.addresses !== undefined) row.addresses = patch.addresses;
      if (patch.defaultAddressId !== undefined) row.default_address_id = patch.defaultAddressId ?? null;
      if (patch.notificationsEnabled !== undefined) row.notifications_enabled = patch.notificationsEnabled;
      if (patch.pushToken !== undefined) row.push_token = patch.pushToken ?? null;
      const updated = check(await this.sb.from('profiles').update(row).eq('id', id).select('*').single());
      this.changed('users');
      return toUser(updated);
    },
  };

  // ───────────────────────────── catalog (public)

  catalog = {
    listServices: async (): Promise<ServiceItem[]> => {
      const rows = check(await this.sb.from('services').select('*').order('sort_order'));
      return (rows ?? []).map(toService);
    },
    getSettings: async (): Promise<BusinessSettings> => {
      const row = check(await this.sb.from('settings').select('data').eq('id', 1).maybeSingle());
      // Merge so newly added settings keys always have a default.
      return { ...DEFAULT_SETTINGS, ...((row?.data as Partial<BusinessSettings>) ?? {}) };
    },
  };

  // ───────────────────────────── customer orders

  orders = {
    listMine: async () => {
      const id = await this.uid();
      if (!id) return [];
      const rows = check(await this.sb.from('orders').select('*').eq('customer_id', id).order('created_at', { ascending: false }));
      return (rows ?? []).map(toOrder);
    },

    getMine: async (orderId: string) => {
      const id = await this.uid();
      if (!id) return null;
      const row = check(await this.sb.from('orders').select('*').eq('id', orderId).eq('customer_id', id).maybeSingle());
      return row ? toOrder(row) : null;
    },

    create: async (input: CreateOrderInput) => {
      const row = check(
        await this.sb
          .rpc('create_order', {
            p_pickup_address: input.pickupAddress,
            p_delivery_address: input.deliveryAddress,
            p_pickup_date: input.pickupDate,
            p_time_window: input.timeWindow,
            p_lines: input.lines,
            p_instructions: input.instructions,
            p_next_day_service: input.nextDayServiceRequested,
            p_redeem_reward: input.rewardRedemptionRequested,
          })
          .single(),
      );
      this.changed('orders', 'notifications');
      return toOrder(row as Record<string, unknown>);
    },

    cancelMine: async (orderId: string) => {
      const row = check(await this.sb.rpc('cancel_my_order', { p_order_id: orderId }).single());
      this.changed('orders');
      return toOrder(row as Record<string, unknown>);
    },
  };

  // ───────────────────────────── customer messages & notifications

  messages = {
    listMine: async () => {
      const id = await this.uid();
      if (!id) return [];
      const rows = check(await this.sb.from('messages').select('*').eq('customer_id', id).order('created_at'));
      return (rows ?? []).map(toMessage);
    },
    send: async (body: string, opts: { orderId?: string; topic?: string } = {}) => {
      const row = check(
        await this.sb.rpc('send_my_message', { p_body: body, p_order_id: opts.orderId ?? null, p_topic: opts.topic ?? null }).single(),
      );
      this.changed('messages');
      return toMessage(row as Record<string, unknown>);
    },
    markReadByCustomer: async () => {
      if (!(await this.uid())) return;
      check(await this.sb.rpc('mark_my_messages_read'));
      this.changed('messages');
    },
  };

  notifications = {
    listMine: async () => {
      const id = await this.uid();
      if (!id) return [];
      const rows = check(await this.sb.from('notifications').select('*').eq('user_id', id).order('created_at', { ascending: false }).limit(100));
      return (rows ?? []).map(toNotification);
    },
    markAllRead: async () => {
      if (!(await this.uid())) return;
      check(await this.sb.rpc('mark_my_notifications_read'));
      this.changed('notifications');
    },
  };

  rewards = {
    getBalance: async () => {
      const id = await this.uid();
      if (!id) return 0;
      const row = check(await this.sb.from('profiles').select('reward_points').eq('id', id).single());
      return Number(row?.reward_points ?? 0);
    },
  };

  // ───────────────────────────── admin (enforced by RLS + require_admin())

  admin = {
    listOrders: async () => {
      const rows = check(await this.sb.from('orders').select('*').order('created_at', { ascending: false }).limit(500));
      return (rows ?? []).map(toOrder);
    },

    getOrder: async (id: string) => {
      const row = check(await this.sb.from('orders').select('*').eq('id', id).maybeSingle());
      return row ? toOrder(row) : null;
    },

    updateOrder: async (id: string, update: OrderUpdate, notify: NotifyPayload | null) => {
      const row = check(
        await this.sb
          .rpc('admin_update_order', {
            p_order_id: id,
            p_status: update.status ?? null,
            p_set_final_total: update.finalTotal !== undefined,
            p_final_total: update.finalTotal ?? null,
            p_note: update.note ?? null,
            p_notify_title: notify?.title ?? null,
            p_notify_body: notify?.body ?? null,
          })
          .single(),
      );
      this.changed('orders', 'messages', 'users');
      return toOrder(row as Record<string, unknown>);
    },

    listCustomers: async () => {
      const rows = check(await this.sb.rpc('admin_list_customers')) as Record<string, unknown>[];
      return (rows ?? []).map(toCustomer);
    },

    getCustomer: async (id: string) => {
      const all = await this.admin.listCustomers();
      return all.find((c) => c.id === id) ?? null;
    },

    listConversations: async (): Promise<ConversationSummary[]> => {
      const rows = check(await this.sb.rpc('admin_list_conversations')) as Record<string, any>[];
      return (rows ?? []).map((r) => ({
        customerId: r.customer_id,
        customerName: r.customer_name,
        customerPhone: r.customer_phone,
        lastMessage: toMessage(r.last_message),
        unread: Number(r.unread),
      }));
    },

    listMessages: async (customerId: string) => {
      const rows = check(await this.sb.from('messages').select('*').eq('customer_id', customerId).order('created_at'));
      return (rows ?? []).map(toMessage);
    },

    sendMessage: async (customerId: string, body: string, orderId?: string) => {
      const row = check(
        await this.sb.rpc('admin_send_message', { p_customer_id: customerId, p_body: body, p_order_id: orderId ?? null }).single(),
      );
      this.changed('messages');
      return toMessage(row as Record<string, unknown>);
    },

    markConversationRead: async (customerId: string) => {
      check(await this.sb.rpc('admin_mark_conversation_read', { p_customer_id: customerId }));
      this.changed('messages');
    },

    saveServices: async (services: ServiceItem[]) => {
      check(await this.sb.from('services').upsert(services.map(fromService)));
      this.changed('catalog');
    },

    saveSettings: async (settings: BusinessSettings) => {
      const data: BusinessSettings = {
        ...settings,
        serviceRadiusMiles: Math.min(50, Math.max(1, Number(settings.serviceRadiusMiles) || 1)),
      };
      check(await this.sb.from('settings').update({ data, updated_at: new Date().toISOString() }).eq('id', 1));
      this.changed('catalog');
    },
  };
}

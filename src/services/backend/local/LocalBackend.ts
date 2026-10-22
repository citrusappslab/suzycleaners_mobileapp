import { DEFAULT_SETTINGS } from '@/config/business';
import { hashPassword, randomSalt, safeEqual, uid } from '@/lib/crypto';
import { isEmail } from '@/lib/format';
import { jsonStorage, secureStorage } from '@/services/storage';
import { sendPush } from '@/services/push';
import type { AppNotification, BusinessSettings, Customer, Message, Order, ServiceItem, Session, User } from '@/types';
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
import { buildSeed, DB_VERSION, type LocalDb } from './seed';

const DB_KEY = 'suzys.db';
const SESSION_KEY = 'suzys.session';

/**
 * On-device demo backend.
 *
 * Persists a small JSON "database" in AsyncStorage and the session token in
 * SecureStore. It enforces the same rules a real backend must:
 *   - customers can only read/write their own orders, messages and notifications
 *   - every admin.* call requires a session with role === 'admin'
 *   - staff can't use the customer sign-in and customers can't use the staff one
 */
export class LocalBackend implements Backend {
  private db: LocalDb | null = null;
  private loading: Promise<LocalDb> | null = null;
  private session: Session | null = null;
  private listeners = new Set<(topic: ChangeTopic) => void>();

  // ───────────────────────────── infrastructure

  private async load(): Promise<LocalDb> {
    if (this.db) return this.db;
    if (!this.loading) {
      this.loading = (async () => {
        const stored = await jsonStorage.get<LocalDb>(DB_KEY);
        const db = stored && stored.version === DB_VERSION ? stored : buildSeed();
        if (!stored) await jsonStorage.set(DB_KEY, db);
        this.db = db;
        return db;
      })();
    }
    return this.loading;
  }

  private async commit(...topics: ChangeTopic[]) {
    if (this.db) await jsonStorage.set(DB_KEY, this.db);
    topics.forEach((t) => this.listeners.forEach((l) => l(t)));
  }

  subscribe(listener: (topic: ChangeTopic) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private requireUser(db: LocalDb): User {
    if (!this.session) throw new AuthError('Please sign in to continue.');
    const user = db.users.find((u) => u.id === this.session!.userId);
    if (!user) throw new AuthError('Your session has expired. Please sign in again.');
    return user;
  }

  private requireCustomer(db: LocalDb): User {
    const user = this.requireUser(db);
    if (user.role !== 'customer') throw new ForbiddenError('Staff accounts cannot place customer orders.');
    return user;
  }

  private requireAdmin(db: LocalDb): User {
    const user = this.requireUser(db);
    if (user.role !== 'admin' || this.session?.role !== 'admin') throw new ForbiddenError();
    return user;
  }

  private async startSession(user: User): Promise<AuthResult> {
    const session: Session = { userId: user.id, role: user.role, token: uid(), issuedAt: new Date().toISOString() };
    this.session = session;
    await secureStorage.set(SESSION_KEY, JSON.stringify(session));
    this.listeners.forEach((l) => l('session'));
    return { session, user };
  }

  private async verify(db: LocalDb, email: string, password: string): Promise<User> {
    const cred = db.credentials.find((c) => c.email.toLowerCase() === email.trim().toLowerCase());
    // Hash even when the account is missing so timing doesn't reveal which emails exist.
    const hash = await hashPassword(cred?.salt ?? 'missing', password);
    if (!cred || !safeEqual(hash, cred.passwordHash)) throw new AuthError('That email and password don’t match our records.');
    const user = db.users.find((u) => u.id === cred.userId);
    if (!user) throw new AuthError('Account not found.');
    return user;
  }

  /** Reset the demo database (Admin → Settings → Reset demo data). */
  async resetDemoData() {
    const db = await this.load();
    this.requireAdmin(db);
    this.db = buildSeed();
    await this.commit('orders', 'messages', 'notifications', 'users', 'catalog');
  }

  // ───────────────────────────── auth

  auth = {
    restoreSession: async (): Promise<AuthResult | null> => {
      const db = await this.load();
      const raw = await secureStorage.get(SESSION_KEY);
      if (!raw) return null;
      try {
        const session = JSON.parse(raw) as Session;
        const user = db.users.find((u) => u.id === session.userId);
        if (!user || user.role !== session.role) {
          await secureStorage.remove(SESSION_KEY);
          return null;
        }
        this.session = session;
        return { session, user };
      } catch {
        return null;
      }
    },

    signUp: async (input: SignUpInput): Promise<AuthResult> => {
      const db = await this.load();
      const email = input.email.trim().toLowerCase();
      if (!input.name.trim()) throw new AuthError('Please enter your name.');
      if (!isEmail(email)) throw new AuthError('Please enter a valid email address.');
      if (input.password.length < 8) throw new AuthError('Password must be at least 8 characters.');
      if (db.credentials.some((c) => c.email.toLowerCase() === email)) throw new AuthError('An account with this email already exists.');
      const user: User = {
        id: `usr-${uid()}`,
        role: 'customer', // self-registration can only ever create customers
        name: input.name.trim(),
        email,
        phone: input.phone.trim(),
        addresses: [],
        notificationsEnabled: true,
        rewardPoints: 0,
        createdAt: new Date().toISOString(),
      };
      const salt = randomSalt();
      db.users.push(user);
      db.credentials.push({ userId: user.id, email, salt, passwordHash: await hashPassword(salt, input.password) });
      db.messages.push({
        id: uid(),
        customerId: user.id,
        sender: 'system',
        senderName: "Suzy's Cleaners",
        body: `Welcome to Suzy's Cleaners, ${user.name.split(' ')[0]}! Message us anytime about pickups, deliveries, tailoring or shoe care.`,
        createdAt: new Date().toISOString(),
        readByAdmin: true,
        readByCustomer: false,
      });
      await this.commit('users', 'messages');
      return this.startSession(user);
    },

    signIn: async (email: string, password: string) => {
      const db = await this.load();
      const user = await this.verify(db, email, password);
      if (user.role !== 'customer') throw new AuthError('That email and password don’t match our records.');
      return this.startSession(user);
    },

    signInStaff: async (email: string, password: string) => {
      const db = await this.load();
      const user = await this.verify(db, email, password);
      // Same message as a bad password so the staff screen can't be used to discover customer emails.
      if (user.role !== 'admin') throw new AuthError('That email and password don’t match our records.');
      return this.startSession(user);
    },

    signOut: async () => {
      this.session = null;
      await secureStorage.remove(SESSION_KEY);
      this.listeners.forEach((l) => l('session'));
    },

    updateProfile: async (patch: ProfilePatch) => {
      const db = await this.load();
      const user = this.requireUser(db);
      Object.assign(user, patch);
      await this.commit('users');
      return { ...user };
    },

    deleteAccount: async () => {
      const db = await this.load();
      const me = this.requireUser(db);
      if (me.role !== 'customer') throw new ForbiddenError('Only customer accounts can be deleted from the app.');
      db.users = db.users.filter((u) => u.id !== me.id);
      db.credentials = db.credentials.filter((c) => c.userId !== me.id);
      db.orders = db.orders.filter((o) => o.customerId !== me.id);
      db.messages = db.messages.filter((m) => m.customerId !== me.id);
      db.notifications = db.notifications.filter((n) => n.userId !== me.id);
      this.session = null;
      await secureStorage.remove(SESSION_KEY);
      await this.commit('users', 'orders', 'messages', 'notifications', 'session');
    },
  };

  // ───────────────────────────── catalog (public)

  catalog = {
    listServices: async (): Promise<ServiceItem[]> => {
      const db = await this.load();
      return [...db.services].sort((a, b) => a.sortOrder - b.sortOrder);
    },
    // Merge defaults so settings saved by an older app version pick up new fields (e.g. altPhone).
    getSettings: async (): Promise<BusinessSettings> => {
      const settings = { ...DEFAULT_SETTINGS, ...(await this.load()).settings };
      settings.hours = settings.hours.map((h) => h.day === 'Sun' ? { ...h, open: h.open || '8:00 AM', close: h.close || '5:00 PM', closed: false } : h);
      return settings;
    },
  };

  // ───────────────────────────── customer orders

  orders = {
    listMine: async (): Promise<Order[]> => {
      const db = await this.load();
      if (!this.session) return [];
      const me = this.requireUser(db);
      return db.orders.filter((o) => o.customerId === me.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    getMine: async (id: string) => {
      const db = await this.load();
      const me = this.requireUser(db);
      return db.orders.find((o) => o.id === id && o.customerId === me.id) ?? null;
    },

    create: async (input: CreateOrderInput): Promise<Order> => {
      const db = await this.load();
      const me = this.requireCustomer(db);
      // Prices are always recomputed from the catalog — never trusted from the client.
      const lines = input.lines
        .filter((l) => l.quantity > 0)
        .map((l) => {
          const svc = db.services.find((s) => s.id === l.serviceId && s.active && s.bookable);
          if (!svc) throw new Error('One of the selected services is no longer available.');
          return { serviceId: svc.id, name: svc.name, quantity: Math.min(99, Math.round(l.quantity)) };
        });
      if (!lines.length) throw new Error('Please choose at least one service.');
      const pieceCount = lines.reduce((sum, line) => sum + line.quantity, 0);
      if (pieceCount < 10) throw new Error('Pickup requests require at least 10 pieces.');
      const reservedPoints = db.orders.filter((o) => o.customerId === me.id && o.rewardRedemptionRequested && o.rewardDiscount === 0 && o.status !== 'cancelled').length * 1000;
      if (input.rewardRedemptionRequested && (me.rewardPoints ?? 0) - reservedPoints < 1000) throw new Error('You need 1,000 available points to redeem $100 off.');
      const now = new Date().toISOString();
      const order: Order = {
        id: `ord-${uid()}`,
        number: Math.max(1000, ...db.orders.map((o) => o.number)) + 1,
        customerId: me.id,
        customerName: me.name,
        customerPhone: me.phone,
        customerEmail: me.email,
        pickupAddress: input.pickupAddress,
        deliveryAddress: input.deliveryAddress,
        pickupDate: input.pickupDate,
        timeWindow: input.timeWindow,
        lines,
        instructions: input.instructions.slice(0, 500),
        nextDayServiceRequested: input.nextDayServiceRequested,
        rewardRedemptionRequested: input.rewardRedemptionRequested,
        rewardDiscount: 0,
        pointsAwarded: 0,
        status: 'request_received',
        history: [{ status: 'request_received', at: now, by: 'customer' }],
        createdAt: now,
        updatedAt: now,
      };
      db.orders.push(order);
      const tpl = db.settings.notificationTemplates.request_received;
      db.notifications.push({
        id: uid(),
        userId: me.id,
        title: tpl.title,
        body: tpl.body,
        orderId: order.id,
        status: 'request_received',
        createdAt: now,
        read: false,
      });
      await this.commit('orders', 'notifications');
      return order;
    },

    cancelMine: async (id: string) => {
      const db = await this.load();
      const me = this.requireCustomer(db);
      const order = db.orders.find((o) => o.id === id && o.customerId === me.id);
      if (!order) throw new Error('Order not found.');
      if (!['request_received', 'pickup_confirmed'].includes(order.status)) {
        throw new Error('This order can no longer be cancelled in the app. Please message us.');
      }
      const now = new Date().toISOString();
      order.status = 'cancelled';
      order.rewardRedemptionRequested = false;
      order.rewardDiscount = 0;
      order.finalTotal = undefined;
      order.updatedAt = now;
      order.history.push({ status: 'cancelled', at: now, by: 'customer', note: 'Cancelled by customer' });
      await this.commit('orders');
      return order;
    },
  };

  rewards = {
    getBalance: async () => {
      const db = await this.load();
      return this.session ? (this.requireUser(db).rewardPoints ?? 0) : 0;
    },
  };

  // ───────────────────────────── customer messages

  messages = {
    listMine: async (): Promise<Message[]> => {
      const db = await this.load();
      if (!this.session) return [];
      const me = this.requireUser(db);
      return db.messages.filter((m) => m.customerId === me.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },

    send: async (body: string, opts: { orderId?: string; topic?: Message['topic'] } = {}) => {
      const db = await this.load();
      const me = this.requireCustomer(db);
      const text = body.trim().slice(0, 2000);
      if (!text) throw new Error('Message is empty.');
      if (opts.orderId && !db.orders.some((o) => o.id === opts.orderId && o.customerId === me.id)) {
        throw new ForbiddenError();
      }
      const message: Message = {
        id: uid(),
        customerId: me.id,
        sender: 'customer',
        senderName: me.name,
        body: text,
        orderId: opts.orderId,
        topic: opts.topic,
        createdAt: new Date().toISOString(),
        readByAdmin: false,
        readByCustomer: true,
      };
      db.messages.push(message);
      await this.commit('messages');
      return message;
    },

    markReadByCustomer: async () => {
      const db = await this.load();
      if (!this.session) return;
      const me = this.requireUser(db);
      let changed = false;
      db.messages.forEach((m) => {
        if (m.customerId === me.id && !m.readByCustomer) {
          m.readByCustomer = true;
          changed = true;
        }
      });
      if (changed) await this.commit('messages');
    },
  };

  // ───────────────────────────── customer notifications

  notifications = {
    listMine: async (): Promise<AppNotification[]> => {
      const db = await this.load();
      if (!this.session) return [];
      const me = this.requireUser(db);
      return db.notifications.filter((n) => n.userId === me.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
    markAllRead: async () => {
      const db = await this.load();
      if (!this.session) return;
      const me = this.requireUser(db);
      db.notifications.forEach((n) => {
        if (n.userId === me.id) n.read = true;
      });
      await this.commit('notifications');
    },
  };

  // ───────────────────────────── admin (role-gated)

  admin = {
    listOrders: async () => {
      const db = await this.load();
      this.requireAdmin(db);
      return [...db.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    getOrder: async (id: string) => {
      const db = await this.load();
      this.requireAdmin(db);
      return db.orders.find((o) => o.id === id) ?? null;
    },

    updateOrder: async (id: string, update: OrderUpdate, notify: NotifyPayload | null) => {
      const db = await this.load();
      this.requireAdmin(db);
      const order = db.orders.find((o) => o.id === id);
      if (!order) throw new Error('Order not found.');
      const nextStatus = update.status ?? order.status;
      let redemptionCustomer: User | undefined;
      if (update.finalTotal != null) {
        if (!['cleaning_in_progress', 'ready_for_pickup', 'ready_for_delivery', 'out_for_delivery', 'completed'].includes(nextStatus)) {
          throw new Error('Send the final invoice after the items have been inspected.');
        }
        if (order.rewardRedemptionRequested && order.rewardDiscount === 0) {
          redemptionCustomer = db.users.find((u) => u.id === order.customerId);
          const otherReservations = db.orders.filter((o) => o.customerId === order.customerId && o.id !== order.id && o.rewardRedemptionRequested && o.rewardDiscount === 0 && o.status !== 'cancelled').length * 1000;
          if (!redemptionCustomer || (redemptionCustomer.rewardPoints ?? 0) - otherReservations < 1000) throw new Error('This customer no longer has enough available points to redeem the $100 reward.');
          if (update.finalTotal < 100) throw new Error('The invoice must be at least $100 before applying the reward.');
        }
      }
      const now = new Date().toISOString();
      if (update.status && update.status !== order.status) {
        order.status = update.status;
        order.history.push({ status: update.status, at: now, by: 'admin', note: update.note });
      }
      if (update.finalTotal !== undefined) order.finalTotal = update.finalTotal ?? undefined;
      if (update.finalTotal != null && redemptionCustomer) {
        redemptionCustomer.rewardPoints -= 1000;
        order.rewardDiscount = 100;
        order.finalTotal = update.finalTotal - 100;
      }
      order.updatedAt = now;

      if (order.status === 'completed' && order.finalTotal != null && order.pointsAwarded === 0) {
        const earned = Math.floor(order.finalTotal / 100) * 10;
        const customer = db.users.find((u) => u.id === order.customerId);
        if (customer && earned > 0) {
          customer.rewardPoints = (customer.rewardPoints ?? 0) + earned;
          order.pointsAwarded = earned;
        }
      }

      if (notify) {
        const customer = db.users.find((u) => u.id === order.customerId);
        db.notifications.push({
          id: uid(),
          userId: order.customerId,
          title: notify.title,
          body: notify.body,
          orderId: order.id,
          status: order.status,
          createdAt: now,
          read: false,
        });
        db.messages.push({
          id: uid(),
          customerId: order.customerId,
          sender: 'admin',
          senderName: "Suzy's Cleaners",
          body: notify.body,
          orderId: order.id,
          createdAt: now,
          readByAdmin: true,
          readByCustomer: false,
        });
        if (customer?.pushToken && customer.notificationsEnabled) {
          sendPush(customer.pushToken, notify.title, notify.body, { orderId: order.id }).catch(() => {});
        }
      }
      await this.commit('orders', 'notifications', 'messages', 'users');
      return order;
    },

    listCustomers: async (): Promise<Customer[]> => {
      const db = await this.load();
      this.requireAdmin(db);
      return db.users
        .filter((u) => u.role === 'customer')
        .map((u) => this.toCustomer(db, u))
        .sort((a, b) => (b.lastOrderAt ?? b.createdAt).localeCompare(a.lastOrderAt ?? a.createdAt));
    },

    getCustomer: async (id: string) => {
      const db = await this.load();
      this.requireAdmin(db);
      const u = db.users.find((x) => x.id === id && x.role === 'customer');
      return u ? this.toCustomer(db, u) : null;
    },

    listConversations: async (): Promise<ConversationSummary[]> => {
      const db = await this.load();
      this.requireAdmin(db);
      const byCustomer = new Map<string, Message[]>();
      db.messages.forEach((m) => byCustomer.set(m.customerId, [...(byCustomer.get(m.customerId) ?? []), m]));
      const out: ConversationSummary[] = [];
      byCustomer.forEach((msgs, customerId) => {
        const c = db.users.find((u) => u.id === customerId);
        if (!c) return;
        const real = msgs.filter((m) => m.sender !== 'system');
        if (!real.length) return;
        const sorted = [...real].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        out.push({
          customerId,
          customerName: c.name,
          customerPhone: c.phone,
          lastMessage: sorted[sorted.length - 1]!,
          unread: msgs.filter((m) => !m.readByAdmin).length,
        });
      });
      return out.sort((a, b) => b.lastMessage.createdAt.localeCompare(a.lastMessage.createdAt));
    },

    listMessages: async (customerId: string) => {
      const db = await this.load();
      this.requireAdmin(db);
      return db.messages.filter((m) => m.customerId === customerId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },

    sendMessage: async (customerId: string, body: string, orderId?: string) => {
      const db = await this.load();
      this.requireAdmin(db);
      const customer = db.users.find((u) => u.id === customerId && u.role === 'customer');
      if (!customer) throw new Error('Customer not found.');
      const text = body.trim().slice(0, 2000);
      if (!text) throw new Error('Message is empty.');
      const now = new Date().toISOString();
      const message: Message = {
        id: uid(),
        customerId,
        sender: 'admin',
        senderName: "Suzy's Cleaners",
        body: text,
        orderId,
        createdAt: now,
        readByAdmin: true,
        readByCustomer: false,
      };
      db.messages.push(message);
      db.notifications.push({ id: uid(), userId: customerId, title: "New message from Suzy's", body: text, orderId, createdAt: now, read: false });
      if (customer.pushToken && customer.notificationsEnabled) {
        sendPush(customer.pushToken, "Suzy's Cleaners", text, { customerId }).catch(() => {});
      }
      await this.commit('messages', 'notifications');
      return message;
    },

    markConversationRead: async (customerId: string) => {
      const db = await this.load();
      this.requireAdmin(db);
      let changed = false;
      db.messages.forEach((m) => {
        if (m.customerId === customerId && !m.readByAdmin) {
          m.readByAdmin = true;
          changed = true;
        }
      });
      if (changed) await this.commit('messages');
    },

    saveServices: async (services: ServiceItem[]) => {
      const db = await this.load();
      this.requireAdmin(db);
      db.services = services;
      await this.commit('catalog');
    },

    saveSettings: async (settings: BusinessSettings) => {
      const db = await this.load();
      this.requireAdmin(db);
      db.settings = {
        ...settings,
        serviceRadiusMiles: Math.min(50, Math.max(1, Number(settings.serviceRadiusMiles) || 1)),
      };
      await this.commit('catalog');
    },
  };

  private toCustomer(db: LocalDb, u: User): Customer {
    const orders = db.orders.filter((o) => o.customerId === u.id);
    const last = orders.map((o) => o.createdAt).sort().pop();
    return {
      ...u,
      orderCount: orders.length,
      lifetimeValue: orders.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + (o.finalTotal ?? 0), 0),
      lastOrderAt: last,
      unreadForAdmin: db.messages.filter((m) => m.customerId === u.id && !m.readByAdmin).length,
    };
  }
}

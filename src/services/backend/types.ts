import type {
  Address,
  AppNotification,
  BusinessSettings,
  Customer,
  Message,
  MessageTopic,
  Order,
  OrderStatus,
  ServiceItem,
  Session,
  User,
} from '@/types';

/**
 * The single contract every data adapter implements.
 *
 * The UI only talks to this interface — never to AsyncStorage, Supabase or
 * Firebase directly — so swapping the demo `LocalBackend` for a production
 * adapter is a one-line change in `src/services/backend/index.ts`.
 *
 * Authorization rule: every `admin.*` method MUST be enforced server-side
 * (Supabase RLS / Firebase security rules / API middleware). The local adapter
 * mirrors that by checking the session role on every admin call.
 */

export interface AuthResult {
  session: Session;
  user: User;
}

export interface SignUpInput {
  name: string;
  email: string;
  phone: string;
  password: string;
}

export type ProfilePatch = Partial<Pick<User, 'name' | 'phone' | 'addresses' | 'defaultAddressId' | 'notificationsEnabled' | 'pushToken'>>;

export interface AuthApi {
  restoreSession(): Promise<AuthResult | null>;
  signUp(input: SignUpInput): Promise<AuthResult>;
  /** Customer sign-in. Staff accounts are rejected here on purpose. */
  signIn(email: string, password: string): Promise<AuthResult>;
  /** Staff sign-in. Only accounts holding the `admin` role are accepted. */
  signInStaff(email: string, password: string): Promise<AuthResult>;
  signOut(): Promise<void>;
  updateProfile(patch: ProfilePatch): Promise<User>;
  /** Permanently deletes the signed-in customer's own account and data, then signs out. Staff are refused. */
  deleteAccount(): Promise<void>;
}

export interface CatalogApi {
  listServices(): Promise<ServiceItem[]>;
  getSettings(): Promise<BusinessSettings>;
}

export interface CreateOrderInput {
  pickupAddress: Address;
  deliveryAddress: Address;
  pickupDate: string;
  timeWindow: string;
  lines: { serviceId: string; quantity: number }[];
  instructions: string;
  nextDayServiceRequested: boolean;
  rewardRedemptionRequested: boolean;
}

export interface RewardsApi {
  getBalance(): Promise<number>;
}

export interface OrdersApi {
  listMine(): Promise<Order[]>;
  getMine(id: string): Promise<Order | null>;
  create(input: CreateOrderInput): Promise<Order>;
  cancelMine(id: string): Promise<Order>;
}

export interface MessagesApi {
  listMine(): Promise<Message[]>;
  send(body: string, opts?: { orderId?: string; topic?: MessageTopic }): Promise<Message>;
  markReadByCustomer(): Promise<void>;
}

export interface NotificationsApi {
  listMine(): Promise<AppNotification[]>;
  markAllRead(): Promise<void>;
}

export interface OrderUpdate {
  status?: OrderStatus;
  finalTotal?: number | null;
  note?: string;
}

export interface NotifyPayload {
  title: string;
  body: string;
}

export interface ConversationSummary {
  customerId: string;
  customerName: string;
  customerPhone: string;
  lastMessage: Message;
  unread: number;
}

export interface AdminApi {
  listOrders(): Promise<Order[]>;
  getOrder(id: string): Promise<Order | null>;
  /** Changes the order and (optionally) notifies the customer: in-app notification, push and a message in their thread. */
  updateOrder(id: string, update: OrderUpdate, notify: NotifyPayload | null): Promise<Order>;
  listCustomers(): Promise<Customer[]>;
  getCustomer(id: string): Promise<Customer | null>;
  listConversations(): Promise<ConversationSummary[]>;
  listMessages(customerId: string): Promise<Message[]>;
  sendMessage(customerId: string, body: string, orderId?: string): Promise<Message>;
  markConversationRead(customerId: string): Promise<void>;
  saveServices(services: ServiceItem[]): Promise<void>;
  saveSettings(settings: BusinessSettings): Promise<void>;
}

export type ChangeTopic = 'orders' | 'messages' | 'notifications' | 'users' | 'catalog' | 'session';

export interface Backend {
  auth: AuthApi;
  catalog: CatalogApi;
  orders: OrdersApi;
  messages: MessagesApi;
  notifications: NotificationsApi;
  rewards: RewardsApi;
  admin: AdminApi;
  /** Realtime change feed (Supabase channels / Firestore snapshots in production). */
  subscribe(listener: (topic: ChangeTopic) => void): () => void;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

export class ForbiddenError extends Error {
  constructor(message = 'You do not have access to this area.') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

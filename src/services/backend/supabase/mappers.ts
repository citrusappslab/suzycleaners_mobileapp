import type { AppNotification, Customer, Message, Order, ServiceItem, User } from '@/types';

/* Database rows use snake_case; the app uses the camelCase domain model. */

type Row = Record<string, any>;

const num = (v: unknown) => (v == null ? undefined : Number(v));

export const toUser = (r: Row): User => ({
  id: r.id,
  role: r.role,
  name: r.name,
  email: r.email,
  phone: r.phone ?? '',
  addresses: r.addresses ?? [],
  defaultAddressId: r.default_address_id ?? undefined,
  pushToken: r.push_token ?? undefined,
  notificationsEnabled: r.notifications_enabled,
  rewardPoints: Number(r.reward_points ?? 0),
  createdAt: r.created_at,
});

export const toCustomer = (r: Row): Customer => ({
  ...toUser(r),
  orderCount: Number(r.order_count ?? 0),
  lifetimeValue: Number(r.lifetime_value ?? 0),
  lastOrderAt: r.last_order_at ?? undefined,
  unreadForAdmin: Number(r.unread_for_admin ?? 0),
});

export const toOrder = (r: Row): Order => ({
  id: r.id,
  number: r.number,
  customerId: r.customer_id,
  customerName: r.customer_name,
  customerPhone: r.customer_phone,
  customerEmail: r.customer_email,
  pickupAddress: r.pickup_address,
  deliveryAddress: r.delivery_address,
  pickupDate: r.pickup_date,
  timeWindow: r.time_window,
  lines: (r.lines ?? []).map((l: Row) => ({ serviceId: l.serviceId, name: l.name, quantity: Number(l.quantity) })),
  instructions: r.instructions ?? '',
  finalTotal: num(r.final_total),
  nextDayServiceRequested: Boolean(r.next_day_service_requested),
  rewardRedemptionRequested: Boolean(r.reward_redemption_requested),
  rewardDiscount: Number(r.reward_discount ?? 0),
  pointsAwarded: Number(r.points_awarded ?? 0),
  status: r.status,
  history: r.history ?? [],
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const toMessage = (r: Row): Message => ({
  id: r.id,
  customerId: r.customer_id,
  sender: r.sender,
  senderName: r.sender_name,
  body: r.body,
  orderId: r.order_id ?? undefined,
  topic: r.topic ?? undefined,
  createdAt: r.created_at,
  readByCustomer: r.read_by_customer,
  readByAdmin: r.read_by_admin,
});

export const toNotification = (r: Row): AppNotification => ({
  id: r.id,
  userId: r.user_id,
  title: r.title,
  body: r.body,
  orderId: r.order_id ?? undefined,
  status: r.status ?? undefined,
  createdAt: r.created_at,
  read: r.read,
});

export const toService = (r: Row): ServiceItem => ({
  id: r.id,
  name: r.name,
  tagline: r.tagline,
  description: r.description,
  highlights: r.highlights ?? [],
  icon: r.icon,
  image: r.image,
  active: r.active,
  bookable: r.bookable,
  sortOrder: r.sort_order,
});

export const fromService = (s: ServiceItem) => ({
  id: s.id,
  name: s.name,
  tagline: s.tagline,
  description: s.description,
  highlights: s.highlights.map((h) => h.trim()).filter(Boolean),
  icon: s.icon,
  image: s.image,
  active: s.active,
  bookable: s.bookable,
  sort_order: s.sortOrder,
});

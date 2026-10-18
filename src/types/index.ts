/**
 * Domain model shared by the UI and every backend adapter.
 * Keep these shapes stable — they map 1:1 onto database tables
 * (see docs/BACKEND.md for the suggested Supabase / Firebase schema).
 */

export type Role = 'customer' | 'admin';

export interface Address {
  id: string;
  label: string; // "Home", "Office"…
  line1: string;
  line2?: string;
  city: string;
  state: string;
  zip: string;
  latitude?: number;
  longitude?: number;
}

export interface User {
  id: string;
  role: Role;
  name: string;
  email: string;
  phone: string;
  addresses: Address[];
  defaultAddressId?: string;
  pushToken?: string;
  notificationsEnabled: boolean;
  rewardPoints: number;
  createdAt: string;
}

export interface Session {
  userId: string;
  role: Role;
  token: string;
  issuedAt: string;
}

export type ServiceId = string;

export interface ServiceItem {
  id: ServiceId;
  name: string;
  tagline: string;
  description: string;
  highlights: string[];
  icon: string; // Ionicons / MaterialCommunityIcons glyph key (see ServiceIcon)
  image: ServiceImageKey;
  active: boolean;
  /** Pickup & Delivery is a service the customer reads about, not one they add to a cart. */
  bookable: boolean;
  sortOrder: number;
}

export type ServiceImageKey = 'dry-cleaning' | 'garment-care' | 'shoe-cleaning' | 'tailoring' | 'pickup-delivery';

export const ORDER_STATUSES = [
  'request_received',
  'pickup_confirmed',
  'driver_on_the_way',
  'picked_up',
  'cleaning_in_progress',
  'ready_for_pickup',
  'ready_for_delivery',
  'out_for_delivery',
  'completed',
  'cancelled',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export interface OrderLine {
  serviceId: ServiceId;
  name: string;
  quantity: number;
}

export interface StatusEvent {
  status: OrderStatus;
  at: string;
  note?: string;
  by: 'customer' | 'admin' | 'system';
}

export interface Order {
  id: string;
  number: number;
  customerId: string;
  /** Snapshot of the customer's contact info at time of request. */
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  pickupAddress: Address;
  deliveryAddress: Address;
  pickupDate: string; // YYYY-MM-DD
  timeWindow: string; // "9–11 AM"
  lines: OrderLine[];
  instructions: string;
  finalTotal?: number;
  nextDayServiceRequested: boolean;
  rewardRedemptionRequested: boolean;
  rewardDiscount: number;
  pointsAwarded: number;
  status: OrderStatus;
  history: StatusEvent[];
  createdAt: string;
  updatedAt: string;
}

export type MessageSender = 'customer' | 'admin' | 'system';

export interface Message {
  id: string;
  customerId: string; // a conversation == one customer thread with the business
  sender: MessageSender;
  senderName: string;
  body: string;
  orderId?: string;
  topic?: MessageTopic;
  createdAt: string;
  readByCustomer: boolean;
  readByAdmin: boolean;
}

export type MessageTopic = 'order' | 'pickup' | 'delivery' | 'tailoring' | 'shoes' | 'general';

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  orderId?: string;
  status?: OrderStatus;
  createdAt: string;
  read: boolean;
}

export interface BusinessHours {
  day: 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';
  open: string; // "7:00 AM"
  close: string; // "7:00 PM"
  closed: boolean;
}

export interface StoreLocation {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  latitude: number;
  longitude: number;
  status: 'open' | 'coming_soon';
}

export interface NotificationTemplate {
  title: string;
  body: string;
}

export interface BusinessSettings {
  businessName: string;
  tagline: string;
  phone: string;
  /** Second business line, shown next to the main number. Empty to hide. */
  altPhone: string;
  email: string;
  website: string;
  serviceRadiusMiles: number;
  timeWindows: string[];
  bookingDaysAhead: number;
  hours: BusinessHours[];
  locations: StoreLocation[];
  notificationTemplates: Record<OrderStatus, NotificationTemplate>;
  about: string;
  chamberMember: boolean;
}

export interface Customer extends User {
  orderCount: number;
  lifetimeValue: number;
  lastOrderAt?: string;
  unreadForAdmin: number;
}

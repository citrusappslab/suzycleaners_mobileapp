import { DEFAULT_SERVICES, DEFAULT_SETTINGS } from '@/config/business';
import { DEMO_ADMIN, DEMO_CUSTOMER } from '@/config/demo';
import { toDayKey } from '@/lib/format';
import type { Address, AppNotification, BusinessSettings, Message, Order, OrderStatus, ServiceItem, User } from '@/types';
import { DELIVERY_TIMELINE, PICKUP_TIMELINE } from '@/config/orderStatus';

export interface Credential {
  userId: string;
  email: string;
  salt: string;
  passwordHash: string;
}

export interface LocalDb {
  version: number;
  users: User[];
  credentials: Credential[];
  orders: Order[];
  messages: Message[];
  notifications: AppNotification[];
  services: ServiceItem[];
  settings: BusinessSettings;
}

export const DB_VERSION = 1;

const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return toDayKey(d);
};
const at = (offsetDays: number, hour: number, minute = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
};

const addr = (id: string, label: string, line1: string, city: string, zip: string): Address => ({
  id,
  label,
  line1,
  city,
  state: 'CA',
  zip,
});

const customer = (id: string, name: string, email: string, phone: string, addresses: Address[], createdDaysAgo: number): User => ({
  id,
  role: 'customer',
  name,
  email,
  phone,
  addresses,
  defaultAddressId: addresses[0]?.id,
  notificationsEnabled: true,
  rewardPoints: 0,
  createdAt: at(-createdDaysAgo, 10),
});

const line = (serviceId: string, quantity: number) => ({
  serviceId,
  name: DEFAULT_SERVICES.find((s) => s.id === serviceId)!.name,
  quantity,
});

/** Build a status history up to (and including) `status`. */
const historyTo = (status: OrderStatus, startDayOffset: number, delivery = true) => {
  const path: OrderStatus[] =
    status === 'cancelled' ? ['request_received', 'cancelled'] : delivery ? DELIVERY_TIMELINE : PICKUP_TIMELINE;
  const trimmed = path.slice(0, path.indexOf(status) + 1);
  const now = Date.now();
  return trimmed.map((s, i) => ({
    status: s,
    // Never in the future: upcoming pickups were requested/confirmed earlier today.
    at: new Date(Math.min(new Date(at(startDayOffset + Math.floor(i / 3), 9 + (i % 3) * 2, 15)).getTime(), now - (trimmed.length - i) * 47 * 60000)).toISOString(),
    by: (i === 0 ? 'customer' : 'admin') as 'customer' | 'admin',
  }));
};

export function buildSeed(): LocalDb {
  const demoAddresses = [
    addr('adr-demo-1', 'Home', '840 N Glenoaks Blvd', 'Burbank', '91502'),
    addr('adr-demo-2', 'Office', '3900 W Alameda Ave', 'Burbank', '91505'),
  ];

  const admin: User = {
    id: DEMO_ADMIN.id,
    role: 'admin',
    name: DEMO_ADMIN.name,
    email: DEMO_ADMIN.email,
    phone: DEMO_ADMIN.phone,
    addresses: [],
    notificationsEnabled: true,
    rewardPoints: 0,
    createdAt: at(-400, 9),
  };

  const users: User[] = [
    admin,
    customer(DEMO_CUSTOMER.id, 'Alex Morgan', DEMO_CUSTOMER.email, '(818) 555-0110', demoAddresses, 120),
    customer('usr-maria', 'Maria Alvarez', 'maria.alvarez@example.com', '(818) 555-0142', [addr('adr-m1', 'Home', '1215 W Olive Ave', 'Burbank', '91506')], 60),
    customer('usr-james', 'James Cole', 'james.cole@example.com', '(747) 555-0178', [addr('adr-j1', 'Home', '410 E Providencia Ave', 'Burbank', '91501')], 45),
    customer('usr-priya', 'Priya Shah', 'priya.shah@example.com', '(818) 555-0199', [addr('adr-p1', 'Home', '1600 N Brand Blvd', 'Glendale', '91201')], 200),
    customer('usr-daniel', 'Daniel Kim', 'daniel.kim@example.com', '(818) 555-0163', [addr('adr-d1', 'Home', '4400 Lankershim Blvd', 'North Hollywood', '91602')], 30),
    customer('usr-sophie', 'Sophie Martinez', 'sophie.m@example.com', '(747) 555-0120', [addr('adr-s1', 'Home', '220 S Lake Ave', 'Pasadena', '91101')], 90),
    customer('usr-robert', 'Robert Chen', 'robert.chen@example.com', '(818) 555-0188', [addr('adr-r1', 'Office', '3000 W Magnolia Blvd', 'Burbank', '91505')], 15),
  ];

  const credentials: Credential[] = [
    { userId: DEMO_ADMIN.id, email: DEMO_ADMIN.email, salt: DEMO_ADMIN.salt, passwordHash: DEMO_ADMIN.passwordHash },
    { userId: DEMO_CUSTOMER.id, email: DEMO_CUSTOMER.email, salt: DEMO_CUSTOMER.salt, passwordHash: DEMO_CUSTOMER.passwordHash },
  ];

  const u = (id: string) => users.find((x) => x.id === id)!;

  const mkOrder = (
    n: number,
    userId: string,
    status: OrderStatus,
    lines: ReturnType<typeof line>[],
    opts: { pickupOffset: number; window: string; instructions?: string; finalTotal?: number; delivery?: boolean },
  ): Order => {
    const c = u(userId);
    const history = historyTo(status, opts.pickupOffset - 1, opts.delivery ?? true);
    return {
      id: `ord-${n}`,
      number: n,
      customerId: c.id,
      customerName: c.name,
      customerPhone: c.phone,
      customerEmail: c.email,
      pickupAddress: c.addresses[0]!,
      deliveryAddress: c.addresses[0]!,
      pickupDate: day(opts.pickupOffset),
      timeWindow: opts.window,
      lines,
      instructions: opts.instructions ?? '',
      nextDayServiceRequested: false,
      rewardRedemptionRequested: false,
      rewardDiscount: 0,
      pointsAwarded: 0,
      finalTotal: opts.finalTotal,
      status,
      history,
      createdAt: history[0]!.at,
      updatedAt: history[history.length - 1]!.at,
    };
  };

  const orders: Order[] = [
    mkOrder(1031, DEMO_CUSTOMER.id, 'completed', [line('dry-cleaning', 4), line('tailoring', 1)], { pickupOffset: -21, window: '9–11 AM', finalTotal: 76 }),
    mkOrder(1042, DEMO_CUSTOMER.id, 'cleaning_in_progress', [line('dry-cleaning', 2), line('shoe-cleaning', 1)], {
      pickupOffset: -2,
      window: '9–11 AM',
      instructions: 'Please leave with the concierge.',
    }),
    mkOrder(1043, 'usr-maria', 'request_received', [line('dry-cleaning', 3), line('garment-care', 2), line('tailoring', 1)], {
      pickupOffset: 1,
      window: '12–2 PM',
      instructions: 'Gate code 4417. Silk blouse has a small stain on the cuff.',
    }),
    mkOrder(1044, 'usr-james', 'pickup_confirmed', [line('dry-cleaning', 6), line('shoe-cleaning', 1)], { pickupOffset: 1, window: '9–11 AM' }),
    mkOrder(1038, 'usr-priya', 'ready_for_pickup', [line('garment-care', 1), line('tailoring', 1), line('dry-cleaning', 2)], {
      pickupOffset: -4,
      window: '3–5 PM',
      delivery: false,
    }),
    mkOrder(1040, 'usr-daniel', 'cleaning_in_progress', [line('dry-cleaning', 3)], { pickupOffset: -2, window: '12–2 PM' }),
    mkOrder(1039, 'usr-sophie', 'ready_for_delivery', [line('shoe-cleaning', 2), line('dry-cleaning', 2)], { pickupOffset: -3, window: '9–11 AM', finalTotal: 95 }),
    mkOrder(1045, 'usr-robert', 'pickup_confirmed', [line('tailoring', 2), line('dry-cleaning', 2)], {
      pickupOffset: 2,
      window: '3–5 PM',
      instructions: 'Front desk, ask for Robert.',
    }),
    mkOrder(1035, 'usr-james', 'cancelled', [line('dry-cleaning', 4)], { pickupOffset: -10, window: '12–2 PM' }),
    mkOrder(1033, 'usr-maria', 'completed', [line('garment-care', 1), line('dry-cleaning', 3)], { pickupOffset: -14, window: '9–11 AM', finalTotal: 58 }),
  ];

  const msg = (customerId: string, sender: Message['sender'], body: string, createdAt: string, extra: Partial<Message> = {}): Message => ({
    id: `msg-${customerId}-${createdAt}-${sender}`,
    customerId,
    sender,
    senderName: sender === 'customer' ? u(customerId).name : "Suzy's Cleaners",
    body,
    createdAt,
    readByAdmin: sender !== 'customer',
    readByCustomer: sender === 'customer',
    ...extra,
  });

  const messages: Message[] = [
    msg(DEMO_CUSTOMER.id, 'system', "Welcome to Suzy's Cleaners! Message us anytime about pickups, deliveries, tailoring or shoe care.", at(-120, 10), { readByCustomer: true }),
    msg(DEMO_CUSTOMER.id, 'customer', 'Hi! Can you take in the waist on one of the suits about an inch?', at(-2, 8, 40), { orderId: 'ord-1042', topic: 'tailoring' }),
    msg(DEMO_CUSTOMER.id, 'admin', "Absolutely — we'll pin it at pickup and our tailor will take care of it. Small alterations are $20.", at(-2, 9, 5), { orderId: 'ord-1042', readByCustomer: true }),
    msg('usr-maria', 'customer', 'Will someone be able to look at the stain on my silk blouse before cleaning?', at(0, 8, 12), { orderId: 'ord-1043', topic: 'order' }),
    msg('usr-sophie', 'customer', 'Can the delivery come after 5pm on Friday?', at(0, 7, 50), { orderId: 'ord-1039', topic: 'delivery' }),
    msg('usr-daniel', 'customer', 'Do you clean suede jackets too?', at(-1, 18, 30), { topic: 'general' }),
    msg('usr-priya', 'admin', 'Great news! Your Suzy Cleaners order is ready for pickup.', at(-1, 16, 0), { orderId: 'ord-1038', readByCustomer: true }),
  ];

  const notifications: AppNotification[] = [
    {
      id: 'ntf-1042-a',
      userId: DEMO_CUSTOMER.id,
      title: 'Cleaning in progress',
      body: 'Your order is being cleaned with care.',
      orderId: 'ord-1042',
      status: 'cleaning_in_progress',
      createdAt: at(-1, 10),
      read: false,
    },
  ];

  return {
    version: DB_VERSION,
    users,
    credentials,
    orders,
    messages,
    notifications,
    services: DEFAULT_SERVICES,
    settings: DEFAULT_SETTINGS,
  };
}

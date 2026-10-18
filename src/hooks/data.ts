import { backend } from '@/services/backend';
import { DEFAULT_SERVICES, DEFAULT_SETTINGS } from '@/config/business';
import { useAuth } from '@/providers/AuthProvider';
import { useLiveQuery } from './useLiveQuery';

/* Customer-facing & public data */

export const useSettings = () => {
  const q = useLiveQuery(() => backend.catalog.getSettings(), ['catalog']);
  return { ...q, settings: q.data ?? DEFAULT_SETTINGS };
};

export const useServices = () => {
  const q = useLiveQuery(() => backend.catalog.listServices(), ['catalog']);
  return { ...q, services: (q.data ?? DEFAULT_SERVICES).filter((s) => s.active), allServices: q.data ?? DEFAULT_SERVICES };
};

export const useMyOrders = () => {
  const { user } = useAuth();
  const q = useLiveQuery(() => (user ? backend.orders.listMine() : Promise.resolve([])), ['orders'], [user?.id]);
  return { ...q, orders: q.data ?? [] };
};

export const useMyOrder = (id: string | undefined) => {
  const { user } = useAuth();
  return useLiveQuery(() => (user && id ? backend.orders.getMine(id) : Promise.resolve(null)), ['orders'], [user?.id, id]);
};

export const useMyMessages = () => {
  const { user } = useAuth();
  const q = useLiveQuery(() => (user ? backend.messages.listMine() : Promise.resolve([])), ['messages'], [user?.id]);
  return { ...q, messages: q.data ?? [] };
};

export const useMyNotifications = () => {
  const { user } = useAuth();
  const q = useLiveQuery(() => (user ? backend.notifications.listMine() : Promise.resolve([])), ['notifications'], [user?.id]);
  return { ...q, notifications: q.data ?? [] };
};

export const useRewardsBalance = () => {
  const { user } = useAuth();
  const q = useLiveQuery(() => (user ? backend.rewards.getBalance() : Promise.resolve(0)), ['users', 'orders'], [user?.id]);
  return { ...q, points: q.data ?? user?.rewardPoints ?? 0 };
};

/* Admin data — every call is role-checked by the backend */

export const useAdminOrders = () => {
  const q = useLiveQuery(() => backend.admin.listOrders(), ['orders']);
  return { ...q, orders: q.data ?? [] };
};

export const useAdminOrder = (id: string | undefined) =>
  useLiveQuery(() => (id ? backend.admin.getOrder(id) : Promise.resolve(null)), ['orders'], [id]);

export const useAdminCustomers = () => {
  const q = useLiveQuery(() => backend.admin.listCustomers(), ['users', 'orders', 'messages']);
  return { ...q, customers: q.data ?? [] };
};

export const useAdminCustomer = (id: string | undefined) =>
  useLiveQuery(() => (id ? backend.admin.getCustomer(id) : Promise.resolve(null)), ['users', 'orders', 'messages'], [id]);

export const useAdminConversations = () => {
  const q = useLiveQuery(() => backend.admin.listConversations(), ['messages', 'users']);
  return { ...q, conversations: q.data ?? [] };
};

export const useAdminMessages = (customerId: string | undefined) => {
  const q = useLiveQuery(() => (customerId ? backend.admin.listMessages(customerId) : Promise.resolve([])), ['messages'], [customerId]);
  return { ...q, messages: q.data ?? [] };
};

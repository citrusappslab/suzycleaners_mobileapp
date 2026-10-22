import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { backend, type ProfilePatch, type SignUpInput } from '@/services/backend';
import { registerForPushAsync } from '@/services/push';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  ready: boolean;
  isAdmin: boolean;
  signIn(email: string, password: string): Promise<User>;
  signInStaff(email: string, password: string): Promise<User>;
  signUp(input: SignUpInput): Promise<User>;
  signOut(): Promise<void>;
  updateProfile(patch: ProfilePatch): Promise<User>;
  deleteAccount(): Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    backend.auth
      .restoreSession()
      .then((r) => setUser(r?.user ?? null))
      .finally(() => setReady(true));
  }, []);

  // Customers: register this device for push and remember the token on their profile.
  useEffect(() => {
    if (!user || user.role !== 'customer' || !user.notificationsEnabled) return;
    registerForPushAsync().then((token) => {
      if (token && token !== user.pushToken) backend.auth.updateProfile({ pushToken: token }).then(setUser);
    });
  }, [user?.id, user?.notificationsEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  const signIn = useCallback(async (email: string, password: string) => {
    const r = await backend.auth.signIn(email, password);
    setUser(r.user);
    return r.user;
  }, []);

  const signInStaff = useCallback(async (email: string, password: string) => {
    const r = await backend.auth.signInStaff(email, password);
    setUser(r.user);
    return r.user;
  }, []);

  const signUp = useCallback(async (input: SignUpInput) => {
    const r = await backend.auth.signUp(input);
    setUser(r.user);
    return r.user;
  }, []);

  const signOut = useCallback(async () => {
    await backend.auth.signOut();
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (patch: ProfilePatch) => {
    const u = await backend.auth.updateProfile(patch);
    setUser(u);
    return u;
  }, []);

  const deleteAccount = useCallback(async () => {
    await backend.auth.deleteAccount();
    setUser(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, ready, isAdmin: user?.role === 'admin', signIn, signInStaff, signUp, signOut, updateProfile, deleteAccount }),
    [user, ready, signIn, signInStaff, signUp, signOut, updateProfile, deleteAccount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

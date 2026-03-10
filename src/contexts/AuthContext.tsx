import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isNewUser: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshIsNewUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from('profiles')
    .select('user_id, display_name, avatar_url')
    .eq('user_id', userId)
    .single();
  return data as Profile | null;
}

async function checkIfNewUser(userId: string): Promise<boolean> {
  const { count } = await supabase
    .from('analyses')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  return (count ?? 0) === 0;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isNewUser, setIsNewUser] = useState(false);

  const loadUserData = useCallback(async (u: User) => {
    const [p, newUser] = await Promise.all([
      fetchProfile(u.id),
      checkIfNewUser(u.id),
    ]);
    setProfile(p);
    setIsNewUser(newUser);
  }, []);

  async function refreshProfile() {
    if (!user) return;
    const p = await fetchProfile(user.id);
    setProfile(p);
  }

  async function refreshIsNewUser() {
    if (!user) return;
    const newUser = await checkIfNewUser(user.id);
    setIsNewUser(newUser);
  }

  useEffect(() => {
    // Step 1: Restore session from storage FIRST (avoids deadlock in onAuthStateChange)
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        await loadUserData(s.user);
      }
      setLoading(false);
    });

    // Step 2: Listen for SUBSEQUENT auth changes (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        // Skip INITIAL_SESSION — already handled by getSession above
        if (event === 'INITIAL_SESSION') return;

        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          // Use setTimeout to avoid Supabase auth deadlock
          setTimeout(() => {
            loadUserData(newSession.user);
          }, 0);
        } else {
          setProfile(null);
          setIsNewUser(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [loadUserData]);

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, isNewUser, signOut, refreshProfile, refreshIsNewUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

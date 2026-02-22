import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const hadUserRef = useRef(false);

  useEffect(() => {
    // Obtener sesion actual
    supabase.auth.getSession().then(({ data: { session } }) => {
      const sessionUser = session?.user ?? null;
      setUser(sessionUser);
      if (sessionUser) hadUserRef.current = true;
      setLoading(false);
    });

    // Escuchar cambios de autenticacion
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery(true);
        setUser(session?.user ?? null);
        if (session?.user) hadUserRef.current = true;
        return;
      }
      if (session?.user) {
        setUser(session.user);
        hadUserRef.current = true;
      } else if (hadUserRef.current && event === 'TOKEN_REFRESHED') {
        // Token refresh failed — try to recover silently
        try {
          const { data } = await supabase.auth.getSession();
          if (data.session?.user) {
            setUser(data.session.user);
            return;
          }
        } catch {
          // Recovery failed — fall through to logout
        }
        setUser(null);
        hadUserRef.current = false;
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        hadUserRef.current = false;
      }
      // For other events where session is null but user was logged in,
      // keep the current user to avoid interrupting an active game.
      // Supabase client will attempt token refresh automatically.
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  };

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const resetPassword = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/playstats-basketball/`
    });
    if (error) throw error;
  };

  const updatePassword = async (newPassword) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    setPasswordRecovery(false);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signOut, resetPassword, updatePassword, passwordRecovery }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

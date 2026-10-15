import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { checkSession, signOut as authSignOut, getStoredEmail, hasStoredSession } from '../../services/authService';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  email: string | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  isLoading: true,
  email: null,
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [email, setEmail] = useState<string | null>(getStoredEmail());
  const [isLoading, setIsLoading] = useState(hasStoredSession());

  useEffect(() => {
    if (!hasStoredSession()) {
      setIsLoading(false);
      return;
    }
    checkSession().then(result => {
      setEmail(result);
      setIsLoading(false);
    });
  }, []);

  const handleSignOut = useCallback(async () => {
    await authSignOut();
    setEmail(null);
  }, []);

  return (
    <AuthContext.Provider value={{ isAuthenticated: !!email, isLoading, email, signOut: handleSignOut }}>
      {children}
    </AuthContext.Provider>
  );
}

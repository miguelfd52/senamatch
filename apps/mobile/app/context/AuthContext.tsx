import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Role = 'aprendiz' | 'instructor' | 'bienestar' | 'admin' | 'egresado' | 'moderador' | null;

interface UserInfo {
  id: string;
  correo: string;
  nombre: string;
  rol: Role;
  fotoUrl?: string | null;
  primeraPublicacionCompletada?: boolean;
}

interface AuthContextProps {
  user: UserInfo | null;
  loading: boolean;
  signIn: (token: string, userData: UserInfo) => Promise<void>;
  signOut: () => Promise<void>;
  completeInitialPost: () => Promise<void>;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restaurar sesión al inicio
    const loadSession = async () => {
      try {
        const token = await AsyncStorage.getItem('jwt_token');
        const storedUser = await AsyncStorage.getItem('user_data');
        
        if (token && storedUser) {
          const parsed = JSON.parse(storedUser);
          setUser(parsed);

          // Sincronizar estado real con la BD
          try {
            const baseUrl = typeof window !== 'undefined' && window.location ? window.location.origin : 'http://localhost:3001';
            const res = await fetch(`${baseUrl}/perfiles/${parsed.id}`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
              const fresh = await res.json();
              if (fresh && typeof fresh.primeraPublicacionCompletada === 'boolean') {
                const merged = { ...parsed, primeraPublicacionCompletada: fresh.primeraPublicacionCompletada };
                await AsyncStorage.setItem('user_data', JSON.stringify(merged));
                setUser(merged);
              }
            }
          } catch (_) {}
        }
      } catch (e) {
        console.error('Error cargando sesión', e);
      } finally {
        setLoading(false);
      }
    };
    
    loadSession();
  }, []);

  const signIn = async (token: string, userData: UserInfo) => {
    try {
      await AsyncStorage.setItem('jwt_token', token);
      await AsyncStorage.setItem('user_data', JSON.stringify(userData));
      setUser(userData);
    } catch (e) {
      console.error('Error guardando la sesión', e);
    }
  };

  const completeInitialPost = async () => {
    if (!user) return;
    const updated = { ...user, primeraPublicacionCompletada: true };
    try {
      await AsyncStorage.setItem('user_data', JSON.stringify(updated));
      setUser(updated);
    } catch (e) {
      console.error('Error al actualizar estado en sesión', e);
    }
  };

  const signOut = async () => {
    try {
      await AsyncStorage.removeItem('jwt_token');
      await AsyncStorage.removeItem('user_data');
      setUser(null);
    } catch (e) {
      console.error('Error cerrando sesión', e);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, completeInitialPost }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};

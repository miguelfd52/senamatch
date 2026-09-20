import { Slot, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { AuthProvider, useAuth } from './context/AuthContext';

const qc = new QueryClient();

function Enrutador() {
  const { user, loading } = useAuth();
  const segmentos = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const grupo = segmentos[0];
    const estaAutenticado = !!user;
    
    // Obtener la esfera dinámicamente si el usuario existe
    const esfera = user ? (['aprendiz', 'egresado'].includes(user.rol as string) ? 'aprendices' : 'equipo') : null;

    if (!estaAutenticado) {
      // Si no está en auth, ir directamente al login (no a la pantalla de bienvenida)
      if (grupo !== '(auth)') {
        router.replace('/(auth)/login');
      }
      return;
    }

    // Lógica de redirección cuando está autenticado
    if (esfera === 'equipo' && (grupo === '(aprendices)' || grupo === '(auth)' || !grupo || grupo === 'index')) {
      router.replace('/(equipo)');
      return;
    }
    
    if (esfera === 'aprendices' && (grupo === '(equipo)' || grupo === '(auth)' || !grupo || grupo === 'index')) {
      router.replace('/(aprendices)');
      return;
    }

  }, [loading, user, segmentos, router]);

  return <Slot />;
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <View style={styles.webOuter}>
          <Enrutador />
        </View>
      </AuthProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  webOuter: {
    flex: 1,
    backgroundColor: '#0F0C18',
    width: '100%',
    height: '100%',
    ...(Platform.OS === 'web'
      ? {
          minHeight: '100vh' as any,
        }
      : {}),
  },
});

import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, RefreshControl,
  Platform
} from 'react-native';
import { useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../app/context/AuthContext';
import { useBandeja, useFeedParches } from '../hooks/useParches';

const ACCENT = '#FF6B4A';
const BG = '#16121D';
const CARD = '#1E1A2B';

interface Props {
  esfera: 'aprendices' | 'equipo';
}

export default function HomeScreen({ esfera }: Props) {
  const { user } = useAuth();
  const router = useRouter();
  const { data: chats, isLoading: chatsLoading, refetch: refetchChats } = useBandeja();
  const { data: parches, isLoading: parchesLoading, refetch: refetchParches } = useFeedParches();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchChats(), refetchParches()]);
    setRefreshing(false);
  }, [refetchChats, refetchParches]);

  const firstName = user?.nombre?.split(' ')[0] || 'Usuario';
  const rolLabel = user?.rol
    ? user.rol.charAt(0).toUpperCase() + user.rol.slice(1)
    : '';
  const totalChats = Array.isArray(chats) ? chats.length : 0;
  const parchesActivos = Array.isArray(parches)
    ? parches.filter((p: any) => p.estado === 'abierto').length
    : 0;

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Buenos días';
    if (h < 18) return 'Buenas tardes';
    return 'Buenas noches';
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={ACCENT}
          colors={[ACCENT]}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarEmoji}>
            {esfera === 'equipo' ? '🏫' : '🎓'}
          </Text>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.greeting}>{greeting()}</Text>
          <Text style={styles.name}>{firstName} 👋</Text>
          <View style={styles.rolBadge}>
            <Text style={styles.rolText}>{rolLabel}</Text>
          </View>
        </View>
      </View>

      {/* Correo */}
      <View style={styles.emailCard}>
        <Text style={styles.emailLabel}>📧 Correo</Text>
        <Text style={styles.emailValue}>{user?.correo || '—'}</Text>
      </View>

      {/* Estadísticas */}
      <Text style={styles.sectionTitle}>Tu actividad</Text>
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statEmoji}>💬</Text>
          {chatsLoading ? (
            <ActivityIndicator color={ACCENT} size="small" />
          ) : (
            <Text style={styles.statNumber}>{totalChats}</Text>
          )}
          <Text style={styles.statLabel}>Chats</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statEmoji}>🎯</Text>
          {parchesLoading ? (
            <ActivityIndicator color={ACCENT} size="small" />
          ) : (
            <Text style={styles.statNumber}>{parchesActivos}</Text>
          )}
          <Text style={styles.statLabel}>Parches</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statEmoji}>✨</Text>
          <Text style={styles.statNumber}>
            {esfera === 'equipo' ? '🏢' : '📚'}
          </Text>
          <Text style={styles.statLabel}>{esfera === 'equipo' ? 'Equipo' : 'Aprendiz'}</Text>
        </View>
      </View>

      {/* Accesos rápidos */}
      <Text style={styles.sectionTitle}>Accesos rápidos</Text>
      <View style={styles.quickActions}>
        <QuickAction
          emoji="👥"
          label="Personas y Comunidad"
          sublabel="Ver usuarios registrados y chatear"
          onPress={() => router.push('/chats')}
        />
        <QuickAction
          emoji="🔍"
          label="Descubrir personas"
          sublabel="Encuentra afinidades por swipe"
          onPress={() => router.push('/descubrir')}
        />
        <QuickAction
          emoji="🎯"
          label="Explorar parches"
          sublabel="Únete a actividades grupales"
          onPress={() => router.push('/parches')}
        />
        <QuickAction
          emoji="💬"
          label="Tus conversaciones"
          sublabel={`${totalChats} chat${totalChats !== 1 ? 's' : ''} activo${totalChats !== 1 ? 's' : ''}`}
          onPress={() => router.push('/chats')}
        />
      </View>

      {/* Tip */}
      <View style={styles.tipCard}>
        <Text style={styles.tipEmoji}>💡</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.tipTitle}>Consejo</Text>
          <Text style={styles.tipText}>
            {esfera === 'equipo'
              ? 'Crea parches institucionales para conectar con colegas del SENA.'
              : 'En la sección de Chats puedes usar "+ Nueva persona" para buscar a cualquier compañero registrado y chatear directamente.'}
          </Text>
        </View>
      </View>

      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

function QuickAction({
  emoji,
  label,
  sublabel,
  onPress
}: {
  emoji: string;
  label: string;
  sublabel: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.quickCard}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={styles.quickEmoji}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.quickLabel}>{label}</Text>
        <Text style={styles.quickSublabel}>{sublabel}</Text>
      </View>
      <Text style={styles.quickArrow}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  content: {
    padding: 24,
    paddingTop: Platform.OS === 'web' ? 95 : 32,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    backgroundColor: CARD,
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2D2640',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  avatarCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(255,107,74,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: ACCENT,
  },
  avatarEmoji: { fontSize: 32 },
  headerText: { marginLeft: 20, flex: 1 },
  greeting: { fontSize: 14, color: '#8D83A0', fontWeight: '500' },
  name: { fontSize: 28, fontWeight: '800', color: '#F0ECF6', marginTop: 2 },
  rolBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,107,74,0.12)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,107,74,0.25)',
  },
  rolText: { color: ACCENT, fontSize: 12, fontWeight: '700' },

  // Email card
  emailCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2D2640',
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  emailLabel: { fontSize: 14, color: '#8D83A0', fontWeight: '600' },
  emailValue: { fontSize: 14, color: '#B9B1C9', flex: 1 },

  // Section
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F0ECF6',
    marginBottom: 16,
    marginTop: 8,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 28,
  },
  statCard: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2D2640',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  statEmoji: { fontSize: 28, marginBottom: 8 },
  statNumber: { fontSize: 26, fontWeight: '800', color: '#F0ECF6' },
  statLabel: { fontSize: 13, color: '#8D83A0', marginTop: 4, fontWeight: '600' },

  // Quick actions grid
  quickActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 28,
  },
  quickCard: {
    backgroundColor: CARD,
    borderRadius: 18,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
    borderColor: '#2D2640',
    flex: 1,
    minWidth: 260,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  quickEmoji: { fontSize: 32 },
  quickLabel: { fontSize: 16, fontWeight: '700', color: '#F0ECF6' },
  quickSublabel: { fontSize: 13, color: '#8D83A0', marginTop: 3 },
  quickArrow: { fontSize: 24, color: '#4E4461', fontWeight: '300' },

  // Tip
  tipCard: {
    backgroundColor: 'rgba(255,107,74,0.07)',
    borderRadius: 16,
    padding: 18,
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(255,107,74,0.2)',
  },
  tipEmoji: { fontSize: 24, marginTop: 2 },
  tipTitle: { fontSize: 15, fontWeight: '700', color: ACCENT },
  tipText: { fontSize: 13, color: '#B9B1C9', marginTop: 4, lineHeight: 20 },
});

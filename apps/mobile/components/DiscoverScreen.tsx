import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, Animated,
  Dimensions, Platform
} from 'react-native';
import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../app/context/AuthContext';
import { usePerfiles, useSwipe } from '../hooks/useParches';
import PeopleScreen from './PeopleScreen';

const ACCENT = '#FF6B4A';
const BG = '#16121D';
const CARD = '#1E1A2B';
const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = Math.min(SCREEN_W - 48, 460);

const INTENCIONES = ['amistad', 'estudio', 'deporte'] as const;

export default function DiscoverScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: perfiles, isLoading, isError, refetch } = usePerfiles();
  const [currentIdx, setCurrentIdx] = useState(0);
  const [mode, setMode] = useState<'cards' | 'people'>('cards');
  const [intencion] = useState<typeof INTENCIONES[number]>('amistad');
  const swipeMutation = useSwipe(intencion);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  if (mode === 'people') {
    return (
      <View style={{ flex: 1, backgroundColor: BG }}>
        <PeopleScreen
          onOpenChat={() => {
            router.push('/chats');
          }}
          onBack={() => setMode('cards')}
        />
      </View>
    );
  }

  // Filter out own profile
  const cards = Array.isArray(perfiles)
    ? perfiles.filter((p: any) => p.id !== user?.id)
    : [];

  const currentCard = cards[currentIdx] as any;

  const animateAction = useCallback((action: () => void) => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.92,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
    action();
  }, [scaleAnim]);

  const handleSwipe = useCallback((dir: 'pass' | 'like') => {
    if (!currentCard) return;
    animateAction(() => {
      swipeMutation.mutate(
        { target: currentCard.id, dir },
        {
          onSuccess: (res: any) => {
            if (res?.match) {
              // Could show a match celebration
            }
            setCurrentIdx(prev => prev + 1);
          },
          onError: () => {
            setCurrentIdx(prev => prev + 1);
          },
        }
      );
    });
  }, [currentCard, swipeMutation, animateAction]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={styles.loadingText}>Cargando perfiles…</Text>
      </View>
    );
  }

  if (isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyEmoji}>⚠️</Text>
        <Text style={styles.emptyTitle}>Error al cargar perfiles</Text>
        <Text style={styles.emptySubtitle}>
          No se pudieron obtener los perfiles. Verifica tu conexión e inténtalo de nuevo.
        </Text>
        <View style={styles.emptyActions}>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => { setCurrentIdx(0); refetch(); }}
            activeOpacity={0.8}
          >
            <Text style={styles.retryText}>🔄 Reintentar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.communityBtn}
            onPress={() => setMode('people')}
            activeOpacity={0.85}
          >
            <Text style={styles.communityBtnText}>👥 Ver toda la comunidad</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!cards.length || currentIdx >= cards.length) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyEmoji}>🔍</Text>
        <Text style={styles.emptyTitle}>Sin perfiles por ahora</Text>
        <Text style={styles.emptySubtitle}>
          No hay más personas en el swipe en este momento. ¡Puedes explorar y chatear con todas las personas registradas en la comunidad!
        </Text>
        <View style={styles.emptyActions}>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => { setCurrentIdx(0); refetch(); }}
            activeOpacity={0.8}
          >
            <Text style={styles.retryText}>Actualizar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.communityBtn}
            onPress={() => setMode('people')}
            activeOpacity={0.85}
          >
            <Text style={styles.communityBtnText}>👥 Ver toda la comunidad</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const intereses = currentCard.intereses || [];
  const avatarEmoji = currentCard.avatarEmoji || '😊';
  const avatarColor = currentCard.avatarColor || ACCENT;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Descubrir</Text>
          <Text style={styles.headerCount}>
            {currentIdx + 1} / {cards.length}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.switchModeBtn}
          onPress={() => setMode('people')}
          activeOpacity={0.8}
        >
          <Text style={styles.switchModeText}>👥 Directorio</Text>
        </TouchableOpacity>
      </View>

      {/* Card */}
      <View style={styles.cardContainer}>
        <Animated.View
          style={[styles.card, { transform: [{ scale: scaleAnim }] }]}
        >
          {/* Avatar */}
          <View style={[styles.avatarArea, { backgroundColor: avatarColor + '20' }]}>
            <Text style={styles.avatarEmoji}>{avatarEmoji}</Text>
          </View>

          {/* Info */}
          <View style={styles.cardInfo}>
            <Text style={styles.cardName}>{currentCard.nombre}</Text>
            <View style={styles.rolBadge}>
              <Text style={styles.rolBadgeText}>
                {currentCard.rol?.charAt(0).toUpperCase() + currentCard.rol?.slice(1)}
              </Text>
            </View>

            {currentCard.bio ? (
              <Text style={styles.bio} numberOfLines={3}>{currentCard.bio}</Text>
            ) : null}

            {currentCard.programa ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>📚</Text>
                <Text style={styles.infoValue}>{currentCard.programa}</Text>
              </View>
            ) : null}

            {currentCard.jornada ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>🕐</Text>
                <Text style={styles.infoValue}>Jornada {currentCard.jornada}</Text>
              </View>
            ) : null}

            {/* Intereses */}
            {intereses.length > 0 && (
              <View style={styles.tagsRow}>
                {intereses.slice(0, 5).map((tag: string, i: number) => (
                  <View key={i} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </Animated.View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.passBtn}
          onPress={() => handleSwipe('pass')}
          activeOpacity={0.75}
          disabled={swipeMutation.isPending}
        >
          <Text style={styles.passBtnEmoji}>👋</Text>
          <Text style={styles.passBtnText}>Pasar</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.likeBtn}
          onPress={() => handleSwipe('like')}
          activeOpacity={0.75}
          disabled={swipeMutation.isPending}
        >
          <Text style={styles.likeBtnEmoji}>❤️</Text>
          <Text style={styles.likeBtnText}>Me interesa</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  center: {
    flex: 1, backgroundColor: BG,
    justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  loadingText: { color: '#786E8A', marginTop: 16, fontSize: 15 },

  // Empty
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#F0ECF6', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#786E8A', textAlign: 'center', lineHeight: 22, maxWidth: 320 },
  emptyActions: { flexDirection: 'row', gap: 12, marginTop: 24, alignItems: 'center' },
  retryBtn: {
    backgroundColor: '#282234',
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12,
    borderWidth: 1, borderColor: '#3A3247',
  },
  retryText: { color: '#F0ECF6', fontWeight: '700', fontSize: 14 },
  communityBtn: {
    backgroundColor: ACCENT,
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12,
    shadowColor: ACCENT, shadowOpacity: 0.3, shadowRadius: 8, elevation: 3,
  },
  communityBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 24, paddingTop: Platform.OS === 'web' ? 95 : 52,
    maxWidth: 600, width: '100%', alignSelf: 'center',
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#F0ECF6' },
  headerCount: { fontSize: 14, color: '#786E8A', fontWeight: '600', marginTop: 2 },
  switchModeBtn: {
    backgroundColor: 'rgba(255,107,74,0.15)',
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,107,74,0.3)',
  },
  switchModeText: { color: ACCENT, fontSize: 13, fontWeight: '700' },

  // Card
  cardContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  card: {
    backgroundColor: CARD, borderRadius: 24,
    width: CARD_W, overflow: 'hidden',
    borderWidth: 1, borderColor: '#2D2640',
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 20, elevation: 8,
  },
  avatarArea: {
    height: 140, justifyContent: 'center', alignItems: 'center',
  },
  avatarEmoji: { fontSize: 64 },
  cardInfo: { padding: 24 },
  cardName: { fontSize: 24, fontWeight: '800', color: '#F0ECF6' },
  rolBadge: {
    alignSelf: 'flex-start', marginTop: 8,
    backgroundColor: 'rgba(255,107,74,0.12)',
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
  },
  rolBadgeText: { color: ACCENT, fontSize: 12, fontWeight: '700' },
  bio: { fontSize: 14, color: '#B9B1C9', marginTop: 14, lineHeight: 21 },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10,
  },
  infoLabel: { fontSize: 16 },
  infoValue: { fontSize: 13, color: '#786E8A' },
  tagsRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16,
  },
  tag: {
    backgroundColor: '#282234', paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 16, borderWidth: 1, borderColor: '#3A3247',
  },
  tagText: { color: '#B9B1C9', fontSize: 12, fontWeight: '500' },

  // Actions
  actions: {
    flexDirection: 'row', gap: 16,
    padding: 24, paddingBottom: 16, justifyContent: 'center',
  },
  passBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#282234', padding: 16, borderRadius: 14,
    borderWidth: 1, borderColor: '#3A3247',
  },
  passBtnEmoji: { fontSize: 20 },
  passBtnText: { color: '#B9B1C9', fontSize: 16, fontWeight: '700' },
  likeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: ACCENT, padding: 16, borderRadius: 14,
  },
  likeBtnEmoji: { fontSize: 20 },
  likeBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

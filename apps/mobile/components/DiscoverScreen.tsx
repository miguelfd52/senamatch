import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, Animated,
  Dimensions, Platform, Image, Modal
} from 'react-native';
import { useState, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../app/context/AuthContext';
import { usePerfiles, useSwipe } from '../hooks/useParches';
import { api } from '../lib/api';
import PeopleScreen from './PeopleScreen';
import PublicProfileModal from './PublicProfileModal';

const ACCENT = '#39A900';
const BG = '#0F0C18';
const CARD = '#161B22';
const CARD_BORDER = '#263238';
const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = Math.min(SCREEN_W - 48, 460);

const INTENCIONES = ['amistad', 'estudio', 'deporte'] as const;

export default function DiscoverScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: perfiles, isLoading, isError, error, refetch } = usePerfiles();

  const [currentIdx, setCurrentIdx] = useState(0);
  const [mode, setMode] = useState<'cards' | 'people'>('cards');
  const [intencion] = useState<typeof INTENCIONES[number]>('amistad');
  const [descartesHistorial, setDescartesHistorial] = useState<string[]>([]);
  const [deshaciendo, setDeshaciendo] = useState(false);

  // Filtros
  const [filtroJornada, setFiltroJornada] = useState<string>('todos');
  const [filtroInteres, setFiltroInteres] = useState<string>('todos');

  // Modal de Match
  const [matchData, setMatchData] = useState<{ match: boolean; chat?: string; otroUsuario?: any } | null>(null);

  // Perfil público modal
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const swipeMutation = useSwipe(intencion);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handleRetry = useCallback(() => {
    setCurrentIdx(0);
    refetch();
  }, [refetch]);

  // Filtrar perfiles
  const rawCards = Array.isArray(perfiles)
    ? perfiles.filter((p: any) => p && String(p.id) !== String(user?.id))
    : [];

  const cards = useMemo(() => {
    return rawCards.filter((p: any) => {
      if (filtroJornada !== 'todos' && p.jornada !== filtroJornada) return false;
      if (filtroInteres !== 'todos' && !(p.intereses || []).includes(filtroInteres)) return false;
      return true;
    });
  }, [rawCards, filtroJornada, filtroInteres]);

  const currentCard = cards[currentIdx] as any;

  const animateAction = useCallback((action: () => void) => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.94,
        duration: 90,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
    action();
  }, [scaleAnim]);

  const handleSwipe = useCallback((dir: 'pass' | 'like') => {
    if (!currentCard) return;
    const targetId = currentCard.id;

    animateAction(() => {
      swipeMutation.mutate(
        { target: targetId, dir },
        {
          onSuccess: (res: any) => {
            if (dir === 'pass') {
              setDescartesHistorial(prev => [...prev, targetId]);
            }
            if (res?.match) {
              setMatchData({
                match: true,
                chat: res.chat,
                otroUsuario: res.otroUsuario || currentCard
              });
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

  const handleDeshacer = async () => {
    if (descartesHistorial.length === 0 || deshaciendo) return;
    setDeshaciendo(true);
    const ultimoId = descartesHistorial[descartesHistorial.length - 1];

    try {
      await api.post('/swipes/deshacer', {
        p_intencion: intencion,
        targetId: ultimoId
      });
      setDescartesHistorial(prev => prev.slice(0, -1));
      // Retroceder índice si es posible
      setCurrentIdx(prev => Math.max(0, prev - 1));
    } catch (err: any) {
      console.error('Error al deshacer:', err);
    } finally {
      setDeshaciendo(false);
    }
  };

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

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Descubrir</Text>
          {cards.length > 0 && currentIdx < cards.length ? (
            <Text style={styles.headerCount}>
              {currentIdx + 1} de {cards.length} aprendices
            </Text>
          ) : (
            <Text style={styles.headerCount}>SENA Match</Text>
          )}
        </View>

        <TouchableOpacity
          style={styles.switchModeBtn}
          onPress={() => setMode('people')}
          activeOpacity={0.8}
        >
          <Text style={styles.switchModeText}>👥 Directorio</Text>
        </TouchableOpacity>
      </View>

      {/* Barra de Filtros Rápida */}
      <View style={styles.filtersScrollWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersBar}>
          <TouchableOpacity
            style={[styles.filterChip, filtroJornada === 'todos' && styles.filterChipActive]}
            onPress={() => { setFiltroJornada('todos'); setCurrentIdx(0); }}
          >
            <Text style={[styles.filterText, filtroJornada === 'todos' && styles.filterTextActive]}>Todas jornadas</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filtroJornada === 'manana' && styles.filterChipActive]}
            onPress={() => { setFiltroJornada('manana'); setCurrentIdx(0); }}
          >
            <Text style={[styles.filterText, filtroJornada === 'manana' && styles.filterTextActive]}>Mañana</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filtroJornada === 'tarde' && styles.filterChipActive]}
            onPress={() => { setFiltroJornada('tarde'); setCurrentIdx(0); }}
          >
            <Text style={[styles.filterText, filtroJornada === 'tarde' && styles.filterTextActive]}>Tarde</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterChip, filtroJornada === 'noche' && styles.filterChipActive]}
            onPress={() => { setFiltroJornada('noche'); setCurrentIdx(0); }}
          >
            <Text style={[styles.filterText, filtroJornada === 'noche' && styles.filterTextActive]}>Noche</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Contenido según estado */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ACCENT} />
          <Text style={styles.loadingText}>Buscando aprendices con afinidad…</Text>
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>⚠️</Text>
          <Text style={styles.emptyTitle}>Error al cargar perfiles</Text>
          <Text style={styles.emptySubtitle}>
            {error instanceof Error ? error.message : 'No se pudieron obtener los perfiles. Verifica tu conexión.'}
          </Text>
          <View style={styles.emptyActions}>
            <TouchableOpacity style={styles.retryBtn} onPress={handleRetry} activeOpacity={0.8}>
              <Text style={styles.retryText}>🔄 Reintentar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.communityBtn} onPress={() => setMode('people')} activeOpacity={0.85}>
              <Text style={styles.communityBtnText}>👥 Directorio</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : !cards.length || currentIdx >= cards.length ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>🔍</Text>
          <Text style={styles.emptyTitle}>Has revisado todos los perfiles</Text>
          <Text style={styles.emptySubtitle}>
            No hay más perfiles con los filtros actuales. Puedes reiniciar, explorar el directorio o deshacer tu último descarte.
          </Text>
          <View style={styles.emptyActions}>
            {descartesHistorial.length > 0 ? (
              <TouchableOpacity style={styles.undoBtn} onPress={handleDeshacer} disabled={deshaciendo}>
                <Text style={styles.undoBtnText}>↩️ Deshacer último descarte</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={styles.retryBtn} onPress={handleRetry} activeOpacity={0.8}>
              <Text style={styles.retryText}>🔄 Reiniciar mazo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.communityBtn} onPress={() => setMode('people')} activeOpacity={0.85}>
              <Text style={styles.communityBtnText}>👥 Directorio completo</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <>
          {/* Tarjeta interactiva */}
          <View style={styles.cardContainer}>
            <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => setSelectedUserId(currentCard.id)}
              >
                {/* Avatar o Foto */}
                {(currentCard.fotoUrl || currentCard.foto) ? (
                  <Image
                    source={{ uri: currentCard.fotoUrl || currentCard.foto }}
                    style={styles.avatarPhoto}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={[
                      styles.avatarArea,
                      { backgroundColor: (currentCard.avatarColor || ACCENT) + '22' }
                    ]}
                  >
                    <Text style={styles.avatarEmoji}>{currentCard.avatarEmoji || '😊'}</Text>
                  </View>
                )}

                {/* Info */}
                <View style={styles.cardInfo}>
                  <Text style={styles.cardName}>{currentCard.nombre}</Text>
                  <View style={styles.rolBadge}>
                    <Text style={styles.rolBadgeText}>
                      {currentCard.rol ? (currentCard.rol.charAt(0).toUpperCase() + currentCard.rol.slice(1)) : 'Aprendiz'}
                    </Text>
                  </View>

                  {/* Banner de afinidad */}
                  {currentCard.afinidad ? (
                    <View style={styles.afinidadBox}>
                      <Text style={styles.afinidadText}>✨ {currentCard.afinidad}</Text>
                    </View>
                  ) : null}

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
                  {Array.isArray(currentCard.intereses) && currentCard.intereses.length > 0 && (
                    <View style={styles.tagsRow}>
                      {currentCard.intereses.slice(0, 4).map((tag: string, i: number) => (
                        <View key={i} style={styles.tag}>
                          <Text style={styles.tagText}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <Text style={styles.hintTouch}>Toca para ver perfil completo ℹ️</Text>
                </View>
              </TouchableOpacity>
            </Animated.View>
          </View>

          {/* Acciones */}
          <View style={styles.actions}>
            {descartesHistorial.length > 0 ? (
              <TouchableOpacity
                style={styles.undoRoundBtn}
                onPress={handleDeshacer}
                disabled={deshaciendo}
                activeOpacity={0.75}
              >
                <Text style={styles.undoRoundEmoji}>↩️</Text>
              </TouchableOpacity>
            ) : null}

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
              <Text style={styles.likeBtnEmoji}>💚</Text>
              <Text style={styles.likeBtnText}>Me interesa</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* MODAL DE ¡NUEVO MATCH! */}
      <Modal
        visible={!!matchData}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setMatchData(null)}
      >
        <View style={styles.matchOverlay}>
          <View style={styles.matchCard}>
            <Text style={styles.matchBadge}>¡CONEXIÓN SENA MATCH!</Text>
            <Text style={styles.matchEmoji}>🎉</Text>
            <Text style={styles.matchTitle}>¡Hicieron Match!</Text>
            <Text style={styles.matchSubtitle}>
              Tú y {matchData?.otroUsuario?.nombre || 'tu compañero'} tienen afinidad mutua.
            </Text>

            <View style={styles.matchActions}>
              <TouchableOpacity
                style={styles.matchChatBtn}
                onPress={() => {
                  const cId = matchData?.chat;
                  setMatchData(null);
                  router.push('/chats');
                }}
              >
                <Text style={styles.matchChatBtnText}>💬 Ir a la conversación</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.matchContinueBtn}
                onPress={() => setMatchData(null)}
              >
                <Text style={styles.matchContinueText}>Seguir descubriendo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Universal de Perfil Público */}
      <PublicProfileModal
        userId={selectedUserId}
        visible={!!selectedUserId}
        onClose={() => setSelectedUserId(null)}
        onOpenChat={(cId) => {
          setSelectedUserId(null);
          router.push('/chats');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  center: {
    flex: 1, backgroundColor: BG,
    justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  loadingText: { color: '#8D83A0', marginTop: 16, fontSize: 15 },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 24, paddingTop: Platform.OS === 'web' ? 24 : 52,
    paddingBottom: 12, maxWidth: 600, width: '100%', alignSelf: 'center',
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#F0ECF6' },
  headerCount: { fontSize: 13, color: '#8D83A0', fontWeight: '600', marginTop: 2 },
  switchModeBtn: {
    backgroundColor: 'rgba(57,169,0,0.15)',
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1, borderColor: 'rgba(57,169,0,0.3)',
  },
  switchModeText: { color: ACCENT, fontSize: 13, fontWeight: '700' },

  // Filtros
  filtersScrollWrap: {
    maxWidth: 600, width: '100%', alignSelf: 'center', marginBottom: 12,
  },
  filtersBar: {
    paddingHorizontal: 24, gap: 8, flexDirection: 'row',
  },
  filterChip: {
    backgroundColor: '#161B22',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#263238',
  },
  filterChipActive: {
    borderColor: ACCENT,
    backgroundColor: 'rgba(57,169,0,0.15)',
  },
  filterText: {
    color: '#8D83A0',
    fontSize: 12,
    fontWeight: '600',
  },
  filterTextActive: {
    color: ACCENT,
    fontWeight: '700',
  },

  // Empty & Error
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#F0ECF6', marginBottom: 8, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: '#8D83A0', textAlign: 'center', lineHeight: 22, maxWidth: 360 },
  emptyActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 24, justifyContent: 'center', alignItems: 'center' },
  retryBtn: {
    backgroundColor: '#1E252F',
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12,
    borderWidth: 1, borderColor: '#2D3748',
  },
  retryText: { color: '#F0ECF6', fontWeight: '700', fontSize: 14 },
  communityBtn: {
    backgroundColor: ACCENT,
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12,
    shadowColor: ACCENT, shadowOpacity: 0.3, shadowRadius: 8, elevation: 3,
  },
  communityBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  undoBtn: {
    backgroundColor: 'rgba(57,169,0,0.15)',
    borderWidth: 1, borderColor: ACCENT,
    paddingHorizontal: 18, paddingVertical: 12, borderRadius: 12,
  },
  undoBtnText: {
    color: ACCENT, fontWeight: '700', fontSize: 14,
  },

  // Card
  cardContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  card: {
    backgroundColor: CARD, borderRadius: 24,
    width: CARD_W, overflow: 'hidden',
    borderWidth: 1, borderColor: CARD_BORDER,
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 20, elevation: 8,
  },
  avatarPhoto: {
    width: '100%',
    height: 200,
    backgroundColor: '#1E252F',
  },
  avatarArea: {
    height: 140, justifyContent: 'center', alignItems: 'center',
  },
  avatarEmoji: { fontSize: 64 },
  cardInfo: { padding: 22 },
  cardName: { fontSize: 22, fontWeight: '800', color: '#F0ECF6' },
  rolBadge: {
    alignSelf: 'flex-start', marginTop: 6,
    backgroundColor: 'rgba(57,169,0,0.15)',
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 6,
  },
  rolBadgeText: { color: ACCENT, fontSize: 11, fontWeight: '700' },
  afinidadBox: {
    backgroundColor: 'rgba(0, 229, 163, 0.1)',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 8, marginTop: 8,
    alignSelf: 'flex-start',
  },
  afinidadText: {
    color: '#00E5A3', fontSize: 12, fontWeight: '700',
  },
  bio: { fontSize: 13, color: '#B9B1C9', marginTop: 10, lineHeight: 18 },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8,
  },
  infoLabel: { fontSize: 14 },
  infoValue: { fontSize: 13, color: '#8D83A0' },
  tagsRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12,
  },
  tag: {
    backgroundColor: '#1E252F', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12, borderWidth: 1, borderColor: '#2D3748',
  },
  tagText: { color: '#B9B1C9', fontSize: 11, fontWeight: '500' },
  hintTouch: {
    fontSize: 11, color: '#786E8A', marginTop: 12, textAlign: 'center', fontStyle: 'italic',
  },

  // Actions
  actions: {
    flexDirection: 'row', gap: 14,
    padding: 20, paddingBottom: 14, justifyContent: 'center',
    maxWidth: 600, width: '100%', alignSelf: 'center', alignItems: 'center',
  },
  undoRoundBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#1E252F', borderWidth: 1, borderColor: '#2D3748',
    justifyContent: 'center', alignItems: 'center',
  },
  undoRoundEmoji: { fontSize: 18 },
  passBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: '#1E252F', padding: 15, borderRadius: 14,
    borderWidth: 1, borderColor: '#2D3748',
  },
  passBtnEmoji: { fontSize: 20 },
  passBtnText: { color: '#B9B1C9', fontSize: 15, fontWeight: '700' },
  likeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: ACCENT, padding: 15, borderRadius: 14,
    shadowColor: ACCENT, shadowOpacity: 0.4, shadowRadius: 10, elevation: 3,
  },
  likeBtnEmoji: { fontSize: 20 },
  likeBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  // Match Modal
  matchOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  matchCard: {
    backgroundColor: '#161B22', borderRadius: 24,
    padding: 28, maxWidth: 440, width: '100%',
    alignItems: 'center', borderWidth: 1, borderColor: ACCENT,
    shadowColor: ACCENT, shadowOpacity: 0.5, shadowRadius: 25, elevation: 12,
  },
  matchBadge: {
    fontSize: 11, fontWeight: '800', color: ACCENT, letterSpacing: 1,
    marginBottom: 8,
  },
  matchEmoji: { fontSize: 56, marginBottom: 8 },
  matchTitle: {
    fontSize: 26, fontWeight: '900', color: '#fff', textAlign: 'center', marginBottom: 8,
  },
  matchSubtitle: {
    fontSize: 14, color: '#B9B1C9', textAlign: 'center', lineHeight: 20, marginBottom: 24,
  },
  matchActions: { width: '100%', gap: 10 },
  matchChatBtn: {
    backgroundColor: ACCENT, paddingVertical: 14, borderRadius: 12,
    alignItems: 'center',
  },
  matchChatBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  matchContinueBtn: {
    paddingVertical: 12, alignItems: 'center',
  },
  matchContinueText: { color: '#8D83A0', fontWeight: '600', fontSize: 14 },
});

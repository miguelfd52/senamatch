import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, TextInput,
  RefreshControl, Platform
} from 'react-native';
import { useState, useCallback, useEffect } from 'react';
import { useUsuariosComunidad, useCrearChatDirecto } from '../hooks/useParches';

const ACCENT = '#FF6B4A';
const BG = '#16121D';
const CARD = '#1E1A2B';

interface Props {
  onOpenChat: (chatId: string) => void;
  onBack?: () => void;
}

export default function PeopleScreen({ onOpenChat, onBack }: Props) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [startingChatWith, setStartingChatWith] = useState<string | null>(null);

  // Debounce effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: usuarios, isLoading, isError, refetch } = useUsuariosComunidad(debouncedSearch);
  const crearChatMutation = useCrearChatDirecto();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleStartChat = (targetUserId: string) => {
    setStartingChatWith(targetUserId);
    crearChatMutation.mutate(targetUserId, {
      onSuccess: (res: any) => {
        setStartingChatWith(null);
        if (res?.id) {
          onOpenChat(res.id);
        }
      },
      onError: (err: any) => {
        setStartingChatWith(null);
        if (typeof window !== 'undefined' && window.alert) {
          window.alert(err?.message || 'No se pudo iniciar el chat');
        }
      }
    });
  };

  const usersList = Array.isArray(usuarios) ? usuarios : [];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {onBack ? (
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
            <Text style={styles.backText}>‹ Volver</Text>
          </TouchableOpacity>
        ) : null}
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Comunidad SENA</Text>
          <Text style={styles.headerSubtitle}>
            Encuentra personas registradas y chatea con ellas
          </Text>
        </View>
      </View>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por nombre, correo o programa…"
          placeholderTextColor="#786E8A"
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          returnKeyType="search"
        />
        {search ? (
          <TouchableOpacity
            onPress={() => setSearch('')}
            style={styles.clearBtn}
            activeOpacity={0.7}
          >
            <Text style={styles.clearText}>✕</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Lista de usuarios */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ACCENT} />
          <Text style={styles.loadingText}>Buscando miembros de la comunidad…</Text>
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>⚠️</Text>
          <Text style={styles.emptyTitle}>Error al cargar la comunidad</Text>
          <Text style={styles.emptySubtitle}>No pudimos conectar con el servidor.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()} activeOpacity={0.8}>
            <Text style={styles.retryText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : usersList.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>👥</Text>
          <Text style={styles.emptyTitle}>
            {search ? 'Sin coincidencias' : 'Aún no hay más personas registradas'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {search
              ? 'Intenta con otro nombre, correo o programa.'
              : 'Cuando tus compañeros creen cuenta en la página, aparecerán aquí automáticamente.'}
          </Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => { setSearch(''); refetch(); }}
            activeOpacity={0.8}
          >
            <Text style={styles.retryText}>Actualizar lista</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={ACCENT}
              colors={[ACCENT]}
            />
          }
        >
          <Text style={styles.resultsCount}>
            {usersList.length} persona{usersList.length !== 1 ? 's' : ''} disponible{usersList.length !== 1 ? 's' : ''}
          </Text>

          <View style={styles.usersGrid}>
            {usersList.map((user: any) => {
              const isProcessing = startingChatWith === user.id;
            const rolLabel = user.rol
              ? user.rol.charAt(0).toUpperCase() + user.rol.slice(1)
              : 'Aprendiz';

            return (
              <View key={user.id} style={styles.userCard}>
                {/* Avatar */}
                <View
                  style={[
                    styles.avatar,
                    { backgroundColor: (user.avatarColor || ACCENT) + '20' }
                  ]}
                >
                  <Text style={styles.avatarEmoji}>{user.avatarEmoji || '😊'}</Text>
                </View>

                {/* Info */}
                <View style={styles.userInfo}>
                  <View style={styles.userTopRow}>
                    <Text style={styles.userName} numberOfLines={1}>
                      {user.nombre}
                    </Text>
                    <View style={styles.rolBadge}>
                      <Text style={styles.rolText}>{rolLabel}</Text>
                    </View>
                  </View>

                  <Text style={styles.userEmail} numberOfLines={1}>
                    ✉️ {user.correo}
                  </Text>

                  {user.programa ? (
                    <Text style={styles.userProgram} numberOfLines={1}>
                      📚 {user.programa}
                    </Text>
                  ) : null}

                  {user.bio ? (
                    <Text style={styles.userBio} numberOfLines={2}>
                      {`"${user.bio}"`}
                    </Text>
                  ) : null}

                  {/* Intereses tags */}
                  {user.intereses && user.intereses.length > 0 ? (
                    <View style={styles.tagsWrap}>
                      {user.intereses.slice(0, 3).map((tag: string, i: number) => (
                        <View key={i} style={styles.tag}>
                          <Text style={styles.tagText}>{tag}</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>

                {/* Botón Chatear */}
                <TouchableOpacity
                  style={[styles.chatBtn, isProcessing && styles.chatBtnLoading]}
                  onPress={() => handleStartChat(user.id)}
                  disabled={isProcessing}
                  activeOpacity={0.85}
                >
                  {isProcessing ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <View style={styles.chatBtnContent}>
                      <Text style={styles.chatBtnEmoji}>💬</Text>
                      <Text style={styles.chatBtnText}>Chatear</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            );
          })}
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
    width: '100%',
  },
  scrollView: {
    flex: 1,
    width: '100%',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: { color: '#786E8A', marginTop: 16, fontSize: 15 },

  // Header
  header: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'web' ? 95 : 32,
    paddingBottom: 16,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  backBtn: {
    paddingVertical: 6,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  backText: {
    color: ACCENT,
    fontSize: 16,
    fontWeight: '700',
  },
  headerTitleWrap: {},
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F0ECF6',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#8D83A0',
    marginTop: 4,
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 16,
    marginHorizontal: 24,
    marginBottom: 20,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#2D2640',
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  searchIcon: { fontSize: 18, marginRight: 10 },
  searchInput: {
    flex: 1,
    paddingVertical: 14,
    color: '#F0ECF6',
    fontSize: 15,
  },
  clearBtn: { padding: 6 },
  clearText: { color: '#8D83A0', fontSize: 14, fontWeight: '700' },

  // List
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  resultsCount: {
    fontSize: 14,
    color: '#8D83A0',
    fontWeight: '600',
    marginBottom: 16,
    marginLeft: 4,
  },
  usersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    width: '100%',
  },

  userCard: {
    backgroundColor: CARD,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
    borderColor: '#2D2640',
    flex: 1,
    minWidth: 340,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,107,74,0.3)',
  },
  avatarEmoji: { fontSize: 26 },
  userInfo: { flex: 1 },
  userTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F0ECF6',
    flex: 1,
  },
  rolBadge: {
    backgroundColor: 'rgba(255,107,74,0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  rolText: {
    color: ACCENT,
    fontSize: 11,
    fontWeight: '700',
  },
  userEmail: {
    fontSize: 12,
    color: '#B9B1C9',
    marginBottom: 2,
  },
  userProgram: {
    fontSize: 12,
    color: '#786E8A',
    marginBottom: 4,
  },
  userBio: {
    fontSize: 12,
    color: '#8D83A0',
    fontStyle: 'italic',
    marginTop: 2,
    lineHeight: 16,
  },
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  tag: {
    backgroundColor: '#282234',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3A3247',
  },
  tagText: {
    color: '#B9B1C9',
    fontSize: 10,
    fontWeight: '500',
  },

  chatBtn: {
    backgroundColor: ACCENT,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: ACCENT,
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chatBtnLoading: {
    opacity: 0.8,
  },
  chatBtnEmoji: {
    fontSize: 14,
  },
  chatBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },

  // Empty
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#F0ECF6',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#786E8A',
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
  },
  retryBtn: {
    marginTop: 20,
    backgroundColor: '#282234',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3A3247',
  },
  retryText: {
    color: '#F0ECF6',
    fontWeight: '600',
    fontSize: 14,
  },
});

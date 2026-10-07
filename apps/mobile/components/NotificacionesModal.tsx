import {
  View, Text, StyleSheet, TouchableOpacity,
  Modal, ActivityIndicator, ScrollView, RefreshControl
} from 'react-native';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { api } from '../lib/api';
import { useTheme, ThemeColors } from '../app/context/ThemeContext';

const ACCENT = '#39A900';

interface NotificacionItem {
  id: string;
  recipientId: string;
  type: string;
  title: string;
  message: string;
  reference: string | null;
  read: boolean;
  createdAt: number;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelectChat?: (chatId: string) => void;
  onNotifCountChange?: (count: number) => void;
}

function getIconoTipo(type: string): string {
  switch (type) {
    case 'nuevo_match': return '🎉';
    case 'nuevo_mensaje': return '💬';
    case 'invitacion_parche':
    case 'union_parche': return '🎯';
    case 'aceptacion_parche': return '✅';
    case 'salida_parche': return '👋';
    case 'cancelacion_parche': return '⚠️';
    default: return '🔔';
  }
}

function formatearFecha(ts: number): string {
  const diffMs = Date.now() - ts;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Ahora';
  if (diffMin < 60) return `${diffMin}m`;
  const diffHoras = Math.floor(diffMin / 60);
  if (diffHoras < 24) return `${diffHoras}h`;
  const diffDias = Math.floor(diffHoras / 24);
  return `${diffDias}d`;
}

export default function NotificacionesModal({ visible, onClose, onSelectChat, onNotifCountChange }: Props) {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [notificaciones, setNotificaciones] = useState<NotificacionItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargarNotificaciones = useCallback(async () => {
    try {
      setError(null);
      const res: any = await api.get('/notificaciones');
      const items: NotificacionItem[] = res?.notificaciones || [];
      const count: number = res?.unreadCount || 0;
      setNotificaciones(items);
      setUnreadCount(count);
      if (onNotifCountChange) onNotifCountChange(count);
    } catch (err: any) {
      setError(err?.message || 'No se pudieron cargar las notificaciones');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [onNotifCountChange]);

  useEffect(() => {
    if (visible) {
      setLoading(true);
      cargarNotificaciones();
    }
  }, [visible, cargarNotificaciones]);

  const handleMarcarLeida = async (n: NotificacionItem) => {
    if (n.read) return;
    try {
      const res: any = await api.patch(`/notificaciones/${n.id}/leer`);
      setNotificaciones(prev => prev.map(item => item.id === n.id ? { ...item, read: true } : item));
      const nuevoCount = typeof res?.unreadCount === 'number' ? res.unreadCount : Math.max(0, unreadCount - 1);
      setUnreadCount(nuevoCount);
      if (onNotifCountChange) onNotifCountChange(nuevoCount);
    } catch (err) {
      console.error('Error al marcar notificación:', err);
    }
  };

  const handleMarcarTodas = async () => {
    try {
      await api.patch('/notificaciones/leer-todas');
      setNotificaciones(prev => prev.map(item => ({ ...item, read: true })));
      setUnreadCount(0);
      if (onNotifCountChange) onNotifCountChange(0);
    } catch (err) {
      console.error('Error al marcar todas:', err);
    }
  };

  const handleClickNotif = async (n: NotificacionItem) => {
    await handleMarcarLeida(n);
    onClose();

    if (n.type === 'nuevo_match' || n.type === 'nuevo_mensaje') {
      // Ambos tipos tienen reference = chatId
      if (n.reference && onSelectChat) {
        onSelectChat(n.reference);
      } else if (n.reference) {
        // Fallback si onSelectChat no está disponible
        router.push('/chats');
      } else {
        router.push('/chats');
      }
    } else if (n.type.includes('parche')) {
      // Eventos de parche (invitación, cancelación, expulsión, etc.) → ir a parches
      router.push('/parches');
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {/* Cabecera */}
          <View style={[styles.header, { borderBottomColor: colors.cardBorder }]}>
            <View style={styles.headerTitleWrap}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>Notificaciones</Text>
              {unreadCount > 0 ? (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>{unreadCount} nuevas</Text>
                </View>
              ) : null}
            </View>

            <View style={styles.headerActions}>
              {unreadCount > 0 ? (
                <TouchableOpacity onPress={handleMarcarTodas} style={styles.btnMarcarTodas} activeOpacity={0.7}>
                  <Text style={styles.btnMarcarTodasText}>Marcar leídas</Text>
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
                <Text style={styles.closeText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Cuerpo */}
          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={ACCENT} />
              <Text style={[styles.loadingText, { color: colors.textSub }]}>Cargando notificaciones…</Text>
            </View>
          ) : error ? (
            <View style={styles.centerBox}>
              <Text style={styles.emptyEmoji}>⚠️</Text>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Error al cargar</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSub }]}>{error}</Text>
              <TouchableOpacity
                style={[styles.retryBtn, { backgroundColor: colors.chipBg }]}
                onPress={() => { setLoading(true); cargarNotificaciones(); }}
              >
                <Text style={[styles.retryBtnText, { color: colors.text }]}>🔄 Reintentar</Text>
              </TouchableOpacity>
            </View>
          ) : notificaciones.length === 0 ? (
            <View style={styles.centerBox}>
              <Text style={styles.emptyEmoji}>🔔</Text>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No tienes notificaciones</Text>
              <Text style={[styles.emptySubtitle, { color: colors.textSub }]}>
                Te avisaremos cuando hagas match, recibas mensajes o te unas a parches.
              </Text>
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollList}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => { setRefreshing(true); cargarNotificaciones(); }}
                  tintColor={ACCENT}
                  colors={[ACCENT]}
                />
              }
            >
              {notificaciones.map((n) => (
                <TouchableOpacity
                  key={n.id}
                  style={[styles.notifCard, { backgroundColor: colors.inputBg }, !n.read && styles.notifCardUnread]}
                  onPress={() => handleClickNotif(n)}
                  activeOpacity={0.75}
                >
                  <View style={styles.iconBox}>
                    <Text style={styles.iconText}>{getIconoTipo(n.type)}</Text>
                  </View>

                  <View style={styles.textBox}>
                    <View style={styles.topRow}>
                      <Text style={[styles.notifTitle, { color: colors.textSub }, !n.read && styles.notifTitleUnread]} numberOfLines={1}>
                        {n.title}
                      </Text>
                      <Text style={[styles.notifTime, { color: colors.textMuted }]}>{formatearFecha(n.createdAt)}</Text>
                    </View>
                    <Text style={[styles.notifMsg, { color: colors.textSub }]} numberOfLines={2}>
                      {n.message}
                    </Text>
                  </View>

                  {!n.read ? <View style={styles.unreadDot} /> : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.modalOverlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
    borderRadius: 22,
    borderWidth: 1,
    maxWidth: 480,
    width: '100%',
    maxHeight: '85%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  unreadBadge: {
    backgroundColor: 'rgba(57, 169, 0, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(57, 169, 0, 0.35)',
  },
  unreadBadgeText: {
    color: ACCENT,
    fontSize: 11,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  btnMarcarTodas: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  btnMarcarTodasText: {
    color: ACCENT,
    fontSize: 12,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  closeText: {
    fontSize: 18,
    color: colors.textMuted,
    fontWeight: '700',
  },
  centerBox: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.textSub,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
    color: colors.text,
  },
  emptySubtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 320,
    color: colors.textSub,
  },
  retryBtn: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.chipBg,
  },
  retryBtnText: {
    fontWeight: '700',
    fontSize: 13,
    color: colors.text,
  },
  scrollList: {
    padding: 12,
  },
  notifCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  notifCardUnread: {
    borderColor: 'rgba(57, 169, 0, 0.25)',
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 20,
  },
  textBox: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    marginRight: 6,
    color: colors.textSub,
  },
  notifTitleUnread: {
    fontWeight: '800',
    color: colors.text,
  },
  notifTime: {
    fontSize: 11,
    color: colors.textMuted,
  },
  notifMsg: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSub,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ACCENT,
    marginLeft: 8,
  },
});

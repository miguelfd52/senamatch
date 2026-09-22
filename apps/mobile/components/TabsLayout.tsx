import { Tabs } from 'expo-router';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Platform, useWindowDimensions
} from 'react-native';
import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

import SenaMatchLogo from './SenaMatchLogo';
import NotificacionesModal from './NotificacionesModal';
import AdminPanelModal from './AdminPanelModal';
import InitialPostModal from './InitialPostModal';
import { useAuth } from '../app/context/AuthContext';
import { api } from '../lib/api';
import { pendingChat } from '../lib/pendingChat';

const ACCENT = '#39A900';
const INACTIVE = '#8D83A0';
const NAVBAR_BG = '#161B22';

const TABS_META: Record<string, { title: string; emoji: string }> = {
  index: { title: 'Inicio', emoji: '🏠' },
  descubrir: { title: 'Descubrir', emoji: '🔍' },
  parches: { title: 'Parches', emoji: '🎯' },
  chats: { title: 'Chats', emoji: '💬' },
  perfil: { title: 'Perfil', emoji: '👤' },
};

interface ToastAviso {
  id: string;
  titulo: string;
  mensaje: string;
  chatId: string | null;
}

function ResponsiveTabBar({
  state,
  navigation,
  unreadNotifs,
  unreadChats,
  onOpenNotifs,
  onOpenAdmin,
  esStaffUser
}: BottomTabBarProps & {
  unreadNotifs: number;
  unreadChats: number;
  onOpenNotifs: () => void;
  onOpenAdmin: () => void;
  esStaffUser: boolean;
}) {
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;

  if (isDesktop) {
    return (
      <View style={styles.desktopNavbar}>
        <View style={styles.desktopNavInner}>
          {/* Marca / Logo 3D */}
          <TouchableOpacity
            style={styles.brandWrap}
            onPress={() => navigation.navigate('index')}
            activeOpacity={0.8}
          >
            <SenaMatchLogo size={32} textSize={19} showText={true} />
            <View style={styles.brandBadge}>
              <Text style={styles.brandBadgeText}>Comunidad 🇨🇴</Text>
            </View>
          </TouchableOpacity>

          {/* Navegación Desktop */}
          <View style={styles.desktopTabs}>
            {state.routes.map((route, index) => {
              const isFocused = state.index === index;
              const meta = TABS_META[route.name] || { title: route.name, emoji: '✨' };
              const isChatsTab = route.name === 'chats';

              const onPress = () => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });

                if (!isFocused && !event.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              };

              return (
                <TouchableOpacity
                  key={route.key}
                  onPress={onPress}
                  style={[
                    styles.desktopTabItem,
                    isFocused && styles.desktopTabItemActive,
                  ]}
                  activeOpacity={0.8}
                >
                  <View style={{ position: 'relative' }}>
                    <Text style={styles.desktopTabEmoji}>{meta.emoji}</Text>
                    {isChatsTab && unreadChats > 0 ? (
                      <View style={styles.desktopTabBadge}>
                        <Text style={styles.desktopTabBadgeText}>
                          {unreadChats > 9 ? '9+' : unreadChats}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text
                    style={[
                      styles.desktopTabText,
                      isFocused && styles.desktopTabTextActive,
                    ]}
                  >
                    {meta.title}
                  </Text>
                  {isFocused ? <View style={styles.activePillGlow} /> : null}
                </TouchableOpacity>
              );
            })}

            {/* Botón de Notificaciones en Desktop 🔔 */}
            <TouchableOpacity
              onPress={onOpenNotifs}
              style={styles.desktopNotifBtn}
              activeOpacity={0.8}
            >
              <Text style={styles.desktopTabEmoji}>🔔</Text>
              {unreadNotifs > 0 ? (
                <View style={styles.desktopNotifBadge}>
                  <Text style={styles.desktopNotifBadgeText}>
                    {unreadNotifs > 9 ? '9+' : unreadNotifs}
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>

            {/* Acceso Staff / Admin si aplica */}
            {esStaffUser ? (
              <TouchableOpacity
                onPress={onOpenAdmin}
                style={styles.desktopAdminBtn}
                activeOpacity={0.85}
              >
                <Text style={styles.desktopAdminText}>🛡️ Panel Admin</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>
    );
  }

  // Versión móvil en la parte inferior
  return (
    <View style={styles.mobileTabBar}>
      {state.routes.map((route, index) => {
        const isFocused = state.index === index;
        const meta = TABS_META[route.name] || { title: route.name, emoji: '✨' };
        const isChatsTab = route.name === 'chats';

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            style={styles.mobileTabItem}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.mobileIconWrap,
                isFocused && styles.mobileIconWrapActive,
              ]}
            >
              <Text style={styles.mobileIconText}>{meta.emoji}</Text>
              {isChatsTab && unreadChats > 0 ? (
                <View style={styles.mobileNotifBadge}>
                  <Text style={styles.mobileNotifBadgeText}>
                    {unreadChats > 9 ? '9+' : unreadChats}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text
              style={[
                styles.mobileTabLabel,
                isFocused && styles.mobileTabLabelActive,
              ]}
            >
              {meta.title}
            </Text>
          </TouchableOpacity>
        );
      })}

      {/* Botón de Notificaciones Móvil 🔔 */}
      <TouchableOpacity
        onPress={onOpenNotifs}
        style={styles.mobileTabItem}
        activeOpacity={0.7}
      >
        <View style={styles.mobileIconWrap}>
          <Text style={styles.mobileIconText}>🔔</Text>
          {unreadNotifs > 0 ? (
            <View style={styles.mobileNotifBadge}>
              <Text style={styles.mobileNotifBadgeText}>
                {unreadNotifs > 9 ? '9+' : unreadNotifs}
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.mobileTabLabel}>Avisos</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function TabsLayout() {
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;
  const qc = useQueryClient();

  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [unreadChats, setUnreadChats] = useState(0);
  const [showNotifsModal, setShowNotifsModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [toastAviso, setToastAviso] = useState<ToastAviso | null>(null);

  const notifiedKeysRef = useRef<Set<string>>(new Set());
  const isInitialRef = useRef(true);

  const esStaffUser = !!(user?.rol && ['admin', 'moderador', 'bienestar'].includes(user.rol as string));

  // Solicitar permiso de notificaciones del navegador en web
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        try {
          Notification.requestPermission().catch(() => {});
        } catch (_) {}
      }
    }
  }, []);

  // Auto-cerrar toast tras 5 segundos
  useEffect(() => {
    if (toastAviso) {
      const timer = setTimeout(() => {
        setToastAviso(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [toastAviso]);

  // Sondeo en tiempo real de notificaciones y chats no leídos (cada 3s)
  useEffect(() => {
    let activo = true;

    const consultar = async () => {
      try {
        const [resNotifs, resChats]: [any, any] = await Promise.all([
          api.get('/notificaciones'),
          api.get('/chats').catch(() => []),
        ]);

        if (!activo) return;

        // 1. Actualizar contador de notificaciones 🔔
        if (resNotifs && typeof resNotifs.unreadCount === 'number') {
          setUnreadNotifs(resNotifs.unreadCount);
        }

        // 2. Actualizar contador total de mensajes de chat no leídos
        if (Array.isArray(resChats)) {
          const totalNoLeidos = resChats.reduce((acc: number, c: any) => acc + (c?.unreadCount || 0), 0);
          setUnreadChats(totalNoLeidos);
        }

        // 3. Procesar notificaciones en tiempo real
        const items: any[] = resNotifs?.notificaciones || [];
        if (isInitialRef.current) {
          // Primera carga: registrar existentes para no alertar de mensajes antiguos
          items.forEach((n) => {
            const key = `${n.id}_${n.createdAt}`;
            notifiedKeysRef.current.add(key);
          });
          isInitialRef.current = false;
          return;
        }

        // Buscar mensajes nuevos no notificados
        for (const n of items) {
          const key = `${n.id}_${n.createdAt}`;
          if (notifiedKeysRef.current.has(key)) continue;

          notifiedKeysRef.current.add(key);

          // Si es un mensaje nuevo no leído
          if (n.type === 'nuevo_mensaje' && !n.read) {
            // Actualizar vista del chat y bandeja en React Query inmediatamente sin recargar
            qc.invalidateQueries({ queryKey: ['mensajes'] });
            qc.invalidateQueries({ queryKey: ['bandeja'] });

            const avisoTitulo = n.title?.startsWith('💬') ? n.title : `💬 ${n.title || 'Nuevo mensaje'}`;
            setToastAviso({
              id: n.id,
              titulo: avisoTitulo,
              mensaje: n.message || 'Te han enviado un nuevo mensaje',
              chatId: n.reference,
            });

            // Notificación nativa del navegador web
            if (
              Platform.OS === 'web' &&
              typeof window !== 'undefined' &&
              'Notification' in window &&
              Notification.permission === 'granted'
            ) {
              try {
                const webNotif = new Notification(avisoTitulo, {
                  body: n.message || 'Tienes un nuevo mensaje en SENA Match',
                  icon: '/favicon.ico',
                });
                webNotif.onclick = () => {
                  window.focus();
                  if (n.reference) {
                    pendingChat.set(n.reference);
                  }
                };
              } catch (_) {}
            }
          }
        }
      } catch {
        // Ignorar si aún no está autenticado
      }
    };

    consultar();
    const interval = setInterval(consultar, 3_000);
    return () => {
      activo = false;
      clearInterval(interval);
    };
  }, [qc, user?.id]);

  return (
    <>
      <Tabs
        tabBar={(props: any) => (
          <ResponsiveTabBar
            {...props}
            unreadNotifs={unreadNotifs}
            unreadChats={unreadChats}
            onOpenNotifs={() => setShowNotifsModal(true)}
            onOpenAdmin={() => setShowAdminModal(true)}
            esStaffUser={esStaffUser}
          />
        )}
        sceneContainerStyle={{
          paddingTop: isDesktop ? 72 : 0,
          backgroundColor: '#0F0C18',
        }}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tabs.Screen name="index" options={{ title: 'Inicio' }} />
        <Tabs.Screen name="descubrir" options={{ title: 'Descubrir' }} />
        <Tabs.Screen name="parches" options={{ title: 'Parches' }} />
        <Tabs.Screen name="chats" options={{ title: 'Chats' }} />
        <Tabs.Screen name="perfil" options={{ title: 'Perfil' }} />
      </Tabs>

      {/* Aviso flotante en tiempo real: 💬 Nuevo mensaje de [usuario] */}
      {toastAviso ? (
        <TouchableOpacity
          activeOpacity={0.95}
          onPress={() => {
            if (toastAviso.chatId) {
              pendingChat.set(toastAviso.chatId);
            }
            setToastAviso(null);
          }}
          style={styles.toastBanner}
        >
          <View style={styles.toastIconWrap}>
            <Text style={{ fontSize: 20 }}>💬</Text>
          </View>
          <View style={styles.toastBody}>
            <Text style={styles.toastTitle} numberOfLines={1}>
              {toastAviso.titulo}
            </Text>
            <Text style={styles.toastSnippet} numberOfLines={1}>
              {toastAviso.mensaje}
            </Text>
          </View>
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation?.();
              setToastAviso(null);
            }}
            style={styles.toastCloseBtn}
          >
            <Text style={styles.toastCloseText}>✕</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      ) : null}

      {/* Modales globales de Notificaciones y Panel Admin */}
      <NotificacionesModal
        visible={showNotifsModal}
        onClose={() => setShowNotifsModal(false)}
        onNotifCountChange={(c) => setUnreadNotifs(c)}
        onSelectChat={(chatId) => {
          pendingChat.set(chatId);
          setShowNotifsModal(false);
        }}
      />

      <AdminPanelModal
        visible={showAdminModal}
        onClose={() => setShowAdminModal(false)}
      />

      {/* Modal de primera publicación obligatoria para usuarios nuevos */}
      <InitialPostModal />
    </>
  );
}

const styles = StyleSheet.create({
  desktopNavbar: {
    position: 'absolute' as any,
    top: 0,
    left: 0,
    right: 0,
    height: 70,
    backgroundColor: NAVBAR_BG,
    borderBottomWidth: 1,
    borderBottomColor: '#2D2640',
    zIndex: 1000,
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 15,
    elevation: 8,
  },
  desktopNavInner: {
    maxWidth: 1200,
    width: '100%',
    marginHorizontal: 'auto',
    paddingHorizontal: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brandBadge: {
    backgroundColor: 'rgba(57, 169, 0, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(57, 169, 0, 0.35)',
  },
  brandBadgeText: {
    color: '#DDF4D5',
    fontSize: 12,
    fontWeight: '700',
  },
  desktopTabs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  desktopTabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    position: 'relative',
  },
  desktopTabItemActive: {
    backgroundColor: '#261F36',
  },
  desktopTabEmoji: {
    fontSize: 18,
  },
  desktopTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: INACTIVE,
  },
  desktopTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  activePillGlow: {
    position: 'absolute',
    bottom: -1,
    left: 14,
    right: 14,
    height: 3,
    borderRadius: 2,
    backgroundColor: ACCENT,
  },
  desktopNotifBtn: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    position: 'relative',
    backgroundColor: '#221B30',
  },
  desktopNotifBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: ACCENT,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  desktopNotifBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
  },
  desktopAdminBtn: {
    backgroundColor: '#1E281E',
    borderWidth: 1,
    borderColor: ACCENT,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    marginLeft: 6,
  },
  desktopAdminText: {
    color: ACCENT,
    fontWeight: '800',
    fontSize: 13,
  },

  // Mobile Tab bar (Bottom)
  mobileTabBar: {
    backgroundColor: NAVBAR_BG,
    borderTopWidth: 1,
    borderTopColor: '#2D2640',
    height: 74,
    paddingBottom: 14,
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 16,
  },
  mobileTabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  mobileIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  mobileIconWrapActive: {
    backgroundColor: 'rgba(57, 169, 0, 0.15)',
  },
  mobileIconText: {
    fontSize: 20,
  },
  mobileTabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: INACTIVE,
    marginTop: 2,
  },
  mobileTabLabelActive: {
    color: ACCENT,
    fontWeight: '700',
  },
  mobileNotifBadge: {
    position: 'absolute',
    top: -2,
    right: -4,
    backgroundColor: ACCENT,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  mobileNotifBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
  },
  desktopTabBadge: {
    position: 'absolute',
    top: -6,
    right: -8,
    backgroundColor: ACCENT,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  desktopTabBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
  },

  // Banner / Toast flotante para mensajes en tiempo real
  toastBanner: {
    position: 'absolute' as any,
    top: Platform.OS === 'web' ? 18 : 50,
    alignSelf: 'center',
    width: 380,
    maxWidth: '92%',
    backgroundColor: '#1E1A2B',
    borderColor: ACCENT,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 18,
    elevation: 25,
    zIndex: 99999,
  },
  toastIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(57, 169, 0, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  toastBody: {
    flex: 1,
  },
  toastTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#F0ECF6',
  },
  toastSnippet: {
    fontSize: 12,
    color: '#B9B1C9',
    marginTop: 2,
  },
  toastCloseBtn: {
    padding: 6,
    marginLeft: 6,
  },
  toastCloseText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#8D83A0',
  },
});

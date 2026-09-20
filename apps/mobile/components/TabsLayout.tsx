import { Tabs } from 'expo-router';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Platform, useWindowDimensions
} from 'react-native';
import { useState, useEffect } from 'react';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

import SenaMatchLogo from './SenaMatchLogo';
import NotificacionesModal from './NotificacionesModal';
import AdminPanelModal from './AdminPanelModal';
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

function ResponsiveTabBar({
  state,
  navigation,
  unreadNotifs,
  onOpenNotifs,
  onOpenAdmin,
  esStaffUser
}: BottomTabBarProps & {
  unreadNotifs: number;
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
                  <Text style={styles.desktopTabEmoji}>{meta.emoji}</Text>
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

            {/* Botón de Notificaciones en Desktop */}
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

      {/* Botón de Notificaciones Móvil */}
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

  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [showNotifsModal, setShowNotifsModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);

  const esStaffUser = !!(user?.rol && ['admin', 'moderador', 'bienestar'].includes(user.rol as string));

  // Sondeo periódico de notificaciones
  useEffect(() => {
    let activo = true;
    const consultar = async () => {
      try {
        const res: any = await api.get('/notificaciones');
        if (activo && res && typeof res.unreadCount === 'number') {
          setUnreadNotifs(res.unreadCount);
        }
      } catch {
        // Ignorar si no está autenticado aún
      }
    };

    consultar();
    const interval = setInterval(consultar, 20_000);
    return () => {
      activo = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <>
      <Tabs
        tabBar={(props: any) => (
          <ResponsiveTabBar
            {...props}
            unreadNotifs={unreadNotifs}
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

      {/* Modales globales de Notificaciones y Panel Admin */}
      <NotificacionesModal
        visible={showNotifsModal}
        onClose={() => setShowNotifsModal(false)}
        onNotifCountChange={(c) => setUnreadNotifs(c)}
        onSelectChat={(chatId) => {
          // 1. Guardar el chatId para que ChatsScreen lo detecte
          pendingChat.set(chatId);
          // 2. Cerrar el modal
          setShowNotifsModal(false);
          // 3. El Tab de chats se montará/actualizará y leerá el pendingChat
        }}
      />

      <AdminPanelModal
        visible={showAdminModal}
        onClose={() => setShowAdminModal(false)}
      />
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
});

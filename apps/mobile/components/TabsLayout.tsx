import { Tabs } from 'expo-router';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Platform, useWindowDimensions
} from 'react-native';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

const ACCENT = '#FF6B4A';
const INACTIVE = '#8D83A0';
const NAVBAR_BG = '#171324';

const TABS_META: Record<string, { title: string; emoji: string }> = {
  index: { title: 'Inicio', emoji: '🏠' },
  descubrir: { title: 'Descubrir', emoji: '🔍' },
  parches: { title: 'Parches', emoji: '🎯' },
  chats: { title: 'Chats', emoji: '💬' },
  perfil: { title: 'Perfil', emoji: '👤' },
};

function ResponsiveTabBar({ state, navigation }: BottomTabBarProps) {
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;

  if (isDesktop) {
    return (
      <View style={styles.desktopNavbar}>
        <View style={styles.desktopNavInner}>
          {/* Marca / Logo */}
          <TouchableOpacity
            style={styles.brandWrap}
            onPress={() => navigation.navigate('index')}
            activeOpacity={0.8}
          >
            <Text style={styles.brandLogo}>SENA Match</Text>
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
          </View>
        </View>
      </View>
    );
  }

  // Versión móvil clásica en la parte inferior
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
    </View>
  );
}

export default function TabsLayout() {
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === 'web' && width >= 768;

  return (
    <Tabs
      tabBar={(props: any) => <ResponsiveTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneContainerStyle: {
          paddingTop: isDesktop ? 72 : 0,
          backgroundColor: '#0F0C18',
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Inicio' }} />
      <Tabs.Screen name="descubrir" options={{ title: 'Descubrir' }} />
      <Tabs.Screen name="parches" options={{ title: 'Parches' }} />
      <Tabs.Screen name="chats" options={{ title: 'Chats' }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  // Desktop Navbar (Top bar)
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
    shadowOpacity: 0.3,
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
  brandLogo: {
    fontSize: 24,
    fontWeight: '900',
    color: ACCENT,
    letterSpacing: -0.5,
  },
  brandBadge: {
    backgroundColor: 'rgba(255,107,74,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,107,74,0.3)',
  },
  brandBadgeText: {
    color: '#F0ECF6',
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
    paddingHorizontal: 16,
    paddingVertical: 10,
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
    color: '#F0ECF6',
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

  // Mobile Tab bar (Bottom)
  mobileTabBar: {
    backgroundColor: '#171324',
    borderTopWidth: 1,
    borderTopColor: '#2D2640',
    height: 76,
    paddingBottom: 16,
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
  },
  mobileIconWrapActive: {
    backgroundColor: 'rgba(255, 107, 74, 0.15)',
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
});

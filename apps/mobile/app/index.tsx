import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { useTheme } from './context/ThemeContext';
import SenaMatchLogo from '../components/SenaMatchLogo';

export default function WelcomeScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { backgroundColor: colors.bg }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        {/* Banner Ilustrado / Logo Hero */}
        <View style={styles.heroBox}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>SENA Match</Text>
          </View>
          <View style={styles.logoWrap}>
            <SenaMatchLogo size={68} textSize={30} textColor={colors.text} />
          </View>
        </View>

        {/* Textos Principales */}
        <View style={styles.textSection}>
          <Text style={[styles.title, { color: colors.text }]}>
            Conecta con tu comunidad
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSub }]}>
            Descubre aprendices con tus mismos intereses, comparte proyectos y arma tu parche fácilmente.
          </Text>
        </View>

        {/* Pilares / Beneficios rápidos */}
        <View style={styles.features}>
          <FeatureItem icon="🎯" title="Por afinidad" desc="Encuentra personas por gustos y programas" colors={colors} />
          <FeatureItem icon="👥" title="Parches grupales" desc="Únete a grupos de estudio o deporte" colors={colors} />
          <FeatureItem icon="💬" title="Comunidad activa" desc="Comparte tus ideas y chatea en tiempo real" colors={colors} />
        </View>

        {/* Botones de Acción */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.btnPrimary}
            onPress={() => router.push('/(auth)/registro')}
            activeOpacity={0.88}
          >
            <Text style={styles.btnPrimaryText}>Crear cuenta</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btnSecondary, { backgroundColor: colors.chipBg, borderColor: colors.cardBorder }]}
            onPress={() => router.push('/(auth)/login')}
            activeOpacity={0.85}
          >
            <Text style={[styles.btnSecondaryText, { color: colors.text }]}>Iniciar sesión</Text>
          </TouchableOpacity>
        </View>

        <Text style={[styles.footnote, { color: colors.textMuted }]}>
          Exclusivo para la comunidad SENA · Seguro y verificado 🇨🇴
        </Text>
      </View>
    </ScrollView>
  );
}

function FeatureItem({ icon, title, desc, colors }: {
  icon: string;
  title: string;
  desc: string;
  colors: import('./context/ThemeContext').ThemeColors;
}) {
  return (
    <View style={[stylesFeature.item, { backgroundColor: colors.bgSecondary, borderColor: colors.cardBorder }]}>
      <Text style={stylesFeature.icon}>{icon}</Text>
      <View style={stylesFeature.meta}>
        <Text style={[stylesFeature.title, { color: colors.text }]}>{title}</Text>
        <Text style={[stylesFeature.desc, { color: colors.textSub }]}>{desc}</Text>
      </View>
    </View>
  );
}

const stylesFeature = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  icon: {
    fontSize: 20,
    marginRight: 12,
  },
  meta: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 1,
  },
  desc: {
    fontSize: 11,
    lineHeight: 15,
  },
});

function makeStyles(colors: import('./context/ThemeContext').ThemeColors, isDark: boolean) {
  return StyleSheet.create({
    container: {
      flexGrow: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    card: {
      width: '100%',
      maxWidth: 440,
      borderRadius: 24,
      borderWidth: 1,
      padding: 28,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: isDark ? 0.35 : 0.08,
      shadowRadius: 20,
      elevation: 5,
    },
    heroBox: {
      alignItems: 'center',
      marginBottom: 20,
    },
    badge: {
      backgroundColor: 'rgba(57, 169, 0, 0.12)',
      borderColor: 'rgba(57, 169, 0, 0.28)',
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 20,
      marginBottom: 16,
    },
    badgeText: {
      color: colors.accent,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
    logoWrap: {
      paddingVertical: 4,
    },
    textSection: {
      alignItems: 'center',
      marginBottom: 20,
    },
    title: {
      fontSize: 22,
      fontWeight: '800',
      textAlign: 'center',
      letterSpacing: -0.4,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 13,
      lineHeight: 19,
      textAlign: 'center',
      paddingHorizontal: 8,
    },
    features: {
      width: '100%',
      marginBottom: 20,
    },
    actions: {
      width: '100%',
      gap: 10,
    },
    btnPrimary: {
      backgroundColor: colors.accent,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
      shadowColor: colors.accent,
      shadowOpacity: 0.3,
      shadowRadius: 10,
      elevation: 3,
    },
    btnPrimaryText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
    btnSecondary: {
      borderRadius: 14,
      paddingVertical: 13,
      alignItems: 'center',
      borderWidth: 1,
    },
    btnSecondaryText: {
      fontSize: 14,
      fontWeight: '600',
    },
    footnote: {
      fontSize: 11,
      textAlign: 'center',
      marginTop: 20,
    },
  });
}

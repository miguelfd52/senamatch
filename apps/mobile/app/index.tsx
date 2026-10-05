import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { useTheme } from './context/ThemeContext';
import SenaMatchLogo from '../components/SenaMatchLogo';

export default function WelcomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
        {/* Marca con Logo 3D */}
        <View style={styles.brand}>
          <View style={{ marginBottom: 14 }}>
            <SenaMatchLogo size={64} textSize={32} />
          </View>
          <Text style={styles.logoBadge}>Comunidad SENA</Text>
          <Text style={[styles.slogan, { color: colors.textSub }]}>
            Descubre personas por afinidad{'\n'}y arma tu parche 🎯
          </Text>
        </View>

        {/* CTA principal */}
        <TouchableOpacity
          style={styles.btnPrimary}
          onPress={() => router.push('/(auth)/registro')}
          activeOpacity={0.85}
        >
          <Text style={styles.btnPrimaryText}>Crear cuenta nueva</Text>
        </TouchableOpacity>

        {/* CTA secundario */}
        <TouchableOpacity
          style={[styles.btnSecondary, { backgroundColor: colors.chipBg, borderColor: colors.cardBorder }]}
          onPress={() => router.push('/(auth)/login')}
          activeOpacity={0.8}
        >
          <Text style={[styles.btnSecondaryText, { color: colors.textSub }]}>Ya tengo cuenta — Iniciar sesión</Text>
        </TouchableOpacity>

        <Text style={[styles.footer, { color: colors.textMuted }]}>Solo para la comunidad SENA 🇨🇴</Text>
      </View>
    </View>
  );
}

function makeStyles(colors: import('./context/ThemeContext').ThemeColors) {
  return StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    maxWidth: 480,
    width: '100%',
    padding: 40,
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 25,
    elevation: 6,
  },
  brand: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoBadge: {
    backgroundColor: 'rgba(57,169,0,0.15)',
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(57,169,0,0.3)',
  },
  logo: {
    fontSize: 42,
    fontWeight: '900',
    color: colors.accent,
    letterSpacing: -1,
  },
  slogan: {
    fontSize: 16,
    color: colors.textSub,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 24,
  },
  btnPrimary: {
    backgroundColor: colors.accent,
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: colors.accent,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 3,
  },
  btnPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  btnSecondary: {
    backgroundColor: colors.chipBg,
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  btnSecondaryText: {
    color: colors.textSub,
    fontSize: 15,
    fontWeight: '600',
  },
  footer: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 28,
  },
  });
}

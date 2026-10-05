import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView
} from 'react-native';
import { useState, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import SenaMatchLogo from '../../components/SenaMatchLogo';

export default function LoginScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const { signIn } = useAuth();

  const handleLogin = async () => {
    setError('');

    if (!email.trim()) { setError('Ingresa tu correo'); return; }
    if (!password) { setError('Ingresa tu contraseña'); return; }

    setLoading(true);
    try {
      const response = await api.post('/auth/login', {
        email: email.trim().toLowerCase(),
        password,
      });
      await signIn(response.token, response.user);
      // _layout.tsx redirige automáticamente según rol
    } catch (e: any) {
      console.error('Error al iniciar sesión:', e);
      const status = e?.status ?? (e instanceof ApiError ? e.status : null);
      const rawMsg = (e?.message || '').toLowerCase();

      if (status === 401 || rawMsg.includes('incorrecto') || rawMsg.includes('correo o contrase')) {
        setError('Correo o contraseña incorrectos');
      } else if (status === 0 || rawMsg.includes('no se pudo conectar') || rawMsg.includes('fetch')) {
        setError('No se pudo conectar con el servidor. Verifica tu conexión o intenta nuevamente.');
      } else if (status === 503 || rawMsg.includes('base de datos') || rawMsg.includes('conexión')) {
        setError('La base de datos se está reconectando. Por favor, intenta de nuevo en unos segundos.');
      } else if (status === 400 && e?.message) {
        setError(e.message);
      } else {
        setError(e?.message || 'No pudimos iniciar sesión en este momento. Inténtalo nuevamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Logo / Marca 3D */}
        <View style={styles.header}>
          <SenaMatchLogo size={52} textSize={28} subtitle="Conecta con tu comunidad SENA" />
        </View>

        {/* Formulario */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
            placeholder="Correo electrónico"
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            returnKeyType="next"
          />
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
            placeholder="Contraseña"
            placeholderTextColor={colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleLogin}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.btnPrimary, loading && styles.btnDisabled]}
            onPress={handleLogin}
            activeOpacity={0.85}
            disabled={loading}
          >
            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#FFFFFF" size="small" style={{ marginRight: 8 }} />
                <Text style={styles.btnPrimaryText}>Iniciando sesión…</Text>
              </View>
            ) : (
              <Text style={styles.btnPrimaryText}>Iniciar sesión</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Divisor */}
        <View style={styles.divider}>
          <View style={[styles.dividerLine, { backgroundColor: colors.cardBorder }]} />
          <Text style={[styles.dividerText, { color: colors.textMuted }]}>o</Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.cardBorder }]} />
        </View>

        {/* Enlace a registro */}
        <TouchableOpacity
          style={[styles.btnSecondary, { backgroundColor: colors.chipBg, borderColor: colors.cardBorder }]}
          onPress={() => router.push('/(auth)/registro')}
          activeOpacity={0.8}
        >
          <Text style={[styles.btnSecondaryText, { color: colors.textSub }]}>¿No tienes cuenta? Crear cuenta</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: import('../context/ThemeContext').ThemeColors) {
  return StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    paddingTop: 60,
    maxWidth: 460,
    width: '100%',
    alignSelf: 'center',
  },
  header: { alignItems: 'center', marginBottom: 36 },
  logo: {
    fontSize: 38, fontWeight: '800',
    color: '#FF6B4A', letterSpacing: -0.5,
  },
  tagline: { fontSize: 15, marginTop: 6 },
  card: {
    borderRadius: 16, padding: 24,
    borderWidth: 1,
    shadowColor: '#000', shadowOpacity: 0.3,
    shadowRadius: 12, elevation: 4,
  },
  input: {
    backgroundColor: colors.inputBg,
    color: colors.text, fontSize: 16,
    borderWidth: 1, borderColor: colors.inputBorder,
    padding: 14, borderRadius: 10,
    marginBottom: 14,
  },
  error: {
    color: colors.danger, fontSize: 14,
    marginBottom: 12, textAlign: 'center',
  },
  loader: { marginVertical: 8 },
  btnPrimary: {
    backgroundColor: colors.accent,
    padding: 15, borderRadius: 10,
    alignItems: 'center', marginTop: 4,
  },
  btnDisabled: {
    opacity: 0.75,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: {
    color: '#fff', fontSize: 16, fontWeight: '700',
  },
  divider: {
    flexDirection: 'row', alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.cardBorder },
  dividerText: { color: colors.textMuted, marginHorizontal: 12, fontSize: 14 },
  btnSecondary: {
    backgroundColor: colors.inputBg,
    padding: 15, borderRadius: 10,
    alignItems: 'center', borderWidth: 1, borderColor: colors.inputBorder,
  },
  btnSecondaryText: {
    color: colors.textSub, fontSize: 15, fontWeight: '600',
  },
  });
}

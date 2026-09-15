import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView
} from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen() {
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
      } else if (status === 400 && e?.message) {
        setError(e.message);
      } else {
        setError('No pudimos iniciar sesión en este momento. Inténtalo nuevamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Logo / Marca */}
        <View style={styles.header}>
          <Text style={styles.logo}>SENA Match</Text>
          <Text style={styles.tagline}>Conecta con tu comunidad SENA</Text>
        </View>

        {/* Formulario */}
        <View style={styles.card}>
          <TextInput
            style={styles.input}
            placeholder="Correo electrónico"
            placeholderTextColor="#786E8A"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            returnKeyType="next"
          />
          <TextInput
            style={styles.input}
            placeholder="Contraseña"
            placeholderTextColor="#786E8A"
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
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>o</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Enlace a registro */}
        <TouchableOpacity
          style={styles.btnSecondary}
          onPress={() => router.push('/(auth)/registro')}
          activeOpacity={0.8}
        >
          <Text style={styles.btnSecondaryText}>¿No tienes cuenta? Crear cuenta</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#0F0C18' },
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
  tagline: { fontSize: 15, color: '#786E8A', marginTop: 6 },
  card: {
    backgroundColor: '#1E1A2B',
    borderRadius: 16, padding: 24,
    borderWidth: 1, borderColor: '#2D2640',
    shadowColor: '#000', shadowOpacity: 0.3,
    shadowRadius: 12, elevation: 4,
  },
  input: {
    backgroundColor: '#282234',
    color: '#F0ECF6', fontSize: 16,
    borderWidth: 1, borderColor: '#3A3247',
    padding: 14, borderRadius: 10,
    marginBottom: 14,
  },
  error: {
    color: '#FF5B6E', fontSize: 14,
    marginBottom: 12, textAlign: 'center',
  },
  loader: { marginVertical: 8 },
  btnPrimary: {
    backgroundColor: '#FF6B4A',
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
  dividerLine: { flex: 1, height: 1, backgroundColor: '#2D2640' },
  dividerText: { color: '#786E8A', marginHorizontal: 12, fontSize: 14 },
  btnSecondary: {
    backgroundColor: '#2D2640',
    padding: 15, borderRadius: 10,
    alignItems: 'center', borderWidth: 1, borderColor: '#3A3247',
  },
  btnSecondaryText: {
    color: '#B9B1C9', fontSize: 15, fontWeight: '600',
  },
});

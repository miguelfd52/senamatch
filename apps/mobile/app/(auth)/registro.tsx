import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView
} from 'react-native';
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../context/AuthContext';
import SenaMatchLogo from '../../components/SenaMatchLogo';

const CORREO_RE = /^[^\s@]+@(gmail\.com|misena\.edu\.co|sena\.edu\.co)$/i;

export default function RegistroScreen() {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const { signIn } = useAuth();

  const validar = () => {
    if (nombre.trim().length < 2) return 'El nombre debe tener al menos 2 caracteres';
    if (!CORREO_RE.test(email.trim())) return 'Solo se admiten correos @gmail.com, @misena.edu.co o @sena.edu.co';
    if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
    if (password !== confirmar) return 'Las contraseñas no coinciden';
    return null;
  };

  const handleRegistro = async () => {
    setError('');
    const msg = validar();
    if (msg) { setError(msg); return; }

    setLoading(true);
    try {
      const response = await api.post('/auth/register', {
        nombre: nombre.trim(),
        email: email.trim().toLowerCase(),
        password,
      });
      await signIn(response.token, response.user);
      // _layout.tsx redirige automáticamente según rol
    } catch (e: any) {
      console.error('Error en registro:', e);
      const status = e?.status ?? (e instanceof ApiError ? e.status : null);
      const rawMsg = (e?.message || '').toLowerCase();

      if (status === 409 || rawMsg.includes('existe')) {
        setError('Ya existe una cuenta con ese correo');
      } else if (status === 400 && e?.message) {
        setError(e.message);
      } else {
        setError('No pudimos registrar tu cuenta en este momento. Inténtalo nuevamente.');
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
        {/* Cabecera con Logo 3D */}
        <View style={styles.header}>
          <SenaMatchLogo size={52} textSize={28} subtitle="Crea tu cuenta y conecta" />
        </View>

        {/* Formulario */}
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Nombre completo</Text>
          <TextInput
            style={styles.input}
            placeholder="Tu nombre"
            placeholderTextColor="#786E8A"
            value={nombre}
            onChangeText={setNombre}
            autoCapitalize="words"
            returnKeyType="next"
          />

          <Text style={styles.fieldLabel}>Correo electrónico</Text>
          <TextInput
            style={styles.input}
            placeholder="ejemplo@gmail.com"
            placeholderTextColor="#786E8A"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            returnKeyType="next"
          />
          <Text style={styles.hint}>Acepta: @gmail.com · @misena.edu.co · @sena.edu.co</Text>

          <Text style={styles.fieldLabel}>Contraseña</Text>
          <TextInput
            style={styles.input}
            placeholder="Mínimo 8 caracteres"
            placeholderTextColor="#786E8A"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            returnKeyType="next"
          />

          <Text style={styles.fieldLabel}>Confirmar contraseña</Text>
          <TextInput
            style={styles.input}
            placeholder="Repite tu contraseña"
            placeholderTextColor="#786E8A"
            value={confirmar}
            onChangeText={setConfirmar}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleRegistro}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.btnPrimary, loading && styles.btnDisabled]}
            onPress={handleRegistro}
            activeOpacity={0.85}
            disabled={loading}
          >
            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#FFFFFF" size="small" style={{ marginRight: 8 }} />
                <Text style={styles.btnPrimaryText}>Creando cuenta…</Text>
              </View>
            ) : (
              <Text style={styles.btnPrimaryText}>Crear cuenta</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Enlace a login */}
        <TouchableOpacity
          style={styles.linkBtn}
          onPress={() => router.replace('/(auth)/login')}
        >
          <Text style={styles.linkText}>¿Ya tienes cuenta? <Text style={styles.linkAccent}>Iniciar sesión</Text></Text>
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
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  header: { alignItems: 'center', marginBottom: 32 },
  logo: {
    fontSize: 34, fontWeight: '800',
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
  fieldLabel: {
    color: '#B9B1C9', fontSize: 13,
    fontWeight: '600', marginBottom: 6,
  },
  input: {
    backgroundColor: '#282234',
    color: '#F0ECF6', fontSize: 16,
    borderWidth: 1, borderColor: '#3A3247',
    padding: 13, borderRadius: 10,
    marginBottom: 16,
  },
  hint: {
    color: '#786E8A', fontSize: 12,
    marginTop: -12, marginBottom: 16,
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
  linkBtn: { alignItems: 'center', marginTop: 24 },
  linkText: { color: '#786E8A', fontSize: 15 },
  linkAccent: { color: '#FF6B4A', fontWeight: '700' },
});

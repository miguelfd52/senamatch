import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView, Image
} from 'react-native';
import { useState, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { api, ApiError } from '../../lib/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import SenaMatchLogo from '../../components/SenaMatchLogo';
import { openImagePickerAndUpload } from '../../lib/cloudinary';
import NavIcon from '../../components/NavIcon';

const CORREO_RE = /^[^\s@]+@(gmail\.com|misena\.edu\.co|sena\.edu\.co)$/i;
const ACCENT = '#39A900';

export default function RegistroScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [fotoUrl, setFotoUrl] = useState('');
  const [fotoPreview, setFotoPreview] = useState('');
  const [fotoUploading, setFotoUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const { signIn } = useAuth();

  const handlePickPhoto = () => {
    setError('');
    openImagePickerAndUpload({
      onProgress: (p) => setFotoUploading(p),
      onPreview: (preview) => setFotoPreview(preview),
      onSuccess: (url) => {
        setFotoUrl(url);
        setFotoPreview(url);
      },
      onError: (msg) => {
        setError(msg);
        setFotoPreview('');
      }
    }).catch(() => {});
  };

  const validar = () => {
    if (!fotoUrl.trim()) return 'La foto de perfil es obligatoria para crear tu cuenta';
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
        foto_url: fotoUrl.trim(),
      });

      if (response.requiresVerification || response.pending) {
        // Backend requiere verificación OTP: ir a pantalla de verificación
        router.push({
          pathname: '/(auth)/verify-registro' as any,
          params: { email: email.trim().toLowerCase() }
        });
      } else if (response.token && response.user) {
        await signIn(response.token, response.user);
        // _layout.tsx redirige automáticamente según rol
      }
    } catch (e: any) {
      console.error('Error en registro:', e);
      const status = e?.status ?? (e instanceof ApiError ? e.status : null);
      const rawMsg = (e?.message || '').toLowerCase();

      if (status === 409 || rawMsg.includes('existe')) {
        setError('Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña.');
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
      style={[styles.flex, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Cabecera con Logo 3D */}
        <View style={styles.header}>
          <SenaMatchLogo size={52} textSize={28} subtitle="Crea tu cuenta y conecta" />
        </View>

        {/* Formulario */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {/* Subida obligatoria de Foto de Perfil */}
          <View style={styles.photoSection}>
            <TouchableOpacity
              style={[styles.photoCircleBtn, { backgroundColor: colors.inputBg }]}
              onPress={handlePickPhoto}
              disabled={fotoUploading}
              activeOpacity={0.8}
            >
              {fotoPreview || fotoUrl ? (
                <Image
                  source={{ uri: fotoPreview || fotoUrl }}
                  style={styles.photoPreviewImg}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <NavIcon name="camera" size={30} color={ACCENT} />
                  <Text style={[styles.photoPlaceholderText, { color: colors.textMuted }]}>Subir foto *</Text>
                </View>
              )}

              {fotoUploading && (
                <View style={styles.photoUploadingOverlay}>
                  <ActivityIndicator size="small" color="#FFF" />
                </View>
              )}
            </TouchableOpacity>

            <View style={{ flex: 1 }}>
              <Text style={[styles.photoRequiredTitle, { color: colors.text }]}>Foto de perfil obligatoria</Text>
              <Text style={[styles.photoRequiredSubtitle, { color: colors.textSub }]}>
                {fotoUrl ? 'Foto cargada con éxito' : 'Selecciona una foto tuya para que tus compañeros puedan reconocerte.'}
              </Text>
              <TouchableOpacity
                onPress={handlePickPhoto}
                disabled={fotoUploading}
                style={styles.changePhotoBtn}
              >
                <Text style={styles.changePhotoBtnText}>
                  {fotoUploading ? 'Subiendo…' : fotoUrl ? 'Cambiar foto' : 'Seleccionar foto'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <Text style={[styles.fieldLabel, { color: colors.textSub }]}>Nombre completo</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
            placeholder="Tu nombre"
            placeholderTextColor={colors.textMuted}
            value={nombre}
            onChangeText={setNombre}
            autoCapitalize="words"
            returnKeyType="next"
          />

          <Text style={[styles.fieldLabel, { color: colors.textSub }]}>Correo electrónico</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
            placeholder="ejemplo@gmail.com"
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            returnKeyType="next"
          />
          <Text style={[styles.hint, { color: colors.textMuted }]}>Acepta: @gmail.com · @misena.edu.co · @sena.edu.co</Text>

          <Text style={[styles.fieldLabel, { color: colors.textSub }]}>Contraseña</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
            placeholder="Mínimo 8 caracteres"
            placeholderTextColor={colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            returnKeyType="next"
          />

          <Text style={[styles.fieldLabel, { color: colors.textSub }]}>Confirmar contraseña</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
            placeholder="Repite tu contraseña"
            placeholderTextColor={colors.textMuted}
            value={confirmar}
            onChangeText={setConfirmar}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleRegistro}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.btnPrimary, (loading || fotoUploading) && styles.btnDisabled]}
            onPress={handleRegistro}
            activeOpacity={0.85}
            disabled={loading || fotoUploading}
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
          <Text style={[styles.linkText, { color: colors.textSub }]}>¿Ya tienes cuenta? <Text style={styles.linkAccent}>Iniciar sesión</Text></Text>
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
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  header: { alignItems: 'center', marginBottom: 32 },
  logo: {
    fontSize: 34, fontWeight: '800',
    color: '#FF6B4A', letterSpacing: -0.5,
  },
  tagline: { fontSize: 15, color: colors.textSub, marginTop: 6 },
  card: {
    borderRadius: 16, padding: 24,
    borderWidth: 1,
    shadowColor: '#000', shadowOpacity: 0.3,
    shadowRadius: 12, elevation: 4,
  },
  photoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 14,
    backgroundColor: 'rgba(57,169,0,0.06)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(57,169,0,0.25)',
    marginBottom: 20,
  },
  photoCircleBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: 'hidden',
    backgroundColor: colors.inputBg,
    borderWidth: 2,
    borderColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPreviewImg: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPlaceholderEmoji: {
    fontSize: 22,
  },
  photoPlaceholderText: {
    color: colors.textSub,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  photoUploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoRequiredTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  photoRequiredSubtitle: {
    color: colors.textSub,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  changePhotoBtn: {
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  changePhotoBtnText: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  fieldLabel: {
    color: colors.textSub, fontSize: 13,
    fontWeight: '600', marginBottom: 6,
  },
  input: {
    backgroundColor: colors.inputBg,
    color: colors.text, fontSize: 16,
    borderWidth: 1, borderColor: colors.inputBorder,
    padding: 13, borderRadius: 10,
    marginBottom: 16,
  },
  hint: {
    color: colors.textMuted, fontSize: 12,
    marginTop: -12, marginBottom: 16,
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
  linkBtn: { alignItems: 'center', marginTop: 24 },
  linkText: { color: colors.textSub, fontSize: 15 },
  linkAccent: { color: colors.accent, fontWeight: '700' },
  });
}

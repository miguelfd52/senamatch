import {
  View, Text, StyleSheet, TouchableOpacity,
  Modal, ActivityIndicator, TextInput, Image,
  Platform, KeyboardAvoidingView, ScrollView
} from 'react-native';
import { useState, useMemo } from 'react';
import { useAuth } from '../app/context/AuthContext';
import { openImagePickerAndUpload } from '../lib/cloudinary';
import { api } from '../lib/api';
import SenaMatchLogo from './SenaMatchLogo';
import { useTheme, ThemeColors } from '../app/context/ThemeContext';

const ACCENT = '#39A900';
const DANGER = '#FF5B6E';

export default function InitialPostModal() {
  const { user, completeInitialPost } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [texto, setTexto] = useState('');
  const [fotoPreview, setFotoPreview] = useState('');
  const [fotoUrl, setFotoUrl] = useState('');
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [error, setError] = useState('');

  // Solo se muestra si el usuario está autenticado y tiene pendiente su primera publicación
  const visible = !!user && user.primeraPublicacionCompletada === false;

  if (!visible) return null;

  const handleSubirFoto = () => {
    setError('');
    openImagePickerAndUpload({
      onProgress: (loading) => setSubiendoFoto(loading),
      onPreview: (dataUrl) => setFotoPreview(dataUrl),
      onSuccess: (secureUrl) => {
        setFotoUrl(secureUrl);
        setFotoPreview(secureUrl);
        setSubiendoFoto(false);
        setError('');
      },
      onError: (msg) => {
        setError(msg);
        setSubiendoFoto(false);
        if (!fotoUrl) setFotoPreview('');
      },
    });
  };

  const puedePublicar = texto.trim().length > 0 && !!fotoUrl && !publicando && !subiendoFoto;

  const handlePublicar = async () => {
    if (!fotoUrl) {
      setError('Debes adjuntar una foto para completar tu registro.');
      return;
    }
    if (!texto.trim()) {
      setError('Escribe un texto o comentario para tu publicación.');
      return;
    }

    setPublicando(true);
    setError('');

    try {
      // 1. Crear la publicación obligatoria en la base de datos
      await api.post('/publicaciones', {
        texto: texto.trim(),
        fotoUrl: fotoUrl.trim(),
      });

      // 2. Marcar en la base de datos y en sesión que se completó el requisito
      await completeInitialPost();
    } catch (err: any) {
      console.error('Error en publicación inicial obligatoria:', err);
      setError(err?.message || 'No pudimos guardar tu publicación. Inténtalo nuevamente.');
    } finally {
      setPublicando(false);
    }
  };

  const imagenAMostrar = fotoPreview || fotoUrl;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={() => {}} // Bloquear cierre con botón atrás
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            {/* Logo y Encabezado */}
            <View style={styles.header}>
              <SenaMatchLogo size={42} textSize={22} subtitle="" />
              <Text style={[styles.title, { color: colors.text }]}>¡Completa tu Registro! 🎉</Text>
              <Text style={[styles.subtitle, { color: colors.textSub }]}>
                Para activar tu perfil y conectar con la comunidad SENA, es obligatorio crear tu primera publicación con una foto y un mensaje de presentación.
              </Text>
            </View>

            {/* Subida de Foto Obligatoria */}
            <View style={styles.section}>
              <Text style={[styles.label, { color: colors.text }]}>
                1. Foto de presentación <Text style={styles.required}>* Obligatoria</Text>
              </Text>

              {imagenAMostrar ? (
                <View style={styles.previewWrap}>
                  <Image source={{ uri: imagenAMostrar }} style={styles.previewImage} resizeMode="cover" />
                  {subiendoFoto ? (
                    <View style={styles.previewLoadingOverlay}>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text style={styles.previewLoadingText}>Subiendo foto a Cloudinary…</Text>
                    </View>
                  ) : null}
                  <TouchableOpacity
                    style={styles.btnCambiarFoto}
                    onPress={handleSubirFoto}
                    disabled={subiendoFoto}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.btnCambiarFotoText}>
                      {subiendoFoto ? 'Cargando imagen…' : '📷 Cambiar foto'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.uploadBox, { borderColor: colors.inputBorder, backgroundColor: colors.bgSecondary }, subiendoFoto && styles.uploadBoxDisabled]}
                  onPress={handleSubirFoto}
                  disabled={subiendoFoto}
                  activeOpacity={0.8}
                >
                  {subiendoFoto ? (
                    <View style={styles.uploadInner}>
                      <ActivityIndicator size="small" color={ACCENT} />
                      <Text style={styles.uploadText}>Subiendo foto a Cloudinary…</Text>
                    </View>
                  ) : (
                    <View style={styles.uploadInner}>
                      <Text style={styles.uploadIcon}>📸</Text>
                      <Text style={[styles.uploadTextBold, { color: colors.text }]}>Toca aquí para seleccionar tu foto</Text>
                      <Text style={[styles.uploadHint, { color: colors.textMuted }]}>JPG, PNG o WebP (máx. 3 MB)</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {/* Texto Obligatorio */}
            <View style={styles.section}>
              <Text style={[styles.label, { color: colors.text }]}>
                2. Mensaje o presentación <Text style={styles.required}>* Obligatorio</Text>
              </Text>
              <TextInput
                style={[styles.textArea, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.inputBorder }]}
                placeholder="Cuéntanos quién eres, tu programa de formación, proyectos o qué te apasiona en el SENA…"
                placeholderTextColor={colors.textMuted}
                value={texto}
                onChangeText={setTexto}
                multiline
                numberOfLines={4}
                maxLength={800}
              />
              <Text style={[styles.charCount, { color: colors.textMuted }]}>{texto.length}/800</Text>
            </View>

            {/* Error si existe */}
            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠️ {error}</Text>
              </View>
            ) : null}

            {/* Botón de Publicación */}
            <TouchableOpacity
              style={[styles.btnSubmit, !puedePublicar && styles.btnSubmitDisabled]}
              onPress={handlePublicar}
              disabled={!puedePublicar}
              activeOpacity={0.85}
            >
              {publicando ? (
                <View style={styles.btnInner}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.btnSubmitText}>Publicando y activando cuenta…</Text>
                </View>
              ) : (
                <Text style={styles.btnSubmitText}>
                  {!fotoUrl
                    ? 'Sube una foto para continuar'
                    : !texto.trim()
                    ? 'Escribe tu mensaje para continuar'
                    : '✨ Publicar y Comenzar'}
                </Text>
              )}
            </TouchableOpacity>

            <Text style={styles.footerNote}>
              🔒 Este requisito solo se solicita una única vez al registrarte.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.modalOverlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    paddingVertical: 40,
    width: '100%',
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    width: '100%',
    maxWidth: 520,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 6,
  },
  section: {
    marginBottom: 18,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  required: {
    color: ACCENT,
    fontSize: 12,
  },
  uploadBox: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadBoxDisabled: {
    opacity: 0.6,
  },
  uploadInner: {
    alignItems: 'center',
  },
  uploadIcon: {
    fontSize: 32,
    marginBottom: 6,
  },
  uploadTextBold: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  uploadHint: {
    fontSize: 11,
    marginTop: 4,
  },
  uploadText: {
    fontSize: 13,
    color: colors.textSub,
    marginTop: 8,
  },
  previewWrap: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.inputBg,
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: 190,
  },
  previewLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 40,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  previewLoadingText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  btnCambiarFoto: {
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: colors.inputBg,
  },
  btnCambiarFotoText: {
    color: colors.textSub,
    fontSize: 12,
    fontWeight: '600',
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    fontSize: 14,
    minHeight: 95,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 11,
    textAlign: 'right',
    marginTop: 4,
  },
  errorBox: {
    backgroundColor: 'rgba(255, 91, 110, 0.12)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 91, 110, 0.3)',
  },
  errorText: {
    color: DANGER,
    fontSize: 13,
    textAlign: 'center',
  },
  btnSubmit: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    shadowColor: ACCENT,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  btnSubmitDisabled: {
    backgroundColor: colors.isDark ? '#263238' : '#D0C8DE',
    shadowOpacity: 0,
    elevation: 0,
  },
  btnSubmitText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  btnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  footerNote: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 14,
  },
});

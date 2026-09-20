import {
  View, Text, StyleSheet, TouchableOpacity,
  Modal, ActivityIndicator, TextInput, Image,
  Platform, KeyboardAvoidingView, ScrollView
} from 'react-native';
import { useState } from 'react';
import { useAuth } from '../app/context/AuthContext';
import { openImagePickerAndUpload } from '../lib/cloudinary';
import { api } from '../lib/api';
import SenaMatchLogo from './SenaMatchLogo';

const ACCENT = '#39A900';
const BG = '#0F0C18';
const CARD = '#161B22';
const CARD_BORDER = '#263238';
const DANGER = '#FF5B6E';

export default function InitialPostModal() {
  const { user, completeInitialPost } = useAuth();
  const [texto, setTexto] = useState('');
  const [fotoUrl, setFotoUrl] = useState('');
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [error, setError] = useState('');

  // Solo se muestra si el usuario está autenticado y tiene pendiente su primera publicación
  const visible = !!user && user.primeraPublicacionCompletada === false;

  if (!visible) return null;

  const handleSubirFoto = async () => {
    setError('');
    setSubiendoFoto(true);
    try {
      const result = await openImagePickerAndUpload();
      if (result && result.secure_url) {
        setFotoUrl(result.secure_url);
      }
    } catch (err: any) {
      if (!err?.message?.includes('cancel')) {
        setError(err?.message || 'Error al subir la imagen. Inténtalo de nuevo.');
      }
    } finally {
      setSubiendoFoto(false);
    }
  };

  const puedePublicar = texto.trim().length > 0 && !!fotoUrl && !publicando && !subiendoFoto;

  const handlePublicar = async () => {
    if (!texto.trim()) {
      setError('Escribe un texto o comentario para tu publicación.');
      return;
    }
    if (!fotoUrl) {
      setError('Debes adjuntar una foto para completar tu registro.');
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
          <View style={styles.card}>
            {/* Logo y Encabezado */}
            <View style={styles.header}>
              <SenaMatchLogo size={42} textSize={22} subtitle="" />
              <Text style={styles.title}>¡Completa tu Registro! 🎉</Text>
              <Text style={styles.subtitle}>
                Para activar tu perfil y conectar con la comunidad SENA, es obligatorio crear tu primera publicación con una foto y un mensaje de presentación.
              </Text>
            </View>

            {/* Subida de Foto Obligatoria */}
            <View style={styles.section}>
              <Text style={styles.label}>
                1. Foto de presentación <Text style={styles.required}>* Obligatoria</Text>
              </Text>

              {fotoUrl ? (
                <View style={styles.previewWrap}>
                  <Image source={{ uri: fotoUrl }} style={styles.previewImage} resizeMode="cover" />
                  <TouchableOpacity
                    style={styles.btnCambiarFoto}
                    onPress={handleSubirFoto}
                    disabled={subiendoFoto}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.btnCambiarFotoText}>
                      {subiendoFoto ? 'Cargando…' : '📷 Cambiar foto'}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.uploadBox, subiendoFoto && styles.uploadBoxDisabled]}
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
                      <Text style={styles.uploadTextBold}>Toca aquí para seleccionar tu foto</Text>
                      <Text style={styles.uploadHint}>JPG, PNG o WebP (máx. 3 MB)</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {/* Texto Obligatorio */}
            <View style={styles.section}>
              <Text style={styles.label}>
                2. Mensaje o presentación <Text style={styles.required}>* Obligatorio</Text>
              </Text>
              <TextInput
                style={styles.textArea}
                placeholder="Cuéntanos quién eres, tu programa de formación, proyectos o qué te apasiona en el SENA…"
                placeholderTextColor="#786E8A"
                value={texto}
                onChangeText={setTexto}
                multiline
                numberOfLines={4}
                maxLength={800}
              />
              <Text style={styles.charCount}>{texto.length}/800</Text>
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

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 3, 10, 0.96)',
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
    backgroundColor: CARD,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: CARD_BORDER,
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
    color: '#F0ECF6',
    marginTop: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: '#8D83A0',
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
    color: '#F0ECF6',
    marginBottom: 8,
  },
  required: {
    color: ACCENT,
    fontSize: 12,
  },
  uploadBox: {
    borderWidth: 2,
    borderColor: '#2D2640',
    borderStyle: 'dashed',
    borderRadius: 16,
    padding: 20,
    backgroundColor: '#120F1D',
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
    color: '#F0ECF6',
    textAlign: 'center',
  },
  uploadHint: {
    fontSize: 11,
    color: '#786E8A',
    marginTop: 4,
  },
  uploadText: {
    fontSize: 13,
    color: '#8D83A0',
    marginTop: 8,
  },
  previewWrap: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: '#120F1D',
  },
  previewImage: {
    width: '100%',
    height: 190,
  },
  btnCambiarFoto: {
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#1E1A2B',
  },
  btnCambiarFotoText: {
    color: '#8D83A0',
    fontSize: 12,
    fontWeight: '600',
  },
  textArea: {
    backgroundColor: '#120F1D',
    borderWidth: 1,
    borderColor: '#2D2640',
    borderRadius: 14,
    padding: 14,
    color: '#F0ECF6',
    fontSize: 14,
    minHeight: 95,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 11,
    color: '#786E8A',
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
    backgroundColor: '#263238',
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
    color: '#786E8A',
    textAlign: 'center',
    marginTop: 14,
  },
});

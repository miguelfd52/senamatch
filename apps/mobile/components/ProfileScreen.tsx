import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, TextInput,
  KeyboardAvoidingView, Platform, Alert, Image
} from 'react-native';
import { useState, useEffect } from 'react';
import { useAuth } from '../app/context/AuthContext';
import { usePerfil, useEditarPerfil } from '../hooks/useParches';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { openImagePickerAndUpload, CloudinaryError } from '../lib/cloudinary';
import FotoViewerModal from './FotoViewerModal';
import { useTheme } from '../app/context/ThemeContext';

const ACCENT = '#39A900';
const SUCCESS = '#00E5A3';

const INTERESES_OPCIONES = [
  '🎮 Gaming', '⚽ Fútbol', '🎵 Música', '📚 Lectura',
  '🎬 Cine', '💻 Programación', '🎨 Arte', '📷 Fotografía',
  '🏋️ Gym', '🍳 Cocina', '✈️ Viajes', '🐱 Mascotas',
];

const EMOJIS = ['😊', '😎', '🤓', '🦊', '🐱', '🐶', '🦄', '🌟', '🔥', '🎯', '💪', '🎓'];

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoIcon}>{icon}</Text>
      <Text style={[styles.infoLabel, { color: colors.textSub }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { user, signOut, signIn } = useAuth();
  const { data: perfil, isLoading } = usePerfil(user?.id || '');
  const editMutation = useEditarPerfil(user?.id || '');
  const { isDark, toggleTheme, colors } = useTheme();

  const [editing, setEditing] = useState(false);
  const [nombre, setNombre] = useState(user?.nombre || '');
  const [centro, setCentro] = useState('');
  const [programa, setPrograma] = useState('');
  const [ficha, setFicha] = useState('');
  const [jornada, setJornada] = useState('');
  const [bio, setBio] = useState('');
  const [fotoUrl, setFotoUrl] = useState('');
  const [fotoPreview, setFotoPreview] = useState('');
  const [fotoUploading, setFotoUploading] = useState(false);
  const [fotoError, setFotoError] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [selectedEmoji, setSelectedEmoji] = useState('😊');
  const [saved, setSaved] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [viewingPhotoUrl, setViewingPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading) return;
    const timer = setTimeout(() => setTimedOut(true), 3000);
    return () => clearTimeout(timer);
  }, [isLoading]);

  useEffect(() => {
    if (perfil) {
      const p = perfil as any;
      setNombre(p.nombre || user?.nombre || '');
      setCentro(p.centro ? String(p.centro) : '');
      setPrograma(p.programa || '');
      setFicha(p.ficha || '');
      setJornada(p.jornada || '');
      setBio(p.bio || '');
      setSelectedInterests(p.intereses || []);
      setSelectedEmoji(p.avatarEmoji || p.avatar_emoji || '😊');
      const foto = p.fotoUrl || p.foto_url || '';
      setFotoUrl(foto);
      setFotoPreview(foto);
    }
  }, [perfil, user]);

  const toggleInterest = (interest: string) => {
    setSelectedInterests(prev =>
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  const handlePickImage = () => {
    setFotoError('');
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      openImagePickerAndUpload({
        onProgress: (loading) => setFotoUploading(loading),
        onPreview: (dataUrl) => setFotoPreview(dataUrl),
        onSuccess: (secureUrl) => {
          setFotoUrl(secureUrl);
          setFotoPreview(secureUrl);
          setFotoError('');
        },
        onError: (msg) => {
          setFotoError(msg);
          // Si falla, limpiar preview base64 para no guardar base64
          setFotoPreview(fotoUrl); // restaurar la URL previa válida
        },
      });
    } else {
      Alert.alert(
        'Foto de perfil',
        'Pega la URL pública de tu imagen en el campo de abajo.',
        [{ text: 'Entendido' }]
      );
    }
  };

  const handleSave = async () => {
    if (nombre.trim().length < 2) return;
    if (fotoUploading) return; // Esperar que termine el upload

    // Nunca guardar base64 en MongoDB
    let finalFoto: string | null = null;
    if (fotoUrl.trim() && !fotoUrl.startsWith('data:')) {
      finalFoto = fotoUrl.trim();
    }

    editMutation.mutate(
      {
        nombre: nombre.trim(),
        centro: centro.trim() ? parseInt(centro.trim(), 10) : undefined,
        programa: programa.trim() || undefined,
        ficha: ficha.trim() || undefined,
        jornada: jornada.trim() || undefined,
        bio: bio.trim() || null,
        intereses: selectedInterests,
        avatarEmoji: selectedEmoji,
        fotoUrl: finalFoto,
        foto_url: finalFoto,
      },
      {
        onSuccess: async (data: any) => {
          setEditing(false);
          setSaved(true);
          setFotoError('');
          if (data && user) {
            const token = await AsyncStorage.getItem('jwt_token');
            if (token) {
              await signIn(token, {
                id: user.id,
                correo: user.correo,
                nombre: data.nombre || user.nombre,
                rol: user.rol,
              });
            }
          }
          setTimeout(() => setSaved(false), 2500);
        },
      }
    );
  };

  const handleSignOut = () => {
    signOut();
  };

  if (isLoading && !timedOut) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>Cargando perfil…</Text>
      </View>
    );
  }

  const p = perfil as any;
  const rolLabel = p?.rol
    ? p.rol.charAt(0).toUpperCase() + p.rol.slice(1)
    : user?.rol || '';

  const displayFoto = fotoPreview || p?.fotoUrl || p?.foto_url || '';

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Mi Perfil</Text>
          {!editing ? (
            <TouchableOpacity
              style={[styles.editBtn, { backgroundColor: 'rgba(57,169,0,0.12)', borderColor: 'rgba(57,169,0,0.3)' }]}
              onPress={() => setEditing(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.editBtnText}>✏️ Editar</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.cancelBtn, { backgroundColor: colors.chipBg }]}
              onPress={() => setEditing(false)}
              activeOpacity={0.8}
            >
              <Text style={[styles.cancelBtnText, { color: colors.textSub }]}>Cancelar</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Success message */}
        {saved && (
          <View style={styles.savedBanner}>
            <Text style={styles.savedText}>✅ Perfil actualizado correctamente</Text>
          </View>
        )}

        {/* Avatar + Photo + Name */}
        <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {displayFoto ? (
            <TouchableOpacity
              onPress={editing ? handlePickImage : () => setViewingPhotoUrl(displayFoto)}
              activeOpacity={0.8}
              style={styles.photoContainer}
            >
              <Image
                source={{ uri: displayFoto }}
                style={styles.profilePhoto}
                resizeMode="cover"
              />
              {editing && (
                <View style={styles.photoOverlay}>
                  <Text style={styles.photoOverlayText}>📷 Cambiar</Text>
                </View>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={editing ? handlePickImage : undefined}
              activeOpacity={editing ? 0.7 : 1}
              style={styles.avatarLarge}
            >
              <Text style={styles.avatarEmojiLarge}>{selectedEmoji}</Text>
              {editing && (
                <View style={styles.photoOverlaySmall}>
                  <Text style={styles.photoOverlayTextSmall}>📷</Text>
                </View>
              )}
            </TouchableOpacity>
          )}

          {editing ? (
            <>
              <View style={styles.photoUrlSection}>
                {/* Botón de subida */}
                <TouchableOpacity
                  style={[styles.pickPhotoBtn, fotoUploading && styles.pickPhotoBtnDisabled]}
                  onPress={fotoUploading ? undefined : handlePickImage}
                  activeOpacity={fotoUploading ? 1 : 0.8}
                >
                  {fotoUploading ? (
                    <View style={styles.uploadingRow}>
                      <ActivityIndicator size="small" color={ACCENT} style={{ marginRight: 8 }} />
                      <Text style={styles.pickPhotoBtnText}>Subiendo a Cloudinary…</Text>
                    </View>
                  ) : (
                    <Text style={styles.pickPhotoBtnText}>
                      {Platform.OS === 'web' ? '📁 Seleccionar foto (JPG/PNG/WebP · máx 3 MB)' : '📷 Cambiar foto'}
                    </Text>
                  )}
                </TouchableOpacity>

                {/* Error de validación / upload */}
                {fotoError ? (
                  <View style={styles.fotoErrorBanner}>
                    <Text style={styles.fotoErrorText}>⚠️ {fotoError}</Text>
                  </View>
                ) : null}

                <Text style={[styles.photoUrlHint, { color: colors.textMuted }]}>O pega una URL pública (https://…):</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.inputBorder }]}
                  value={fotoUrl.startsWith('data:') ? '' : fotoUrl}
                  onChangeText={(text) => {
                    setFotoUrl(text);
                    setFotoPreview(text);
                    setFotoError('');
                  }}
                  placeholder="https://ejemplo.com/foto.jpg"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!fotoUploading}
                />

                {displayFoto && !fotoUploading ? (
                  <TouchableOpacity
                    style={styles.removePhotoBtn}
                    onPress={() => {
                      setFotoUrl('');
                      setFotoPreview('');
                      setFotoError('');
                    }}
                  >
                    <Text style={styles.removePhotoText}>🗑️ Quitar foto (usar avatar emoji)</Text>
                  </TouchableOpacity>
                ) : null}
              </View>

              <Text style={[styles.fieldLabel, { color: colors.textSub }]}>Nombre</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.inputBorder }]}
                value={nombre}
                onChangeText={setNombre}
                maxLength={80}
                placeholder="Tu nombre"
                placeholderTextColor={colors.textMuted}
              />
            </>
          ) : (
            <>
              <Text style={[styles.profileName, { color: colors.text }]}>{p?.nombre || user?.nombre}</Text>
              <View style={styles.rolBadge}>
                <Text style={styles.rolText}>{rolLabel}</Text>
              </View>
            </>
          )}
        </View>

        {/* Info Card */}
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <InfoRow icon="📧" label="Correo" value={p?.correo || user?.correo || '—'} />

          {editing ? (
            <>
              <Text style={[styles.fieldLabel, { color: colors.textSub, marginTop: 0 }]}>Centro (Requerido para parches)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.inputBorder }]}
                value={centro}
                onChangeText={setCentro}
                keyboardType="numeric"
                placeholder="Ej: 11303"
                placeholderTextColor={colors.textMuted}
              />
              <Text style={[styles.fieldLabel, { color: colors.textSub }]}>Programa</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.inputBorder }]}
                value={programa}
                onChangeText={setPrograma}
                placeholder="Ej: ADSO"
                placeholderTextColor={colors.textMuted}
              />
              <Text style={[styles.fieldLabel, { color: colors.textSub }]}>Ficha</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.inputBorder }]}
                value={ficha}
                onChangeText={setFicha}
                keyboardType="numeric"
                maxLength={8}
                placeholder="Ej: 2654321"
                placeholderTextColor={colors.textMuted}
              />
              <Text style={[styles.fieldLabel, { color: colors.textSub }]}>Jornada</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.inputBorder }]}
                value={jornada}
                onChangeText={setJornada}
                placeholder="manana, tarde, noche, virtual"
                placeholderTextColor={colors.textMuted}
              />
            </>
          ) : (
            <>
              {p?.programa && <InfoRow icon="📚" label="Programa" value={p.programa} />}
              {p?.ficha && <InfoRow icon="🏷️" label="Ficha" value={p.ficha} />}
              {p?.jornada && <InfoRow icon="🕐" label="Jornada" value={p.jornada} />}
              {p?.centro && <InfoRow icon="🏫" label="Centro" value={String(p.centro)} />}
            </>
          )}
        </View>

        {/* Avatar Emoji picker (editing) */}
        {editing && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Elige tu avatar emoji</Text>
            <View style={styles.emojiGrid}>
              {EMOJIS.map(e => (
                <TouchableOpacity
                  key={e}
                  style={[styles.emojiBtn, { backgroundColor: colors.chipBg, borderColor: colors.inputBorder }, selectedEmoji === e && styles.emojiBtnActive]}
                  onPress={() => setSelectedEmoji(e)}
                >
                  <Text style={styles.emojiBtnText}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Bio */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Bio</Text>
          {editing ? (
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.inputBorder, height: 80, textAlignVertical: 'top' }]}
              value={bio}
              onChangeText={setBio}
              maxLength={400}
              multiline
              placeholder="Cuéntales algo sobre ti…"
              placeholderTextColor={colors.textMuted}
            />
          ) : (
            <Text style={[styles.bioText, { backgroundColor: colors.card, borderColor: colors.cardBorder, color: colors.textSub }]}>
              {p?.bio || 'Aún no has agregado una bio. ¡Edita tu perfil para contarles sobre ti!'}
            </Text>
          )}
        </View>

        {/* Intereses */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Intereses</Text>
          <View style={styles.interestsGrid}>
            {INTERESES_OPCIONES.map(interest => {
              const selected = selectedInterests.includes(interest);
              return (
                <TouchableOpacity
                  key={interest}
                  style={[styles.interestChip, { backgroundColor: colors.chipBg, borderColor: colors.inputBorder }, selected && styles.interestChipActive]}
                  onPress={() => editing && toggleInterest(interest)}
                  activeOpacity={editing ? 0.7 : 1}
                >
                  <Text
                    style={[styles.interestText, { color: colors.textSub }, selected && styles.interestTextActive]}
                  >
                    {interest}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Save / Sign out */}
        {editing ? (
          (editMutation.isPending || fotoUploading) ? (
            <View style={{ alignItems: 'center', marginVertical: 20 }}>
              <ActivityIndicator color={ACCENT} />
              {fotoUploading && (
                <Text style={styles.uploadingLabel}>Subiendo foto a Cloudinary…</Text>
              )}
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.saveBtn, fotoUploading && styles.saveBtnDisabled]}
              onPress={handleSave}
              activeOpacity={0.85}
              disabled={fotoUploading}
            >
              <Text style={styles.saveBtnText}>Guardar cambios</Text>
            </TouchableOpacity>
          )
        ) : (
          <View style={{ gap: 12 }}>
            {/* Toggle tema */}
            <TouchableOpacity
              style={styles.themeBtn}
              onPress={toggleTheme}
              activeOpacity={0.8}
              accessibilityLabel={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            >
              <Text style={styles.themeBtnIcon}>{isDark ? '☀️' : '🌙'}</Text>
              <Text style={[styles.themeBtnText, { color: colors.accent }]}>
                {isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.signOutBtn}
              onPress={handleSignOut}
              activeOpacity={0.8}
            >
              <Text style={styles.signOutText}>Cerrar sesión</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Crédito del creador */}
        <Text style={[styles.credit, { color: colors.textMuted }]}>Creado por Miguel Toncel Herrera</Text>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Visor Modal de Foto Completa */}
      <FotoViewerModal
        visible={!!viewingPhotoUrl}
        fotoUrl={viewingPhotoUrl}
        onClose={() => setViewingPhotoUrl(null)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    padding: 24,
    paddingTop: Platform.OS === 'web' ? 95 : 32,
    maxWidth: 840,
    width: '100%',
    alignSelf: 'center',
  },
  center: {
    flex: 1,
    justifyContent: 'center', alignItems: 'center',
  },
  loadingText: { fontSize: 15, marginTop: 16 },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 24,
  },
  headerTitle: { fontSize: 24, fontWeight: '800' },
  editBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1,
  },
  editBtnText: { color: ACCENT, fontWeight: '600', fontSize: 14 },
  cancelBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
  },
  cancelBtnText: { fontWeight: '600', fontSize: 14 },

  // Saved
  savedBanner: {
    backgroundColor: 'rgba(95,224,180,0.12)',
    padding: 12, borderRadius: 10, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(95,224,180,0.3)',
  },
  savedText: { color: SUCCESS, fontWeight: '600', textAlign: 'center', fontSize: 14 },

  // Profile card
  profileCard: {
    borderRadius: 20, padding: 24,
    alignItems: 'center', borderWidth: 1,
    marginBottom: 16,
  },

  // Photo
  photoContainer: {
    width: 104, height: 104, borderRadius: 52,
    overflow: 'hidden', marginBottom: 16,
    borderWidth: 3, borderColor: ACCENT,
  },
  profilePhoto: {
    width: '100%', height: '100%',
  },
  photoOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)', paddingVertical: 4,
    alignItems: 'center',
  },
  photoOverlayText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  photoOverlaySmall: {
    position: 'absolute', bottom: -2, right: -2,
    backgroundColor: ACCENT, width: 28, height: 28,
    borderRadius: 14, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: 'transparent',
  },
  photoOverlayTextSmall: { fontSize: 13 },
  photoUrlSection: {
    width: '100%', marginBottom: 14,
  },
  pickPhotoBtn: {
    backgroundColor: 'rgba(255,107,74,0.15)',
    paddingVertical: 10, paddingHorizontal: 16,
    borderRadius: 10, alignItems: 'center', marginBottom: 8,
    borderWidth: 1, borderColor: 'rgba(255,107,74,0.3)',
  },
  pickPhotoBtnDisabled: {
    opacity: 0.6,
  },
  pickPhotoBtnText: { color: ACCENT, fontWeight: '700', fontSize: 14 },
  uploadingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  },
  uploadingLabel: {
    color: '#8D83A0', fontSize: 13, marginTop: 8, textAlign: 'center',
  },
  fotoErrorBanner: {
    backgroundColor: 'rgba(255, 91, 110, 0.12)',
    borderWidth: 1, borderColor: 'rgba(255, 91, 110, 0.3)',
    borderRadius: 8, padding: 10, marginBottom: 8,
  },
  fotoErrorText: {
    color: '#FF5B6E', fontSize: 13, fontWeight: '600',
  },
  photoUrlHint: { color: '#786E8A', fontSize: 12, marginBottom: 6 },
  removePhotoBtn: {
    marginTop: 8, paddingVertical: 6, alignItems: 'center',
  },
  removePhotoText: { color: '#FF5B6E', fontSize: 13, fontWeight: '600' },

  avatarLarge: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: 'rgba(255,107,74,0.15)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: ACCENT, marginBottom: 16,
  },
  avatarEmojiLarge: { fontSize: 42 },
  profileName: { fontSize: 22, fontWeight: '800' },
  rolBadge: {
    backgroundColor: 'rgba(255,107,74,0.12)',
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8, marginTop: 8,
  },
  rolText: { color: ACCENT, fontSize: 13, fontWeight: '700' },

  // Info card
  infoCard: {
    borderRadius: 14, padding: 16,
    borderWidth: 1, marginBottom: 16, gap: 12,
  },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  infoIcon: { fontSize: 16 },
  infoLabel: { fontSize: 13, color: '#786E8A', fontWeight: '600', width: 80 },
  infoValue: { fontSize: 14, color: '#B9B1C9', flex: 1 },

  // Section
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 16, fontWeight: '700', marginBottom: 12,
  },

  // Form
  fieldLabel: {
    fontSize: 13, fontWeight: '600',
    marginBottom: 6, marginTop: 12, alignSelf: 'flex-start',
  },
  input: {
    fontSize: 15,
    borderWidth: 1,
    padding: 13, borderRadius: 10, width: '100%',
  },

  // Emoji picker
  emojiGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
  },
  emojiBtn: {
    width: 48, height: 48, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1,
  },
  emojiBtnActive: { borderColor: ACCENT, backgroundColor: 'rgba(57,169,0,0.15)' },
  emojiBtnText: { fontSize: 24 },

  // Bio
  bioText: {
    fontSize: 14, lineHeight: 21,
    padding: 16, borderRadius: 14,
    borderWidth: 1, overflow: 'hidden',
  },

  // Interests
  interestsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
  },
  interestChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 16, borderWidth: 1,
  },
  interestChipActive: {
    borderColor: ACCENT, backgroundColor: 'rgba(57,169,0,0.12)',
  },
  interestText: { fontSize: 13, fontWeight: '500' },
  interestTextActive: { color: ACCENT },

  // Buttons
  saveBtn: {
    backgroundColor: ACCENT, padding: 16, borderRadius: 12,
    alignItems: 'center', marginTop: 8,
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  signOutBtn: {
    backgroundColor: 'rgba(255,91,110,0.1)',
    padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8,
    borderWidth: 1, borderColor: 'rgba(255,91,110,0.3)',
  },
  signOutText: { color: '#FF5B6E', fontSize: 16, fontWeight: '700' },
  themeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(57,169,0,0.08)',
    padding: 16, borderRadius: 12, marginTop: 8,
    borderWidth: 1, borderColor: 'rgba(57,169,0,0.25)',
  },
  themeBtnIcon: { fontSize: 20 },
  themeBtnText: { color: '#39A900', fontSize: 15, fontWeight: '700' },
  credit: {
    marginTop: 28, textAlign: 'center',
    fontSize: 11, color: '#625975', fontStyle: 'italic',
  },
});

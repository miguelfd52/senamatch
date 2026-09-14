import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, TextInput,
  KeyboardAvoidingView, Platform, Alert
} from 'react-native';
import { useState, useEffect } from 'react';
import { useAuth } from '../app/context/AuthContext';
import { usePerfil, useEditarPerfil } from '../hooks/useParches';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ACCENT = '#FF6B4A';
const BG = '#16121D';
const CARD = '#1E1A2B';
const SUCCESS = '#5FE0B4';

const INTERESES_OPCIONES = [
  '🎮 Gaming', '⚽ Fútbol', '🎵 Música', '📚 Lectura',
  '🎬 Cine', '💻 Programación', '🎨 Arte', '📷 Fotografía',
  '🏋️ Gym', '🍳 Cocina', '✈️ Viajes', '🐱 Mascotas',
];

const EMOJIS = ['😊', '😎', '🤓', '🦊', '🐱', '🐶', '🦄', '🌟', '🔥', '🎯', '💪', '🎓'];

export default function ProfileScreen() {
  const { user, signOut, signIn } = useAuth();
  // retry: 1 para no reintentar infinitamente si la API falla
  const { data: perfil, isLoading } = usePerfil(user?.id || '');
  const editMutation = useEditarPerfil(user?.id || '');

  const [editing, setEditing] = useState(false);
  const [nombre, setNombre] = useState(user?.nombre || '');
  const [centro, setCentro] = useState('');
  const [programa, setPrograma] = useState('');
  const [ficha, setFicha] = useState('');
  const [jornada, setJornada] = useState('');
  const [bio, setBio] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [selectedEmoji, setSelectedEmoji] = useState('😊');
  const [saved, setSaved] = useState(false);
  // Timeout: si en 3s no carga la API, mostramos pantalla con datos del contexto
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!isLoading) return;
    const timer = setTimeout(() => setTimedOut(true), 3000);
    return () => clearTimeout(timer);
  }, [isLoading]);

  // Populate form cuando lleguen datos del API
  useEffect(() => {
    if (perfil) {
      setNombre((perfil as any).nombre || user?.nombre || '');
      setCentro((perfil as any).centro ? String((perfil as any).centro) : '');
      setPrograma((perfil as any).programa || '');
      setFicha((perfil as any).ficha || '');
      setJornada((perfil as any).jornada || '');
      setBio((perfil as any).bio || '');
      setSelectedInterests((perfil as any).intereses || []);
      setSelectedEmoji((perfil as any).avatarEmoji || '😊');
    }
  }, [perfil]);

  const toggleInterest = (interest: string) => {
    setSelectedInterests(prev =>
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  const handleSave = async () => {
    if (nombre.trim().length < 2) return;

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
      },
      {
        onSuccess: async (data: any) => {
          setEditing(false);
          setSaved(true);
          // Update the stored user data so the context has fresh info
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
          setTimeout(() => setSaved(false), 2000);
        },
      }
    );
  };

  const handleSignOut = () => {
    signOut();
  };

  // Solo mostrar spinner durante los primeros 3 segundos; después mostramos lo que tengamos
  if (isLoading && !timedOut) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={styles.loadingText}>Cargando perfil…</Text>
      </View>
    );
  }

  const p = perfil as any;
  const rolLabel = p?.rol
    ? p.rol.charAt(0).toUpperCase() + p.rol.slice(1)
    : user?.rol || '';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Mi Perfil</Text>
          {!editing ? (
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => setEditing(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.editBtnText}>✏️ Editar</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => setEditing(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Success message */}
        {saved && (
          <View style={styles.savedBanner}>
            <Text style={styles.savedText}>✅ Perfil actualizado</Text>
          </View>
        )}

        {/* Avatar + Name */}
        <View style={styles.profileCard}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarEmojiLarge}>{selectedEmoji}</Text>
          </View>
          {editing ? (
            <>
              <Text style={styles.fieldLabel}>Nombre</Text>
              <TextInput
                style={styles.input}
                value={nombre}
                onChangeText={setNombre}
                maxLength={80}
                placeholder="Tu nombre"
                placeholderTextColor="#786E8A"
              />
            </>
          ) : (
            <>
              <Text style={styles.profileName}>{p?.nombre || user?.nombre}</Text>
              <View style={styles.rolBadge}>
                <Text style={styles.rolText}>{rolLabel}</Text>
              </View>
            </>
          )}
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <InfoRow icon="📧" label="Correo" value={p?.correo || user?.correo || '—'} />
          
          {editing ? (
            <>
              <Text style={[styles.fieldLabel, { marginTop: 0 }]}>Centro (Requerido para parches)</Text>
              <TextInput
                style={styles.input}
                value={centro}
                onChangeText={setCentro}
                keyboardType="numeric"
                placeholder="Ej: 11303"
                placeholderTextColor="#786E8A"
              />
              <Text style={styles.fieldLabel}>Programa</Text>
              <TextInput
                style={styles.input}
                value={programa}
                onChangeText={setPrograma}
                placeholder="Ej: ADSO"
                placeholderTextColor="#786E8A"
              />
              <Text style={styles.fieldLabel}>Ficha</Text>
              <TextInput
                style={styles.input}
                value={ficha}
                onChangeText={setFicha}
                keyboardType="numeric"
                maxLength={8}
                placeholder="Ej: 2654321"
                placeholderTextColor="#786E8A"
              />
              <Text style={styles.fieldLabel}>Jornada</Text>
              <TextInput
                style={styles.input}
                value={jornada}
                onChangeText={setJornada}
                placeholder="manana, tarde, noche, virtual"
                placeholderTextColor="#786E8A"
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
            <Text style={styles.sectionTitle}>Elige tu avatar</Text>
            <View style={styles.emojiGrid}>
              {EMOJIS.map(e => (
                <TouchableOpacity
                  key={e}
                  style={[styles.emojiBtn, selectedEmoji === e && styles.emojiBtnActive]}
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
          <Text style={styles.sectionTitle}>Bio</Text>
          {editing ? (
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              value={bio}
              onChangeText={setBio}
              maxLength={400}
              multiline
              placeholder="Cuéntales algo sobre ti…"
              placeholderTextColor="#786E8A"
            />
          ) : (
            <Text style={styles.bioText}>
              {p?.bio || 'Aún no has agregado una bio. ¡Edita tu perfil para contarles sobre ti!'}
            </Text>
          )}
        </View>

        {/* Intereses */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Intereses</Text>
          <View style={styles.interestsGrid}>
            {INTERESES_OPCIONES.map(interest => {
              const selected = selectedInterests.includes(interest);
              return (
                <TouchableOpacity
                  key={interest}
                  style={[styles.interestChip, selected && styles.interestChipActive]}
                  onPress={() => editing && toggleInterest(interest)}
                  activeOpacity={editing ? 0.7 : 1}
                >
                  <Text
                    style={[styles.interestText, selected && styles.interestTextActive]}
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
          editMutation.isPending ? (
            <ActivityIndicator color={ACCENT} style={{ marginVertical: 20 }} />
          ) : (
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSave}
              activeOpacity={0.85}
            >
              <Text style={styles.saveBtnText}>Guardar cambios</Text>
            </TouchableOpacity>
          )
        ) : (
          <TouchableOpacity
            style={styles.signOutBtn}
            onPress={handleSignOut}
            activeOpacity={0.8}
          >
            <Text style={styles.signOutText}>Cerrar sesión</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoIcon}>{icon}</Text>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  content: {
    padding: 24,
    paddingTop: Platform.OS === 'web' ? 95 : 32,
    maxWidth: 840,
    width: '100%',
    alignSelf: 'center',
  },
  center: {
    flex: 1, backgroundColor: BG,
    justifyContent: 'center', alignItems: 'center',
  },
  loadingText: { color: '#786E8A', marginTop: 16, fontSize: 15 },

  // Header
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 24,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#F0ECF6' },
  editBtn: {
    backgroundColor: 'rgba(255,107,74,0.12)',
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
  },
  editBtnText: { color: ACCENT, fontWeight: '600', fontSize: 14 },
  cancelBtn: {
    backgroundColor: '#282234',
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
  },
  cancelBtnText: { color: '#786E8A', fontWeight: '600', fontSize: 14 },

  // Saved
  savedBanner: {
    backgroundColor: 'rgba(95,224,180,0.12)',
    padding: 12, borderRadius: 10, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(95,224,180,0.3)',
  },
  savedText: { color: SUCCESS, fontWeight: '600', textAlign: 'center', fontSize: 14 },

  // Profile card
  profileCard: {
    backgroundColor: CARD, borderRadius: 20, padding: 24,
    alignItems: 'center', borderWidth: 1, borderColor: '#2D2640',
    marginBottom: 16,
  },
  avatarLarge: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,107,74,0.15)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: ACCENT, marginBottom: 16,
  },
  avatarEmojiLarge: { fontSize: 40 },
  profileName: { fontSize: 22, fontWeight: '800', color: '#F0ECF6' },
  rolBadge: {
    backgroundColor: 'rgba(255,107,74,0.12)',
    paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8, marginTop: 8,
  },
  rolText: { color: ACCENT, fontSize: 13, fontWeight: '700' },

  // Info card
  infoCard: {
    backgroundColor: CARD, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#2D2640', marginBottom: 16, gap: 12,
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
    fontSize: 16, fontWeight: '700', color: '#F0ECF6', marginBottom: 12,
  },

  // Form
  fieldLabel: {
    color: '#B9B1C9', fontSize: 13, fontWeight: '600',
    marginBottom: 6, marginTop: 12, alignSelf: 'flex-start',
  },
  input: {
    backgroundColor: '#282234', color: '#F0ECF6', fontSize: 15,
    borderWidth: 1, borderColor: '#3A3247',
    padding: 13, borderRadius: 10, width: '100%',
  },

  // Emoji picker
  emojiGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 10,
  },
  emojiBtn: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: '#282234', justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#3A3247',
  },
  emojiBtnActive: { borderColor: ACCENT, backgroundColor: 'rgba(255,107,74,0.15)' },
  emojiBtnText: { fontSize: 24 },

  // Bio
  bioText: {
    fontSize: 14, color: '#786E8A', lineHeight: 21,
    backgroundColor: CARD, padding: 16, borderRadius: 14,
    borderWidth: 1, borderColor: '#2D2640', overflow: 'hidden',
  },

  // Interests
  interestsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
  },
  interestChip: {
    backgroundColor: '#282234', paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 16, borderWidth: 1, borderColor: '#3A3247',
  },
  interestChipActive: {
    borderColor: ACCENT, backgroundColor: 'rgba(255,107,74,0.12)',
  },
  interestText: { color: '#786E8A', fontSize: 13, fontWeight: '500' },
  interestTextActive: { color: ACCENT },

  // Buttons
  saveBtn: {
    backgroundColor: ACCENT, padding: 16, borderRadius: 12,
    alignItems: 'center', marginTop: 8,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  signOutBtn: {
    backgroundColor: 'rgba(255,91,110,0.1)',
    padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 8,
    borderWidth: 1, borderColor: 'rgba(255,91,110,0.3)',
  },
  signOutText: { color: '#FF5B6E', fontSize: 16, fontWeight: '700' },
});

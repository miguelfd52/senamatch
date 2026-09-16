import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, Modal, TextInput,
  RefreshControl, Platform, KeyboardAvoidingView, Alert
} from 'react-native';
import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../app/context/AuthContext';
import { useFeedParches, useCrearParche, useUnirmeAlParche } from '../hooks/useParches';
import { api } from '../lib/api';
import PublicProfileModal from './PublicProfileModal';

const ACCENT = '#39A900';
const BG = '#0F0C18';
const CARD = '#161B22';
const CARD_BORDER = '#263238';
const SUCCESS = '#00E5A3';
const DANGER = '#FF5B6E';

const TIPOS_PARCHE = [
  { key: 'desayuno', emoji: '🍳', label: 'Desayuno' },
  { key: 'almuerzo', emoji: '🍽️', label: 'Almuerzo' },
  { key: 'cafe', emoji: '☕', label: 'Café' },
  { key: 'estudio', emoji: '📚', label: 'Estudio' },
  { key: 'deporte', emoji: '⚽', label: 'Deporte' },
  { key: 'integracion', emoji: '🎉', label: 'Integración' },
  { key: 'cultural', emoji: '🎭', label: 'Cultural' },
  { key: 'otro', emoji: '✨', label: 'Otro' },
];

export default function ParchesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: parches, isLoading, isError, refetch } = useFeedParches();
  const crearMutation = useCrearParche();
  const unirseMutation = useUnirmeAlParche();

  const [showModal, setShowModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  // Form state
  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState('cafe');
  const [lugar, setLugar] = useState('');
  const [cupo, setCupo] = useState('10');
  const [descripcion, setDescripcion] = useState('');
  const [formError, setFormError] = useState('');

  // Perfil público modal
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  // Modal ver participantes / gestión anfitrión
  const [selectedParcheParaGestion, setSelectedParcheParaGestion] = useState<any | null>(null);

  useEffect(() => {
    if (!isLoading) { setTimedOut(false); return; }
    const t = setTimeout(() => setTimedOut(true), 8000);
    return () => clearTimeout(t);
  }, [isLoading]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleCrear = async () => {
    setFormError('');
    if (titulo.trim().length < 4) {
      setFormError('El título debe tener al menos 4 caracteres');
      return;
    }
    if (lugar.trim().length < 2) {
      setFormError('Ingresa el lugar de encuentro');
      return;
    }

    const cupoNum = parseInt(cupo, 10);
    if (isNaN(cupoNum) || cupoNum < 2) {
      setFormError('El cupo mínimo es 2 personas');
      return;
    }

    const inicio = new Date();
    inicio.setHours(inicio.getHours() + 1);

    crearMutation.mutate(
      {
        titulo: titulo.trim(),
        tipo,
        lugar: lugar.trim(),
        inicio: inicio.toISOString(),
        cupo: cupoNum,
        descripcion: descripcion.trim() || undefined,
      },
      {
        onSuccess: () => {
          setShowModal(false);
          resetForm();
        },
        onError: (e: any) => {
          setFormError(e?.message || 'Error al crear el parche');
        },
      }
    );
  };

  const resetForm = () => {
    setTitulo('');
    setTipo('cafe');
    setLugar('');
    setCupo('10');
    setDescripcion('');
    setFormError('');
  };

  const handleUnirse = (parcheId: string) => {
    unirseMutation.mutate({ activityId: parcheId });
  };

  const handleCancelarParche = async (parcheId: string) => {
    const doCancel = async () => {
      try {
        await api.post(`/parches/${parcheId}/cancelar`);
        setSelectedParcheParaGestion(null);
        refetch();
      } catch (err: any) {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.alert(err?.message || 'Error al cancelar');
        }
      }
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm('¿Seguro que deseas cancelar este parche? Se notificará a los participantes.')) {
        doCancel();
      }
    } else {
      Alert.alert(
        'Cancelar parche',
        '¿Seguro que deseas cancelar este parche? Se notificará a todos los participantes.',
        [
          { text: 'No', style: 'cancel' },
          { text: 'Sí, cancelar', style: 'destructive', onPress: doCancel }
        ]
      );
    }
  };

  const handleExpulsarParticipante = async (parcheId: string, participantId: string) => {
    try {
      await api.post(`/parches/${parcheId}/expulsar`, { targetUserId: participantId });
      refetch();
      setSelectedParcheParaGestion((prev: any) => {
        if (!prev) return null;
        return {
          ...prev,
          participantes: (prev.participantes || []).filter((p: any) => p.id !== participantId)
        };
      });
    } catch (err: any) {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(err?.message || 'Error al expulsar');
      }
    }
  };

  const parchesList = Array.isArray(parches) ? parches : [];
  const abiertos = parchesList.filter((p: any) => p.estado !== 'cancelado');

  if (isError || timedOut) {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 40, marginBottom: 16 }}>😕</Text>
        <Text style={[styles.loadingText, { fontSize: 16, color: '#F0ECF6', marginBottom: 8 }]}>
          No se pudieron cargar los parches
        </Text>
        <Text style={styles.loadingText}>Verifica que el servidor esté activo</Text>
        <TouchableOpacity
          style={[styles.createBtn, { marginTop: 20 }]}
          onPress={() => { setTimedOut(false); refetch(); }}
        >
          <Text style={styles.createBtnText}>🔄 Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={styles.loadingText}>Cargando parches de la comunidad…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Parches</Text>
          <Text style={styles.headerSubtitle}>Actividades grupales para la comunidad SENA</Text>
        </View>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => setShowModal(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.createBtnText}>+ Crear parche</Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      <ScrollView
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={ACCENT}
            colors={[ACCENT]}
          />
        }
      >
        {abiertos.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🎯</Text>
            <Text style={styles.emptyTitle}>Sin parches activos en este momento</Text>
            <Text style={styles.emptySubtitle}>
              Sé el primero en armar un parche de estudio, café o deporte para tu comunidad.
            </Text>
            <TouchableOpacity
              style={[styles.createBtn, { marginTop: 16 }]}
              onPress={() => setShowModal(true)}
            >
              <Text style={styles.createBtnText}>✨ Crear el primer parche</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.cardsGrid}>
            {abiertos.map((parche: any) => {
              const tipoInfo = TIPOS_PARCHE.find(t => t.key === parche.tipo);
              const yaEstoy = (parche.participantes || []).some(
                (p: any) => String(p.id) === String(user?.id)
              );
              const cupoOcupado = (parche.participantes || []).length;
              const fechaInicio = new Date(parche.inicio);
              const esAnfitrion = String(parche.anfitrion) === String(user?.id);

              return (
                <View key={parche.id} style={styles.parcheCard}>
                  {/* Tipo icon + title */}
                  <View style={styles.parcheHeader}>
                    <View style={styles.tipoIcon}>
                      <Text style={styles.tipoEmoji}>
                        {tipoInfo?.emoji || '✨'}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.parcheTitulo} numberOfLines={2}>
                        {parche.titulo}
                      </Text>
                      <Text style={styles.parcheTipo}>
                        {tipoInfo?.label || parche.tipo}
                      </Text>
                    </View>
                  </View>

                  {/* Details */}
                  <View style={styles.parcheDetails}>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailIcon}>📍</Text>
                      <Text style={styles.detailText}>{parche.lugar}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailIcon}>📅</Text>
                      <Text style={styles.detailText}>
                        {fechaInicio.toLocaleDateString('es-CO', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                        })}{' '}
                        ·{' '}
                        {fechaInicio.toLocaleTimeString('es-CO', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailIcon}>👥</Text>
                      <Text style={styles.detailText}>
                        {cupoOcupado} / {parche.cupo} cupos
                      </Text>
                    </View>

                    {/* Anfitrión clickable */}
                    {parche.anfitrionNombre ? (
                      <TouchableOpacity
                        style={styles.detailRow}
                        onPress={() => setSelectedProfileId(parche.anfitrion)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.detailIcon}>👤</Text>
                        <Text style={styles.detailText}>
                          Por <Text style={styles.anfitrionLink}>{parche.anfitrionNombre}</Text>
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {parche.descripcion ? (
                    <Text style={styles.parcheDesc} numberOfLines={2}>
                      {parche.descripcion}
                    </Text>
                  ) : null}

                  {/* Botones de acción */}
                  <View style={styles.parcheActionsRow}>
                    {esAnfitrion ? (
                      <View style={styles.anfitrionActionBox}>
                        <TouchableOpacity
                          style={styles.btnGestionar}
                          onPress={() => setSelectedParcheParaGestion(parche)}
                        >
                          <Text style={styles.btnGestionarText}>⚙️ Administrar parche</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.btnChatParche}
                          onPress={() => router.push('/chats')}
                        >
                          <Text style={styles.btnChatParcheText}>💬 Chat</Text>
                        </TouchableOpacity>
                      </View>
                    ) : yaEstoy ? (
                      <View style={styles.joinedActionBox}>
                        <View style={styles.joinedBadge}>
                          <Text style={styles.joinedText}>✅ Ya estás dentro</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.btnChatParche}
                          onPress={() => router.push('/chats')}
                        >
                          <Text style={styles.btnChatParcheText}>💬 Chat del parche</Text>
                        </TouchableOpacity>
                      </View>
                    ) : cupoOcupado >= parche.cupo ? (
                      <View style={styles.statusBadge}>
                        <Text style={styles.statusText}>Sin cupos disponibles</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.joinBtn}
                        onPress={() => handleUnirse(parche.id)}
                        activeOpacity={0.85}
                        disabled={unirseMutation.isPending}
                      >
                        <Text style={styles.joinBtnText}>
                          {unirseMutation.isPending ? 'Uniéndote…' : '🎯 Unirme al parche'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* MODAL CREAR PARCHE (Responsivo de 320px en adelante) */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Crear nuevo parche</Text>
              <TouchableOpacity onPress={() => { setShowModal(false); resetForm(); }} style={{ padding: 4 }}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              <Text style={styles.fieldLabel}>Título del parche</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: Repaso de algoritmos o café en la biblioteca"
                placeholderTextColor="#786E8A"
                value={titulo}
                onChangeText={setTitulo}
                maxLength={80}
              />

              <Text style={styles.fieldLabel}>Tipo de actividad</Text>
              <View style={styles.tiposGrid}>
                {TIPOS_PARCHE.map(t => (
                  <TouchableOpacity
                    key={t.key}
                    style={[styles.tipoChip, tipo === t.key && styles.tipoChipActive]}
                    onPress={() => setTipo(t.key)}
                  >
                    <Text style={styles.tipoChipEmoji}>{t.emoji}</Text>
                    <Text style={[styles.tipoChipText, tipo === t.key && styles.tipoChipTextActive]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Lugar de encuentro</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: Cafetería Bloque A o Cancha de fútbol"
                placeholderTextColor="#786E8A"
                value={lugar}
                onChangeText={setLugar}
                maxLength={80}
              />

              <Text style={styles.fieldLabel}>Cupo máximo de asistentes</Text>
              <TextInput
                style={styles.input}
                placeholder="10"
                placeholderTextColor="#786E8A"
                value={cupo}
                onChangeText={setCupo}
                keyboardType="numeric"
              />

              <Text style={styles.fieldLabel}>Descripción / Detalles adicionales</Text>
              <TextInput
                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                placeholder="Indica qué llevar, cómo reconocerse o de qué se hablará…"
                placeholderTextColor="#786E8A"
                value={descripcion}
                onChangeText={setDescripcion}
                multiline
                maxLength={400}
              />

              {formError ? <Text style={styles.formError}>{formError}</Text> : null}

              {crearMutation.isPending ? (
                <ActivityIndicator color={ACCENT} style={{ marginVertical: 16 }} />
              ) : (
                <TouchableOpacity
                  style={styles.submitBtn}
                  onPress={handleCrear}
                  activeOpacity={0.85}
                >
                  <Text style={styles.submitBtnText}>Publicar parche 🎯</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL GESTIÓN DE ANFITRIÓN */}
      {selectedParcheParaGestion ? (
        <Modal
          visible={true}
          animationType="fade"
          transparent
          onRequestClose={() => setSelectedParcheParaGestion(null)}
        >
          <View style={styles.modalOverlayCenter}>
            <View style={styles.gestionModalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Administrar parche</Text>
                <TouchableOpacity onPress={() => setSelectedParcheParaGestion(null)} style={{ padding: 4 }}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.gestionParcheTitulo}>
                {selectedParcheParaGestion.titulo}
              </Text>

              <Text style={styles.fieldLabel}>Participantes actuales ({selectedParcheParaGestion.participantes?.length || 0}):</Text>

              <ScrollView style={{ maxHeight: 200, marginVertical: 10 }}>
                {(selectedParcheParaGestion.participantes || []).map((part: any) => {
                  const esAnf = part.id === selectedParcheParaGestion.anfitrion;
                  return (
                    <View key={part.id} style={styles.participantRow}>
                      <TouchableOpacity
                        onPress={() => setSelectedProfileId(part.id)}
                        style={{ flex: 1 }}
                      >
                        <Text style={styles.participantName}>
                          {esAnf ? '👑 Anfitrión (Tú)' : `Aprendiz (ID: ${part.id.slice(0, 8)}...)`}
                        </Text>
                      </TouchableOpacity>

                      {!esAnf && (
                        <TouchableOpacity
                          style={styles.btnExpulsar}
                          onPress={() => handleExpulsarParticipante(selectedParcheParaGestion.id, part.id)}
                        >
                          <Text style={styles.btnExpulsarText}>Expulsar</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </ScrollView>

              <TouchableOpacity
                style={styles.btnCancelarParche}
                onPress={() => handleCancelarParche(selectedParcheParaGestion.id)}
              >
                <Text style={styles.btnCancelarParcheText}>⚠️ Cancelar este parche</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      ) : null}

      {/* Modal Universal de Perfil Público */}
      <PublicProfileModal
        userId={selectedProfileId}
        visible={!!selectedProfileId}
        onClose={() => setSelectedProfileId(null)}
        onOpenChat={() => {
          setSelectedProfileId(null);
          router.push('/chats');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  center: {
    flex: 1, backgroundColor: BG,
    justifyContent: 'center', alignItems: 'center',
  },
  loadingText: { color: '#8D83A0', marginTop: 16, fontSize: 15 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'web' ? 95 : 32,
    paddingBottom: 16,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#F0ECF6' },
  headerSubtitle: { fontSize: 13, color: '#8D83A0', marginTop: 2 },
  createBtn: {
    backgroundColor: ACCENT,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: ACCENT,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 3,
  },
  createBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  // List
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    width: '100%',
  },

  // Empty
  emptyState: { alignItems: 'center', paddingVertical: 60, width: '100%' },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#F0ECF6', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#8D83A0', textAlign: 'center', maxWidth: 400 },

  // Parche card
  parcheCard: {
    backgroundColor: CARD,
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    flex: 1,
    minWidth: 320,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  parcheHeader: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  tipoIcon: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: 'rgba(57,169,0,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  tipoEmoji: { fontSize: 24 },
  parcheTitulo: { fontSize: 16, fontWeight: '700', color: '#F0ECF6' },
  parcheTipo: { fontSize: 12, color: '#8D83A0', marginTop: 2 },

  parcheDetails: { marginTop: 14, gap: 8 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailIcon: { fontSize: 14 },
  detailText: { fontSize: 13, color: '#B9B1C9' },
  anfitrionLink: { color: ACCENT, fontWeight: '700' },

  parcheDesc: {
    fontSize: 13, color: '#8D83A0', marginTop: 12,
    lineHeight: 19, fontStyle: 'italic',
  },

  parcheActionsRow: {
    marginTop: 14,
  },
  anfitrionActionBox: {
    flexDirection: 'row',
    gap: 10,
  },
  btnGestionar: {
    flex: 1,
    backgroundColor: '#1E252F',
    borderWidth: 1,
    borderColor: '#2D3748',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnGestionarText: {
    color: '#F0ECF6',
    fontWeight: '700',
    fontSize: 13,
  },
  btnChatParche: {
    backgroundColor: 'rgba(57,169,0,0.15)',
    borderWidth: 1,
    borderColor: ACCENT,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnChatParcheText: {
    color: ACCENT,
    fontWeight: '700',
    fontSize: 13,
  },
  joinedActionBox: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  joinedBadge: {
    flex: 1,
    backgroundColor: 'rgba(0, 229, 163, 0.12)',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  joinedText: {
    color: SUCCESS,
    fontWeight: '700',
    fontSize: 13,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#1E252F',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  statusText: { fontSize: 13, color: '#8D83A0', fontWeight: '600' },

  joinBtn: {
    backgroundColor: ACCENT,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: ACCENT,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 3,
  },
  joinBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  modalOverlayCenter: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center', alignItems: 'center', padding: 16,
  },
  modalContent: {
    backgroundColor: CARD, borderTopLeftRadius: 24,
    borderTopRightRadius: 24, padding: 24,
    maxHeight: '90%',
    borderTopWidth: 1, borderColor: CARD_BORDER,
    maxWidth: 600, width: '100%', alignSelf: 'center',
  },
  gestionModalContent: {
    backgroundColor: CARD, borderRadius: 20, padding: 22,
    maxWidth: 440, width: '100%',
    borderWidth: 1, borderColor: CARD_BORDER,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 18,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#F0ECF6' },
  modalClose: { fontSize: 20, color: '#8D83A0', fontWeight: '700' },

  fieldLabel: {
    color: '#B9B1C9', fontSize: 13,
    fontWeight: '600', marginBottom: 6, marginTop: 12,
  },
  input: {
    backgroundColor: '#1E252F', color: '#F0ECF6', fontSize: 14,
    borderWidth: 1, borderColor: '#2D3748',
    padding: 12, borderRadius: 10,
  },
  tiposGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4,
  },
  tipoChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#1E252F', paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1, borderColor: '#2D3748',
  },
  tipoChipActive: {
    borderColor: ACCENT, backgroundColor: 'rgba(57,169,0,0.15)',
  },
  tipoChipEmoji: { fontSize: 16 },
  tipoChipText: { fontSize: 13, color: '#8D83A0', fontWeight: '500' },
  tipoChipTextActive: { color: ACCENT, fontWeight: '700' },

  formError: {
    color: DANGER, fontSize: 13, textAlign: 'center',
    marginTop: 12,
  },
  submitBtn: {
    backgroundColor: ACCENT, padding: 15, borderRadius: 12,
    alignItems: 'center', marginTop: 20,
    shadowColor: ACCENT, shadowOpacity: 0.4, shadowRadius: 8, elevation: 3,
  },
  submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  gestionParcheTitulo: {
    fontSize: 16,
    fontWeight: '700',
    color: '#00E5A3',
    marginBottom: 8,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E252F',
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
  },
  participantName: {
    color: '#F0ECF6',
    fontSize: 13,
    fontWeight: '600',
  },
  btnExpulsar: {
    backgroundColor: 'rgba(255, 91, 110, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  btnExpulsarText: {
    color: DANGER,
    fontSize: 11,
    fontWeight: '700',
  },
  btnCancelarParche: {
    backgroundColor: 'rgba(255, 91, 110, 0.15)',
    borderWidth: 1,
    borderColor: DANGER,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },
  btnCancelarParcheText: {
    color: DANGER,
    fontWeight: '700',
    fontSize: 13,
  },
});

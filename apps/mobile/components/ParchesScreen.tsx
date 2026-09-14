import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, Modal, TextInput,
  RefreshControl, Platform, KeyboardAvoidingView
} from 'react-native';
import { useState, useCallback } from 'react';
import { useAuth } from '../app/context/AuthContext';
import { useFeedParches, useCrearParche, useUnirmeAlParche } from '../hooks/useParches';

const ACCENT = '#FF6B4A';
const BG = '#16121D';
const CARD = '#1E1A2B';
const SUCCESS = '#5FE0B4';

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
  const { user } = useAuth();
  const { data: parches, isLoading, refetch } = useFeedParches();
  const crearMutation = useCrearParche();
  const unirseMutation = useUnirmeAlParche();
  const [showModal, setShowModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Form state
  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState('cafe');
  const [lugar, setLugar] = useState('');
  const [cupo, setCupo] = useState('10');
  const [descripcion, setDescripcion] = useState('');
  const [formError, setFormError] = useState('');

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleCrear = async () => {
    setFormError('');
    if (titulo.trim().length < 5) {
      setFormError('El título debe tener al menos 5 caracteres');
      return;
    }
    if (lugar.trim().length < 3) {
      setFormError('Ingresa el lugar');
      return;
    }

    const cupoNum = parseInt(cupo, 10);
    if (isNaN(cupoNum) || cupoNum < 2) {
      setFormError('El cupo mínimo es 2');
      return;
    }

    // Start time: 1 hour from now
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

  const parchesList = Array.isArray(parches) ? parches : [];
  const abiertos = parchesList.filter((p: any) => p.estado !== 'cancelado');

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={styles.loadingText}>Cargando parches…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Parches</Text>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => setShowModal(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.createBtnText}>+ Crear</Text>
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
            <Text style={styles.emptyTitle}>Sin parches abiertos</Text>
            <Text style={styles.emptySubtitle}>
              Sé el primero en crear un parche para tu comunidad.
            </Text>
          </View>
        ) : (
          <View style={styles.cardsGrid}>
            {abiertos.map((parche: any) => {
              const tipoInfo = TIPOS_PARCHE.find(t => t.key === parche.tipo);
              const yaEstoy = (parche.participantes || []).some(
                (p: any) => p.id === user?.id
              );
              const cupoOcupado = (parche.participantes || []).length;
              const fechaInicio = new Date(parche.inicio);
              const esAnfitrion = parche.anfitrion === user?.id;

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
                  {parche.anfitrionNombre ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailIcon}>👤</Text>
                      <Text style={styles.detailText}>
                        Por <Text style={{ color: '#F0ECF6', fontWeight: '700' }}>{parche.anfitrionNombre}</Text>
                      </Text>
                    </View>
                  ) : null}
                </View>

                {parche.descripcion ? (
                  <Text style={styles.parcheDesc} numberOfLines={2}>
                    {parche.descripcion}
                  </Text>
                ) : null}

                {/* Action */}
                {esAnfitrion ? (
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>🏠 Tu parche</Text>
                  </View>
                ) : yaEstoy ? (
                  <View style={[styles.statusBadge, { backgroundColor: 'rgba(95,224,180,0.12)' }]}>
                    <Text style={[styles.statusText, { color: SUCCESS }]}>
                      ✅ Ya estás dentro
                    </Text>
                  </View>
                ) : cupoOcupado >= parche.cupo ? (
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>Sin cupos</Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.joinBtn}
                    onPress={() => handleUnirse(parche.id)}
                    activeOpacity={0.8}
                    disabled={unirseMutation.isPending}
                  >
                    <Text style={styles.joinBtnText}>Unirme</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
          </View>
        )}
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Create Modal */}
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
              <Text style={styles.modalTitle}>Crear parche</Text>
              <TouchableOpacity onPress={() => { setShowModal(false); resetForm(); }}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.fieldLabel}>Título</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: Cafecito después de clase"
                placeholderTextColor="#786E8A"
                value={titulo}
                onChangeText={setTitulo}
                maxLength={80}
              />

              <Text style={styles.fieldLabel}>Tipo</Text>
              <View style={styles.tiposGrid}>
                {TIPOS_PARCHE.map(t => (
                  <TouchableOpacity
                    key={t.key}
                    style={[styles.tipoChip, tipo === t.key && styles.tipoChipActive]}
                    onPress={() => setTipo(t.key)}
                  >
                    <Text style={styles.tipoChipEmoji}>{t.emoji}</Text>
                    <Text
                      style={[styles.tipoChipText, tipo === t.key && styles.tipoChipTextActive]}
                    >
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.fieldLabel}>Lugar</Text>
              <TextInput
                style={styles.input}
                placeholder="Ej: Cafetería del bloque 3"
                placeholderTextColor="#786E8A"
                value={lugar}
                onChangeText={setLugar}
                maxLength={80}
              />

              <Text style={styles.fieldLabel}>Cupo máximo</Text>
              <TextInput
                style={styles.input}
                placeholder="10"
                placeholderTextColor="#786E8A"
                value={cupo}
                onChangeText={setCupo}
                keyboardType="numeric"
              />

              <Text style={styles.fieldLabel}>Descripción (opcional)</Text>
              <TextInput
                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                placeholder="Cuéntales más sobre el parche…"
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
                  <Text style={styles.submitBtnText}>Crear parche 🎯</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  center: {
    flex: 1, backgroundColor: BG,
    justifyContent: 'center', alignItems: 'center',
  },
  loadingText: { color: '#786E8A', marginTop: 16, fontSize: 15 },

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
  createBtn: {
    backgroundColor: ACCENT,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  createBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

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
  emptySubtitle: { fontSize: 14, color: '#786E8A', textAlign: 'center' },

  // Parche card
  parcheCard: {
    backgroundColor: CARD,
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2D2640',
    flex: 1,
    minWidth: 320,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  parcheHeader: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  tipoIcon: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: 'rgba(255,107,74,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  tipoEmoji: { fontSize: 24 },
  parcheTitulo: { fontSize: 16, fontWeight: '700', color: '#F0ECF6' },
  parcheTipo: { fontSize: 12, color: '#786E8A', marginTop: 2 },

  parcheDetails: { marginTop: 14, gap: 8 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  detailIcon: { fontSize: 14 },
  detailText: { fontSize: 13, color: '#B9B1C9' },

  parcheDesc: {
    fontSize: 13, color: '#786E8A', marginTop: 12,
    lineHeight: 19, fontStyle: 'italic',
  },

  statusBadge: {
    alignSelf: 'flex-start', marginTop: 14,
    backgroundColor: 'rgba(255,107,74,0.1)',
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 10,
  },
  statusText: { fontSize: 13, color: ACCENT, fontWeight: '600' },

  joinBtn: {
    marginTop: 14, backgroundColor: ACCENT,
    paddingVertical: 12, borderRadius: 10, alignItems: 'center',
  },
  joinBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1E1A2B', borderTopLeftRadius: 24,
    borderTopRightRadius: 24, padding: 24,
    maxHeight: '90%',
    borderTopWidth: 1, borderColor: '#2D2640',
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#F0ECF6' },
  modalClose: { fontSize: 22, color: '#786E8A', padding: 4 },

  fieldLabel: {
    color: '#B9B1C9', fontSize: 13,
    fontWeight: '600', marginBottom: 6, marginTop: 12,
  },
  input: {
    backgroundColor: '#282234', color: '#F0ECF6', fontSize: 15,
    borderWidth: 1, borderColor: '#3A3247',
    padding: 13, borderRadius: 10,
  },
  tiposGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4,
  },
  tipoChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#282234', paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10, borderWidth: 1, borderColor: '#3A3247',
  },
  tipoChipActive: {
    borderColor: ACCENT, backgroundColor: 'rgba(255,107,74,0.12)',
  },
  tipoChipEmoji: { fontSize: 16 },
  tipoChipText: { fontSize: 13, color: '#786E8A', fontWeight: '500' },
  tipoChipTextActive: { color: ACCENT },

  formError: {
    color: '#FF5B6E', fontSize: 14, textAlign: 'center',
    marginTop: 12,
  },
  submitBtn: {
    backgroundColor: ACCENT, padding: 16, borderRadius: 12,
    alignItems: 'center', marginTop: 20, marginBottom: 20,
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

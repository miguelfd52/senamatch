import {
  View, Text, StyleSheet, TouchableOpacity,
  Modal, ActivityIndicator, Image, ScrollView,
  Alert, Platform
} from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../app/context/AuthContext';
import { api } from '../lib/api';

const ACCENT = '#39A900';
const ACCENT_DARK = '#1F6B00';
const CARD = '#1E1A2B';
const CARD_BORDER = '#2D2640';
const DANGER = '#FF5B6E';

interface Props {
  userId: string | null;
  visible: boolean;
  onClose: () => void;
  onOpenChat?: (chatId: string) => void;
}

export default function PublicProfileModal({ userId, visible, onClose, onOpenChat }: Props) {
  const { user } = useAuth();
  const router = useRouter();

  const [perfil, setPerfil] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startingChat, setStartingChat] = useState(false);
  const [bloqueando, setBloqueando] = useState(false);
  const [bloqueado, setBloqueado] = useState(false);

  // Modal de reporte interno
  const [showReporteModal, setShowReporteModal] = useState(false);
  const [reportMotivo, setReportMotivo] = useState('Comportamiento inapropiado');
  const [reportDetalle, setReportDetalle] = useState('');
  const [enviandoReporte, setEnviandoReporte] = useState(false);
  const [reporteEnviado, setReporteEnviado] = useState(false);

  useEffect(() => {
    if (!visible || !userId) {
      setPerfil(null);
      setError(null);
      return;
    }

    // Si es el propio perfil, redirigir a Mi Perfil
    if (user && String(user.id) === String(userId)) {
      onClose();
      router.push('/perfil');
      return;
    }

    cargarPerfil(userId);
  }, [visible, userId, user]);

  const cargarPerfil = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get(`/perfiles/${id}/publico`);
      setPerfil(data);

      // Verificar si ya está bloqueado
      try {
        const blDoc = await api.get('/bloqueos');
        const ids = Array.isArray(blDoc?.ids) ? blDoc.ids.map(String) : [];
        setBloqueado(ids.includes(String(id)));
      } catch {
        // Ignorar
      }
    } catch (err: any) {
      setError(err?.message || 'No se pudo cargar el perfil');
    } finally {
      setLoading(false);
    }
  };

  const handleStartChat = async () => {
    if (!userId) return;
    setStartingChat(true);
    try {
      const res: any = await api.post('/chats/directo', { targetUserId: userId });
      onClose();
      if (onOpenChat && res?.id) {
        onOpenChat(res.id);
      } else {
        router.push('/chats');
      }
    } catch (err: any) {
      const msg = err?.message || 'Error al iniciar chat';
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(msg);
      } else {
        Alert.alert('Atención', msg);
      }
    } finally {
      setStartingChat(false);
    }
  };

  const handleToggleBloqueo = async () => {
    if (!userId) return;
    setBloqueando(true);
    try {
      const res: any = await api.post('/bloqueos/toggle', { targetUserId: userId });
      setBloqueado(!!res?.bloqueado);
      const msg = res?.bloqueado ? 'Usuario bloqueado.' : 'Usuario desbloqueado.';
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(msg);
      } else {
        Alert.alert('Bloqueo', msg);
      }
    } catch (err: any) {
      const msg = err?.message || 'No se pudo actualizar el bloqueo';
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(msg);
      } else {
        Alert.alert('Error', msg);
      }
    } finally {
      setBloqueando(false);
    }
  };

  const handleEnviarReporte = async () => {
    if (!userId) return;
    setEnviandoReporte(true);
    try {
      await api.post('/reportes', {
        targetId: userId,
        targetType: 'usuario',
        reason: reportMotivo,
        description: reportDetalle.trim() || undefined
      });
      setReporteEnviado(true);
      setTimeout(() => {
        setReporteEnviado(false);
        setShowReporteModal(false);
        setReportDetalle('');
      }, 1500);
    } catch (err: any) {
      const msg = err?.message || 'Error al enviar reporte';
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(msg);
      } else {
        Alert.alert('Error', msg);
      }
    } finally {
      setEnviandoReporte(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Cabecera modal */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Perfil de la comunidad</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={ACCENT} />
              <Text style={styles.loadingText}>Cargando información del aprendiz…</Text>
            </View>
          ) : error ? (
            <View style={styles.centerBox}>
              <Text style={styles.errorEmoji}>⚠️</Text>
              <Text style={styles.errorTitle}>Perfil no disponible</Text>
              <Text style={styles.errorMsg}>{error}</Text>
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={() => userId && cargarPerfil(userId)}
                activeOpacity={0.8}
              >
                <Text style={styles.retryBtnText}>🔄 Reintentar</Text>
              </TouchableOpacity>
            </View>
          ) : perfil ? (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
              {/* Foto o Avatar */}
              <View style={styles.avatarSection}>
                {perfil.fotoUrl ? (
                  <Image source={{ uri: perfil.fotoUrl }} style={styles.avatarPhoto} resizeMode="cover" />
                ) : (
                  <View style={[styles.avatarCircle, { backgroundColor: (perfil.avatarColor || ACCENT) + '22' }]}>
                    <Text style={styles.avatarEmoji}>{perfil.avatarEmoji || '😊'}</Text>
                  </View>
                )}
                <Text style={styles.nombre}>{perfil.nombre}</Text>
                <View style={styles.badgeRow}>
                  <View style={styles.rolBadge}>
                    <Text style={styles.rolBadgeText}>
                      {perfil.rol ? (perfil.rol.charAt(0).toUpperCase() + perfil.rol.slice(1)) : 'Aprendiz'}
                    </Text>
                  </View>
                  {perfil.centro ? (
                    <View style={styles.centroBadge}>
                      <Text style={styles.centroBadgeText}>Centro #{perfil.centro}</Text>
                    </View>
                  ) : null}
                </View>

                {/* Afinidad detectada */}
                {perfil.afinidad ? (
                  <View style={styles.afinidadBanner}>
                    <Text style={styles.afinidadText}>✨ {perfil.afinidad}</Text>
                  </View>
                ) : null}
              </View>

              {/* Bio */}
              {perfil.bio ? (
                <View style={styles.infoCard}>
                  <Text style={styles.infoLabel}>Acerca de mí</Text>
                  <Text style={styles.bioText}>{perfil.bio}</Text>
                </View>
              ) : null}

              {/* Datos formativos públicos */}
              <View style={styles.infoCard}>
                {perfil.programa ? (
                  <View style={styles.metaRow}>
                    <Text style={styles.metaIcon}>📚</Text>
                    <Text style={styles.metaLabel}>Programa:</Text>
                    <Text style={styles.metaVal}>{perfil.programa}</Text>
                  </View>
                ) : null}
                {perfil.jornada ? (
                  <View style={styles.metaRow}>
                    <Text style={styles.metaIcon}>🕐</Text>
                    <Text style={styles.metaLabel}>Jornada:</Text>
                    <Text style={styles.metaVal}>{perfil.jornada}</Text>
                  </View>
                ) : null}
                <View style={styles.metaRow}>
                  <Text style={styles.metaIcon}>🎯</Text>
                  <Text style={styles.metaLabel}>Asistencias:</Text>
                  <Text style={styles.metaVal}>{perfil.asistencias || 0} parches completados</Text>
                </View>
              </View>

              {/* Intereses */}
              {Array.isArray(perfil.intereses) && perfil.intereses.length > 0 ? (
                <View style={styles.infoCard}>
                  <Text style={styles.infoLabel}>Intereses</Text>
                  <View style={styles.tagsGrid}>
                    {perfil.intereses.map((tag: string, i: number) => (
                      <View key={i} style={styles.tag}>
                        <Text style={styles.tagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {/* Acciones principales */}
              <View style={styles.actionsBox}>
                <TouchableOpacity
                  style={[styles.btnChat, startingChat && styles.btnDisabled]}
                  onPress={handleStartChat}
                  disabled={startingChat || bloqueado}
                  activeOpacity={0.85}
                >
                  {startingChat ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.btnChatText}>💬 Enviar mensaje directo</Text>
                  )}
                </TouchableOpacity>

                <View style={styles.secondaryActions}>
                  <TouchableOpacity
                    style={styles.btnSecundario}
                    onPress={() => setShowReporteModal(true)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.btnSecundarioText}>🚩 Reportar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.btnSecundario, bloqueado && styles.btnBloqueado]}
                    onPress={handleToggleBloqueo}
                    disabled={bloqueando}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.btnSecundarioText, bloqueado && { color: '#FFD166' }]}>
                      {bloqueando ? '…' : (bloqueado ? '🔓 Desbloquear' : '🚫 Bloquear')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          ) : null}

          {/* Submodal de reporte */}
          {showReporteModal ? (
            <View style={styles.reportOverlay}>
              <View style={styles.reportModal}>
                <Text style={styles.reportTitle}>Reportar usuario</Text>
                <Text style={styles.reportDesc}>
                  Ayúdanos a mantener la comunidad segura y respetuosa en SENA Match.
                </Text>

                {reporteEnviado ? (
                  <View style={styles.reportSuccess}>
                    <Text style={styles.reportSuccessText}>✅ Reporte enviado a moderación</Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.reportLabel}>Motivo:</Text>
                    {['Comportamiento inapropiado', 'Spam o publicidad', 'Contenido ofensivo', 'Suplantación'].map((m) => (
                      <TouchableOpacity
                        key={m}
                        style={[styles.motivoOption, reportMotivo === m && styles.motivoOptionActive]}
                        onPress={() => setReportMotivo(m)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.motivoText, reportMotivo === m && styles.motivoTextActive]}>
                          {m}
                        </Text>
                      </TouchableOpacity>
                    ))}

                    <View style={styles.reportActions}>
                      <TouchableOpacity
                        style={styles.btnCancelReport}
                        onPress={() => setShowReporteModal(false)}
                        disabled={enviandoReporte}
                      >
                        <Text style={styles.btnCancelReportText}>Cancelar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.btnSendReport}
                        onPress={handleEnviarReporte}
                        disabled={enviandoReporte}
                      >
                        <Text style={styles.btnSendReportText}>
                          {enviandoReporte ? 'Enviando…' : 'Enviar reporte'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
    backgroundColor: CARD,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    maxWidth: 500,
    width: '100%',
    maxHeight: '90%',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#282136',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#B9B1C9',
  },
  closeBtn: {
    padding: 4,
  },
  closeText: {
    fontSize: 18,
    color: '#8D83A0',
    fontWeight: '700',
  },
  centerBox: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: '#8D83A0',
    marginTop: 12,
    fontSize: 14,
  },
  errorEmoji: {
    fontSize: 44,
    marginBottom: 8,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F0ECF6',
    marginBottom: 6,
  },
  errorMsg: {
    color: '#8D83A0',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryBtn: {
    backgroundColor: '#282234',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#3A3247',
  },
  retryBtnText: {
    color: '#F0ECF6',
    fontWeight: '700',
    fontSize: 13,
  },
  scrollBody: {
    padding: 20,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarPhoto: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: ACCENT,
    marginBottom: 12,
  },
  avatarCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: ACCENT,
    marginBottom: 12,
  },
  avatarEmoji: {
    fontSize: 44,
  },
  nombre: {
    fontSize: 22,
    fontWeight: '800',
    color: '#F0ECF6',
    textAlign: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  rolBadge: {
    backgroundColor: 'rgba(57, 169, 0, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(57, 169, 0, 0.3)',
  },
  rolBadgeText: {
    color: ACCENT,
    fontWeight: '700',
    fontSize: 12,
  },
  centroBadge: {
    backgroundColor: '#282234',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  centroBadgeText: {
    color: '#8D83A0',
    fontSize: 12,
    fontWeight: '600',
  },
  afinidadBanner: {
    backgroundColor: 'rgba(0, 229, 163, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 10,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 163, 0.25)',
  },
  afinidadText: {
    color: '#00E5A3',
    fontWeight: '700',
    fontSize: 13,
  },
  infoCard: {
    backgroundColor: '#241D30',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#342B45',
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#8D83A0',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  bioText: {
    fontSize: 14,
    color: '#F0ECF6',
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  metaIcon: {
    fontSize: 15,
  },
  metaLabel: {
    fontSize: 13,
    color: '#8D83A0',
    fontWeight: '600',
  },
  metaVal: {
    fontSize: 13,
    color: '#F0ECF6',
    flex: 1,
  },
  tagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  tag: {
    backgroundColor: '#1E1A2B',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3A3247',
  },
  tagText: {
    color: '#B9B1C9',
    fontSize: 12,
  },
  actionsBox: {
    marginTop: 8,
    gap: 10,
  },
  btnChat: {
    backgroundColor: ACCENT,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: ACCENT,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 3,
  },
  btnChatText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 10,
  },
  btnSecundario: {
    flex: 1,
    backgroundColor: '#282234',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3A3247',
  },
  btnBloqueado: {
    borderColor: 'rgba(255, 209, 102, 0.4)',
    backgroundColor: 'rgba(255, 209, 102, 0.1)',
  },
  btnSecundarioText: {
    color: '#B9B1C9',
    fontSize: 13,
    fontWeight: '600',
  },

  // Report Modal
  reportOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    zIndex: 100,
  },
  reportModal: {
    backgroundColor: '#1E1A2B',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 380,
    borderWidth: 1,
    borderColor: '#3A3247',
  },
  reportTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F0ECF6',
    marginBottom: 6,
  },
  reportDesc: {
    fontSize: 13,
    color: '#8D83A0',
    marginBottom: 14,
    lineHeight: 18,
  },
  reportLabel: {
    fontSize: 12,
    color: '#B9B1C9',
    fontWeight: '700',
    marginBottom: 8,
  },
  motivoOption: {
    backgroundColor: '#282234',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#3A3247',
  },
  motivoOptionActive: {
    borderColor: ACCENT,
    backgroundColor: 'rgba(57, 169, 0, 0.15)',
  },
  motivoText: {
    color: '#B9B1C9',
    fontSize: 13,
    fontWeight: '600',
  },
  motivoTextActive: {
    color: ACCENT,
    fontWeight: '700',
  },
  reportActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 14,
  },
  btnCancelReport: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  btnCancelReportText: {
    color: '#8D83A0',
    fontWeight: '600',
  },
  btnSendReport: {
    backgroundColor: DANGER,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  btnSendReportText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  reportSuccess: {
    backgroundColor: 'rgba(95, 224, 180, 0.15)',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 12,
  },
  reportSuccessText: {
    color: '#5FE0B4',
    fontWeight: '700',
  },
});

import {
  View, Text, StyleSheet, TouchableOpacity,
  Modal, ActivityIndicator, Image, ScrollView,
  Alert, Platform
} from 'react-native';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../app/context/AuthContext';
import { useTheme } from '../app/context/ThemeContext';
import { api } from '../lib/api';
import FotoViewerModal from './FotoViewerModal';

const ACCENT = '#39A900';
const DANGER = '#FF5B6E';

interface Props {
  userId: string | null;
  visible: boolean;
  onClose: () => void;
  onOpenChat?: (chatId: string) => void;
}

export default function PublicProfileModal({ userId, visible, onClose, onOpenChat }: Props) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [perfil, setPerfil] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visorFoto, setVisorFoto] = useState<string | null>(null);
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
      <View style={[styles.overlay, { backgroundColor: colors.modalOverlay }]}>
        <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {/* Cabecera modal */}
          <View style={[styles.modalHeader, { borderBottomColor: colors.cardBorder }]}>
            <Text style={[styles.modalTitle, { color: colors.textSub }]}>Perfil de la comunidad</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Text style={[styles.closeText, { color: colors.textSub }]}>✕</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={ACCENT} />
              <Text style={[styles.loadingText, { color: colors.textSub }]}>Cargando información del aprendiz…</Text>
            </View>
          ) : error ? (
            <View style={styles.centerBox}>
              <Text style={styles.errorEmoji}>⚠️</Text>
              <Text style={[styles.errorTitle, { color: colors.text }]}>Perfil no disponible</Text>
              <Text style={[styles.errorMsg, { color: colors.textSub }]}>{error}</Text>
              <TouchableOpacity
                style={[styles.retryBtn, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}
                onPress={() => userId && cargarPerfil(userId)}
                activeOpacity={0.8}
              >
                <Text style={[styles.retryBtnText, { color: colors.text }]}>🔄 Reintentar</Text>
              </TouchableOpacity>
            </View>
          ) : perfil ? (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
              {/* Foto o Avatar */}
              <View style={styles.avatarSection}>
                {perfil.fotoUrl ? (
                  <TouchableOpacity activeOpacity={0.9} onPress={() => setVisorFoto(perfil.fotoUrl)}>
                    <Image source={{ uri: perfil.fotoUrl }} style={styles.avatarPhoto} resizeMode="cover" />
                  </TouchableOpacity>
                ) : (
                  <View style={[styles.avatarCircle, { backgroundColor: (perfil.avatarColor || ACCENT) + '22' }]}>
                    <Text style={styles.avatarEmoji}>{perfil.avatarEmoji || '😊'}</Text>
                  </View>
                )}
                <Text style={[styles.nombre, { color: colors.text }]}>{perfil.nombre}</Text>
                <View style={styles.badgeRow}>
                  <View style={styles.rolBadge}>
                    <Text style={styles.rolBadgeText}>
                      {perfil.rol ? (perfil.rol.charAt(0).toUpperCase() + perfil.rol.slice(1)) : 'Aprendiz'}
                    </Text>
                  </View>
                  {perfil.centro ? (
                    <View style={[styles.centroBadge, { backgroundColor: colors.chipBg }]}>
                      <Text style={[styles.centroBadgeText, { color: colors.textSub }]}>Centro #{perfil.centro}</Text>
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
                <View style={[styles.infoCard, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
                  <Text style={[styles.infoLabel, { color: colors.textSub }]}>Acerca de mí</Text>
                  <Text style={[styles.bioText, { color: colors.text }]}>{perfil.bio}</Text>
                </View>
              ) : null}

              {/* Datos formativos públicos */}
              <View style={[styles.infoCard, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
                {perfil.programa ? (
                  <View style={styles.metaRow}>
                    <Text style={styles.metaIcon}>📚</Text>
                    <Text style={[styles.metaLabel, { color: colors.textSub }]}>Programa:</Text>
                    <Text style={[styles.metaVal, { color: colors.text }]}>{perfil.programa}</Text>
                  </View>
                ) : null}
                {perfil.jornada ? (
                  <View style={styles.metaRow}>
                    <Text style={styles.metaIcon}>🕐</Text>
                    <Text style={[styles.metaLabel, { color: colors.textSub }]}>Jornada:</Text>
                    <Text style={[styles.metaVal, { color: colors.text }]}>{perfil.jornada}</Text>
                  </View>
                ) : null}
                <View style={styles.metaRow}>
                  <Text style={styles.metaIcon}>🎯</Text>
                  <Text style={[styles.metaLabel, { color: colors.textSub }]}>Asistencias:</Text>
                  <Text style={[styles.metaVal, { color: colors.text }]}>{perfil.asistencias || 0} parches completados</Text>
                </View>
              </View>

              {/* Intereses */}
              {Array.isArray(perfil.intereses) && perfil.intereses.length > 0 ? (
                <View style={[styles.infoCard, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
                  <Text style={[styles.infoLabel, { color: colors.textSub }]}>Intereses</Text>
                  <View style={styles.tagsGrid}>
                    {perfil.intereses.map((tag: string, i: number) => (
                      <View key={i} style={[styles.tag, { backgroundColor: colors.chipBg, borderColor: colors.cardBorder }]}>
                        <Text style={[styles.tagText, { color: colors.textSub }]}>{tag}</Text>
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
                    style={[styles.btnSecundario, { backgroundColor: colors.chipBg, borderColor: colors.cardBorder }]}
                    onPress={() => setShowReporteModal(true)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.btnSecundarioText, { color: colors.textSub }]}>🚩 Reportar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.btnSecundario, { backgroundColor: colors.chipBg, borderColor: colors.cardBorder }, bloqueado && styles.btnBloqueado]}
                    onPress={handleToggleBloqueo}
                    disabled={bloqueando}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.btnSecundarioText, { color: colors.textSub }, bloqueado && { color: '#FFD166' }]}>
                      {bloqueando ? '…' : (bloqueado ? '🔓 Desbloquear' : '🚫 Bloquear')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          ) : null}

          {/* Submodal de reporte */}
          {showReporteModal ? (
            <View style={[styles.reportOverlay, { backgroundColor: colors.modalOverlay }]}>
              <View style={[styles.reportModal, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
                <Text style={[styles.reportTitle, { color: colors.text }]}>Reportar usuario</Text>
                <Text style={[styles.reportDesc, { color: colors.textSub }]}>
                  Ayúdanos a mantener la comunidad segura y respetuosa en SENA Match.
                </Text>

                {reporteEnviado ? (
                  <View style={styles.reportSuccess}>
                    <Text style={styles.reportSuccessText}>✅ Reporte enviado a moderación</Text>
                  </View>
                ) : (
                  <>
                    <Text style={[styles.reportLabel, { color: colors.textSub }]}>Motivo:</Text>
                    {['Comportamiento inapropiado', 'Spam o publicidad', 'Contenido ofensivo', 'Suplantación'].map((m) => (
                      <TouchableOpacity
                        key={m}
                        style={[
                          styles.motivoOption,
                          { backgroundColor: colors.inputBg, borderColor: colors.cardBorder },
                          reportMotivo === m && styles.motivoOptionActive
                        ]}
                        onPress={() => setReportMotivo(m)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.motivoText, { color: colors.textSub }, reportMotivo === m && styles.motivoTextActive]}>
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
                        <Text style={[styles.btnCancelReportText, { color: colors.textSub }]}>Cancelar</Text>
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

      {/* Visor de foto a pantalla completa */}
      <FotoViewerModal
        visible={!!visorFoto}
        fotoUrl={visorFoto}
        onClose={() => setVisorFoto(null)}
      />
    </Modal>
  );
}

function makeStyles(colors: import('../app/context/ThemeContext').ThemeColors) {
  return StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
    borderRadius: 22,
    borderWidth: 1,
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
    borderBottomColor: colors.cardBorder,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textSub,
  },
  closeBtn: {
    padding: 4,
  },
  closeText: {
    fontSize: 18,
    color: colors.textSub,
    fontWeight: '700',
  },
  centerBox: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    color: colors.textSub,
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
    color: colors.text,
    marginBottom: 6,
  },
  errorMsg: {
    color: colors.textSub,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryBtn: {
    backgroundColor: colors.chipBg,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  retryBtnText: {
    color: colors.text,
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
    borderColor: colors.accent,
    marginBottom: 12,
  },
  avatarCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.accent,
    marginBottom: 12,
  },
  avatarEmoji: {
    fontSize: 44,
  },
  nombre: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
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
    color: colors.accent,
    fontWeight: '700',
    fontSize: 12,
  },
  centroBadge: {
    backgroundColor: colors.chipBg,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  centroBadgeText: {
    color: colors.textSub,
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
    color: colors.success,
    fontWeight: '700',
    fontSize: 13,
  },
  infoCard: {
    backgroundColor: colors.inputBg,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSub,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  bioText: {
    fontSize: 14,
    color: colors.text,
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
    color: colors.textSub,
    fontWeight: '600',
  },
  metaVal: {
    fontSize: 13,
    color: colors.text,
    flex: 1,
  },
  tagsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  tag: {
    backgroundColor: colors.inputBg,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  tagText: {
    color: colors.textSub,
    fontSize: 12,
  },
  actionsBox: {
    marginTop: 8,
    gap: 10,
  },
  btnChat: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: colors.accent,
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
    backgroundColor: colors.chipBg,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  btnBloqueado: {
    borderColor: 'rgba(255, 209, 102, 0.4)',
    backgroundColor: 'rgba(255, 209, 102, 0.1)',
  },
  btnSecundarioText: {
    color: colors.textSub,
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
    backgroundColor: colors.inputBg,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 380,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  reportTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 6,
  },
  reportDesc: {
    fontSize: 13,
    color: colors.textSub,
    marginBottom: 14,
    lineHeight: 18,
  },
  reportLabel: {
    fontSize: 12,
    color: colors.textSub,
    fontWeight: '700',
    marginBottom: 8,
  },
  motivoOption: {
    backgroundColor: colors.chipBg,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  motivoOptionActive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(57, 169, 0, 0.15)',
  },
  motivoText: {
    color: colors.textSub,
    fontSize: 13,
    fontWeight: '600',
  },
  motivoTextActive: {
    color: colors.accent,
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
    color: colors.textSub,
    fontWeight: '600',
  },
  btnSendReport: {
    backgroundColor: colors.danger,
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
    color: colors.success,
    fontWeight: '700',
  },
  });
}

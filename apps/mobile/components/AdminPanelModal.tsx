import {
  View, Text, StyleSheet, TouchableOpacity,
  Modal, ActivityIndicator, ScrollView, TextInput,
  RefreshControl, Alert, Platform
} from 'react-native';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTheme } from '../app/context/ThemeContext';
import { api } from '../lib/api';
import NavIcon from './NavIcon';

const ACCENT = '#39A900';
const DANGER = '#FF5B6E';
const WARNING = '#FFD166';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function AdminPanelModal({ visible, onClose }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [activeTab, setActiveTab] = useState<'metricas' | 'reportes' | 'usuarios'>('metricas');
  const [metricas, setMetricas] = useState<any>(null);
  const [reportes, setReportes] = useState<any[]>([]);
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [busquedaUsuario, setBusquedaUsuario] = useState('');

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargarDatos = useCallback(async () => {
    setError(null);
    try {
      if (activeTab === 'metricas') {
        const data = await api.get('/admin/metricas');
        setMetricas(data);
      } else if (activeTab === 'reportes') {
        const data = await api.get('/admin/reportes');
        setReportes(Array.isArray(data) ? data : []);
      } else if (activeTab === 'usuarios') {
        const q = busquedaUsuario.trim() ? `?q=${encodeURIComponent(busquedaUsuario.trim())}` : '';
        const data = await api.get(`/admin/usuarios${q}`);
        setUsuarios(Array.isArray(data) ? data : []);
      }
    } catch (err: any) {
      setError(err?.message || 'Error al cargar datos administrativos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, busquedaUsuario]);

  useEffect(() => {
    if (visible) {
      setLoading(true);
      cargarDatos();
    }
  }, [visible, activeTab, cargarDatos]);

  const handleCambiarEstadoUsuario = async (userId: string, nuevoEstado: string) => {
    try {
      await api.patch(`/admin/usuarios/${userId}/estado`, { estado: nuevoEstado });
      setUsuarios(prev => prev.map(u => u.id === userId ? { ...u, estado: nuevoEstado } : u));
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(`Estado de usuario actualizado a: ${nuevoEstado}`);
      }
    } catch (err: any) {
      const msg = err?.message || 'Error al cambiar estado';
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(msg);
      }
    }
  };

  const handleResolverReporte = async (reporteId: string, status: string) => {
    try {
      await api.patch(`/admin/reportes/${reporteId}`, { status });
      setReportes(prev => prev.map(r => r.id === reporteId ? { ...r, status } : r));
    } catch (err: any) {
      const msg = err?.message || 'Error al resolver reporte';
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(msg);
      }
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, { backgroundColor: colors.modalOverlay }]}>
        <View style={[styles.container, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          {/* Cabecera */}
          <View style={[styles.header, { borderBottomColor: colors.cardBorder }]}>
            <View>
              <Text style={[styles.headerTitle, { color: colors.text }]}>Panel de Administración</Text>
              <Text style={[styles.headerSubtitle, { color: colors.textSub }]}>Gestión y métricas de SENA Match</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <NavIcon name="close" size={20} color={colors.textSub} />
            </TouchableOpacity>
          </View>

          {/* Navegación por pestañas */}
          <View style={[styles.tabsRow, { borderBottomColor: colors.cardBorder }]}>
            <TouchableOpacity
              style={[styles.tabBtn, { backgroundColor: colors.chipBg }, activeTab === 'metricas' && styles.tabBtnActive]}
              onPress={() => setActiveTab('metricas')}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><NavIcon name="chart" size={15} color={activeTab === 'metricas' ? ACCENT : colors.textSub} /><Text style={[styles.tabText, { color: colors.textSub }, activeTab === 'metricas' && styles.tabTextActive]}>Métricas</Text></View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, { backgroundColor: colors.chipBg }, activeTab === 'reportes' && styles.tabBtnActive]}
              onPress={() => setActiveTab('reportes')}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><NavIcon name="flag" size={15} color={activeTab === 'reportes' ? ACCENT : colors.textSub} /><Text style={[styles.tabText, { color: colors.textSub }, activeTab === 'reportes' && styles.tabTextActive]}>Reportes</Text></View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, { backgroundColor: colors.chipBg }, activeTab === 'usuarios' && styles.tabBtnActive]}
              onPress={() => setActiveTab('usuarios')}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><NavIcon name="users" size={15} color={activeTab === 'usuarios' ? ACCENT : colors.textSub} /><Text style={[styles.tabText, { color: colors.textSub }, activeTab === 'usuarios' && styles.tabTextActive]}>Usuarios</Text></View>
            </TouchableOpacity>
          </View>

          {/* Contenido */}
          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={ACCENT} />
              <Text style={[styles.loadingText, { color: colors.textSub }]}>Cargando datos del panel…</Text>
            </View>
          ) : error ? (
            <View style={styles.centerBox}>
              <NavIcon name="alert" size={42} color={DANGER} />
              <Text style={[styles.errorTitle, { color: colors.text }]}>Error de acceso</Text>
              <Text style={[styles.errorSubtitle, { color: colors.textSub }]}>{error}</Text>
              <TouchableOpacity
                style={[styles.retryBtn, { backgroundColor: colors.inputBg, borderColor: colors.cardBorder }]}
                onPress={() => { setLoading(true); cargarDatos(); }}
              >
                <Text style={[styles.retryBtnText, { color: colors.text }]}>Reintentar</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.scrollBody}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => { setRefreshing(true); cargarDatos(); }}
                  tintColor={ACCENT}
                  colors={[ACCENT]}
                />
              }
            >
              {/* TAB 1: MÉTRICAS */}
              {activeTab === 'metricas' && metricas && (
                <View style={styles.gridCards}>
                  <View style={[styles.metricCard, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
                    <NavIcon name="users" size={24} color={ACCENT} />
                    <Text style={[styles.metricVal, { color: colors.text }]}>{metricas.usuarios?.total || 0}</Text>
                    <Text style={[styles.metricLabel, { color: colors.textSub }]}>Usuarios registrados</Text>
                    <Text style={styles.metricSub}>({metricas.usuarios?.activos || 0} activos)</Text>
                  </View>

                  <View style={[styles.metricCard, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
                    <NavIcon name="heart" size={24} color={ACCENT} />
                    <Text style={[styles.metricVal, { color: colors.text }]}>{metricas.matches || 0}</Text>
                    <Text style={[styles.metricLabel, { color: colors.textSub }]}>Matches concretados</Text>
                  </View>

                  <View style={[styles.metricCard, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
                    <NavIcon name="edit" size={24} color={ACCENT} />
                    <Text style={[styles.metricVal, { color: colors.text }]}>{metricas.publicaciones || 0}</Text>
                    <Text style={[styles.metricLabel, { color: colors.textSub }]}>Publicaciones</Text>
                  </View>

                  <View style={[styles.metricCard, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
                    <NavIcon name="target" size={24} color={ACCENT} />
                    <Text style={[styles.metricVal, { color: colors.text }]}>{metricas.parchesActivos || 0}</Text>
                    <Text style={[styles.metricLabel, { color: colors.textSub }]}>Parches activos</Text>
                  </View>

                  <View style={[styles.metricCard, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
                    <NavIcon name="chats" size={24} color={ACCENT} />
                    <Text style={[styles.metricVal, { color: colors.text }]}>{metricas.totalChats || 0}</Text>
                    <Text style={[styles.metricLabel, { color: colors.textSub }]}>Conversaciones</Text>
                  </View>

                  <View style={[styles.metricCard, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }, metricas.reportesPendientes > 0 && { borderColor: DANGER }]}>
                    <NavIcon name="alert" size={24} color={DANGER} />
                    <Text style={[styles.metricVal, { color: colors.text }, metricas.reportesPendientes > 0 && { color: DANGER }]}>
                      {metricas.reportesPendientes || 0}
                    </Text>
                    <Text style={[styles.metricLabel, { color: colors.textSub }]}>Reportes pendientes</Text>
                  </View>
                </View>
              )}

              {/* TAB 2: REPORTES */}
              {activeTab === 'reportes' && (
                <View>
                  {reportes.length === 0 ? (
                    <Text style={[styles.emptyText, { color: colors.textSub }]}>No hay reportes registrados en la comunidad</Text>
                  ) : (
                    reportes.map(rep => (
                      <View key={rep.id} style={[styles.reportItem, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
                        <View style={styles.reportTop}>
                          <Text style={[styles.reportMotivo, { color: colors.text }]}>Motivo: {rep.reason}</Text>
                          <View style={[styles.statusPill, rep.status === 'pendiente' ? styles.pillPendiente : styles.pillResuelto]}>
                            <Text style={styles.statusPillText}>{rep.status}</Text>
                          </View>
                        </View>
                        {rep.description ? (
                          <Text style={[styles.reportDesc, { color: colors.textSub }]}>Detalle: "{rep.description}"</Text>
                        ) : null}
                        <Text style={[styles.reportMeta, { color: colors.textMuted }]}>
                          Tipo: {rep.targetType} · ID: {rep.targetId || 'N/A'}
                        </Text>
                        {rep.status === 'pendiente' && (
                          <View style={styles.reportBtnRow}>
                            <TouchableOpacity
                              style={styles.btnTomarAccion}
                              onPress={() => handleResolverReporte(rep.id, 'accion_tomada')}
                            >
                              <Text style={styles.btnTomarAccionText}>Tomar acción</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[styles.btnDescartar, { backgroundColor: colors.chipBg }]}
                              onPress={() => handleResolverReporte(rep.id, 'descartado')}
                            >
                              <Text style={[styles.btnDescartarText, { color: colors.textSub }]}>Descartar</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    ))
                  )}
                </View>
              )}

              {/* TAB 3: USUARIOS */}
              {activeTab === 'usuarios' && (
                <View>
                  <View style={styles.searchBar}>
                    <TextInput
                      style={[styles.searchInput, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder, color: colors.text }]}
                      placeholder="Buscar por nombre, correo o programa…"
                      placeholderTextColor={colors.textMuted}
                      value={busquedaUsuario}
                      onChangeText={setBusquedaUsuario}
                      onSubmitEditing={cargarDatos}
                    />
                    <TouchableOpacity style={styles.searchBtn} onPress={cargarDatos}>
                      <Text style={styles.searchBtnText}>Buscar</Text>
                    </TouchableOpacity>
                  </View>

                  {usuarios.map(u => (
                    <View key={u.id} style={[styles.userRow, { backgroundColor: colors.inputBg, borderColor: colors.inputBorder }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.uName, { color: colors.text }]}>{u.nombre}</Text>
                        <Text style={[styles.uEmail, { color: colors.textSub }]}>{u.correo} · {u.rol}</Text>
                        <Text style={[styles.uProg, { color: colors.textMuted }]}>{u.programa || 'Sin programa'} · Estado: <Text style={{ fontWeight: '700', color: u.estado === 'activo' ? ACCENT : DANGER }}>{u.estado}</Text></Text>
                      </View>
                      <View style={styles.uActions}>
                        {u.estado === 'activo' ? (
                          <TouchableOpacity
                            style={styles.btnSuspender}
                            onPress={() => handleCambiarEstadoUsuario(u.id, 'suspendido')}
                          >
                            <Text style={styles.btnSuspenderText}>Suspender</Text>
                          </TouchableOpacity>
                        ) : (
                          <TouchableOpacity
                            style={styles.btnReactivar}
                            onPress={() => handleCambiarEstadoUsuario(u.id, 'activo')}
                          >
                            <Text style={styles.btnReactivarText}>Reactivar</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(colors: import('../app/context/ThemeContext').ThemeColors) {
  return StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
    borderRadius: 22,
    borderWidth: 1,
    maxWidth: 720,
    width: '100%',
    maxHeight: '90%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.textSub,
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  closeText: {
    fontSize: 18,
    color: colors.textSub,
    fontWeight: '700',
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
    paddingBottom: 12,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.bgSecondary,
    alignItems: 'center',
  },
  tabBtnActive: {
    backgroundColor: 'rgba(57, 169, 0, 0.15)',
    borderWidth: 1,
    borderColor: colors.accent,
  },
  tabText: {
    color: colors.textSub,
    fontWeight: '600',
    fontSize: 13,
  },
  tabTextActive: {
    color: colors.accent,
    fontWeight: '800',
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
    fontSize: 40,
    marginBottom: 8,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  errorSubtitle: {
    color: colors.textSub,
    fontSize: 13,
    marginBottom: 14,
  },
  retryBtn: {
    backgroundColor: colors.chipBg,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryBtnText: {
    color: colors.text,
    fontWeight: '700',
  },
  scrollBody: {
    padding: 20,
  },
  gridCards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  metricCard: {
    flex: 1,
    minWidth: 180,
    backgroundColor: colors.bgSecondary,
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  metricEmoji: {
    fontSize: 28,
    marginBottom: 6,
  },
  metricVal: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.text,
  },
  metricLabel: {
    fontSize: 13,
    color: colors.textSub,
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '600',
  },
  metricSub: {
    fontSize: 11,
    color: colors.accent,
    marginTop: 2,
  },
  emptyText: {
    color: colors.textSub,
    textAlign: 'center',
    paddingVertical: 30,
    fontSize: 14,
  },
  reportItem: {
    backgroundColor: colors.bgSecondary,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  reportTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  reportMotivo: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  pillPendiente: {
    backgroundColor: 'rgba(255, 91, 110, 0.15)',
  },
  pillResuelto: {
    backgroundColor: 'rgba(57, 169, 0, 0.15)',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#F0ECF6',
  },
  reportDesc: {
    color: colors.textSub,
    fontSize: 13,
    marginBottom: 6,
  },
  reportMeta: {
    color: colors.textMuted,
    fontSize: 11,
  },
  reportBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  btnTomarAccion: {
    backgroundColor: colors.danger,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  btnTomarAccionText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  btnDescartar: {
    backgroundColor: colors.chipBg,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  btnDescartarText: {
    color: colors.textSub,
    fontSize: 12,
    fontWeight: '600',
  },
  searchBar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  searchInput: {
    flex: 1,
    backgroundColor: colors.bgSecondary,
    color: colors.text,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  searchBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 16,
    borderRadius: 10,
    justifyContent: 'center',
  },
  searchBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  userRow: {
    backgroundColor: colors.bgSecondary,
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  uName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  uEmail: {
    fontSize: 12,
    color: colors.textSub,
  },
  uProg: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  uActions: {
    marginLeft: 10,
  },
  btnSuspender: {
    backgroundColor: 'rgba(255, 91, 110, 0.15)',
    borderWidth: 1,
    borderColor: colors.danger,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  btnSuspenderText: {
    color: colors.danger,
    fontSize: 11,
    fontWeight: '700',
  },
  btnReactivar: {
    backgroundColor: 'rgba(57, 169, 0, 0.15)',
    borderWidth: 1,
    borderColor: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  btnReactivarText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  });
}

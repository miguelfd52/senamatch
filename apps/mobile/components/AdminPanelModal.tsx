import {
  View, Text, StyleSheet, TouchableOpacity,
  Modal, ActivityIndicator, ScrollView, TextInput,
  RefreshControl, Alert, Platform
} from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

const ACCENT = '#39A900';
const CARD = '#1E1A2B';
const CARD_BORDER = '#2D2640';
const DANGER = '#FF5B6E';
const WARNING = '#FFD166';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function AdminPanelModal({ visible, onClose }: Props) {
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
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Cabecera */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Panel de Administración</Text>
              <Text style={styles.headerSubtitle}>Gestión y métricas de SENA Match</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Navegación por pestañas */}
          <View style={styles.tabsRow}>
            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'metricas' && styles.tabBtnActive]}
              onPress={() => setActiveTab('metricas')}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, activeTab === 'metricas' && styles.tabTextActive]}>
                📊 Métricas
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'reportes' && styles.tabBtnActive]}
              onPress={() => setActiveTab('reportes')}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, activeTab === 'reportes' && styles.tabTextActive]}>
                🚩 Reportes
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabBtn, activeTab === 'usuarios' && styles.tabBtnActive]}
              onPress={() => setActiveTab('usuarios')}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, activeTab === 'usuarios' && styles.tabTextActive]}>
                👥 Usuarios
              </Text>
            </TouchableOpacity>
          </View>

          {/* Contenido */}
          {loading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator size="large" color={ACCENT} />
              <Text style={styles.loadingText}>Cargando datos del panel…</Text>
            </View>
          ) : error ? (
            <View style={styles.centerBox}>
              <Text style={styles.errorEmoji}>⚠️</Text>
              <Text style={styles.errorTitle}>Error de acceso</Text>
              <Text style={styles.errorSubtitle}>{error}</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={() => { setLoading(true); cargarDatos(); }}>
                <Text style={styles.retryBtnText}>Reintentar</Text>
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
                  <View style={styles.metricCard}>
                    <Text style={styles.metricEmoji}>👥</Text>
                    <Text style={styles.metricVal}>{metricas.usuarios?.total || 0}</Text>
                    <Text style={styles.metricLabel}>Usuarios registrados</Text>
                    <Text style={styles.metricSub}>({metricas.usuarios?.activos || 0} activos)</Text>
                  </View>

                  <View style={styles.metricCard}>
                    <Text style={styles.metricEmoji}>❤️</Text>
                    <Text style={styles.metricVal}>{metricas.matches || 0}</Text>
                    <Text style={styles.metricLabel}>Matches concretados</Text>
                  </View>

                  <View style={styles.metricCard}>
                    <Text style={styles.metricEmoji}>📝</Text>
                    <Text style={styles.metricVal}>{metricas.publicaciones || 0}</Text>
                    <Text style={styles.metricLabel}>Publicaciones</Text>
                  </View>

                  <View style={styles.metricCard}>
                    <Text style={styles.metricEmoji}>🎯</Text>
                    <Text style={styles.metricVal}>{metricas.parchesActivos || 0}</Text>
                    <Text style={styles.metricLabel}>Parches activos</Text>
                  </View>

                  <View style={styles.metricCard}>
                    <Text style={styles.metricEmoji}>💬</Text>
                    <Text style={styles.metricVal}>{metricas.totalChats || 0}</Text>
                    <Text style={styles.metricLabel}>Conversaciones</Text>
                  </View>

                  <View style={[styles.metricCard, metricas.reportesPendientes > 0 && { borderColor: DANGER }]}>
                    <Text style={styles.metricEmoji}>⚠️</Text>
                    <Text style={[styles.metricVal, metricas.reportesPendientes > 0 && { color: DANGER }]}>
                      {metricas.reportesPendientes || 0}
                    </Text>
                    <Text style={styles.metricLabel}>Reportes pendientes</Text>
                  </View>
                </View>
              )}

              {/* TAB 2: REPORTES */}
              {activeTab === 'reportes' && (
                <View>
                  {reportes.length === 0 ? (
                    <Text style={styles.emptyText}>No hay reportes registrados en la comunidad 🎉</Text>
                  ) : (
                    reportes.map(rep => (
                      <View key={rep.id} style={styles.reportItem}>
                        <View style={styles.reportTop}>
                          <Text style={styles.reportMotivo}>Motivo: {rep.reason}</Text>
                          <View style={[styles.statusPill, rep.status === 'pendiente' ? styles.pillPendiente : styles.pillResuelto]}>
                            <Text style={styles.statusPillText}>{rep.status}</Text>
                          </View>
                        </View>
                        {rep.description ? (
                          <Text style={styles.reportDesc}>Detalle: "{rep.description}"</Text>
                        ) : null}
                        <Text style={styles.reportMeta}>
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
                              style={styles.btnDescartar}
                              onPress={() => handleResolverReporte(rep.id, 'descartado')}
                            >
                              <Text style={styles.btnDescartarText}>Descartar</Text>
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
                      style={styles.searchInput}
                      placeholder="Buscar por nombre, correo o programa…"
                      placeholderTextColor="#786E8A"
                      value={busquedaUsuario}
                      onChangeText={setBusquedaUsuario}
                      onSubmitEditing={cargarDatos}
                    />
                    <TouchableOpacity style={styles.searchBtn} onPress={cargarDatos}>
                      <Text style={styles.searchBtnText}>Buscar</Text>
                    </TouchableOpacity>
                  </View>

                  {usuarios.map(u => (
                    <View key={u.id} style={styles.userRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.uName}>{u.nombre}</Text>
                        <Text style={styles.uEmail}>{u.correo} · {u.rol}</Text>
                        <Text style={styles.uProg}>{u.programa || 'Sin programa'} · Estado: <Text style={{ fontWeight: '700', color: u.estado === 'activo' ? ACCENT : DANGER }}>{u.estado}</Text></Text>
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

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
    backgroundColor: CARD,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: CARD_BORDER,
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
    borderBottomColor: '#282136',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F0ECF6',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#8D83A0',
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  closeText: {
    fontSize: 18,
    color: '#8D83A0',
    fontWeight: '700',
  },
  tabsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#282136',
    paddingBottom: 12,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#16121D',
    alignItems: 'center',
  },
  tabBtnActive: {
    backgroundColor: 'rgba(57, 169, 0, 0.15)',
    borderWidth: 1,
    borderColor: ACCENT,
  },
  tabText: {
    color: '#8D83A0',
    fontWeight: '600',
    fontSize: 13,
  },
  tabTextActive: {
    color: ACCENT,
    fontWeight: '800',
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
    fontSize: 40,
    marginBottom: 8,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F0ECF6',
    marginBottom: 4,
  },
  errorSubtitle: {
    color: '#8D83A0',
    fontSize: 13,
    marginBottom: 14,
  },
  retryBtn: {
    backgroundColor: '#282234',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#F0ECF6',
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
    backgroundColor: '#16121D',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#282136',
  },
  metricEmoji: {
    fontSize: 28,
    marginBottom: 6,
  },
  metricVal: {
    fontSize: 26,
    fontWeight: '900',
    color: '#F0ECF6',
  },
  metricLabel: {
    fontSize: 13,
    color: '#8D83A0',
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '600',
  },
  metricSub: {
    fontSize: 11,
    color: ACCENT,
    marginTop: 2,
  },
  emptyText: {
    color: '#8D83A0',
    textAlign: 'center',
    paddingVertical: 30,
    fontSize: 14,
  },
  reportItem: {
    backgroundColor: '#16121D',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#282136',
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
    color: '#F0ECF6',
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
    color: '#B9B1C9',
    fontSize: 13,
    marginBottom: 6,
  },
  reportMeta: {
    color: '#786E8A',
    fontSize: 11,
  },
  reportBtnRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  btnTomarAccion: {
    backgroundColor: DANGER,
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
    backgroundColor: '#282234',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  btnDescartarText: {
    color: '#8D83A0',
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
    backgroundColor: '#16121D',
    color: '#F0ECF6',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#282136',
  },
  searchBtn: {
    backgroundColor: ACCENT,
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
    backgroundColor: '#16121D',
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#282136',
  },
  uName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F0ECF6',
  },
  uEmail: {
    fontSize: 12,
    color: '#8D83A0',
  },
  uProg: {
    fontSize: 11,
    color: '#786E8A',
    marginTop: 2,
  },
  uActions: {
    marginLeft: 10,
  },
  btnSuspender: {
    backgroundColor: 'rgba(255, 91, 110, 0.15)',
    borderWidth: 1,
    borderColor: DANGER,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  btnSuspenderText: {
    color: DANGER,
    fontSize: 11,
    fontWeight: '700',
  },
  btnReactivar: {
    backgroundColor: 'rgba(57, 169, 0, 0.15)',
    borderWidth: 1,
    borderColor: ACCENT,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  btnReactivarText: {
    color: ACCENT,
    fontSize: 11,
    fontWeight: '700',
  },
});

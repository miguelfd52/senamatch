import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, RefreshControl,
  TextInput, Image, Platform, Modal, Alert
} from 'react-native';
import { useState, useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../app/context/AuthContext';
import {
  usePublicaciones,
  useCrearPublicacion,
  useEditarPublicacion,
  useEliminarPublicacion,
  useLikePublicacion,
  useComentarPublicacion,
  Publicacion
} from '../hooks/usePublicaciones';
import { openImagePickerAndUpload } from '../lib/cloudinary';
import { api } from '../lib/api';
import SenaMatchLogo from './SenaMatchLogo';
import PublicProfileModal from './PublicProfileModal';
import FotoViewerModal from './FotoViewerModal';

const ACCENT = '#39A900';
const ACCENT_DARK = '#1F6B00';
const BG = '#0F0C18';
const CARD = '#161B22';
const CARD_BORDER = '#263238';
const DANGER = '#FF5B6E';

interface Props {
  esfera: 'aprendices' | 'equipo';
}

function formatearTiempo(timestamp: number) {
  const diffMs = Date.now() - timestamp;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Justo ahora';
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffHoras = Math.floor(diffMin / 60);
  if (diffHoras < 24) return `Hace ${diffHoras} h`;
  const diffDias = Math.floor(diffHoras / 24);
  if (diffDias < 7) return `Hace ${diffDias} d`;
  return new Date(timestamp).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
}

export default function HomeScreen({ esfera }: Props) {
  const { user } = useAuth();
  const router = useRouter();

  const {
    data: publicaciones,
    isLoading,
    isError,
    error,
    refetch,
  } = usePublicaciones();

  const crearMutation = useCrearPublicacion();
  const editarMutation = useEditarPublicacion();
  const eliminarMutation = useEliminarPublicacion();
  const likeMutation = useLikePublicacion();
  const comentarMutation = useComentarPublicacion();

  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [nuevoTexto, setNuevoTexto] = useState('');
  const [nuevaFotoUrl, setNuevaFotoUrl] = useState('');
  const [fotoPreview, setFotoPreview] = useState('');
  const [formError, setFormError] = useState('');
  const [fotoUploading, setFotoUploading] = useState(false);
  const [fotoError, setFotoError] = useState('');

  // Modal de edición
  const [editingPubId, setEditingPubId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editError, setEditError] = useState('');

  // Perfil público universal
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Visor de fotos a pantalla completa
  const [fotoVisorUrl, setFotoVisorUrl] = useState<string | null>(null);

  // Reporte rápido de post
  const [reportingPubId, setReportingPubId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('Contenido inapropiado');

  // Estados de comentarios abiertos por ID de publicación
  const [comentariosAbiertos, setComentariosAbiertos] = useState<{ [pubId: string]: boolean }>({});
  const [textoComentario, setTextoComentario] = useState<{ [pubId: string]: string }>({});

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleAbrirModal = () => {
    setNuevoTexto('');
    setNuevaFotoUrl('');
    setFotoPreview('');
    setFormError('');
    setFotoError('');
    setFotoUploading(false);
    setModalVisible(true);
  };

  const handleCerrarModal = () => {
    if (fotoUploading) return;
    setModalVisible(false);
  };

  const handlePickFotoPub = () => {
    setFotoError('');
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      openImagePickerAndUpload({
        onProgress: (loading) => setFotoUploading(loading),
        onPreview: (dataUrl) => setFotoPreview(dataUrl),
        onSuccess: (secureUrl) => {
          setNuevaFotoUrl(secureUrl);
          setFotoPreview(secureUrl);
          setFotoError('');
        },
        onError: (msg) => {
          setFotoError(msg);
          if (!nuevaFotoUrl) setFotoPreview('');
        },
      });
    }
  };

  const handlePublicar = async () => {
    if (!nuevoTexto.trim()) {
      setFormError('Escribe algo para publicar.');
      return;
    }
    if (fotoUploading) {
      setFormError('Espera a que termine de subirse la foto.');
      return;
    }

    let finalFoto: string | null = null;
    if (nuevaFotoUrl.trim() && !nuevaFotoUrl.startsWith('data:')) {
      finalFoto = nuevaFotoUrl.trim();
    }

    setFormError('');
    try {
      await crearMutation.mutateAsync({
        texto: nuevoTexto.trim(),
        fotoUrl: finalFoto,
      });
      setModalVisible(false);
      setNuevoTexto('');
      setNuevaFotoUrl('');
      setFotoPreview('');
      setFotoError('');
    } catch (err: any) {
      setFormError(err.message || 'Error al publicar. Inténtalo de nuevo.');
    }
  };

  const handleStartEdit = (pub: Publicacion) => {
    setEditingPubId(pub.id);
    setEditText(pub.texto);
    setEditError('');
  };

  const handleSaveEdit = async () => {
    if (!editingPubId || !editText.trim()) return;
    setEditError('');
    try {
      await editarMutation.mutateAsync({ id: editingPubId, texto: editText.trim() });
      setEditingPubId(null);
    } catch (err: any) {
      setEditError(err?.message || 'Error al guardar los cambios');
    }
  };

  const handleDelete = (pubId: string) => {
    const doDelete = async () => {
      try {
        await eliminarMutation.mutateAsync(pubId);
      } catch (err: any) {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          window.alert(err?.message || 'Error al eliminar');
        }
      }
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm('¿Seguro que deseas eliminar esta publicación?')) {
        doDelete();
      }
    } else {
      Alert.alert(
        'Eliminar publicación',
        '¿Seguro que deseas eliminar esta publicación?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Eliminar', style: 'destructive', onPress: doDelete }
        ]
      );
    }
  };

  const handleEnviarReportePost = async () => {
    if (!reportingPubId) return;
    try {
      await api.post('/reportes', {
        targetId: reportingPubId,
        targetType: 'publicacion',
        reason: reportReason,
        description: 'Reporte generado desde el feed principal'
      });
      setReportingPubId(null);
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert('Publicación reportada para moderación.');
      }
    } catch (err: any) {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert(err?.message || 'Error al reportar');
      }
    }
  };

  const toggleComentarios = (pubId: string) => {
    setComentariosAbiertos(prev => ({
      ...prev,
      [pubId]: !prev[pubId],
    }));
  };

  const handleEnviarComentario = async (pubId: string) => {
    const txt = (textoComentario[pubId] || '').trim();
    if (!txt) return;

    try {
      await comentarMutation.mutateAsync({ publicacionId: pubId, texto: txt });
      setTextoComentario(prev => ({ ...prev, [pubId]: '' }));
    } catch (err) {
      console.error('Error al comentar:', err);
    }
  };

  const listaPublicaciones = Array.isArray(publicaciones) ? publicaciones : [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={ACCENT}
          colors={[ACCENT]}
        />
      }
    >
      {/* Barra superior de Inicio */}
      <View style={styles.topBar}>
        <SenaMatchLogo size={36} textSize={20} subtitle="Comunidad SENA" />
        <TouchableOpacity
          style={styles.btnCrearTop}
          onPress={handleAbrirModal}
          activeOpacity={0.85}
        >
          <Text style={styles.btnCrearTopText}>➕ Crear publicación</Text>
        </TouchableOpacity>
      </View>

      {/* Composer Card */}
      <View style={styles.composerCard}>
        <View style={styles.composerHeader}>
          <TouchableOpacity
            style={styles.myAvatar}
            onPress={() => user?.id && setSelectedUserId(user.id)}
            activeOpacity={0.8}
          >
            <Text style={styles.myAvatarEmoji}>{user?.rol === 'aprendiz' ? '🎓' : '🏫'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.composerFakeInput}
            onPress={handleAbrirModal}
            activeOpacity={0.7}
          >
            <Text style={styles.composerPlaceholder}>
              ¿Qué quieres compartir hoy, {user?.nombre?.split(' ')[0] || 'compañero'}?
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.composerFooter}>
          <TouchableOpacity
            style={styles.composerActionBtn}
            onPress={handleAbrirModal}
            activeOpacity={0.8}
          >
            <Text style={styles.composerActionIcon}>📷</Text>
            <Text style={styles.composerActionText}>Foto</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.composerActionBtn}
            onPress={() => router.push('/descubrir')}
            activeOpacity={0.8}
          >
            <Text style={styles.composerActionIcon}>👥</Text>
            <Text style={styles.composerActionText}>Conectar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.composerActionBtn}
            onPress={() => router.push('/parches')}
            activeOpacity={0.8}
          >
            <Text style={styles.composerActionIcon}>🎯</Text>
            <Text style={styles.composerActionText}>Parches</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Feed Header */}
      <View style={styles.feedHeader}>
        <Text style={styles.feedTitle}>Novedades de la comunidad</Text>
        <Text style={styles.feedBadge}>Feed en vivo ✨</Text>
      </View>

      {/* Estados: Loading, Error, Empty, o Lista */}
      {isLoading ? (
        <View style={styles.stateContainer}>
          <ActivityIndicator size="large" color={ACCENT} />
          <Text style={styles.loadingText}>Cargando publicaciones de la comunidad…</Text>
        </View>
      ) : isError ? (
        <View style={styles.stateContainer}>
          <Text style={styles.emptyEmoji}>⚠️</Text>
          <Text style={styles.errorTitle}>No se pudieron cargar las publicaciones</Text>
          <Text style={styles.errorSubtitle}>
            {error instanceof Error ? error.message : 'Verifica tu conexión a internet e inténtalo de nuevo.'}
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()} activeOpacity={0.8}>
            <Text style={styles.retryBtnText}>🔄 Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : listaPublicaciones.length === 0 ? (
        <View style={styles.stateContainer}>
          <Text style={styles.emptyEmoji}>📸</Text>
          <Text style={styles.emptyTitle}>Aún no hay publicaciones</Text>
          <Text style={styles.emptySubtitle}>
            Sé el primero en compartir un proyecto, idea o saludo con todos tus compañeros y equipo SENA.
          </Text>
          <TouchableOpacity
            style={styles.btnCrearEmpty}
            onPress={handleAbrirModal}
            activeOpacity={0.85}
          >
            <Text style={styles.btnCrearEmptyText}>✨ Crear la primera publicación</Text>
          </TouchableOpacity>
        </View>
      ) : (
        listaPublicaciones.map((pub: Publicacion) => {
          const abiertos = comentariosAbiertos[pub.id] || false;
          const autorFoto = pub.autor?.fotoUrl;
          const autorEmoji = pub.autor?.avatarEmoji || '😊';
          const esAutor = String(pub.autor?.id) === String(user?.id) || !!pub.esMio;

          return (
            <View key={pub.id} style={styles.postCard}>
              {/* Cabecera del post */}
              <View style={styles.postHeader}>
                <TouchableOpacity
                  style={styles.postAuthorWrap}
                  onPress={() => setSelectedUserId(pub.autor?.id)}
                  activeOpacity={0.8}
                >
                  {autorFoto ? (
                    <Image
                      source={{ uri: autorFoto }}
                      style={styles.authorAvatarPhoto}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.authorAvatarCircle, { backgroundColor: (pub.autor?.avatarColor || ACCENT) + '25' }]}>
                      <Text style={styles.authorAvatarEmoji}>{autorEmoji}</Text>
                    </View>
                  )}
                  <View>
                    <Text style={styles.authorName}>{pub.autor?.nombre || 'Usuario SENA'}</Text>
                    <View style={styles.authorSubRow}>
                      <View style={styles.authorBadge}>
                        <Text style={styles.authorBadgeText}>
                          {pub.autor?.rol?.toUpperCase() || 'APRENDIZ'}
                        </Text>
                      </View>
                      <Text style={styles.postTime}>· {formatearTiempo(pub.creado)}</Text>
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Opciones del post (Editar/Eliminar si es propio, o Reportar) */}
                <View style={styles.postOptionsRow}>
                  {esAutor ? (
                    <>
                      <TouchableOpacity
                        onPress={() => handleStartEdit(pub)}
                        style={styles.btnPostOption}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.btnPostOptionText}>✏️</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDelete(pub.id)}
                        style={styles.btnPostOption}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.btnPostOptionText, { color: DANGER }]}>🗑️</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <TouchableOpacity
                      onPress={() => setReportingPubId(pub.id)}
                      style={styles.btnPostOption}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.btnPostOptionText}>🚩</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Contenido de texto */}
              <Text style={styles.postText}>{pub.texto}</Text>

              {/* Foto opcional del post con visor en pantalla completa */}
              {pub.fotoUrl ? (
                <TouchableOpacity
                  style={styles.postImageWrap}
                  activeOpacity={0.9}
                  onPress={() => setFotoVisorUrl(pub.fotoUrl)}
                >
                  <Image
                    source={{ uri: pub.fotoUrl }}
                    style={styles.postImage}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              ) : null}

              {/* Barra de interacción */}
              <View style={styles.interactionBar}>
                <TouchableOpacity
                  style={[styles.actionButton, pub.likedPorMi && styles.actionButtonLiked]}
                  onPress={() => likeMutation.mutate(pub.id)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.actionIcon}>{pub.likedPorMi ? '❤️' : '🤍'}</Text>
                  <Text style={[styles.actionText, pub.likedPorMi && styles.actionTextLiked]}>
                    {pub.likesCount} {pub.likesCount === 1 ? 'Me gusta' : 'Me gusta'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => toggleComentarios(pub.id)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.actionIcon}>💬</Text>
                  <Text style={styles.actionText}>
                    {pub.comentarios?.length || 0} {pub.comentarios?.length === 1 ? 'Comentario' : 'Comentarios'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Comentarios */}
              {abiertos && (
                <View style={styles.commentsSection}>
                  <View style={styles.commentsDivider} />

                  {pub.comentarios && pub.comentarios.length > 0 ? (
                    pub.comentarios.map(com => (
                      <View key={com.id} style={styles.commentItem}>
                        <TouchableOpacity
                          onPress={() => setSelectedUserId(com.autorId)}
                          activeOpacity={0.8}
                        >
                          {com.autorFotoUrl ? (
                            <Image
                              source={{ uri: com.autorFotoUrl }}
                              style={styles.commentAvatarPhoto}
                              resizeMode="cover"
                            />
                          ) : (
                            <View style={styles.commentAvatar}>
                              <Text style={styles.commentAvatarEmoji}>{com.autorAvatarEmoji || '😊'}</Text>
                            </View>
                          )}
                        </TouchableOpacity>
                        <View style={styles.commentBubble}>
                          <View style={styles.commentTop}>
                            <TouchableOpacity onPress={() => setSelectedUserId(com.autorId)}>
                              <Text style={styles.commentAuthor}>{com.autorNombre}</Text>
                            </TouchableOpacity>
                            <Text style={styles.commentTime}>{formatearTiempo(com.creado)}</Text>
                          </View>
                          <Text style={styles.commentText}>{com.texto}</Text>
                        </View>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.noCommentsText}>Aún no hay comentarios. ¡Sé el primero en opinar!</Text>
                  )}

                  {/* Formulario comentario */}
                  <View style={styles.newCommentRow}>
                    <TextInput
                      style={styles.newCommentInput}
                      placeholder="Escribe un comentario respetuoso…"
                      placeholderTextColor="#786E8A"
                      value={textoComentario[pub.id] || ''}
                      onChangeText={(val) => setTextoComentario(prev => ({ ...prev, [pub.id]: val }))}
                      onSubmitEditing={() => handleEnviarComentario(pub.id)}
                      returnKeyType="send"
                    />
                    <TouchableOpacity
                      style={styles.btnSendComment}
                      onPress={() => handleEnviarComentario(pub.id)}
                      activeOpacity={0.8}
                      disabled={comentarMutation.isPending}
                    >
                      <Text style={styles.btnSendCommentText}>Enviar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          );
        })
      )}

      {/* MODAL CREAR PUBLICACIÓN */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={handleCerrarModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nueva publicación</Text>
              <TouchableOpacity onPress={handleCerrarModal} style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {formError ? (
              <View style={styles.formErrorBanner}>
                <Text style={styles.formErrorText}>{formError}</Text>
              </View>
            ) : null}

            <Text style={styles.modalFieldLabel}>¿Qué quieres compartir?</Text>
            <TextInput
              style={styles.modalTextInput}
              multiline
              maxLength={1000}
              placeholder="Escribe tu mensaje, pregunta o comparte una experiencia con la comunidad…"
              placeholderTextColor="#786E8A"
              value={nuevoTexto}
              onChangeText={setNuevoTexto}
            />

            <Text style={styles.modalFieldLabel}>Foto de la publicación (opcional)</Text>
            
            {Platform.OS === 'web' && (
              <TouchableOpacity
                style={[styles.modalPickPhotoBtn, fotoUploading && styles.modalPickPhotoBtnDisabled]}
                onPress={fotoUploading ? undefined : handlePickFotoPub}
                activeOpacity={fotoUploading ? 1 : 0.8}
              >
                {fotoUploading ? (
                  <View style={styles.modalUploadingRow}>
                    <ActivityIndicator size="small" color={ACCENT} style={{ marginRight: 8 }} />
                    <Text style={styles.modalPickPhotoBtnText}>Subiendo foto a Cloudinary…</Text>
                  </View>
                ) : (
                  <Text style={styles.modalPickPhotoBtnText}>
                    📁 Subir foto desde tu dispositivo (JPG/PNG/WebP · máx 3 MB)
                  </Text>
                )}
              </TouchableOpacity>
            )}

            {fotoError ? (
              <View style={styles.formErrorBanner}>
                <Text style={styles.formErrorText}>⚠️ {fotoError}</Text>
              </View>
            ) : null}

            <Text style={styles.modalFieldHint}>O pega una URL pública de imagen:</Text>
            <TextInput
              style={styles.modalUrlInput}
              placeholder="https://... enlace directo HTTPS de imagen"
              placeholderTextColor="#786E8A"
              value={nuevaFotoUrl.startsWith('data:') ? '' : nuevaFotoUrl}
              onChangeText={(text) => {
                setNuevaFotoUrl(text);
                setFotoPreview(text.trim());
                setFotoError('');
              }}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!fotoUploading}
            />

            {fotoPreview ? (
              <View style={styles.previewContainer}>
                <Text style={styles.previewLabel}>Vista previa:</Text>
                <Image
                  source={{ uri: fotoPreview }}
                  style={styles.previewImage}
                  resizeMode="cover"
                />
                {!fotoUploading && (
                  <TouchableOpacity
                    style={styles.btnEliminarFoto}
                    onPress={() => {
                      setNuevaFotoUrl('');
                      setFotoPreview('');
                      setFotoError('');
                    }}
                  >
                    <Text style={styles.btnEliminarFotoText}>✕ Quitar imagen</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : null}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={handleCerrarModal}
                activeOpacity={0.8}
                disabled={fotoUploading}
              >
                <Text style={styles.modalCancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitBtn, (crearMutation.isPending || fotoUploading) && styles.btnDisabled]}
                onPress={handlePublicar}
                disabled={crearMutation.isPending || fotoUploading}
                activeOpacity={0.85}
              >
                {crearMutation.isPending || fotoUploading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>Publicar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL EDITAR PUBLICACIÓN */}
      <Modal
        visible={!!editingPubId}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setEditingPubId(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Editar publicación</Text>
              <TouchableOpacity onPress={() => setEditingPubId(null)} style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {editError ? (
              <View style={styles.formErrorBanner}>
                <Text style={styles.formErrorText}>{editError}</Text>
              </View>
            ) : null}

            <TextInput
              style={styles.modalTextInput}
              multiline
              maxLength={1000}
              value={editText}
              onChangeText={setEditText}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setEditingPubId(null)}
              >
                <Text style={styles.modalCancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitBtn, editarMutation.isPending && styles.btnDisabled]}
                onPress={handleSaveEdit}
                disabled={editarMutation.isPending}
              >
                <Text style={styles.modalSubmitBtnText}>
                  {editarMutation.isPending ? 'Guardando…' : 'Guardar cambios'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL REPORTAR PUBLICACIÓN */}
      <Modal
        visible={!!reportingPubId}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setReportingPubId(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reportar publicación</Text>
              <TouchableOpacity onPress={() => setReportingPubId(null)} style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalFieldLabel}>Selecciona el motivo del reporte:</Text>
            {['Contenido inapropiado', 'Spam o publicidad', 'Acoso o lenguaje ofensivo', 'Información falsa'].map(m => (
              <TouchableOpacity
                key={m}
                style={[styles.reportOptionBtn, reportReason === m && styles.reportOptionBtnActive]}
                onPress={() => setReportReason(m)}
              >
                <Text style={[styles.reportOptionText, reportReason === m && styles.reportOptionTextActive]}>{m}</Text>
              </TouchableOpacity>
            ))}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setReportingPubId(null)}
              >
                <Text style={styles.modalCancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitBtn, { backgroundColor: DANGER }]}
                onPress={handleEnviarReportePost}
              >
                <Text style={styles.modalSubmitBtnText}>Enviar reporte</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Universal de Perfil Público */}
      <PublicProfileModal
        userId={selectedUserId}
        visible={!!selectedUserId}
        onClose={() => setSelectedUserId(null)}
        onOpenChat={(chatId) => {
          setSelectedUserId(null);
          router.push('/chats');
        }}
      />

      {/* Visor de foto en pantalla completa */}
      <FotoViewerModal
        visible={!!fotoVisorUrl}
        fotoUrl={fotoVisorUrl}
        onClose={() => setFotoVisorUrl(null)}
      />

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  content: {
    padding: 16,
    paddingTop: Platform.OS === 'web' ? 88 : 24,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#263238',
  },
  btnCrearTop: {
    backgroundColor: ACCENT,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: ACCENT,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 3,
  },
  btnCrearTopText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },

  // Composer Box
  composerCard: {
    backgroundColor: CARD,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    marginBottom: 22,
  },
  composerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  myAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(57, 169, 0, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: ACCENT,
  },
  myAvatarEmoji: {
    fontSize: 22,
  },
  composerFakeInput: {
    flex: 1,
    backgroundColor: '#1E252F',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  composerPlaceholder: {
    color: '#8D83A0',
    fontSize: 14,
  },
  composerFooter: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#263238',
  },
  composerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  composerActionIcon: {
    fontSize: 18,
  },
  composerActionText: {
    color: '#B9B1C9',
    fontSize: 13,
    fontWeight: '600',
  },

  // Feed Header
  feedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  feedTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F0ECF6',
  },
  feedBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: '#00E5A3',
    backgroundColor: 'rgba(0, 229, 163, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },

  // States
  stateContainer: {
    backgroundColor: CARD,
    borderRadius: 18,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: CARD_BORDER,
    marginVertical: 20,
  },
  loadingText: {
    color: '#8D83A0',
    marginTop: 14,
    fontSize: 14,
  },
  emptyEmoji: {
    fontSize: 42,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F0ECF6',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#8D83A0',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 400,
    marginBottom: 20,
  },
  btnCrearEmpty: {
    backgroundColor: ACCENT,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  btnCrearEmptyText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: DANGER,
    marginBottom: 6,
  },
  errorSubtitle: {
    fontSize: 13,
    color: '#8D83A0',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryBtn: {
    backgroundColor: '#282234',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryBtnText: {
    color: '#F0ECF6',
    fontWeight: '600',
  },

  // Post Card
  postCard: {
    backgroundColor: CARD,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 3,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  postAuthorWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  authorAvatarPhoto: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: ACCENT,
  },
  authorAvatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  authorAvatarEmoji: {
    fontSize: 22,
  },
  authorName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F0ECF6',
  },
  authorSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  authorBadge: {
    backgroundColor: 'rgba(57, 169, 0, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  authorBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: ACCENT,
  },
  postTime: {
    fontSize: 12,
    color: '#8D83A0',
  },
  postOptionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  btnPostOption: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#1E252F',
  },
  btnPostOptionText: {
    fontSize: 14,
  },
  postText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#F0ECF6',
    marginBottom: 12,
  },
  postImageWrap: {
    width: '100%',
    height: 280,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#120F1A',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  postImage: {
    width: '100%',
    height: '100%',
  },

  // Interactions
  interactionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#263238',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  actionButtonLiked: {
    backgroundColor: 'rgba(57, 169, 0, 0.15)',
  },
  actionIcon: {
    fontSize: 16,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#B9B1C9',
  },
  actionTextLiked: {
    color: ACCENT,
    fontWeight: '700',
  },

  // Comments Section
  commentsSection: {
    marginTop: 14,
  },
  commentsDivider: {
    height: 1,
    backgroundColor: '#263238',
    marginBottom: 12,
  },
  commentItem: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  commentAvatarPhoto: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E252F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentAvatarEmoji: {
    fontSize: 16,
  },
  commentBubble: {
    flex: 1,
    backgroundColor: '#1E252F',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  commentTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  commentAuthor: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F0ECF6',
  },
  commentTime: {
    fontSize: 11,
    color: '#8D83A0',
  },
  commentText: {
    fontSize: 13,
    color: '#B9B1C9',
    lineHeight: 18,
  },
  noCommentsText: {
    color: '#786E8A',
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: 12,
  },
  newCommentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  newCommentInput: {
    flex: 1,
    backgroundColor: '#1E252F',
    color: '#F0ECF6',
    fontSize: 13,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  btnSendComment: {
    backgroundColor: ACCENT,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
  },
  btnSendCommentText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: CARD,
    borderRadius: 20,
    padding: 22,
    maxWidth: 540,
    width: '100%',
    borderWidth: 1,
    borderColor: CARD_BORDER,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#F0ECF6',
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalCloseText: {
    fontSize: 18,
    color: '#8D83A0',
    fontWeight: '700',
  },
  formErrorBanner: {
    backgroundColor: 'rgba(255, 91, 110, 0.15)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 91, 110, 0.3)',
  },
  formErrorText: {
    color: DANGER,
    fontSize: 13,
    fontWeight: '600',
  },
  modalFieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#B9B1C9',
    marginBottom: 6,
  },
  modalTextInput: {
    backgroundColor: '#1E252F',
    color: '#F0ECF6',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#2D3748',
    height: 100,
    textAlignVertical: 'top',
    marginBottom: 14,
  },
  modalUrlInput: {
    backgroundColor: '#1E252F',
    color: '#F0ECF6',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#2D3748',
    marginBottom: 14,
  },
  modalPickPhotoBtn: {
    backgroundColor: 'rgba(57, 169, 0, 0.15)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(57, 169, 0, 0.35)',
  },
  modalPickPhotoBtnDisabled: {
    opacity: 0.6,
  },
  modalPickPhotoBtnText: {
    color: ACCENT,
    fontWeight: '700',
    fontSize: 13,
  },
  modalUploadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalFieldHint: {
    fontSize: 12,
    color: '#8D83A0',
    marginBottom: 6,
  },
  previewContainer: {
    marginBottom: 14,
    alignItems: 'center',
  },
  previewLabel: {
    fontSize: 12,
    color: '#8D83A0',
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  previewImage: {
    width: '100%',
    height: 160,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: ACCENT,
  },
  btnEliminarFoto: {
    marginTop: 6,
    paddingVertical: 4,
  },
  btnEliminarFotoText: {
    color: DANGER,
    fontSize: 12,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
  },
  modalCancelBtn: {
    backgroundColor: '#1E252F',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  modalCancelBtnText: {
    color: '#8D83A0',
    fontWeight: '600',
    fontSize: 14,
  },
  modalSubmitBtn: {
    backgroundColor: ACCENT,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubmitBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  btnDisabled: {
    opacity: 0.65,
  },
  reportOptionBtn: {
    backgroundColor: '#1E252F',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2D3748',
  },
  reportOptionBtnActive: {
    borderColor: ACCENT,
    backgroundColor: 'rgba(57, 169, 0, 0.15)',
  },
  reportOptionText: {
    color: '#B9B1C9',
    fontSize: 13,
    fontWeight: '600',
  },
  reportOptionTextActive: {
    color: ACCENT,
    fontWeight: '800',
  },
});

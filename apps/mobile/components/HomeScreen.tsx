import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, RefreshControl,
  TextInput, Image, Platform, Modal, Alert
} from 'react-native';
import { useState, useCallback, useMemo } from 'react';
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
import NavIcon, { getAvatarIconName } from './NavIcon';
import PublicProfileModal from './PublicProfileModal';
import FotoViewerModal from './FotoViewerModal';
import { pendingChat } from '../lib/pendingChat';
import { useTheme } from '../app/context/ThemeContext';

const ACCENT = '#39A900';
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
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

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
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.accent}
          colors={[colors.accent]}
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><NavIcon name="add" size={17} color="#FFFFFF" /><Text style={styles.btnCrearTopText}>Crear publicación</Text></View>
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
            <NavIcon name={user?.rol === 'aprendiz' ? 'school' : 'profile'} size={22} color={ACCENT} />
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
            <NavIcon name="camera" size={18} color={ACCENT} />
            <Text style={styles.composerActionText}>Foto</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.composerActionBtn}
            onPress={() => router.push('/descubrir')}
            activeOpacity={0.8}
          >
            <NavIcon name="users" size={18} color={ACCENT} />
            <Text style={styles.composerActionText}>Conectar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.composerActionBtn}
            onPress={() => router.push('/parches')}
            activeOpacity={0.8}
          >
            <NavIcon name="target" size={18} color={ACCENT} />
            <Text style={styles.composerActionText}>Parches</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Feed Header */}
      <View style={styles.feedHeader}>
        <Text style={styles.feedTitle}>Novedades de la comunidad</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><NavIcon name="sparkles" size={14} color={ACCENT} /><Text style={styles.feedBadge}>Feed en vivo</Text></View>
      </View>

      {/* Estados: Loading, Error, Empty, o Lista */}
      {isLoading ? (
        <View style={[styles.stateContainer, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.textSub }]}>Cargando publicaciones de la comunidad…</Text>
        </View>
      ) : isError ? (
        <View style={[styles.stateContainer, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <NavIcon name="alert" size={42} color={colors.danger} />
          <Text style={[styles.errorTitle, { color: colors.danger }]}>No se pudieron cargar las publicaciones</Text>
          <Text style={[styles.errorSubtitle, { color: colors.textSub }]}>
            {error instanceof Error ? error.message : 'Verifica tu conexión a internet e inténtalo de nuevo.'}
          </Text>
          <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.chipBg }]} onPress={() => refetch()} activeOpacity={0.8}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><NavIcon name="refresh" size={16} color={colors.text} /><Text style={[styles.retryBtnText, { color: colors.text }]}>Reintentar</Text></View>
          </TouchableOpacity>
        </View>
      ) : listaPublicaciones.length === 0 ? (
        <View style={[styles.stateContainer, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <NavIcon name="photo" size={42} color={colors.textSub} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>Aún no hay publicaciones</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSub }]}>
            Sé el primero en compartir un proyecto, idea o saludo con todos tus compañeros y equipo SENA.
          </Text>
          <TouchableOpacity
            style={styles.btnCrearEmpty}
            onPress={handleAbrirModal}
            activeOpacity={0.85}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><NavIcon name="sparkles" size={16} color="#FFFFFF" /><Text style={styles.btnCrearEmptyText}>Crear la primera publicación</Text></View>
          </TouchableOpacity>
        </View>
      ) : (
        listaPublicaciones.map((pub: Publicacion) => {
          const abiertos = comentariosAbiertos[pub.id] || false;
          const autorFoto = pub.autor?.fotoUrl;
          const autorEmoji = pub.autor?.avatarEmoji;
          const esAutor = String(pub.autor?.id) === String(user?.id) || !!pub.esMio;

          return (
            <View key={pub.id} style={[styles.postCard, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
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
                      <NavIcon name={getAvatarIconName(autorEmoji)} size={24} color={ACCENT} />
                    </View>
                  )}
                  <View>
                    <Text style={[styles.authorName, { color: colors.text }]}>{pub.autor?.nombre || 'Usuario SENA'}</Text>
                    <View style={styles.authorSubRow}>
                      <View style={styles.authorBadge}>
                        <Text style={styles.authorBadgeText}>
                          {pub.autor?.rol?.toUpperCase() || 'APRENDIZ'}
                        </Text>
                      </View>
                      <Text style={[styles.postTime, { color: colors.textSub }]}>· {formatearTiempo(pub.creado)}</Text>
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Opciones del post (Editar/Eliminar si es propio, o Reportar) */}
                <View style={styles.postOptionsRow}>
                  {esAutor ? (
                    <>
                      <TouchableOpacity
                        onPress={() => handleStartEdit(pub)}
                        style={[styles.btnPostOption, { backgroundColor: colors.chipBg }]}
                        activeOpacity={0.7}
                      >
                        <NavIcon name="edit" size={17} color={colors.textSub} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDelete(pub.id)}
                        style={[styles.btnPostOption, { backgroundColor: colors.chipBg }]}
                        activeOpacity={0.7}
                      >
                        <NavIcon name="trash" size={17} color={DANGER} />
                      </TouchableOpacity>
                    </>
                  ) : (
                    <TouchableOpacity
                      onPress={() => setReportingPubId(pub.id)}
                      style={[styles.btnPostOption, { backgroundColor: colors.chipBg }]}
                      activeOpacity={0.7}
                    >
                      <NavIcon name="flag" size={17} color={colors.textSub} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Contenido de texto */}
              <Text style={[styles.postText, { color: colors.text }]}>{pub.texto}</Text>

              {/* Foto opcional del post con visor en pantalla completa */}
              {pub.fotoUrl ? (
                <TouchableOpacity
                  style={styles.postImageWrap}
                  activeOpacity={0.9}
                  onPress={() => setFotoVisorUrl(pub.fotoUrl || null)}
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
                  <NavIcon name="heart" size={18} color={pub.likedPorMi ? ACCENT : colors.textSub} />
                  <Text style={[styles.actionText, pub.likedPorMi && styles.actionTextLiked]}>
                    {pub.likesCount} {pub.likesCount === 1 ? 'Me gusta' : 'Me gusta'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => toggleComentarios(pub.id)}
                  activeOpacity={0.7}
                >
                  <NavIcon name="chats" size={18} color={colors.textSub} />
                  <Text style={styles.actionText}>
                    {pub.comentarios?.length || 0} {pub.comentarios?.length === 1 ? 'Comentario' : 'Comentarios'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Comentarios */}
              {abiertos && (
                <View style={styles.commentsSection}>
                  <View style={[styles.commentsDivider, { backgroundColor: colors.cardBorder }]} />

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
                            <View style={[styles.commentAvatar, { backgroundColor: colors.chipBg }]}>
                              <NavIcon name={getAvatarIconName(com.autorAvatarEmoji)} size={18} color={colors.textSub} />
                            </View>
                          )}
                        </TouchableOpacity>
                        <View style={[styles.commentBubble, { backgroundColor: colors.inputBg }]}>
                          <View style={styles.commentTop}>
                            <TouchableOpacity onPress={() => setSelectedUserId(com.autorId)}>
                              <Text style={[styles.commentAuthor, { color: colors.text }]}>{com.autorNombre}</Text>
                            </TouchableOpacity>
                            <Text style={[styles.commentTime, { color: colors.textMuted }]}>{formatearTiempo(com.creado)}</Text>
                          </View>
                          <Text style={[styles.commentText, { color: colors.textSub }]}>{com.texto}</Text>
                        </View>
                      </View>
                    ))
                  ) : (
                    <Text style={[styles.noCommentsText, { color: colors.textMuted }]}>Aún no hay comentarios. ¡Sé el primero en opinar!</Text>
                  )}

                  {/* Formulario comentario */}
                  <View style={styles.newCommentRow}>
                    <TextInput
                      style={[styles.newCommentInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.inputBorder }]}
                      placeholder="Escribe un comentario respetuoso…"
                      placeholderTextColor={colors.textMuted}
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
          <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Nueva publicación</Text>
              <TouchableOpacity onPress={handleCerrarModal} style={styles.modalCloseBtn}>
                <NavIcon name="close" size={20} color={colors.textSub} />
              </TouchableOpacity>
            </View>

            {formError ? (
              <View style={styles.formErrorBanner}>
                <Text style={styles.formErrorText}>{formError}</Text>
              </View>
            ) : null}

            <Text style={[styles.modalFieldLabel, { color: colors.textSub }]}>¿Qué quieres compartir?</Text>
            <TextInput
              style={[styles.modalTextInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.inputBorder }]}
              multiline
              maxLength={1000}
              placeholder="Escribe tu mensaje, pregunta o comparte una experiencia con la comunidad…"
              placeholderTextColor={colors.textMuted}
              value={nuevoTexto}
              onChangeText={setNuevoTexto}
            />

            <Text style={[styles.modalFieldLabel, { color: colors.textSub }]}>Foto de la publicación (opcional)</Text>
            
            {Platform.OS === 'web' && (
              <TouchableOpacity
                style={[styles.modalPickPhotoBtn, fotoUploading && styles.modalPickPhotoBtnDisabled]}
                onPress={fotoUploading ? undefined : handlePickFotoPub}
                activeOpacity={fotoUploading ? 1 : 0.8}
              >
                {fotoUploading ? (
                  <View style={styles.modalUploadingRow}>
                    <ActivityIndicator size="small" color={colors.accent} style={{ marginRight: 8 }} />
                    <Text style={styles.modalPickPhotoBtnText}>Subiendo foto a Cloudinary…</Text>
                  </View>
                ) : (
                  <Text style={styles.modalPickPhotoBtnText}>
                    Subir foto desde tu dispositivo (JPG/PNG/WebP · máx 3 MB)
                  </Text>
                )}
              </TouchableOpacity>
            )}

            {fotoError ? (
              <View style={styles.formErrorBanner}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><NavIcon name="alert" size={16} color={DANGER} /><Text style={styles.formErrorText}>{fotoError}</Text></View>
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
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}><NavIcon name="close" size={15} color={colors.textSub} /><Text style={styles.btnEliminarFotoText}>Quitar imagen</Text></View>
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
                <NavIcon name="close" size={20} color={colors.textSub} />
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
                <NavIcon name="close" size={20} color={colors.textSub} />
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
                style={[styles.modalSubmitBtn, { backgroundColor: colors.danger }]}
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
          if (chatId) {
            pendingChat.set(String(chatId));
          }
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

function makeStyles(colors: import('../app/context/ThemeContext').ThemeColors) {
  return StyleSheet.create({
  container: {
    flex: 1,
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
    borderBottomColor: colors.cardBorder,
  },
  btnCrearTop: {
    backgroundColor: colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: colors.accent,
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
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
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
    borderColor: colors.accent,
  },
  myAvatarEmoji: {
    fontSize: 22,
  },
  composerFakeInput: {
    flex: 1,
    backgroundColor: colors.inputBg,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  composerPlaceholder: {
    color: colors.textSub,
    fontSize: 14,
  },
  composerFooter: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
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
    color: colors.textSub,
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
    color: colors.text,
  },
  feedBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.success,
    backgroundColor: 'rgba(0, 229, 163, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },

  // States
  stateContainer: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginVertical: 20,
  },
  loadingText: {
    color: colors.textSub,
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
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSub,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 400,
    marginBottom: 20,
  },
  btnCrearEmpty: {
    backgroundColor: colors.accent,
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
    color: colors.danger,
    marginBottom: 6,
  },
  errorSubtitle: {
    fontSize: 13,
    color: colors.textSub,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryBtn: {
    backgroundColor: colors.chipBg,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryBtnText: {
    color: colors.text,
    fontWeight: '600',
  },

  // Post Card
  postCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
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
    color: colors.text,
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
    color: colors.accent,
  },
  postTime: {
    fontSize: 12,
    color: colors.textSub,
  },
  postOptionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  btnPostOption: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: colors.chipBg,
  },
  btnPostOptionText: {
    fontSize: 14,
  },
  postText: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
    marginBottom: 12,
  },
  postImageWrap: {
    width: '100%',
    height: 280,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.bg,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
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
    borderTopColor: colors.cardBorder,
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
    color: colors.textSub,
  },
  actionTextLiked: {
    color: colors.accent,
    fontWeight: '700',
  },

  // Comments Section
  commentsSection: {
    marginTop: 14,
  },
  commentsDivider: {
    height: 1,
    backgroundColor: colors.cardBorder,
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
    backgroundColor: colors.chipBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentAvatarEmoji: {
    fontSize: 16,
  },
  commentBubble: {
    flex: 1,
    backgroundColor: colors.inputBg,
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
    color: colors.text,
  },
  commentTime: {
    fontSize: 11,
    color: colors.textMuted,
  },
  commentText: {
    fontSize: 13,
    color: colors.textSub,
    lineHeight: 18,
  },
  noCommentsText: {
    color: colors.textMuted,
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
    backgroundColor: colors.inputBg,
    color: colors.text,
    fontSize: 13,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  btnSendComment: {
    backgroundColor: colors.accent,
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
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 22,
    maxWidth: 540,
    width: '100%',
    borderWidth: 1,
    borderColor: colors.cardBorder,
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
    color: colors.text,
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalCloseText: {
    fontSize: 18,
    color: colors.textSub,
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
    color: colors.danger,
    fontSize: 13,
    fontWeight: '600',
  },
  modalFieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSub,
    marginBottom: 6,
  },
  modalTextInput: {
    backgroundColor: colors.inputBg,
    color: colors.text,
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    height: 100,
    textAlignVertical: 'top',
    marginBottom: 14,
  },
  modalUrlInput: {
    backgroundColor: colors.inputBg,
    color: colors.text,
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: colors.inputBorder,
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
    color: colors.accent,
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
    color: colors.textSub,
    marginBottom: 6,
  },
  previewContainer: {
    marginBottom: 14,
    alignItems: 'center',
  },
  previewLabel: {
    fontSize: 12,
    color: colors.textSub,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  previewImage: {
    width: '100%',
    height: 160,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  btnEliminarFoto: {
    marginTop: 6,
    paddingVertical: 4,
  },
  btnEliminarFotoText: {
    color: colors.danger,
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
    backgroundColor: colors.chipBg,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
  },
  modalCancelBtnText: {
    color: colors.textSub,
    fontWeight: '600',
    fontSize: 14,
  },
  modalSubmitBtn: {
    backgroundColor: colors.accent,
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
    backgroundColor: colors.chipBg,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.inputBorder,
  },
  reportOptionBtnActive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(57, 169, 0, 0.15)',
  },
  reportOptionText: {
    color: colors.textSub,
    fontSize: 13,
    fontWeight: '600',
  },
  reportOptionTextActive: {
    color: colors.accent,
    fontWeight: '800',
  },
  });
}

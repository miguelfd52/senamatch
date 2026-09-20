import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, TextInput,
  KeyboardAvoidingView, Platform, RefreshControl,
  Image
} from 'react-native';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '../app/context/AuthContext';
import { useBandeja, useConversacion, useEnviarMensaje } from '../hooks/useParches';
import { api } from '../lib/api';
import PeopleScreen from './PeopleScreen';
import PublicProfileModal from './PublicProfileModal';
import { pendingChat } from '../lib/pendingChat';

const ACCENT = '#39A900';
const BG = '#0F0C18';
const CARD = '#161B22';
const CARD_BORDER = '#263238';
const DANGER = '#FF5B6E';

export default function ChatsScreen() {
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [showPeople, setShowPeople] = useState(false);

  // Suscribirse al singleton para abrir chats desde notificaciones
  useEffect(() => {
    // Verificar si ya hay un chat pendiente al montar
    const pending = pendingChat.get();
    if (pending) {
      setSelectedChat(pending);
      pendingChat.clear();
    }

    // Suscribirse a futuros cambios
    const unsub = pendingChat.subscribe((chatId) => {
      if (chatId) {
        setSelectedChat(chatId);
        pendingChat.clear();
      }
    });
    return unsub;
  }, []);

  if (selectedChat) {
    return (
      <ConversacionView
        chatId={selectedChat}
        onBack={() => setSelectedChat(null)}
      />
    );
  }

  if (showPeople) {
    return (
      <View style={{ flex: 1, backgroundColor: BG }}>
        <PeopleScreen
          onOpenChat={(id) => {
            setShowPeople(false);
            setSelectedChat(id);
          }}
          onBack={() => setShowPeople(false)}
        />
      </View>
    );
  }

  return (
    <ChatsList
      onSelect={setSelectedChat}
      onOpenPeople={() => setShowPeople(true)}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Lista de chats                                                              */
/* -------------------------------------------------------------------------- */

function ChatsList({
  onSelect,
  onOpenPeople
}: {
  onSelect: (id: string) => void;
  onOpenPeople: () => void;
}) {
  const { data: chats, isLoading, refetch } = useBandeja();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const chatsList = Array.isArray(chats) ? chats : [];
  const sorted = [...chatsList].sort((a: any, b: any) => (b.ultimo || 0) - (a.ultimo || 0));

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={styles.loadingText}>Cargando conversaciones…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Chats</Text>
          <Text style={styles.headerSubtitle}>Tus conversaciones directas y de parches</Text>
        </View>
        <TouchableOpacity
          style={styles.newChatBtn}
          onPress={onOpenPeople}
          activeOpacity={0.85}
        >
          <Text style={styles.newChatBtnEmoji}>➕</Text>
          <Text style={styles.newChatBtnText}>Nueva conversación</Text>
        </TouchableOpacity>
      </View>

      {sorted.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>💬</Text>
          <Text style={styles.emptyTitle}>Sin conversaciones activas</Text>
          <Text style={styles.emptySubtitle}>
            Encuentra a personas registradas en SENA Match o crea un parche para comenzar a chatear.
          </Text>
          <TouchableOpacity
            style={styles.explorePeopleBtn}
            onPress={onOpenPeople}
            activeOpacity={0.85}
          >
            <Text style={styles.explorePeopleBtnEmoji}>👥</Text>
            <Text style={styles.explorePeopleBtnText}>Explorar comunidad para chatear</Text>
          </TouchableOpacity>
        </View>
      ) : (
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
          {sorted.map((chat: any) => {
            const lastMsg = chat.mensajes?.length
              ? chat.mensajes[chat.mensajes.length - 1]
              : null;
            const lastText = lastMsg?.txt || 'Sin mensajes aún';
            const lastTime = chat.ultimo
              ? new Date(chat.ultimo).toLocaleTimeString('es-CO', {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '';
            const isParche = chat.tipo === 'parche';
            const isDirect = chat.tipo === 'directo';
            const otro = chat.otroUsuario;
            const chatTitle = otro?.nombre || chat.titulo || (isParche ? 'Chat de parche' : 'Conversación');
            const unread = chat.unreadCount || 0;

            return (
              <TouchableOpacity
                key={chat.id}
                style={[styles.chatCard, unread > 0 && styles.chatCardUnread]}
                onPress={() => onSelect(chat.id)}
                activeOpacity={0.7}
              >
                {/* Avatar */}
                <TouchableOpacity
                  onPress={() => otro?.id && setSelectedProfileId(otro.id)}
                  activeOpacity={0.8}
                >
                  {otro?.fotoUrl ? (
                    <Image source={{ uri: otro.fotoUrl }} style={styles.chatAvatarPhoto} resizeMode="cover" />
                  ) : (
                    <View
                      style={[
                        styles.chatAvatar,
                        isParche && styles.chatAvatarParche,
                        { backgroundColor: (otro?.avatarColor || ACCENT) + '25' }
                      ]}
                    >
                      <Text style={styles.chatAvatarEmoji}>
                        {otro?.avatarEmoji || (isParche ? '🎯' : '💬')}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>

                <View style={styles.chatInfo}>
                  <View style={styles.chatTopRow}>
                    <Text style={[styles.chatName, unread > 0 && styles.chatNameUnread]} numberOfLines={1}>
                      {chatTitle}
                    </Text>
                    <Text style={styles.chatTime}>{lastTime}</Text>
                  </View>

                  <Text style={[styles.chatPreview, unread > 0 && styles.chatPreviewUnread]} numberOfLines={1}>
                    {lastText}
                  </Text>

                  <View style={styles.chatMeta}>
                    <Text style={styles.chatBadge}>
                      {isParche ? '🎯 Parche' : isDirect ? '👤 Directo' : '❤️ Match'}
                    </Text>
                    {otro?.rol ? (
                      <Text style={styles.chatRole}>
                        {otro.rol.charAt(0).toUpperCase() + otro.rol.slice(1)}
                      </Text>
                    ) : (
                      <Text style={styles.chatMembers}>
                        {chat.miembros?.length || 0} miembros
                      </Text>
                    )}
                    {unread > 0 ? (
                      <View style={styles.unreadCounter}>
                        <Text style={styles.unreadCounterText}>{unread}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}

      {/* Perfil público modal si se pulsa sobre el avatar */}
      <PublicProfileModal
        userId={selectedProfileId}
        visible={!!selectedProfileId}
        onClose={() => setSelectedProfileId(null)}
        onOpenChat={(id) => {
          setSelectedProfileId(null);
          onSelect(id);
        }}
      />
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Vista de conversación                                                       */
/* -------------------------------------------------------------------------- */

function ConversacionView({ chatId, onBack }: { chatId: string; onBack: () => void }) {
  const { user } = useAuth();
  const { data: chatData, isLoading } = useConversacion(chatId);
  const enviarMutation = useEnviarMensaje(chatId);
  const [texto, setTexto] = useState('');
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const [mensajeFallido, setMensajeFallido] = useState<string | null>(null);
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);

  const scrollRef = useRef<ScrollView>(null);

  const chat = chatData as any;
  const mensajes = chat?.mensajes || [];

  // Marcar mensajes como leídos al abrir la conversación
  useEffect(() => {
    if (chatId) {
      api.post(`/chats/${chatId}/leer`).catch(() => {});
    }
  }, [chatId, mensajes.length]);

  useEffect(() => {
    if (scrollRef.current && mensajes.length > 0) {
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: false });
      }, 100);
    }
  }, [mensajes.length]);

  const handleEnviar = (textoAEnviar?: string) => {
    const txt = (textoAEnviar || texto).trim();
    if (!txt) return;

    setErrorEnvio(null);
    setMensajeFallido(null);

    enviarMutation.mutate(txt, {
      onSuccess: () => {
        setTexto('');
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
      },
      onError: (err: any) => {
        setErrorEnvio(err?.message || 'No se pudo enviar el mensaje. Revisa tu conexión.');
        setMensajeFallido(txt);
      }
    });
  };

  const handleReintentar = () => {
    if (mensajeFallido) {
      handleEnviar(mensajeFallido);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }

  const isParche = chat?.tipo === 'parche';
  const chatTitle = chat?.titulo || (isParche ? 'Chat de parche' : 'Conversación');
  const otro = chat?.otroUsuario;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Top bar */}
      <View style={styles.convHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backText}>‹ Volver</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.convTitleWrap}
          onPress={() => otro?.id && setSelectedParticipantId(otro.id)}
          activeOpacity={otro?.id ? 0.8 : 1}
        >
          <Text style={styles.convTitle} numberOfLines={1}>{chatTitle}</Text>
          <Text style={styles.convSubtitle}>
            {isParche ? 'Parche grupal' : (otro?.rol ? `${otro.rol} • SENA` : 'En línea')}
          </Text>
        </TouchableOpacity>

        <View style={{ width: 50 }} />
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={styles.messagesArea}
        contentContainerStyle={styles.messagesContent}
      >
        {mensajes.map((msg: any, i: number) => {
          const isMine = String(msg.de) === String(user?.id);
          const isSystem = msg.de === null;

          if (isSystem) {
            return (
              <View key={i} style={styles.systemMsg}>
                <Text style={styles.systemMsgText}>{msg.txt}</Text>
              </View>
            );
          }

          return (
            <View
              key={i}
              style={[styles.msgBubble, isMine ? styles.msgMine : styles.msgOther]}
            >
              <Text style={[styles.msgText, isMine && styles.msgTextMine]}>
                {msg.txt}
              </Text>
              <Text style={styles.msgTime}>
                {msg.ts ? new Date(msg.ts).toLocaleTimeString('es-CO', {
                  hour: '2-digit',
                  minute: '2-digit',
                }) : ''}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      {/* Banner de error de envío */}
      {errorEnvio ? (
        <View style={styles.errorEnvioBanner}>
          <Text style={styles.errorEnvioText}>⚠️ {errorEnvio}</Text>
          <TouchableOpacity onPress={handleReintentar} style={styles.retryEnvioBtn}>
            <Text style={styles.retryEnvioBtnText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Input */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.msgInput}
          placeholder="Escribe un mensaje respetuoso…"
          placeholderTextColor="#786E8A"
          value={texto}
          onChangeText={setTexto}
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={() => handleEnviar()}
        />
        <TouchableOpacity
          style={[styles.sendBtn, !texto.trim() && styles.sendBtnDisabled]}
          onPress={() => handleEnviar()}
          disabled={!texto.trim() || enviarMutation.isPending}
          activeOpacity={0.85}
        >
          <Text style={styles.sendBtnText}>
            {enviarMutation.isPending ? '…' : '➤'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Modal de perfil público */}
      <PublicProfileModal
        userId={selectedParticipantId}
        visible={!!selectedParticipantId}
        onClose={() => setSelectedParticipantId(null)}
      />
    </KeyboardAvoidingView>
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
  headerSubtitle: { fontSize: 14, color: '#8D83A0', marginTop: 2 },
  newChatBtn: {
    backgroundColor: ACCENT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: ACCENT,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 3,
  },
  newChatBtnEmoji: { fontSize: 15 },
  newChatBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  // Empty
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  emptyEmoji: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: '#F0ECF6', marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: '#8D83A0', textAlign: 'center', lineHeight: 22, maxWidth: 400 },
  explorePeopleBtn: {
    backgroundColor: ACCENT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 20,
    shadowColor: ACCENT,
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  explorePeopleBtnEmoji: { fontSize: 16 },
  explorePeopleBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Chat list
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  chatCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    flexDirection: 'row',
    gap: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  chatCardUnread: {
    borderColor: 'rgba(57, 169, 0, 0.4)',
    backgroundColor: '#1B2420',
  },
  chatAvatar: {
    width: 50, height: 50, borderRadius: 25,
    justifyContent: 'center', alignItems: 'center',
  },
  chatAvatarPhoto: {
    width: 50, height: 50, borderRadius: 25,
    borderWidth: 2, borderColor: ACCENT,
  },
  chatAvatarParche: { backgroundColor: 'rgba(57,169,0,0.15)' },
  chatAvatarEmoji: { fontSize: 24 },
  chatInfo: { flex: 1 },
  chatTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chatName: { fontSize: 15, fontWeight: '700', color: '#F0ECF6', flex: 1, marginRight: 8 },
  chatNameUnread: { fontWeight: '900', color: '#FFFFFF' },
  chatTime: { fontSize: 12, color: '#786E8A' },
  chatPreview: { fontSize: 13, color: '#786E8A', marginTop: 4 },
  chatPreviewUnread: { color: '#DDF4D5', fontWeight: '600' },
  chatMeta: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8 },
  chatBadge: { fontSize: 11, color: '#786E8A' },
  chatRole: { fontSize: 11, color: ACCENT, fontWeight: '700' },
  chatMembers: { fontSize: 11, color: '#786E8A' },
  unreadCounter: {
    backgroundColor: ACCENT,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 'auto',
  },
  unreadCounterText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },

  convHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingTop: Platform.OS === 'web' ? 95 : 52, paddingBottom: 16,
    backgroundColor: CARD, borderBottomWidth: 1, borderBottomColor: CARD_BORDER,
  },
  backBtn: { padding: 4 },
  backText: { color: ACCENT, fontSize: 16, fontWeight: '700' },
  convTitleWrap: { flex: 1, alignItems: 'center', marginHorizontal: 8 },
  convTitle: {
    fontSize: 16, fontWeight: '700', color: '#F0ECF6',
    textAlign: 'center',
  },
  convSubtitle: { fontSize: 11, color: '#786E8A', marginTop: 1 },

  // Messages
  messagesArea: { flex: 1 },
  messagesContent: { padding: 16, paddingBottom: 8 },

  systemMsg: { alignSelf: 'center', marginVertical: 8 },
  systemMsgText: {
    fontSize: 12, color: '#8D83A0', fontStyle: 'italic',
    backgroundColor: '#1E252F', paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 12, overflow: 'hidden',
  },

  msgBubble: {
    maxWidth: '78%', marginBottom: 8, padding: 12,
    borderRadius: 16,
  },
  msgMine: {
    alignSelf: 'flex-end',
    backgroundColor: ACCENT,
    borderBottomRightRadius: 4,
  },
  msgOther: {
    alignSelf: 'flex-start',
    backgroundColor: '#1E252F',
    borderBottomLeftRadius: 4,
  },
  msgText: { fontSize: 14, color: '#F0ECF6', lineHeight: 20 },
  msgTextMine: { color: '#fff' },
  msgTime: {
    fontSize: 10, color: 'rgba(255,255,255,0.6)',
    marginTop: 4, textAlign: 'right',
  },

  errorEnvioBanner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 91, 110, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 91, 110, 0.3)',
  },
  errorEnvioText: {
    color: DANGER,
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  retryEnvioBtn: {
    backgroundColor: DANGER,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  retryEnvioBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },

  // Input bar
  inputBar: {
    flexDirection: 'row', gap: 10, padding: 12,
    backgroundColor: CARD, borderTopWidth: 1, borderTopColor: CARD_BORDER,
    alignItems: 'center',
  },
  msgInput: {
    flex: 1, backgroundColor: '#1E252F',
    color: '#F0ECF6', fontSize: 15,
    borderWidth: 1, borderColor: '#2D3748',
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 20,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: ACCENT, justifyContent: 'center', alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#2D3748' },
  sendBtnText: { fontSize: 18, color: '#fff' },
});

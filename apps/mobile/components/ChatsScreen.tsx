import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, TextInput,
  FlatList, KeyboardAvoidingView, Platform,
  RefreshControl
} from 'react-native';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '../app/context/AuthContext';
import { useBandeja, useConversacion, useEnviarMensaje } from '../hooks/useParches';
import PeopleScreen from './PeopleScreen';

const ACCENT = '#FF6B4A';
const BG = '#16121D';
const CARD = '#1E1A2B';

export default function ChatsScreen() {
  const [selectedChat, setSelectedChat] = useState<string | null>(null);
  const [showPeople, setShowPeople] = useState(false);

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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const chatsList = Array.isArray(chats) ? chats : [];

  // Sort by last message time
  const sorted = [...chatsList].sort((a: any, b: any) => (b.ultimo || 0) - (a.ultimo || 0));

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={ACCENT} />
        <Text style={styles.loadingText}>Cargando chats…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Chats</Text>
          <Text style={styles.headerSubtitle}>Tus conversaciones directas y parches</Text>
        </View>
        <TouchableOpacity
          style={styles.newChatBtn}
          onPress={onOpenPeople}
          activeOpacity={0.85}
        >
          <Text style={styles.newChatBtnEmoji}>➕</Text>
          <Text style={styles.newChatBtnText}>Nueva persona</Text>
        </TouchableOpacity>
      </View>

      {sorted.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>💬</Text>
          <Text style={styles.emptyTitle}>Sin conversaciones activas</Text>
          <Text style={styles.emptySubtitle}>
            Encuentra a personas registradas en SENA Match y comienza a chatear con ellas.
          </Text>
          <TouchableOpacity
            style={styles.explorePeopleBtn}
            onPress={onOpenPeople}
            activeOpacity={0.85}
          >
            <Text style={styles.explorePeopleBtnEmoji}>👥</Text>
            <Text style={styles.explorePeopleBtnText}>Ver personas para chatear</Text>
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
            const avatarEmoji = otro?.avatarEmoji || (isParche ? '🎯' : '💬');
            const avatarBg = otro?.avatarColor ? (otro.avatarColor + '25') : undefined;

            return (
              <TouchableOpacity
                key={chat.id}
                style={styles.chatCard}
                onPress={() => onSelect(chat.id)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.chatAvatar,
                    isParche && styles.chatAvatarParche,
                    avatarBg ? { backgroundColor: avatarBg } : null
                  ]}
                >
                  <Text style={styles.chatAvatarEmoji}>
                    {avatarEmoji}
                  </Text>
                </View>
                <View style={styles.chatInfo}>
                  <View style={styles.chatTopRow}>
                    <Text style={styles.chatName} numberOfLines={1}>
                      {chatTitle}
                    </Text>
                    <Text style={styles.chatTime}>{lastTime}</Text>
                  </View>
                  <Text style={styles.chatPreview} numberOfLines={1}>
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
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}
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
  const scrollRef = useRef<ScrollView>(null);

  const chat = chatData as any;
  const mensajes = chat?.mensajes || [];

  useEffect(() => {
    // Auto scroll to bottom when new messages arrive
    if (scrollRef.current && mensajes.length > 0) {
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: false });
      }, 100);
    }
  }, [mensajes.length]);

  const handleEnviar = () => {
    const txt = texto.trim();
    if (!txt) return;
    enviarMutation.mutate(txt, {
      onSuccess: () => {
        setTexto('');
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
      },
    });
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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Top bar */}
      <View style={styles.convHeader}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backText}>‹ Volver</Text>
        </TouchableOpacity>
        <View style={styles.convTitleWrap}>
          <Text style={styles.convTitle} numberOfLines={1}>{chatTitle}</Text>
          <Text style={styles.convSubtitle}>
            {isParche ? 'Parche grupal' : (chat?.otroUsuario?.rol ? `${chat.otroUsuario.rol} • SENA` : 'En línea')}
          </Text>
        </View>
        <View style={{ width: 50 }} />
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={styles.messagesArea}
        contentContainerStyle={styles.messagesContent}
      >
        {mensajes.map((msg: any, i: number) => {
          const isMine = msg.de === user?.id;
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

      {/* Input */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.msgInput}
          placeholder="Escribe un mensaje…"
          placeholderTextColor="#786E8A"
          value={texto}
          onChangeText={setTexto}
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={handleEnviar}
        />
        <TouchableOpacity
          style={[styles.sendBtn, !texto.trim() && styles.sendBtnDisabled]}
          onPress={handleEnviar}
          disabled={!texto.trim() || enviarMutation.isPending}
          activeOpacity={0.8}
        >
          <Text style={styles.sendBtnText}>
            {enviarMutation.isPending ? '…' : '➤'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
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
    borderColor: '#2D2640',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  chatAvatar: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: 'rgba(255,107,74,0.1)',
    justifyContent: 'center', alignItems: 'center',
  },
  chatAvatarParche: { backgroundColor: 'rgba(95,224,180,0.1)' },
  chatAvatarEmoji: { fontSize: 24 },
  chatInfo: { flex: 1 },
  chatTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chatName: { fontSize: 15, fontWeight: '700', color: '#F0ECF6', flex: 1, marginRight: 8 },
  chatTime: { fontSize: 12, color: '#786E8A' },
  chatPreview: { fontSize: 13, color: '#786E8A', marginTop: 4 },
  chatMeta: { flexDirection: 'row', gap: 12, marginTop: 8 },
  chatBadge: { fontSize: 11, color: '#786E8A' },
  chatRole: { fontSize: 11, color: ACCENT, fontWeight: '700' },
  chatMembers: { fontSize: 11, color: '#786E8A' },

  convHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 24, paddingTop: Platform.OS === 'web' ? 95 : 52, paddingBottom: 16,
    backgroundColor: CARD, borderBottomWidth: 1, borderBottomColor: '#2D2640',
  },
  backBtn: { padding: 4 },
  backText: { color: ACCENT, fontSize: 16, fontWeight: '600' },
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
    fontSize: 12, color: '#786E8A', fontStyle: 'italic',
    backgroundColor: '#282234', paddingHorizontal: 14, paddingVertical: 6,
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
    backgroundColor: '#282234',
    borderBottomLeftRadius: 4,
  },
  msgText: { fontSize: 14, color: '#F0ECF6', lineHeight: 20 },
  msgTextMine: { color: '#fff' },
  msgTime: {
    fontSize: 10, color: 'rgba(255,255,255,0.5)',
    marginTop: 4, textAlign: 'right',
  },

  // Input bar
  inputBar: {
    flexDirection: 'row', gap: 10, padding: 12,
    backgroundColor: CARD, borderTopWidth: 1, borderTopColor: '#2D2640',
    alignItems: 'center',
  },
  msgInput: {
    flex: 1, backgroundColor: '#282234',
    color: '#F0ECF6', fontSize: 15,
    borderWidth: 1, borderColor: '#3A3247',
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 20,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: ACCENT, justifyContent: 'center', alignItems: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#3A3247' },
  sendBtnText: { fontSize: 18, color: '#fff' },
});

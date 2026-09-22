/**
 * Módulo singleton para comunicar el chatId pendiente entre
 * el modal de notificaciones y ChatsScreen, sin props drilling.
 */

let _pendingChatId: string | null = null;
let _activeChatId: string | null = null;
const _listeners: Array<(chatId: string | null) => void> = [];

export const pendingChat = {
  set(chatId: string | null) {
    _pendingChatId = chatId;
    _listeners.forEach(fn => fn(chatId));
  },
  get(): string | null {
    return _pendingChatId;
  },
  clear() {
    _pendingChatId = null;
  },
  setActive(chatId: string | null) {
    _activeChatId = chatId;
  },
  getActive(): string | null {
    return _activeChatId;
  },
  subscribe(fn: (chatId: string | null) => void): () => void {
    _listeners.push(fn);
    return () => {
      const idx = _listeners.indexOf(fn);
      if (idx !== -1) _listeners.splice(idx, 1);
    };
  }
};

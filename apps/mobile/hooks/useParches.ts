import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Intencion, TipoParche } from '@sena/core/reglas';

/* -------------------------------------------------------------------------- */
/* Mazo de descubrimiento                                                      */
/* Backend: GET /swipes — devuelve el mazo según intencion del perfil         */
/* -------------------------------------------------------------------------- */

export function useMazo(intencion: Intencion) {
  return useQuery({
    queryKey: ['mazo', intencion],
    queryFn: async () => {
      // GET /swipes?intencion=<intencion>&limit=20
      const data = await api.get(`/swipes?intencion=${intencion}&limit=20`);
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

export function useSwipe(intencion: Intencion) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { target: string; dir: 'pass' | 'like' | 'super' }) => {
      // POST /swipes/registrar — backend expects p_otro, p_intencion, p_dir
      return api.post('/swipes/registrar', {
        p_otro: v.target,
        p_intencion: intencion,
        p_dir: v.dir,
      });
    },
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['perfiles'] });
      if (res?.match) {
        qc.invalidateQueries({ queryKey: ['bandeja'] });
        qc.invalidateQueries({ queryKey: ['matches'] });
      }
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Feed de parches                                                             */
/* Backend: GET /parches                                                       */
/* -------------------------------------------------------------------------- */

export function useFeedParches(filtros?: { radioM?: number; tipos?: TipoParche[] }) {
  return useQuery({
    queryKey: ['feed-parches', filtros],
    queryFn: async () => {
      // GET /parches
      const data = await api.get('/parches');
      return data ?? [];
    },
    staleTime: 30_000,
    refetchInterval: 15_000, // Polling: reemplaza los WebSockets de Supabase Realtime
  });
}

export function useCrearParche() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: {
      titulo: string;
      tipo: string;
      lugar: string;
      inicio: string;
      cupo: number;
      descripcion?: string;
      duracion?: number;
      aprobacion?: boolean;
    }) => {
      // POST /parches
      return api.post('/parches', {
        titulo: p.titulo,
        tipo: p.tipo,
        lugar: p.lugar,
        inicio: p.inicio,
        cupo: p.cupo,
        descripcion: p.descripcion,
        duracion: p.duracion ?? 60,
        aprobacion: p.aprobacion ?? false,
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['feed-parches'] }),
  });
}

export function useUnirmeAlParche() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { activityId: string; nota?: string }) => {
      // POST /parches/:id/entrar
      return api.post(`/parches/${v.activityId}/entrar`, { nota: v.nota });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['feed-parches'] });
      qc.invalidateQueries({ queryKey: ['bandeja'] });
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Chat                                                                        */
/* Backend: GET /chats/:id — mensajes de una conversación                     */
/* Backend: POST /chats/:id/mensaje — marca leído al cargar (vía header)      */
/* -------------------------------------------------------------------------- */

export function useConversacion(conversationId: string) {
  return useQuery({
    queryKey: ['mensajes', conversationId],
    queryFn: async () => {
      // GET /chats/:id
      const data = await api.get(`/chats/${conversationId}`);
      return data ?? [];
    },
    refetchInterval: 2_500, // Polling cada 2.5s para actualización en tiempo real sin recargar
    enabled: !!conversationId,
  });
}

/* -------------------------------------------------------------------------- */
/* Bandeja de chats                                                            */
/* Backend: GET /chats — lista de conversaciones donde el usuario es miembro  */
/* -------------------------------------------------------------------------- */

export function useBandeja() {
  return useQuery({
    queryKey: ['bandeja'],
    queryFn: async () => {
      const data = await api.get('/chats');
      return data ?? [];
    },
    staleTime: 2_000,
    refetchInterval: 3_500, // Sincronización continua de bandeja y no leídos
  });
}

/* -------------------------------------------------------------------------- */
/* Enviar mensaje                                                              */
/* Backend: POST /chats/:id/mensaje                                           */
/* -------------------------------------------------------------------------- */

export function useEnviarMensaje(chatId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (txt: string) => {
      return api.post(`/chats/${chatId}/mensaje`, { txt });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['mensajes', chatId] });
      qc.invalidateQueries({ queryKey: ['bandeja'] });
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Perfiles (descubrimiento)                                                   */
/* Backend: GET /perfiles — lista de perfiles visibles                        */
/* -------------------------------------------------------------------------- */

export function usePerfiles() {
  return useQuery({
    queryKey: ['perfiles'],
    queryFn: async () => {
      const data = await api.get('/perfiles');
      return data ?? [];
    },
    staleTime: 60_000,
  });
}

/* -------------------------------------------------------------------------- */
/* Perfil propio                                                               */
/* Backend: GET /perfiles/:id                                                 */
/* -------------------------------------------------------------------------- */

export function usePerfil(userId: string) {
  return useQuery({
    queryKey: ['perfil', userId],
    queryFn: async () => {
      const data = await api.get(`/perfiles/${userId}`);
      return data;
    },
    enabled: !!userId,
    retry: 1,           // Solo 1 reintento si falla (evita carga infinita)
    retryDelay: 1000,   // Espera 1s antes de reintentar
    staleTime: 30_000,
  });
}

/* -------------------------------------------------------------------------- */
/* Editar perfil                                                               */
/* Backend: PATCH /perfiles/:id                                               */
/* -------------------------------------------------------------------------- */

export function useEditarPerfil(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cambios: Record<string, any>) => {
      return api.patch(`/perfiles/${userId}`, cambios);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['perfil', userId] });
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Directorio de comunidad (buscar personas registradas)                       */
/* Backend: GET /perfiles/comunidad?q=                                        */
/* -------------------------------------------------------------------------- */

export function useUsuariosComunidad(query: string = '') {
  return useQuery({
    queryKey: ['usuarios-comunidad', query],
    queryFn: async () => {
      const q = query.trim() ? `?q=${encodeURIComponent(query.trim())}` : '';
      const data = await api.get(`/perfiles/comunidad${q}`);
      return data ?? [];
    },
    staleTime: 10_000,
  });
}

/* -------------------------------------------------------------------------- */
/* Iniciar o abrir chat directo con un usuario                                 */
/* Backend: POST /chats/directo { targetUserId }                              */
/* -------------------------------------------------------------------------- */

export function useCrearChatDirecto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (targetUserId: string) => {
      return api.post('/chats/directo', { targetUserId });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bandeja'] });
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Mis Matches                                                                  */
/* Backend: GET /swipes/matches — lista de matches del usuario autenticado     */
/* -------------------------------------------------------------------------- */

export function useMatches() {
  return useQuery({
    queryKey: ['matches'],
    queryFn: async () => {
      const data = await api.get('/swipes/matches');
      return Array.isArray(data) ? data : [];
    },
    staleTime: 15_000,
    refetchInterval: 15_000,
  });
}


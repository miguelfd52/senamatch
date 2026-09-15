import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export interface Comentario {
  id: string;
  autorId: string;
  autorNombre: string;
  autorAvatarEmoji: string;
  autorFotoUrl?: string | null;
  texto: string;
  creado: number;
}

export interface Publicacion {
  id: string;
  texto: string;
  fotoUrl?: string | null;
  autor: {
    id: string;
    nombre: string;
    rol: string;
    avatarEmoji: string;
    avatarColor: string;
    fotoUrl?: string | null;
  };
  likesCount: number;
  likedPorMi: boolean;
  comentarios: Comentario[];
  creado: number;
}

export function usePublicaciones() {
  return useQuery<Publicacion[]>({
    queryKey: ['publicaciones'],
    queryFn: () => api.get('/publicaciones') as Promise<Publicacion[]>,
    staleTime: 1000 * 15,
  });
}

export function useCrearPublicacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { texto: string; fotoUrl?: string | null }) =>
      api.post('/publicaciones', data) as Promise<Publicacion>,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['publicaciones'] });
    },
  });
}

export function useLikePublicacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (publicacionId: string) =>
      api.post(`/publicaciones/${publicacionId}/like`) as Promise<{
        id: string;
        likesCount: number;
        likedPorMi: boolean;
      }>,
    onMutate: async (publicacionId) => {
      await qc.cancelQueries({ queryKey: ['publicaciones'] });
      const anterior = qc.getQueryData<Publicacion[]>(['publicaciones']);

      if (anterior) {
        qc.setQueryData<Publicacion[]>(
          ['publicaciones'],
          anterior.map(p => {
            if (p.id === publicacionId) {
              const nuevoLiked = !p.likedPorMi;
              return {
                ...p,
                likedPorMi: nuevoLiked,
                likesCount: p.likesCount + (nuevoLiked ? 1 : -1),
              };
            }
            return p;
          })
        );
      }
      return { anterior };
    },
    onError: (_err, _id, context) => {
      if (context?.anterior) {
        qc.setQueryData(['publicaciones'], context.anterior);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['publicaciones'] });
    },
  });
}

export function useComentarPublicacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ publicacionId, texto }: { publicacionId: string; texto: string }) =>
      api.post(`/publicaciones/${publicacionId}/comentarios`, { texto }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['publicaciones'] });
    },
  });
}

const express = require('express');
const crypto = require('crypto');
const { auth } = require('../middleware/auth');
const Publicacion = require('../models/Publicacion');
const Perfil = require('../models/Perfil');

const router = express.Router();

/**
 * Formatear publicación para el frontend
 */
function formatearPublicacion(p, uid) {
  const likesArr = Array.isArray(p.likes) ? p.likes : [];
  return {
    id: p._id,
    texto: p.texto,
    fotoUrl: p.foto_url || null,
    autor: {
      id: p.autor,
      nombre: p.autorNombre || 'Usuario SENA',
      rol: p.autorRol || 'aprendiz',
      avatarEmoji: p.autorAvatarEmoji || '😊',
      avatarColor: p.autorAvatarColor || '#FF6B4A',
      fotoUrl: p.autorFotoUrl || null,
    },
    likesCount: likesArr.length,
    likedPorMi: uid ? likesArr.includes(uid) : false,
    comentarios: (p.comentarios || []).map(c => ({
      id: c.id,
      autorId: c.autorId,
      autorNombre: c.autorNombre || 'Usuario SENA',
      autorAvatarEmoji: c.autorAvatarEmoji || '😊',
      autorFotoUrl: c.autorFotoUrl || null,
      texto: c.texto,
      creado: c.creado ? new Date(c.creado).getTime() : Date.now(),
    })),
    creado: p.creado ? new Date(p.creado).getTime() : Date.now(),
  };
}

/**
 * GET /publicaciones
 * Lista todas las publicaciones ordenadas de forma descendente por fecha de creación.
 */
router.get('/', auth, async (req, res) => {
  try {
    const publicaciones = await Publicacion.find()
      .sort({ creado: -1 })
      .limit(60)
      .lean();

    const resultado = publicaciones.map(p => formatearPublicacion(p, req.uid));
    res.json(resultado);
  } catch (err) {
    console.error('Error en GET /publicaciones:', err);
    res.status(500).json({ error: 'Error al obtener publicaciones' });
  }
});

/**
 * POST /publicaciones
 * Crea una nueva publicación en la comunidad.
 */
router.post('/', auth, async (req, res) => {
  try {
    const { texto, fotoUrl } = req.body;

    if (!texto || typeof texto !== 'string' || !texto.trim()) {
      return res.status(400).json({ error: 'El texto de la publicación es obligatorio' });
    }

    if (texto.trim().length > 1000) {
      return res.status(400).json({ error: 'El texto no puede superar los 1000 caracteres' });
    }

    // Validar fotoUrl si viene
    let fotoLimpia = null;
    if (fotoUrl && typeof fotoUrl === 'string') {
      const trimmed = fotoUrl.trim();
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:image/')) {
        fotoLimpia = trimmed;
      }
    }

    const miPerfil = await Perfil.findById(req.uid).lean();

    const nuevaPub = await Publicacion.create({
      _id: 'pub_' + crypto.randomUUID().replace(/-/g, '').slice(0, 20),
      autor: req.uid,
      autorNombre: miPerfil?.nombre || req.perfil?.nombre || 'Usuario SENA',
      autorRol: miPerfil?.rol || req.perfil?.rol || 'aprendiz',
      autorAvatarEmoji: miPerfil?.avatar_emoji || req.perfil?.avatar_emoji || '😊',
      autorAvatarColor: miPerfil?.avatar_color || req.perfil?.avatar_color || '#FF6B4A',
      autorFotoUrl: miPerfil?.foto_url || req.perfil?.foto_url || null,
      texto: texto.trim(),
      foto_url: fotoLimpia,
      likes: [],
      comentarios: [],
      creado: new Date(),
    });

    res.status(201).json(formatearPublicacion(nuevaPub, req.uid));
  } catch (err) {
    console.error('Error en POST /publicaciones:', err);
    res.status(500).json({ error: 'Error al crear la publicación' });
  }
});

/**
 * POST /publicaciones/:id/like
 * Alterna el 'like' del usuario actual en la publicación.
 */
router.post('/:id/like', auth, async (req, res) => {
  try {
    const pub = await Publicacion.findById(req.params.id);
    if (!pub) {
      return res.status(404).json({ error: 'Publicación no encontrada' });
    }

    const yaDioLike = pub.likes.includes(req.uid);
    if (yaDioLike) {
      pub.likes = pub.likes.filter(id => id !== req.uid);
    } else {
      pub.likes.push(req.uid);
    }

    await pub.save();

    res.json({
      id: pub._id,
      likesCount: pub.likes.length,
      likedPorMi: !yaDioLike,
    });
  } catch (err) {
    console.error('Error en POST /publicaciones/:id/like:', err);
    res.status(500).json({ error: 'Error al actualizar el me gusta' });
  }
});

/**
 * POST /publicaciones/:id/comentarios
 * Agrega un nuevo comentario a la publicación.
 */
router.post('/:id/comentarios', auth, async (req, res) => {
  try {
    const { texto } = req.body;
    if (!texto || typeof texto !== 'string' || !texto.trim()) {
      return res.status(400).json({ error: 'El comentario no puede estar vacío' });
    }

    if (texto.trim().length > 400) {
      return res.status(400).json({ error: 'El comentario no puede superar los 400 caracteres' });
    }

    const pub = await Publicacion.findById(req.params.id);
    if (!pub) {
      return res.status(404).json({ error: 'Publicación no encontrada' });
    }

    const miPerfil = await Perfil.findById(req.uid).lean();

    const nuevoComentario = {
      id: 'com_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16),
      autorId: req.uid,
      autorNombre: miPerfil?.nombre || req.perfil?.nombre || 'Usuario SENA',
      autorAvatarEmoji: miPerfil?.avatar_emoji || req.perfil?.avatar_emoji || '😊',
      autorFotoUrl: miPerfil?.foto_url || req.perfil?.foto_url || null,
      texto: texto.trim(),
      creado: new Date(),
    };

    pub.comentarios.push(nuevoComentario);
    await pub.save();

    res.status(201).json({
      id: nuevoComentario.id,
      autorId: nuevoComentario.autorId,
      autorNombre: nuevoComentario.autorNombre,
      autorAvatarEmoji: nuevoComentario.autorAvatarEmoji,
      autorFotoUrl: nuevoComentario.autorFotoUrl,
      texto: nuevoComentario.texto,
      creado: nuevoComentario.creado.getTime(),
      totalComentarios: pub.comentarios.length,
    });
  } catch (err) {
    console.error('Error en POST /publicaciones/:id/comentarios:', err);
    res.status(500).json({ error: 'Error al agregar el comentario' });
  }
});

module.exports = router;

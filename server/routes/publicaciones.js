const express = require('express');
const crypto = require('crypto');
const { auth } = require('../middleware/auth');
const { esStaff, hayBloqueo } = require('../helpers/reglas');
const Publicacion = require('../models/Publicacion');
const Perfil = require('../models/Perfil');

const router = express.Router();

/**
 * Formatear publicaciÃ³n para el frontend
 */
function formatearPublicacion(p, uid) {
  const likesArr = Array.isArray(p.likes) ? p.likes.map(String) : [];
  const sUid = uid ? String(uid) : null;

  return {
    id: String(p._id),
    texto: p.texto,
    fotoUrl: p.foto_url || null,
    autor: {
      id: String(p.autor),
      nombre: p.autorNombre || 'Usuario SENA',
      rol: p.autorRol || 'aprendiz',
      avatarEmoji: p.autorAvatarEmoji || 'ðŸ˜Š',
      avatarColor: p.autorAvatarColor || '#39A900',
      fotoUrl: p.autorFotoUrl || null,
    },
    likesCount: likesArr.length,
    likedPorMi: sUid ? likesArr.includes(sUid) : false,
    esMio: sUid ? String(p.autor) === sUid : false,
    comentarios: (p.comentarios || []).map(c => ({
      id: String(c.id),
      autorId: String(c.autorId),
      autorNombre: c.autorNombre || 'Usuario SENA',
      autorAvatarEmoji: c.autorAvatarEmoji || 'ðŸ˜Š',
      autorFotoUrl: c.autorFotoUrl || null,
      texto: c.texto,
      creado: c.creado ? new Date(c.creado).getTime() : Date.now(),
    })),
    creado: p.creado ? new Date(p.creado).getTime() : Date.now(),
  };
}

/**
 * GET /publicaciones
 * Lista publicaciones con paginaciÃ³n y filtro de bloqueos.
 */
router.get('/', auth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const publicaciones = await Publicacion.find()
      .sort({ creado: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const resultado = [];
    for (const p of publicaciones) {
      if (await hayBloqueo(req.uid, p.autor)) continue;
      resultado.push(formatearPublicacion(p, req.uid));
    }

    const total = await Publicacion.countDocuments();

    if (req.query.page || req.query.limit) {
      return res.json({
        publicaciones: resultado,
        pagina: page,
        totalPaginas: Math.ceil(total / limit),
        total
      });
    }

    return res.json(resultado);
  } catch (err) {
    console.error('Error en GET /publicaciones:', err);
    res.status(500).json({ error: 'Error al obtener publicaciones' });
  }
});

/**
 * POST /publicaciones
 * Crea una nueva publicaciÃ³n.
 */
router.post('/', auth, async (req, res) => {
  try {
    const { texto, fotoUrl } = req.body;


    // Permitir texto vacio solo si hay imagen adjunta
    const textoFinal = (texto || '').trim();
    if (!textoFinal && !fotoUrl) {
      return res.status(400).json({ error: 'La publicacion debe tener texto o una imagen.' });
    }
    if (textoFinal.length > 1000) {
      return res.status(400).json({ error: 'El texto no puede superar los 1000 caracteres' });
    }

    // Aceptar URL HTTPS o rechazar explícitamente base64 data:image/
    let fotoLimpia = null;
    if (fotoUrl && typeof fotoUrl === 'string') {
      const trimmed = fotoUrl.trim();
      if (trimmed.startsWith('data:image/')) {
        return res.status(400).json({ error: 'No se permiten imágenes en base64 directas. Sube la imagen a través del servicio de almacenamiento.' });
      }
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        fotoLimpia = trimmed;
      }
    }

    const miPerfil = await Perfil.findById(req.uid).lean();

    const nuevaPub = await Publicacion.create({
      _id: 'pub_' + crypto.randomUUID().replace(/-/g, '').slice(0, 20),
      autor: String(req.uid),
      autorNombre: miPerfil?.nombre || req.perfil?.nombre || 'Usuario SENA',
      autorRol: miPerfil?.rol || req.perfil?.rol || 'aprendiz',
      autorAvatarEmoji: miPerfil?.avatar_emoji || req.perfil?.avatar_emoji || 'ðŸ˜Š',
      autorAvatarColor: miPerfil?.avatar_color || req.perfil?.avatar_color || '#39A900',
      autorFotoUrl: miPerfil?.foto_url || req.perfil?.foto_url || null,
      texto: textoFinal,
      foto_url: fotoLimpia,
      likes: [],
      comentarios: [],
      creado: new Date(),
    });

    // Si el usuario tenía pendiente su primera publicación, marcarla como completada en la BD
    await Perfil.findByIdAndUpdate(req.uid, {
      $set: { primera_publicacion_completada: true }
    });

    res.status(201).json(formatearPublicacion(nuevaPub, req.uid));
  } catch (err) {
    console.error('Error en POST /publicaciones:', err);
    res.status(500).json({ error: 'Error al crear la publicaciÃ³n' });
  }
});

/**
 * PATCH /publicaciones/:id
 * Edita una publicaciÃ³n existente. Solo el autor puede editar.
 */
router.patch('/:id', auth, async (req, res) => {
  try {
    const { texto } = req.body;
    if (!texto || typeof texto !== 'string' || !texto.trim()) {
      return res.status(400).json({ error: 'El texto no puede estar vacÃ­o' });
    }
    if (texto.trim().length > 1000) {
      return res.status(400).json({ error: 'El texto no puede superar los 1000 caracteres' });
    }

    const pub = await Publicacion.findById(req.params.id);
    if (!pub) {
      return res.status(404).json({ error: 'PublicaciÃ³n no encontrada' });
    }

    // AutorizaciÃ³n: solo el dueÃ±o puede editar
    if (String(pub.autor) !== String(req.uid)) {
      return res.status(403).json({ error: 'Solo el autor puede editar esta publicaciÃ³n' });
    }

    pub.texto = texto.trim();
    await pub.save();

    res.json(formatearPublicacion(pub, req.uid));
  } catch (err) {
    console.error('Error en PATCH /publicaciones/:id:', err);
    res.status(500).json({ error: 'Error al actualizar la publicaciÃ³n' });
  }
});

/**
 * DELETE /publicaciones/:id
 * Elimina una publicaciÃ³n. Solo el autor o staff pueden eliminar.
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    const pub = await Publicacion.findById(req.params.id);
    if (!pub) {
      return res.status(404).json({ error: 'PublicaciÃ³n no encontrada' });
    }

    const esAutor = String(pub.autor) === String(req.uid);
    const puedeStaff = esStaff(req.perfil);

    if (!esAutor && !puedeStaff) {
      return res.status(403).json({ error: 'No tienes permisos para eliminar esta publicaciÃ³n' });
    }

    await Publicacion.findByIdAndDelete(req.params.id);
    res.json({ ok: true, id: req.params.id });
  } catch (err) {
    console.error('Error en DELETE /publicaciones/:id:', err);
    res.status(500).json({ error: 'Error al eliminar la publicaciÃ³n' });
  }
});

/**
 * POST /publicaciones/:id/like
 * Alterna el like del usuario.
 */
router.post('/:id/like', auth, async (req, res) => {
  try {
    const pub = await Publicacion.findById(req.params.id);
    if (!pub) {
      return res.status(404).json({ error: 'PublicaciÃ³n no encontrada' });
    }

    const uid = String(req.uid);
    const yaDioLike = (pub.likes || []).some(id => String(id) === uid);

    if (yaDioLike) {
      pub.likes = (pub.likes || []).filter(id => String(id) !== uid);
    } else {
      pub.likes = (pub.likes || []).concat([uid]);
    }

    await pub.save();

    res.json({
      id: pub._id,
      likesCount: pub.likes.length,
      likedPorMi: !yaDioLike,
    });
  } catch (err) {
    console.error('Error en POST /publicaciones/:id/like:', err);
    res.status(500).json({ error: 'Error al actualizar me gusta' });
  }
});

/**
 * POST /publicaciones/:id/comentarios
 * Agrega un comentario a la publicaciÃ³n.
 */
router.post('/:id/comentarios', auth, async (req, res) => {
  try {
    const { texto } = req.body;
    if (!texto || typeof texto !== 'string' || !texto.trim()) {
      return res.status(400).json({ error: 'El comentario no puede estar vacÃ­o' });
    }

    if (texto.trim().length > 400) {
      return res.status(400).json({ error: 'El comentario no puede superar los 400 caracteres' });
    }

    const pub = await Publicacion.findById(req.params.id);
    if (!pub) {
      return res.status(404).json({ error: 'PublicaciÃ³n no encontrada' });
    }

    if (await hayBloqueo(req.uid, pub.autor)) {
      return res.status(403).json({ error: 'No puedes comentar en esta publicaciÃ³n' });
    }

    const miPerfil = await Perfil.findById(req.uid).lean();

    const nuevoComentario = {
      id: 'com_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16),
      autorId: String(req.uid),
      autorNombre: miPerfil?.nombre || req.perfil?.nombre || 'Usuario SENA',
      autorAvatarEmoji: miPerfil?.avatar_emoji || req.perfil?.avatar_emoji || 'ðŸ˜Š',
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



/**
 * Rutas de perfiles con seguridad estricta y endpoint de perfil público.
 */
const express = require('express');
const { auth } = require('../middleware/auth');
const { esferaDe, esStaff, hayBloqueo } = require('../helpers/reglas');
const Perfil = require('../models/Perfil');

const Match = require('../models/Match');
const Swipe = require('../models/Swipe');

const router = express.Router();

/**
 * Sanitizar perfil para vista pública universal (FASE 4)
 * NUNCA incluye correo privado, contraseña, ficha, tokens ni datos sensibles.
 */
function sanitizarPerfilPublico(p, affinityInfo = null) {
  return {
    id: String(p._id),
    nombre: p.nombre || 'Usuario SENA',
    rol: p.rol || 'aprendiz',
    esfera: esferaDe(p.rol),
    programa: p.programa || null,
    centro: p.centro || null,
    jornada: p.jornada || null,
    bio: p.bio || '',
    intereses: Array.isArray(p.intereses) ? p.intereses : [],
    intenciones: Array.isArray(p.intenciones) ? p.intenciones : [],
    avatarEmoji: p.avatar_emoji || '😊',
    avatarColor: p.avatar_color || '#39A900',
    fotoUrl: p.foto_url || null,
    asistencias: p.asistencias || 0,
    afinidad: affinityInfo,
    creado: p.creado ? new Date(p.creado).getTime() : Date.now()
  };
}

/**
 * GET /perfiles
 * Lista perfiles visibles según esfera y centro, excluyendo:
 * - El usuario actual
 * - Usuarios con los que ya tiene Match
 * - Usuarios marcados como "No me interesa" (pass)
 * - Duplicados
 */
router.get('/', auth, async (req, res) => {
  try {
    const yo = req.perfil;
    if (!yo) return res.status(404).json({ error: 'Perfil no encontrado' });
    const yoId = String(yo._id);

    // 1. Obtener IDs de usuarios con los que ya tiene Match activo
    const matches = await Match.find({
      $or: [{ a: yoId }, { b: yoId }],
      activo: true
    }).lean();
    const matchedIds = new Set(matches.map(m => String(m.a === yoId ? m.b : m.a)));

    // 2. Obtener IDs de usuarios marcados como "pass" (No me interesa)
    const swipeDoc = await Swipe.findById(yoId).lean();
    const pasadosIds = new Set();
    if (swipeDoc && swipeDoc.por_intencion) {
      for (const intencion of Object.keys(swipeDoc.por_intencion)) {
        const mapa = swipeDoc.por_intencion[intencion] || {};
        for (const [targetId, accion] of Object.entries(mapa)) {
          if (accion === 'pass') {
            pasadosIds.add(String(targetId));
          }
        }
      }
    }

    const miEsfera = esferaDe(yo.rol);
    let filtro = {
      _id: { $ne: yo._id },
      estado: 'activo'
    };

    if (!esStaff(yo)) {
      if (yo.centro) {
        const numCentro = Number(yo.centro);
        const centros = [yo.centro];
        if (!isNaN(numCentro)) centros.push(numCentro);
        centros.push(String(yo.centro));

        filtro.$or = [
          { centro: { $in: centros } },
          { centro: null },
          { centro: { $exists: false } }
        ];
      }
      if (miEsfera === 'aprendices') {
        filtro.rol = { $in: ['aprendiz', 'egresado'] };
      } else {
        filtro.rol = { $in: ['instructor', 'bienestar', 'moderador', 'admin'] };
      }
    }

    const perfiles = await Perfil.find(filtro).sort({ creado: -1 }).lean();

    const visibles = [];
    const seenIds = new Set();

    for (const p of perfiles) {
      const pid = String(p._id);
      if (pid === yoId) continue;
      if (seenIds.has(pid)) continue;
      if (matchedIds.has(pid)) continue;
      if (pasadosIds.has(pid)) continue;

      if (!(await hayBloqueo(yo._id, p._id))) {
        seenIds.add(pid);
        // Calcular afinidad
        const misIntereses = yo.intereses || [];
        const susIntereses = p.intereses || [];
        const comunes = misIntereses.filter(i => susIntereses.includes(i));
        let afinidad = null;
        if (comunes.length > 0) {
          afinidad = `Coinciden en ${comunes.slice(0, 2).join(', ')}`;
        } else if (yo.programa && p.programa && yo.programa.toLowerCase() === p.programa.toLowerCase()) {
          afinidad = 'Mismo programa de formación';
        }

        visibles.push(sanitizarPerfilPublico(p, afinidad));
      }
    }

    res.json(visibles);
  } catch (e) {
    console.error('Error GET /perfiles:', e);
    res.status(500).json({ error: 'Error al obtener perfiles' });
  }
});

/**
 * GET /perfiles/comunidad
 * Directorio de miembros registrados de la comunidad SENA.
 */
router.get('/comunidad', auth, async (req, res) => {
  try {
    const { q } = req.query;
    let query = {
      _id: { $ne: req.uid },
      estado: { $ne: 'suspendido' }
    };

    if (q && q.trim()) {
      const regex = new RegExp(q.trim(), 'i');
      query.$or = [
        { nombre: regex },
        { programa: regex }
      ];
    }

    const perfiles = await Perfil.find(query)
      .sort({ creado: -1 })
      .limit(60)
      .lean();

    const visibles = [];
    for (const p of perfiles) {
      if (await hayBloqueo(req.uid, p._id)) continue;
      visibles.push(sanitizarPerfilPublico(p));
    }

    res.json(visibles);
  } catch (e) {
    console.error('Error en GET /perfiles/comunidad:', e);
    res.status(500).json({ error: 'Error al obtener miembros de la comunidad' });
  }
});

/**
 * GET /perfiles/:id/publico
 * Endpoint específico de perfil público (FASE 4).
 * NUNCA devuelve información privada sensible.
 */
router.get('/:id/publico', auth, async (req, res) => {
  try {
    const targetId = String(req.params.id);
    const yoId = String(req.uid);

    if (await hayBloqueo(yoId, targetId)) {
      return res.status(403).json({ error: 'No tienes acceso a este perfil debido a un bloqueo' });
    }

    const perfil = await Perfil.findById(targetId).lean();
    if (!perfil || perfil.estado === 'suspendido') {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Calcular afinidad
    const yo = req.perfil || await Perfil.findById(yoId).lean();
    let afinidad = null;
    if (yo && targetId !== yoId) {
      const misIntereses = yo.intereses || [];
      const susIntereses = perfil.intereses || [];
      const comunes = misIntereses.filter(i => susIntereses.includes(i));
      if (comunes.length > 0) {
        afinidad = `Coinciden en ${comunes.slice(0, 3).join(', ')}`;
      } else if (yo.programa && perfil.programa && yo.programa.toLowerCase() === perfil.programa.toLowerCase()) {
        afinidad = 'Comparten el mismo programa de formación';
      }
    }

    res.json(sanitizarPerfilPublico(perfil, afinidad));
  } catch (e) {
    console.error('Error en GET /perfiles/:id/publico:', e);
    res.status(500).json({ error: 'Error al consultar el perfil público' });
  }
});

/**
 * GET /perfiles/:id
 * Obtiene el perfil propio o detalle si es staff.
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const r = await Perfil.findById(req.params.id).lean();
    if (!r) return res.status(404).json({ error: 'Perfil no encontrado' });

    const esDueno = String(req.uid) === String(r._id);
    const puedeVerPrivado = esDueno || esStaff(req.perfil);

    // Si es un tercero, sanitizar estrictamente sin correo ni ficha
    if (!puedeVerPrivado) {
      if (await hayBloqueo(req.uid, r._id)) {
        return res.status(403).json({ error: 'No tienes acceso a este perfil' });
      }
      return res.json(sanitizarPerfilPublico(r));
    }

    res.json({
      id: String(r._id),
      nombre: r.nombre,
      correo: r.correo,
      rol: r.rol,
      esfera: esferaDe(r.rol),
      estado: r.estado,
      centro: r.centro,
      programa: r.programa,
      ficha: r.ficha,
      jornada: r.jornada,
      nacimiento: r.nacimiento,
      bio: r.bio,
      intereses: r.intereses || [],
      intenciones: r.intenciones || [],
      avatarEmoji: r.avatar_emoji,
      avatarColor: r.avatar_color,
      fotoUrl: r.foto_url || null,
      primeraPublicacionCompletada: r.primera_publicacion_completada === undefined ? true : !!r.primera_publicacion_completada,
      asistencias: r.asistencias || 0,
      inasistencias: r.inasistencias || 0,
      creado: r.creado ? new Date(r.creado).getTime() : Date.now(),
      visto: r.visto ? new Date(r.visto).getTime() : Date.now()
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /perfiles/completar-primera-publicacion
 * Marca en la base de datos que el usuario completó su publicación inicial obligatoria.
 */
router.post('/completar-primera-publicacion', auth, async (req, res) => {
  try {
    await Perfil.findByIdAndUpdate(req.uid, { $set: { primera_publicacion_completada: true } });
    res.json({ ok: true, primeraPublicacionCompletada: true });
  } catch (e) {
    res.status(500).json({ error: 'Error al actualizar estado de primera publicación' });
  }
});

/**
 * PATCH /perfiles/:id
 * Actualiza el perfil propio. Solo el dueño o staff pueden editar.
 */
router.patch('/:id', auth, async (req, res) => {
  try {
    if (String(req.uid) !== String(req.params.id) && !esStaff(req.perfil)) {
      return res.status(403).json({ error: 'Solo puedes editar tu propio perfil' });
    }

    const permitidas = [
      'nombre', 'centro', 'programa', 'ficha', 'jornada', 'nacimiento',
      'bio', 'intereses', 'intenciones', 'avatar_emoji', 'avatar_color', 'foto_url',
      'avatarEmoji', 'avatarColor', 'fotoUrl'
    ];

    const cambios = {};
    for (const k of Object.keys(req.body)) {
      if (k === 'avatarEmoji') cambios.avatar_emoji = req.body[k];
      else if (k === 'avatarColor') cambios.avatar_color = req.body[k];
      else if (k === 'fotoUrl') cambios.foto_url = req.body[k];
      else if (permitidas.includes(k)) cambios[k] = req.body[k];
    }

    if (cambios.nombre && typeof cambios.nombre === 'string') {
      cambios.nombre = cambios.nombre.trim();
    }
    if (cambios.ficha === '') cambios.ficha = null;
    if (cambios.foto_url !== undefined) {
      if (typeof cambios.foto_url === 'string') {
        const trimmed = cambios.foto_url.trim();
        if (trimmed.startsWith('data:')) {
          return res.status(400).json({ error: 'No se permiten imágenes base64. Sube la foto mediante Cloudinary.' });
        }
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
          cambios.foto_url = trimmed;
        } else {
          cambios.foto_url = null;
        }
      } else {
        cambios.foto_url = null;
      }
    }

    await Perfil.findByIdAndUpdate(req.params.id, { $set: cambios });
    const actualizado = await Perfil.findById(req.params.id).lean();

    res.json({
      id: String(actualizado._id),
      nombre: actualizado.nombre,
      correo: actualizado.correo,
      rol: actualizado.rol,
      esfera: esferaDe(actualizado.rol),
      estado: actualizado.estado,
      centro: actualizado.centro,
      programa: actualizado.programa,
      ficha: actualizado.ficha,
      jornada: actualizado.jornada,
      nacimiento: actualizado.nacimiento,
      bio: actualizado.bio,
      intereses: actualizado.intereses || [],
      intenciones: actualizado.intenciones || [],
      avatarEmoji: actualizado.avatar_emoji,
      avatarColor: actualizado.avatar_color,
      fotoUrl: actualizado.foto_url || null,
      asistencias: actualizado.asistencias || 0,
      inasistencias: actualizado.inasistencias || 0,
      creado: new Date(actualizado.creado).getTime()
    });
  } catch (e) {
    console.error('Error PATCH /perfiles:', e);
    res.status(500).json({ error: 'Error al actualizar el perfil' });
  }
});

/**
 * DELETE /perfiles/:id
 * Elimina el perfil propio.
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    if (String(req.uid) !== String(req.params.id)) {
      return res.status(403).json({ error: 'Solo puedes borrar tu propia cuenta' });
    }
    await Perfil.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

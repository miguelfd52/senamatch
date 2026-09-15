/**
 * Rutas de perfiles.
 * Reemplaza las consultas directas a la tabla perfiles con RLS.
 */
const express = require('express');
const { auth } = require('../middleware/auth');
const { esferaDe, esStaff, hayBloqueo } = require('../helpers/reglas');
const Perfil = require('../models/Perfil');

const router = express.Router();

/**
 * GET /perfiles
 * Lista perfiles visibles para el usuario autenticado.
 * Aplica las mismas reglas que la política perfiles_lectura de RLS.
 */
router.get('/', auth, async (req, res) => {
  try {
    const yo = req.perfil;
    if (!yo) return res.status(404).json({ error: 'Perfil no encontrado' });

    const miEsfera = esferaDe(yo.rol);
    let filtro = { estado: 'activo' };

    if (!esStaff(yo)) {
      // Solo ve gente de su centro y esfera
      filtro.centro = yo.centro;
      // Filtrar por rol que pertenezca a la misma esfera
      if (miEsfera === 'aprendices') {
        filtro.rol = { $in: ['aprendiz', 'egresado'] };
      } else {
        filtro.rol = { $in: ['instructor', 'bienestar', 'moderador', 'admin'] };
      }
    }

    const perfiles = await Perfil.find(filtro).lean({ virtuals: true });

    // Filtrar bloqueados
    const visibles = [];
    for (const p of perfiles) {
      if (p._id === yo._id) { visibles.push(p); continue; }
      if (!(await hayBloqueo(yo._id, p._id))) {
        visibles.push(p);
      }
    }

    // Mapear al formato que espera el frontend
    const resultado = visibles.map(r => ({
      id: r._id, nombre: r.nombre, correo: r.correo, rol: r.rol,
      esfera: esferaDe(r.rol), estado: r.estado, centro: r.centro,
      programa: r.programa, ficha: r.ficha, jornada: r.jornada,
      nacimiento: r.nacimiento, bio: r.bio,
      intereses: r.intereses || [], intenciones: r.intenciones || [],
      avatarEmoji: r.avatar_emoji, avatarColor: r.avatar_color,
      fotoUrl: r.foto_url || null,
      asistencias: r.asistencias || 0, inasistencias: r.inasistencias || 0,
      demo: r.demo, creado: new Date(r.creado).getTime(),
      visto: new Date(r.visto).getTime()
    }));

    res.json(resultado);
  } catch (e) {
    console.error('Error GET /perfiles:', e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /perfiles/comunidad
 * Lista y busca todos los usuarios registrados en la plataforma para conectar o chatear.
 * Ordenado por fecha de registro reciente.
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
        { correo: regex },
        { programa: regex }
      ];
    }

    const perfiles = await Perfil.find(query)
      .sort({ creado: -1 })
      .limit(50)
      .lean();

    const visibles = [];
    for (const p of perfiles) {
      try {
        if (await hayBloqueo(req.uid, p._id)) continue;
      } catch (err) {
        // Continuar si hayBloqueo falla
      }
      visibles.push({
        id: p._id,
        nombre: p.nombre || 'Usuario SENA',
        correo: p.correo || '',
        rol: p.rol || 'aprendiz',
        programa: p.programa || null,
        ficha: p.ficha || null,
        jornada: p.jornada || null,
        centro: p.centro || null,
        bio: p.bio || '',
        avatarEmoji: p.avatar_emoji || '😊',
        avatarColor: p.avatar_color || '#FF6B4A',
        fotoUrl: p.foto_url || null,
        intereses: p.intereses || [],
        creado: p.creado ? new Date(p.creado).getTime() : Date.now()
      });
    }

    res.json(visibles);
  } catch (e) {
    console.error('Error en GET /perfiles/comunidad:', e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /perfiles/:id
 * Obtiene un perfil por ID.
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const r = await Perfil.findById(req.params.id).lean({ virtuals: true });
    if (!r) return res.status(404).json({ error: 'Perfil no encontrado' });

    res.json({
      id: r._id, nombre: r.nombre, correo: r.correo, rol: r.rol,
      esfera: esferaDe(r.rol), estado: r.estado, centro: r.centro,
      programa: r.programa, ficha: r.ficha, jornada: r.jornada,
      nacimiento: r.nacimiento, bio: r.bio,
      intereses: r.intereses || [], intenciones: r.intenciones || [],
      avatarEmoji: r.avatar_emoji, avatarColor: r.avatar_color,
      fotoUrl: r.foto_url || null,
      asistencias: r.asistencias || 0, inasistencias: r.inasistencias || 0,
      demo: r.demo, creado: new Date(r.creado).getTime(),
      visto: new Date(r.visto).getTime()
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * PATCH /perfiles/:id
 * Actualiza el perfil propio. Solo el dueño puede editar.
 * Equivale al GRANT UPDATE de columnas específicas de Supabase.
 */
router.patch('/:id', auth, async (req, res) => {
  try {
    if (req.uid !== req.params.id && !esStaff(req.perfil)) {
      return res.status(403).json({ error: 'Solo puedes editar tu propio perfil' });
    }

    // Columnas que el cliente puede escribir (como el GRANT de Supabase)
    const permitidas = [
      'nombre', 'centro', 'programa', 'ficha', 'jornada', 'nacimiento',
      'bio', 'intereses', 'intenciones', 'avatar_emoji', 'avatar_color', 'foto_url', 'visto',
      // Aliases que usa el frontend
      'avatarEmoji', 'avatarColor', 'fotoUrl'
    ];

    const cambios = {};
    for (const k of Object.keys(req.body)) {
      if (k === 'avatarEmoji') cambios.avatar_emoji = req.body[k];
      else if (k === 'avatarColor') cambios.avatar_color = req.body[k];
      else if (k === 'fotoUrl') cambios.foto_url = req.body[k];
      else if (permitidas.includes(k)) cambios[k] = req.body[k];
    }

    if (cambios.visto) cambios.visto = new Date(cambios.visto);
    if (cambios.ficha === '') cambios.ficha = null;
    if (cambios.foto_url !== undefined) {
      if (typeof cambios.foto_url === 'string') {
        const trimmed = cambios.foto_url.trim();
        if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
          cambios.foto_url = trimmed;
        } else {
          cambios.foto_url = null; // Rechazar data: base64 o URLs no válidas
        }
      } else {
        cambios.foto_url = null;
      }
    }

    await Perfil.findByIdAndUpdate(req.params.id, { $set: cambios });
    const actualizado = await Perfil.findById(req.params.id).lean({ virtuals: true });

    res.json({
      id: actualizado._id, nombre: actualizado.nombre, correo: actualizado.correo,
      rol: actualizado.rol, esfera: esferaDe(actualizado.rol), estado: actualizado.estado,
      centro: actualizado.centro, programa: actualizado.programa, ficha: actualizado.ficha,
      jornada: actualizado.jornada, nacimiento: actualizado.nacimiento, bio: actualizado.bio,
      intereses: actualizado.intereses || [], intenciones: actualizado.intenciones || [],
      avatarEmoji: actualizado.avatar_emoji, avatarColor: actualizado.avatar_color,
      fotoUrl: actualizado.foto_url || null,
      asistencias: actualizado.asistencias || 0, inasistencias: actualizado.inasistencias || 0,
      demo: actualizado.demo, creado: new Date(actualizado.creado).getTime(),
      visto: new Date(actualizado.visto).getTime()
    });
  } catch (e) {
    console.error('Error PATCH /perfiles:', e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * DELETE /perfiles/:id
 * Elimina el perfil propio.
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    if (req.uid !== req.params.id) {
      return res.status(403).json({ error: 'Solo puedes borrar tu propia cuenta' });
    }
    await Perfil.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

/**
 * Rutas de parches (actividades grupales comunitarias).
 */
const express = require('express');
const crypto = require('crypto');
const { auth } = require('../middleware/auth');
const { esferaDe, esStaff, puedoVerParche, hayBloqueo } = require('../helpers/reglas');
const Perfil = require('../models/Perfil');
const Parche = require('../models/Parche');
const Chat = require('../models/Chat');
const { crearNotificacion } = require('./notificaciones');

const router = express.Router();

/** Añade un mensaje de sistema al chat de un parche. */
async function mensajeSistema(chatId, txt) {
  const chat = await Chat.findById(chatId);
  if (!chat) return;
  const msgs = (chat.mensajes || []).concat([{
    id: 'm_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16),
    de: null,
    txt,
    ts: Date.now(),
    leidoPor: []
  }]).slice(-200);
  await Chat.findByIdAndUpdate(chatId, { $set: { mensajes: msgs, ultimo: new Date() } });
}

/** Añade un miembro al chat. */
async function agregarMiembroChat(chatId, perfilId) {
  await Chat.findByIdAndUpdate(chatId, { $addToSet: { miembros: String(perfilId) } });
}

/** Quita un miembro del chat. */
async function quitarMiembroChat(chatId, perfilId) {
  await Chat.findByIdAndUpdate(chatId, { $pull: { miembros: String(perfilId) } });
}

/**
 * GET /parches
 * Lista todos los parches abiertos de la comunidad.
 */
router.get('/', auth, async (req, res) => {
  try {
    const todos = await Parche.find({ estado: { $ne: 'cancelado' } })
      .sort({ creado: -1 })
      .lean();

    const anfitrionesIds = [...new Set(todos.map(p => String(p.anfitrion)).filter(Boolean))];
    const anfitriones = await Perfil.find({ _id: { $in: anfitrionesIds } }).lean();
    const anfitrionMap = new Map();
    anfitriones.forEach(a => anfitrionMap.set(String(a._id), {
      nombre: a.nombre,
      rol: a.rol,
      avatarEmoji: a.avatar_emoji || '😊',
      avatarColor: a.avatar_color || '#39A900',
      fotoUrl: a.foto_url || null
    }));

    const visibles = [];
    for (const p of todos) {
      if (await hayBloqueo(req.uid, p.anfitrion)) continue;

      const anf = anfitrionMap.get(String(p.anfitrion));
      visibles.push({
        id: String(p._id),
        anfitrion: String(p.anfitrion),
        anfitrionNombre: anf?.nombre || 'Usuario SENA',
        anfitrionRol: anf?.rol || 'aprendiz',
        anfitrionFoto: anf?.fotoUrl || null,
        anfitrionEmoji: anf?.avatarEmoji || '😊',
        titulo: p.titulo,
        descripcion: p.descripcion,
        tipo: p.tipo,
        lugar: p.lugar,
        inicio: p.inicio,
        duracion: p.duracion,
        cupo: p.cupo,
        centro: p.centro,
        esfera: p.esfera,
        mixto: p.mixto,
        aprobacion: p.aprobacion,
        codigo: p.codigo,
        estado: p.estado,
        participantes: (p.participantes || []).map(part => ({
          id: String(part.id),
          rol: part.rol,
          desde: part.desde
        })),
        solicitudes: p.solicitudes || [],
        asistencia: p.asistencia,
        creado: new Date(p.creado).getTime()
      });
    }

    res.json(visibles);
  } catch (e) {
    console.error('Error GET /parches:', e);
    res.status(500).json({ error: 'Error al obtener parches' });
  }
});

/**
 * POST /parches
 * Crea un parche y su chat grupal.
 */
router.post('/', auth, async (req, res) => {
  try {
    const yo = await Perfil.findById(req.uid);
    if (!yo) return res.status(401).json({ error: 'Sin sesión' });

    const d = req.body;
    if (!d.titulo || typeof d.titulo !== 'string' || d.titulo.trim().length < 4) {
      return res.status(400).json({ error: 'El título debe tener al menos 4 caracteres' });
    }
    if (!d.lugar || typeof d.lugar !== 'string' || d.lugar.trim().length < 2) {
      return res.status(400).json({ error: 'El lugar del parche es obligatorio' });
    }
    const cupoNum = parseInt(d.cupo, 10);
    if (isNaN(cupoNum) || cupoNum < 2 || cupoNum > 100) {
      return res.status(400).json({ error: 'El cupo debe estar entre 2 y 100 personas' });
    }

    const miEsfera = esferaDe(yo.rol) || 'aprendices';
    const id = 'p_' + crypto.randomUUID().replace(/-/g, '').slice(0, 20);
    const codigo = crypto.randomUUID().replace(/-/g, '').slice(0, 5).toUpperCase();

    const fechaInicio = d.inicio ? new Date(d.inicio) : new Date(Date.now() + 60 * 60 * 1000);

    const parche = await Parche.create({
      _id: id,
      anfitrion: String(yo._id),
      titulo: d.titulo.trim(),
      descripcion: d.descripcion ? d.descripcion.trim() : null,
      tipo: d.tipo || 'cafe',
      lugar: d.lugar.trim(),
      inicio: fechaInicio,
      duracion: d.duracion || 60,
      cupo: cupoNum,
      centro: yo.centro || null,
      esfera: miEsfera,
      mixto: true,
      aprobacion: !!d.aprobacion,
      codigo,
      estado: 'abierto',
      participantes: [{ id: String(yo._id), rol: 'anfitrion', desde: Date.now() }]
    });

    // Crear chat del parche
    await Chat.create({
      _id: id,
      tipo: 'parche',
      titulo: d.titulo.trim(),
      miembros: [String(yo._id)],
      mensajes: [{
        id: 'm_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16),
        de: null,
        txt: `¡Parche creado! 🎯 ${d.titulo.trim()} · Lugar: ${d.lugar.trim()}`,
        ts: Date.now(),
        leidoPor: [String(yo._id)]
      }],
      creado: new Date(),
      ultimo: new Date()
    });

    res.status(201).json({
      id: parche._id,
      titulo: parche.titulo,
      codigo: parche.codigo,
      anfitrion: parche.anfitrion,
      estado: parche.estado
    });
  } catch (e) {
    console.error('Error POST /parches:', e);
    res.status(500).json({ error: 'Error al crear el parche' });
  }
});

/**
 * POST /parches/:id/entrar
 * Unirse a un parche.
 */
router.post('/:id/entrar', auth, async (req, res) => {
  try {
    const yo = await Perfil.findById(req.uid);
    if (!yo) return res.status(401).json({ error: 'Sin sesión' });

    const parche = await Parche.findById(req.params.id);
    if (!parche) return res.status(404).json({ error: 'Parche no encontrado' });

    if (parche.estado !== 'abierto') {
      return res.status(400).json({ error: `El parche está ${parche.estado}` });
    }

    if (await hayBloqueo(req.uid, parche.anfitrion)) {
      return res.status(403).json({ error: 'No puedes unirte al parche de este anfitrión' });
    }

    const yoId = String(yo._id);
    // Si ya está dentro
    if ((parche.participantes || []).some(p => String(p.id) === yoId)) {
      return res.json({ estado: 'confirmado' });
    }

    // Parche con aprobación -> guardar solicitud y notificar anfitrión
    if (parche.aprobacion) {
      const sols = (parche.solicitudes || []).filter(s => String(s.id) !== yoId);
      sols.push({ id: yoId, nota: req.body.nota || '', ts: Date.now() });
      await Parche.findByIdAndUpdate(req.params.id, { $set: { solicitudes: sols } });

      crearNotificacion({
        recipientId: String(parche.anfitrion),
        type: 'union_parche',
        title: 'Solicitud de unión a tu parche',
        message: `${yo.nombre} quiere unirse a "${parche.titulo}".`,
        reference: String(parche._id)
      }).catch(err => console.error(err));

      return res.json({ estado: 'solicitado' });
    }

    // Verificar cupo
    if ((parche.participantes || []).length >= parche.cupo) {
      return res.status(400).json({ error: 'No quedan cupos disponibles en este parche' });
    }

    // Unirse
    const parts = (parche.participantes || []).concat([
      { id: yoId, rol: 'asistente', desde: Date.now() }
    ]);
    await Parche.findByIdAndUpdate(req.params.id, { $set: { participantes: parts } });

    // Sincronizar chat grupal
    await agregarMiembroChat(req.params.id, yoId);
    await mensajeSistema(req.params.id, `${yo.nombre.split(' ')[0]} se unió al parche.`);

    // Notificar al anfitrión
    if (String(parche.anfitrion) !== yoId) {
      crearNotificacion({
        recipientId: String(parche.anfitrion),
        type: 'union_parche',
        title: 'Nuevo participante en tu parche 🎉',
        message: `${yo.nombre} se unió a "${parche.titulo}".`,
        reference: String(parche._id)
      }).catch(err => console.error(err));
    }

    res.json({ estado: 'confirmado' });
  } catch (e) {
    console.error('Error POST /parches/:id/entrar:', e);
    res.status(500).json({ error: 'Error al unirte al parche' });
  }
});

/**
 * POST /parches/:id/salir
 * Salir voluntariamente de un parche.
 */
router.post('/:id/salir', auth, async (req, res) => {
  try {
    const yo = await Perfil.findById(req.uid);
    const parche = await Parche.findById(req.params.id);
    if (!parche) return res.status(404).json({ error: 'Parche no encontrado' });

    const yoId = String(yo._id);
    if (String(parche.anfitrion) === yoId) {
      return res.status(400).json({ error: 'El anfitrión no puede salir de su propio parche; debe cancelarlo si no se realizará' });
    }

    const parts = (parche.participantes || []).filter(p => String(p.id) !== yoId);
    await Parche.findByIdAndUpdate(req.params.id, { $set: { participantes: parts } });

    // Quitar del chat grupal
    await quitarMiembroChat(req.params.id, yoId);
    await mensajeSistema(req.params.id, `${yo.nombre.split(' ')[0]} ya no participará.`);

    res.json({ ok: true });
  } catch (e) {
    console.error('Error en salir de parche:', e);
    res.status(500).json({ error: 'Error al salir del parche' });
  }
});

/**
 * POST /parches/:id/expulsar
 * El anfitrión expulsa a un participante.
 */
router.post('/:id/expulsar', auth, async (req, res) => {
  try {
    const { targetUserId } = req.body;
    if (!targetUserId) return res.status(400).json({ error: 'Usuario a expulsar no especificado' });

    const parche = await Parche.findById(req.params.id);
    if (!parche) return res.status(404).json({ error: 'Parche no encontrado' });

    const esAnfitrion = String(parche.anfitrion) === String(req.uid);
    const puedeStaff = esStaff(req.perfil);
    if (!esAnfitrion && !puedeStaff) {
      return res.status(403).json({ error: 'Solo el anfitrión o moderador puede expulsar participantes' });
    }

    const targetId = String(targetUserId);
    if (targetId === String(parche.anfitrion)) {
      return res.status(400).json({ error: 'No se puede expulsar al anfitrión' });
    }

    const parts = (parche.participantes || []).filter(p => String(p.id) !== targetId);
    await Parche.findByIdAndUpdate(req.params.id, { $set: { participantes: parts } });

    await quitarMiembroChat(req.params.id, targetId);
    const targetPerfil = await Perfil.findById(targetId);
    await mensajeSistema(req.params.id, `${targetPerfil ? targetPerfil.nombre.split(' ')[0] : 'Un miembro'} fue retirado del parche.`);

    // Notificar al expulsado
    crearNotificacion({
      recipientId: targetId,
      type: 'salida_parche',
      title: 'Has sido retirado del parche',
      message: `El anfitrión te retiró de "${parche.titulo}".`,
      reference: String(parche._id)
    }).catch(err => console.error(err));

    res.json({ ok: true });
  } catch (e) {
    console.error('Error en expulsar de parche:', e);
    res.status(500).json({ error: 'Error al expulsar al participante' });
  }
});

/**
 * POST /parches/:id/cancelar
 * Cancela el parche e informa a los integrantes.
 */
router.post('/:id/cancelar', auth, async (req, res) => {
  try {
    const parche = await Parche.findById(req.params.id);
    if (!parche) return res.status(404).json({ error: 'Parche no encontrado' });

    const esAnfitrion = String(parche.anfitrion) === String(req.uid);
    const puedeStaff = esStaff(req.perfil);

    if (!esAnfitrion && !puedeStaff) {
      return res.status(403).json({ error: 'Solo el anfitrión o el equipo de moderación puede cancelar el parche' });
    }

    await Parche.findByIdAndUpdate(req.params.id, { $set: { estado: 'cancelado' } });
    await mensajeSistema(req.params.id, 'El anfitrión canceló este parche.');

    // Notificar a todos los participantes
    const participantes = (parche.participantes || [])
      .map(p => String(p.id))
      .filter(id => id !== String(req.uid));

    for (const pId of participantes) {
      crearNotificacion({
        recipientId: pId,
        type: 'cancelacion_parche',
        title: 'Parche cancelado ⚠️',
        message: `El parche "${parche.titulo}" ha sido cancelado por su anfitrión.`,
        reference: String(parche._id)
      }).catch(err => console.error(err));
    }

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /parches/:id/asistencia
 * Marca asistencia al finalizar el parche.
 */
router.post('/:id/asistencia', auth, async (req, res) => {
  try {
    const { llegaron } = req.body;
    const parche = await Parche.findById(req.params.id);
    if (!parche) return res.status(404).json({ error: 'Parche no encontrado' });

    if (String(parche.anfitrion) !== String(req.uid) && !esStaff(req.perfil)) {
      return res.status(403).json({ error: 'Solo el anfitrión o moderador marca asistencia' });
    }

    const todos = (parche.participantes || [])
      .filter(p => String(p.id) !== String(parche.anfitrion))
      .map(p => String(p.id));

    const llegaronSet = new Set((llegaron || []).map(String));
    const faltaron = todos.filter(id => !llegaronSet.has(id));

    await Parche.findByIdAndUpdate(req.params.id, {
      $set: {
        asistencia: { llegaron: Array.from(llegaronSet), faltaron, ts: Date.now() },
        estado: 'finalizado'
      }
    });

    for (const pid of llegaronSet) {
      await Perfil.findByIdAndUpdate(pid, { $inc: { asistencias: 1 } });
    }
    for (const pid of faltaron) {
      await Perfil.findByIdAndUpdate(pid, { $inc: { inasistencias: 1 } });
    }

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

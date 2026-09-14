/**
 * Rutas de parches (actividades grupales efímeras).
 * Reemplaza crear_parche(), entrar_parche(), salir_parche(),
 * cancelar_parche(), decidir_solicitud(), marcar_asistencia().
 */
const express = require('express');
const crypto = require('crypto');
const { auth } = require('../middleware/auth');
const { esferaDe, esStaff, puedoVerParche } = require('../helpers/reglas');
const Perfil = require('../models/Perfil');
const Parche = require('../models/Parche');
const Chat = require('../models/Chat');

const router = express.Router();

/** Añade un mensaje de sistema al chat de un parche. */
async function mensajeSistema(chatId, txt) {
  const chat = await Chat.findById(chatId);
  if (!chat) return;
  const msgs = (chat.mensajes || []).concat([{ de: null, txt, ts: Date.now() }]).slice(-200);
  await Chat.findByIdAndUpdate(chatId, { $set: { mensajes: msgs, ultimo: new Date() } });
}

/** Añade un miembro al chat. */
async function agregarMiembroChat(chatId, perfilId) {
  await Chat.findByIdAndUpdate(chatId, { $addToSet: { miembros: perfilId } });
}

/**
 * GET /parches
 * Lista todos los parches de la comunidad visibles para todos los usuarios registrados.
 */
router.get('/', auth, async (req, res) => {
  try {
    const yo = req.perfil;
    const todos = await Parche.find({ estado: { $ne: 'cancelado' } })
      .sort({ creado: -1 })
      .lean();

    // Obtener nombres y datos de los anfitriones
    const anfitrionesIds = [...new Set(todos.map(p => p.anfitrion).filter(Boolean))];
    const anfitriones = await Perfil.find({ _id: { $in: anfitrionesIds } }).lean();
    const anfitrionMap = new Map();
    anfitriones.forEach(a => anfitrionMap.set(a._id, a.nombre));

    const visibles = [];

    for (const p of todos) {
      if (await puedoVerParche(yo, p) || p.anfitrion === req.uid || esStaff(yo)) {
        visibles.push({
          id: p._id,
          anfitrion: p.anfitrion,
          anfitrionNombre: anfitrionMap.get(p.anfitrion) || 'Usuario SENA',
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
          participantes: p.participantes || [],
          solicitudes: p.solicitudes || [],
          asistencia: p.asistencia,
          creado: new Date(p.creado).getTime()
        });
      }
    }

    res.json(visibles);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /parches
 * Crea un parche visible para toda la comunidad.
 */
router.post('/', auth, async (req, res) => {
  try {
    const yo = await Perfil.findById(req.uid);
    if (!yo) return res.status(401).json({ error: 'Sin sesión' });

    // Límite de 5 parches por día
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    const hoyCount = await Parche.countDocuments({
      anfitrion: yo._id,
      creado: { $gte: hoy },
      estado: { $ne: 'cancelado' }
    });
    if (hoyCount >= 5) {
      return res.status(429).json({ error: `Ya publicaste ${hoyCount} parches hoy` });
    }

    const d = req.body;
    const miEsfera = esferaDe(yo.rol) || 'aprendices';

    const id = 'p' + crypto.randomUUID().replace(/-/g, '').slice(0, 20);
    const codigo = crypto.randomUUID().replace(/-/g, '').slice(0, 5).toUpperCase();

    const parche = await Parche.create({
      _id: id,
      anfitrion: yo._id,
      titulo: d.titulo,
      descripcion: d.descripcion || null,
      tipo: d.tipo,
      lugar: d.lugar,
      inicio: new Date(d.inicio),
      duracion: d.duracion || 60,
      cupo: d.cupo,
      centro: yo.centro || 0,
      esfera: miEsfera,
      mixto: true, // Mixto para que lo vean y participen todos los aprendices y miembros
      aprobacion: !!d.aprobacion,
      codigo,
      participantes: [{ id: yo._id, rol: 'anfitrion', desde: Date.now() }]
    });

    // Crear chat del parche
    await Chat.create({
      _id: id,
      tipo: 'parche',
      titulo: d.titulo,
      miembros: [yo._id],
      mensajes: [{
        de: null,
        txt: `${d.titulo} · ${d.lugar}`,
        ts: Date.now()
      }]
    });

    res.json({
      id: parche._id, titulo: parche.titulo, codigo: parche.codigo,
      anfitrion: parche.anfitrion, estado: parche.estado
    });
  } catch (e) {
    console.error('Error POST /parches:', e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /parches/:id/entrar
 * Unirse a un parche. Réplica de entrar_parche().
 */
router.post('/:id/entrar', auth, async (req, res) => {
  try {
    const yo = await Perfil.findById(req.uid);
    if (!yo) return res.status(401).json({ error: 'Sin sesión' });

    const parche = await Parche.findById(req.params.id);
    if (!parche) return res.status(404).json({ error: 'Parche no encontrado' });

    if (!(await puedoVerParche(yo, parche))) {
      return res.status(403).json({ error: 'Ese parche no está disponible para ti' });
    }

    if (parche.estado !== 'abierto') {
      return res.status(400).json({ error: `El parche está ${parche.estado}` });
    }
    if (new Date(parche.inicio) <= new Date()) {
      return res.status(400).json({ error: 'El parche ya empezó' });
    }

    // Ya está dentro
    if ((parche.participantes || []).some(p => p.id === yo._id)) {
      return res.json({ estado: 'confirmado' });
    }

    // Verificar inasistencias
    const faltas = yo.inasistencias || 0;
    if (faltas >= 3 && faltas > (yo.asistencias || 0) && !parche.aprobacion) {
      return res.status(403).json({
        error: `Tienes ${faltas} inasistencias: solo puedes pedir cupo en parches con aprobación`
      });
    }

    // Parche con aprobación → solicitud
    if (parche.aprobacion) {
      const sols = (parche.solicitudes || []).filter(s => s.id !== yo._id);
      sols.push({ id: yo._id, nota: req.body.nota || '', ts: Date.now() });
      await Parche.findByIdAndUpdate(req.params.id, { $set: { solicitudes: sols } });
      return res.json({ estado: 'solicitado' });
    }

    // Verificar cupo
    if ((parche.participantes || []).length >= parche.cupo) {
      return res.status(400).json({ error: 'No quedan cupos' });
    }

    // Unirse
    const parts = (parche.participantes || []).concat([
      { id: yo._id, rol: 'asistente', desde: Date.now() }
    ]);
    await Parche.findByIdAndUpdate(req.params.id, { $set: { participantes: parts } });

    await agregarMiembroChat(req.params.id, yo._id);
    await mensajeSistema(req.params.id, `${yo.nombre.split(' ')[0]} se unió.`);

    res.json({ estado: 'confirmado' });
  } catch (e) {
    console.error('Error POST /parches/:id/entrar:', e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /parches/:id/salir
 * Salir de un parche. Réplica de salir_parche().
 */
router.post('/:id/salir', auth, async (req, res) => {
  try {
    const yo = await Perfil.findById(req.uid);
    const parche = await Parche.findById(req.params.id);
    if (!parche) return res.status(404).json({ error: 'Parche no encontrado' });

    if (parche.anfitrion === yo._id) {
      return res.status(400).json({ error: 'El anfitrión no puede salir, solo cancelar' });
    }

    const parts = (parche.participantes || []).filter(p => p.id !== yo._id);
    await Parche.findByIdAndUpdate(req.params.id, { $set: { participantes: parts } });
    await Chat.findByIdAndUpdate(req.params.id, { $pull: { miembros: yo._id } });
    await mensajeSistema(req.params.id, `${yo.nombre.split(' ')[0]} ya no va.`);

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /parches/:id/cancelar
 * Cancela un parche. Réplica de cancelar_parche().
 */
router.post('/:id/cancelar', auth, async (req, res) => {
  try {
    const parche = await Parche.findById(req.params.id);
    if (!parche) return res.status(404).json({ error: 'Parche no encontrado' });

    if (parche.anfitrion !== req.uid && !esStaff(req.perfil)) {
      return res.status(403).json({ error: 'Solo el anfitrión o moderación cancela' });
    }

    await Parche.findByIdAndUpdate(req.params.id, { $set: { estado: 'cancelado' } });
    await mensajeSistema(req.params.id, 'El anfitrión canceló el parche.');

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /parches/:id/decidir
 * Aprueba o rechaza una solicitud. Réplica de decidir_solicitud().
 */
router.post('/:id/decidir', auth, async (req, res) => {
  try {
    const { quien, aprobar } = req.body;
    const parche = await Parche.findById(req.params.id);
    if (!parche) return res.status(404).json({ error: 'Parche no encontrado' });

    if (parche.anfitrion !== req.uid) {
      return res.status(403).json({ error: 'Solo el anfitrión decide' });
    }

    // Quitar de solicitudes
    const sols = (parche.solicitudes || []).filter(s => s.id !== quien);
    const cambios = { solicitudes: sols };

    if (aprobar) {
      if ((parche.participantes || []).length >= parche.cupo) {
        return res.status(400).json({ error: 'No quedan cupos' });
      }
      cambios.participantes = (parche.participantes || []).concat([
        { id: quien, rol: 'asistente', desde: Date.now() }
      ]);
      await agregarMiembroChat(req.params.id, quien);
      const per = await Perfil.findById(quien);
      await mensajeSistema(req.params.id,
        `${per ? per.nombre.split(' ')[0] : 'Alguien'} entró al parche.`);
    }

    await Parche.findByIdAndUpdate(req.params.id, { $set: cambios });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /parches/:id/asistencia
 * Marca asistencia. Réplica de marcar_asistencia().
 */
router.post('/:id/asistencia', auth, async (req, res) => {
  try {
    const { llegaron } = req.body; // array de IDs
    const parche = await Parche.findById(req.params.id);
    if (!parche) return res.status(404).json({ error: 'Parche no encontrado' });

    if (parche.anfitrion !== req.uid) {
      return res.status(403).json({ error: 'Solo el anfitrión marca asistencia' });
    }
    if (new Date(parche.inicio) > new Date()) {
      return res.status(400).json({ error: 'El parche todavía no empieza' });
    }

    const todos = (parche.participantes || [])
      .filter(p => p.id !== parche.anfitrion)
      .map(p => p.id);
    const llegaronSet = new Set(llegaron || []);
    const faltaron = todos.filter(id => !llegaronSet.has(id));

    await Parche.findByIdAndUpdate(req.params.id, {
      $set: {
        asistencia: { llegaron: llegaron || [], faltaron, ts: Date.now() },
        estado: 'finalizado'
      }
    });

    // Actualizar contadores
    for (const pid of (llegaron || [])) {
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

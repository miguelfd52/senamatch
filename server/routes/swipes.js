/**
 * Rutas de swipes y matches.
 * Reemplaza registrar_swipe() y me_marcaron() del esquema SQL.
 */
const express = require('express');
const crypto = require('crypto');
const { auth } = require('../middleware/auth');
const { puedoVer, esferaDe } = require('../helpers/reglas');
const Perfil = require('../models/Perfil');
const Swipe = require('../models/Swipe');
const Match = require('../models/Match');
const Chat = require('../models/Chat');

const router = express.Router();

/**
 * GET /swipes
 * Devuelve los swipes del usuario autenticado.
 */
router.get('/', auth, async (req, res) => {
  try {
    const doc = await Swipe.findById(req.uid);
    res.json({
      id: req.uid,
      porIntencion: doc ? doc.por_intencion || {} : {},
      ts: doc ? new Date(doc.ts).getTime() : 0
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /swipes/registrar
 * Registra un swipe (like/pass). Si hay reciprocidad, crea match + chat.
 * Réplica de registrar_swipe() del esquema SQL.
 */
router.post('/registrar', auth, async (req, res) => {
  try {
    const { p_otro, p_intencion, p_dir } = req.body;
    const yoId = req.uid;

    if (!['like', 'pass'].includes(p_dir)) {
      return res.status(400).json({ error: 'Dirección inválida' });
    }

    const yo = await Perfil.findById(yoId);
    const otro = await Perfil.findById(p_otro);

    if (!(await puedoVer(yo, otro, p_intencion))) {
      return res.status(403).json({ error: 'Ese perfil no está disponible' });
    }

    // Upsert swipe del usuario
    await Swipe.findByIdAndUpdate(
      yoId,
      {
        $set: {
          [`por_intencion.${p_intencion}.${p_otro}`]: p_dir,
          ts: new Date()
        }
      },
      { upsert: true, new: true }
    );

    if (p_dir === 'pass') {
      return res.json({ match: false });
    }

    // ¿Reciprocidad?
    const otroSwipe = await Swipe.findById(p_otro);
    const otroMap = otroSwipe && otroSwipe.por_intencion
      ? otroSwipe.por_intencion[p_intencion] || {}
      : {};

    if (otroMap[yoId] !== 'like') {
      return res.json({ match: false });
    }

    // ¡Match! Crear match y chat
    const [a, b] = yoId < p_otro ? [yoId, p_otro] : [p_otro, yoId];
    const matchId = `${a}__${b}__${p_intencion}`;

    await Match.findByIdAndUpdate(
      matchId,
      {
        $set: { a, b, intencion: p_intencion, activo: true },
        $setOnInsert: { creado: new Date() }
      },
      { upsert: true }
    );

    // Crear chat si no existe
    const existeChat = await Chat.findById(matchId);
    if (!existeChat) {
      await Chat.create({
        _id: matchId,
        tipo: 'match',
        titulo: '',
        miembros: [yoId, p_otro],
        mensajes: [{
          de: null,
          txt: `Coincidieron en ${p_intencion}.`,
          ts: Date.now()
        }],
        creado: new Date(),
        ultimo: new Date()
      });
    }

    res.json({ match: true, chat: matchId });
  } catch (e) {
    console.error('Error POST /swipes/registrar:', e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /swipes/me-marcaron
 * ¿Quién me marcó y aún no le respondo?
 * Réplica de me_marcaron() del esquema SQL.
 */
router.get('/me-marcaron', auth, async (req, res) => {
  try {
    const yoId = req.uid;
    const miSwipe = await Swipe.findById(yoId);
    const miMap = miSwipe ? miSwipe.por_intencion || {} : {};

    // Buscar todos los swipes de otros
    const otros = await Swipe.find({ _id: { $ne: yoId } });
    const resultado = [];

    for (const s of otros) {
      const porInt = s.por_intencion || {};
      for (const intencion of Object.keys(porInt)) {
        const vals = porInt[intencion] || {};
        if (vals[yoId] === 'like') {
          // ¿Yo ya le respondí?
          const mio = (miMap[intencion] || {})[s._id];
          if (!mio) {
            // Verificar que puedo verle
            const otroPerfil = await Perfil.findById(s._id);
            if (otroPerfil && await puedoVer(req.perfil, otroPerfil, intencion)) {
              resultado.push({ perfil: s._id, intencion });
            }
          }
        }
      }
    }

    res.json(resultado);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /matches
 * Devuelve los matches del usuario autenticado.
 */
router.get('/matches', auth, async (req, res) => {
  try {
    const matches = await Match.find({
      $or: [{ a: req.uid }, { b: req.uid }],
      activo: true
    });
    res.json(matches.map(m => ({
      id: m._id, a: m.a, b: m.b, intencion: m.intencion,
      activo: m.activo, creado: new Date(m.creado).getTime()
    })));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

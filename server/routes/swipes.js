/**
 * Rutas de swipes y matches.
 */
const express = require('express');
const crypto = require('crypto');
const { auth } = require('../middleware/auth');
const { puedoVer, esferaDe, hayBloqueo } = require('../helpers/reglas');
const Perfil = require('../models/Perfil');
const Swipe = require('../models/Swipe');
const Match = require('../models/Match');
const Chat = require('../models/Chat');
const Notificacion = require('../models/Notificacion');
const { crearNotificacion } = require('./notificaciones');

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
 * Registra un swipe (like/pass). Si hay reciprocidad, crea match + chat y notificaciones.
 */
router.post('/registrar', auth, async (req, res) => {
  try {
    const { p_otro, p_intencion, p_dir } = req.body;
    const yoId = String(req.uid);
    const otroId = String(p_otro);

    if (!['like', 'pass'].includes(p_dir)) {
      return res.status(400).json({ error: 'Dirección inválida' });
    }

    if (yoId === otroId) {
      return res.status(400).json({ error: 'No puedes interactuar contigo mismo' });
    }

    if (await hayBloqueo(yoId, otroId)) {
      return res.status(403).json({ error: 'No puedes interactuar con un usuario bloqueado' });
    }

    const yo = await Perfil.findById(yoId);
    const otro = await Perfil.findById(otroId);

    if (!(await puedoVer(yo, otro, p_intencion))) {
      return res.status(403).json({ error: 'Ese perfil no está disponible para interactuar' });
    }

    // Upsert swipe del usuario
    await Swipe.findByIdAndUpdate(
      yoId,
      {
        $set: {
          [`por_intencion.${p_intencion}.${otroId}`]: p_dir,
          ts: new Date()
        }
      },
      { upsert: true, new: true }
    );

    if (p_dir === 'pass') {
      return res.json({ match: false });
    }

    // ¿Reciprocidad?
    const otroSwipe = await Swipe.findById(otroId);
    let otroDioLike = false;
    let intencionMatch = p_intencion || 'amistad';

    if (otroSwipe && otroSwipe.por_intencion) {
      // 1. Chequear primero en la misma intención
      if (otroSwipe.por_intencion[p_intencion]?.[yoId] === 'like') {
        otroDioLike = true;
      } else {
        // 2. Si no, chequear si le dio like en cualquier otra intención
        for (const [int, mapa] of Object.entries(otroSwipe.por_intencion)) {
          if (mapa && mapa[yoId] === 'like') {
            otroDioLike = true;
            intencionMatch = int;
            break;
          }
        }
      }
    }

    if (!otroDioLike) {
      return res.json({ match: false });
    }

    // ¡Match! Crear o reutilizar match único entre ambos usuarios
    const [a, b] = yoId < otroId ? [yoId, otroId] : [otroId, yoId];
    const matchId = `${a}__${b}`;
    
    // Buscar si ya existe match previo entre estos 2 usuarios
    let match = await Match.findOne({
      $or: [
        { _id: matchId },
        { a, b },
        { a: b, b: a }
      ]
    });

    const isNewMatch = !match || !match.activo;

    if (!match) {
      // Si no existe, crearlo explícitamente en MongoDB con ID y campos completos
      match = await Match.create({
        _id: matchId,
        a,
        b,
        intencion: intencionMatch,
        activo: true,
        creado: new Date()
      });
    } else if (!match.activo) {
      // Si existía pero estaba inactivo (ej. se habían descartado), reactivarlo
      match.activo = true;
      match.intencion = intencionMatch;
      await match.save();
    }

    // Reutilizar o crear chat único entre ambos usuarios
    let chat = await Chat.findOne({
      tipo: { $in: ['match', 'directo'] },
      miembros: { $all: [yoId, otroId], $size: 2 }
    });

    const mensajeBienvenida = '🎉 ¡Hicieron Match! Ahora pueden comenzar a conocerse.';

    if (!chat) {
      chat = await Chat.create({
        _id: `chat_${a}_${b}`,
        tipo: 'match',
        titulo: `${yo.nombre} & ${otro.nombre}`,
        miembros: [yoId, otroId],
        mensajes: [{
          id: 'm_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16),
          de: null,
          senderId: null,
          senderNombre: 'SENA Match',
          nombre: 'SENA Match',
          txt: mensajeBienvenida,
          ts: Date.now(),
          leidoPor: [yoId, otroId]
        }],
        creado: new Date(),
        ultimo: new Date()
      });
    } else {
      // Asegurar que ambos son miembros
      await Chat.findByIdAndUpdate(chat._id, {
        $addToSet: { miembros: { $each: [yoId, otroId] } }
      });

      // Si el chat existente no tiene ningún mensaje, enviar el mensaje de bienvenida una sola vez
      const mensajesExistentes = chat.mensajes || [];
      const yaTieneBienvenida = mensajesExistentes.some(m => m && m.txt && m.txt.includes('¡Hicieron Match!'));
      if (!yaTieneBienvenida && mensajesExistentes.length === 0) {
        await Chat.findByIdAndUpdate(chat._id, {
          $push: {
            mensajes: {
              id: 'm_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16),
              de: null,
              senderId: null,
              senderNombre: 'SENA Match',
              nombre: 'SENA Match',
              txt: mensajeBienvenida,
              ts: Date.now(),
              leidoPor: [yoId, otroId]
            }
          },
          $set: { ultimo: new Date() }
        });
      }
    }

    // Generar notificaciones para ambos usuarios sin duplicados
    if (isNewMatch) {
      const [notifA, notifB] = await Promise.all([
        Notificacion.findOne({ recipientId: yoId, type: 'nuevo_match', reference: String(chat._id) }),
        Notificacion.findOne({ recipientId: otroId, type: 'nuevo_match', reference: String(chat._id) })
      ]);

      const notifPromises = [];
      if (!notifA) {
        notifPromises.push(crearNotificacion({
          recipientId: yoId,
          type: 'nuevo_match',
          title: '¡Nuevo Match! 🎉',
          message: `¡Hiciste Match con ${otro.nombre}! Ahora pueden comenzar a conocerse.`,
          reference: String(chat._id)
        }));
      }
      if (!notifB) {
        notifPromises.push(crearNotificacion({
          recipientId: otroId,
          type: 'nuevo_match',
          title: '¡Nuevo Match! 🎉',
          message: `¡Hiciste Match con ${yo.nombre}! Ahora pueden comenzar a conocerse.`,
          reference: String(chat._id)
        }));
      }
      if (notifPromises.length > 0) {
        await Promise.all(notifPromises);
      }
    }

    res.json({
      match: true,
      chat: chat._id,
      otroUsuario: {
        id: String(otro._id),
        nombre: otro.nombre,
        rol: otro.rol,
        avatarEmoji: otro.avatar_emoji || '😊',
        avatarColor: otro.avatar_color || '#39A900',
        fotoUrl: otro.foto_url || null,
        programa: otro.programa || null
      }
    });
  } catch (e) {
    console.error('Error POST /swipes/registrar:', e);
    res.status(500).json({ error: 'Error al registrar la acción' });
  }
});

/**
 * POST /swipes/deshacer
 * Deshace el último 'pass' dado por el usuario en una intención específica.
 */
router.post('/deshacer', auth, async (req, res) => {
  try {
    const { p_intencion, targetId } = req.body;
    const yoId = String(req.uid);

    const swipeDoc = await Swipe.findById(yoId);
    if (!swipeDoc || !swipeDoc.por_intencion) {
      return res.status(400).json({ error: 'No hay acciones previas para deshacer' });
    }

    const mapa = swipeDoc.por_intencion[p_intencion] || {};
    let target = targetId;

    if (!target) {
      // Si no especificó ID, buscar la última clave con 'pass'
      const keys = Object.keys(mapa);
      for (let i = keys.length - 1; i >= 0; i--) {
        if (mapa[keys[i]] === 'pass') {
          target = keys[i];
          break;
        }
      }
    }

    if (!target || mapa[target] !== 'pass') {
      return res.status(400).json({ error: 'No se encontró un descarte reciente para deshacer' });
    }

    // Eliminar del mapa
    await Swipe.findByIdAndUpdate(yoId, {
      $unset: { [`por_intencion.${p_intencion}.${target}`]: '' }
    });

    res.json({ ok: true, undoneId: target });
  } catch (e) {
    console.error('Error en POST /swipes/deshacer:', e);
    res.status(500).json({ error: 'Error al deshacer el descarte' });
  }
});

/**
 * GET /matches
 * Devuelve los matches del usuario autenticado.
 */
router.get('/matches', auth, async (req, res) => {
  try {
    const uid = String(req.uid);
    const matches = await Match.find({
      $or: [{ a: uid }, { b: uid }],
      activo: true
    }).sort({ creado: -1 }).lean();

    const otherIds = matches.map(m => m.a === uid ? m.b : m.a);
    const perfiles = await Perfil.find({ _id: { $in: otherIds } }).lean();
    const perfilMap = new Map();
    perfiles.forEach(p => perfilMap.set(String(p._id), p));

    const resultado = [];
    const seenOtherIds = new Set();
    for (const m of matches) {
      const otherId = m.a === uid ? m.b : m.a;
      if (seenOtherIds.has(String(otherId))) continue;
      if (await hayBloqueo(uid, otherId)) continue;

      seenOtherIds.add(String(otherId));
      const p = perfilMap.get(String(otherId));
      resultado.push({
        id: m._id,
        a: m.a,
        b: m.b,
        intencion: m.intencion,
        activo: m.activo,
        otroUsuario: p ? {
          id: String(p._id),
          nombre: p.nombre,
          rol: p.rol,
          avatarEmoji: p.avatar_emoji || '😊',
          avatarColor: p.avatar_color || '#39A900',
          fotoUrl: p.foto_url || null,
          programa: p.programa || null
        } : null,
        creado: new Date(m.creado).getTime()
      });
    }

    res.json(resultado);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

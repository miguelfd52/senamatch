const express = require('express');
const crypto = require('crypto');
const { auth } = require('../middleware/auth');
const { hayBloqueo } = require('../helpers/reglas');
const Chat = require('../models/Chat');
const Match = require('../models/Match');
const Perfil = require('../models/Perfil');
const Parche = require('../models/Parche');
const { crearNotificacion } = require('./notificaciones');

const router = express.Router();

/**
 * Helper para verificar si un usuario es miembro de un chat de forma segura.
 */
function esMiembroDelChat(chat, uid) {
  if (!chat || !Array.isArray(chat.miembros)) return false;
  return chat.miembros.some(m => String(m) === String(uid));
}

/**
 * GET /chats
 * Lista chats donde el usuario autenticado participa, enriqueciendo con detalles del otro usuario
 * y filtrando conversaciones con usuarios bloqueados.
 */
router.get('/', auth, async (req, res) => {
  try {
    const uid = String(req.uid);
    const chats = await Chat.find({ miembros: uid }).sort({ ultimo: -1 }).lean();

    // Recolectar IDs de otros participantes
    const otherUserIds = [];
    chats.forEach(c => {
      if (c.tipo === 'directo' || c.tipo === 'match') {
        const other = (c.miembros || []).find(m => String(m) !== uid);
        if (other) {
          const sOther = String(other);
          if (!otherUserIds.includes(sOther)) {
            otherUserIds.push(sOther);
          }
        }
      }
    });

    const perfiles = await Perfil.find({ _id: { $in: otherUserIds } }).lean();
    const perfilMap = new Map();
    perfiles.forEach(p => {
      perfilMap.set(String(p._id), {
        id: String(p._id),
        nombre: p.nombre || 'Usuario SENA',
        rol: p.rol || 'aprendiz',
        avatarEmoji: p.avatar_emoji || '😊',
        avatarColor: p.avatar_color || '#39A900',
        fotoUrl: p.foto_url || null,
        programa: p.programa || null,
        centro: p.centro || null
      });
    });

    const resultado = [];
    for (const c of chats) {
      // Doble validación de seguridad de membresía
      if (!esMiembroDelChat(c, uid)) continue;

      let otroUsuario = null;
      let titulo = c.titulo;

      if (c.tipo === 'directo' || c.tipo === 'match') {
        const other = (c.miembros || []).find(m => String(m) !== uid);
        if (other) {
          const sOther = String(other);
          // Ocultar si hay bloqueo
          if (await hayBloqueo(uid, sOther)) {
            continue;
          }
          if (perfilMap.has(sOther)) {
            otroUsuario = perfilMap.get(sOther);
            titulo = otroUsuario.nombre;
          }
        }
      }

      // Calcular mensajes no leídos por este usuario
      const mensajes = c.mensajes || [];
      const unreadCount = mensajes.filter(m => {
        if (!m || !m.de) return false; // mensajes del sistema no cuentan
        if (String(m.de) === uid) return false; // mis propios mensajes no son no-leídos
        const leidoPor = Array.isArray(m.leidoPor) ? m.leidoPor.map(String) : [];
        return !leidoPor.includes(uid);
      }).length;

      const ultimoMsg = mensajes.length ? mensajes[mensajes.length - 1] : null;

      resultado.push({
        id: c._id,
        tipo: c.tipo,
        titulo: titulo || (c.tipo === 'parche' ? 'Chat de parche' : 'Conversación'),
        otroUsuario,
        miembros: (c.miembros || []).map(String),
        mensajes,
        ultimoMensaje: ultimoMsg ? {
          de: ultimoMsg.de ? String(ultimoMsg.de) : null,
          txt: ultimoMsg.txt || '',
          ts: ultimoMsg.ts || Date.now()
        } : null,
        unreadCount,
        creado: c.creado ? new Date(c.creado).getTime() : Date.now(),
        ultimo: c.ultimo ? new Date(c.ultimo).getTime() : Date.now()
      });
    }

    res.json(resultado);
  } catch (e) {
    console.error('Error en GET /chats:', e);
    res.status(500).json({ error: 'Error al obtener la bandeja de chats' });
  }
});

/**
 * POST /chats/directo
 * Crea u obtiene una conversación 1 a 1 directa única con otro usuario registrado.
 */
router.post('/directo', auth, async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const uid = String(req.uid);

    if (!targetUserId) {
      return res.status(400).json({ error: 'El identificador del usuario es obligatorio' });
    }
    if (String(targetUserId) === uid) {
      return res.status(400).json({ error: 'No puedes iniciar una conversación contigo mismo' });
    }

    const targetUser = await Perfil.findById(targetUserId).lean();
    if (!targetUser) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (await hayBloqueo(uid, targetUserId)) {
      return res.status(403).json({ error: 'No puedes comunicarte con este usuario debido a un bloqueo' });
    }

    // Buscar si ya existe chat directo o match con exactamente los dos participantes
    const [a, b] = uid < String(targetUserId) ? [uid, String(targetUserId)] : [String(targetUserId), uid];
    const matchChatId = `${a}__${b}`;

    let chat = await Chat.findOne({
      tipo: { $in: ['directo', 'match'] },
      miembros: { $all: [uid, String(targetUserId)], $size: 2 }
    });

    if (!chat) {
      const miNombre = req.perfil?.nombre || 'Usuario SENA';
      chat = await Chat.create({
        _id: 'c_' + crypto.randomUUID().replace(/-/g, '').slice(0, 20),
        tipo: 'directo',
        titulo: `${miNombre} & ${targetUser.nombre}`,
        miembros: [uid, String(targetUserId)],
        mensajes: [{
          id: 'm_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16),
          de: null,
          txt: `Conversación iniciada con ${targetUser.nombre}. ¡Saluda a tu compañero! 👋`,
          ts: Date.now(),
          leidoPor: [uid, String(targetUserId)]
        }],
        creado: new Date(),
        ultimo: new Date()
      });
    }

    const mensajes = chat.mensajes || [];
    const ultimoMsg = mensajes.length ? mensajes[mensajes.length - 1] : null;

    res.json({
      id: chat._id,
      tipo: chat.tipo,
      titulo: targetUser.nombre,
      otroUsuario: {
        id: String(targetUser._id),
        nombre: targetUser.nombre,
        rol: targetUser.rol,
        avatarEmoji: targetUser.avatar_emoji || '😊',
        avatarColor: targetUser.avatar_color || '#39A900',
        fotoUrl: targetUser.foto_url || null,
        programa: targetUser.programa || null,
        centro: targetUser.centro || null
      },
      miembros: (chat.miembros || []).map(String),
      mensajes,
      ultimoMensaje: ultimoMsg ? {
        de: ultimoMsg.de ? String(ultimoMsg.de) : null,
        txt: ultimoMsg.txt || '',
        ts: ultimoMsg.ts || Date.now()
      } : null,
      unreadCount: 0,
      creado: new Date(chat.creado).getTime(),
      ultimo: new Date(chat.ultimo).getTime()
    });
  } catch (e) {
    console.error('Error en POST /chats/directo:', e);
    res.status(500).json({ error: 'Error al iniciar la conversación' });
  }
});

/**
 * GET /chats/:id
 * Obtiene un chat por ID con validación estricta de membresía.
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const uid = String(req.uid);
    const chat = await Chat.findById(req.params.id);
    if (!chat) return res.status(404).json({ error: 'Conversación no encontrada' });

    if (!esMiembroDelChat(chat, uid)) {
      return res.status(403).json({ error: 'No tienes autorización para acceder a esta conversación' });
    }

    let otroUsuario = null;
    let titulo = chat.titulo;

    if (chat.tipo === 'directo' || chat.tipo === 'match') {
      const otherId = (chat.miembros || []).find(m => String(m) !== uid);
      if (otherId) {
        if (await hayBloqueo(uid, otherId)) {
          return res.status(403).json({ error: 'No puedes acceder a este chat debido a un bloqueo' });
        }
        const p = await Perfil.findById(otherId).lean();
        if (p) {
          otroUsuario = {
            id: String(p._id),
            nombre: p.nombre,
            rol: p.rol,
            avatarEmoji: p.avatar_emoji || '😊',
            avatarColor: p.avatar_color || '#39A900',
            fotoUrl: p.foto_url || null,
            programa: p.programa || null,
            centro: p.centro || null
          };
          titulo = p.nombre;
        }
      }
    }

    // Recopilar IDs de los emisores para asegurar que siempre haya nombre visible (especialmente en grupos)
    const senderIds = new Set();
    (chat.mensajes || []).forEach(m => {
      const sender = m?.senderId || m?.de;
      if (sender) senderIds.add(String(sender));
    });
    const perfilesSender = await Perfil.find({ _id: { $in: Array.from(senderIds) } }).lean();
    const senderMap = new Map();
    perfilesSender.forEach(p => senderMap.set(String(p._id), p.nombre));

    const mensajesEnriquecidos = (chat.mensajes || []).map(m => {
      if (!m) return m;
      const sId = m.senderId || m.de || null;
      const sNombre = m.senderNombre || m.nombre || (sId ? senderMap.get(String(sId)) : null) || (sId ? `Usuario ${String(sId).slice(0, 6)}` : 'SENA Match');
      return {
        ...m,
        de: sId,
        senderId: sId,
        senderNombre: sNombre,
        nombre: sNombre
      };
    });

    res.json({
      id: chat._id,
      tipo: chat.tipo,
      titulo: titulo || (chat.tipo === 'parche' ? 'Chat de parche' : 'Conversación'),
      otroUsuario,
      miembros: (chat.miembros || []).map(String),
      mensajes: mensajesEnriquecidos,
      creado: new Date(chat.creado).getTime(),
      ultimo: new Date(chat.ultimo).getTime()
    });
  } catch (e) {
    console.error('Error en GET /chats/:id:', e);
    res.status(500).json({ error: 'Error al obtener la conversación' });
  }
});

/**
 * POST /chats/:id/mensaje
 * Envía un mensaje a la conversación validando membresía y bloqueos.
 */
router.post('/:id/mensaje', auth, async (req, res) => {
  try {
    const uid = String(req.uid);
    const { txt } = req.body;
    if (!txt || typeof txt !== 'string' || !txt.trim() || txt.trim().length > 500) {
      return res.status(400).json({ error: 'El mensaje no puede estar vacío ni superar los 500 caracteres' });
    }

    const chat = await Chat.findById(req.params.id);
    if (!chat) return res.status(404).json({ error: 'Conversación no encontrada' });

    if (!esMiembroDelChat(chat, uid)) {
      return res.status(403).json({ error: 'No participas en esta conversación' });
    }

    // Verificación de bloqueos y estado de match si aplica
    let otherId = null;
    if (chat.tipo === 'match') {
      const match = await Match.findById(req.params.id);
      if (match && !match.activo) {
        return res.status(400).json({ error: 'Esta conversación ha sido cerrada' });
      }
      otherId = (chat.miembros || []).find(m => String(m) !== uid);
      if (otherId && (await hayBloqueo(uid, otherId))) {
        return res.status(403).json({ error: 'No puedes enviar mensajes a este usuario debido a un bloqueo' });
      }
    } else if (chat.tipo === 'directo') {
      otherId = (chat.miembros || []).find(m => String(m) !== uid);
      if (otherId && (await hayBloqueo(uid, otherId))) {
        return res.status(403).json({ error: 'No puedes enviar mensajes a este usuario debido a un bloqueo' });
      }
    }

    const miNombre = req.perfil?.nombre || 'Compañero SENA';

    const nuevoMensaje = {
      id: 'm_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16),
      de: uid,
      senderId: uid,
      senderNombre: miNombre,
      nombre: miNombre,
      txt: txt.trim(),
      ts: Date.now(),
      leidoPor: [uid]
    };

    const msgs = (chat.mensajes || []).concat([nuevoMensaje]).slice(-200);

    await Chat.findByIdAndUpdate(req.params.id, {
      $set: {
        mensajes: msgs,
        ultimo: new Date()
      }
    });

    // Notificaciones según tipo de chat
    if (otherId) {
      // Chat 1 a 1 (directo o match): notificar solo al otro
      crearNotificacion({
        recipientId: String(otherId),
        type: 'nuevo_mensaje',
        title: `Nuevo mensaje de ${miNombre}`,
        message: `${miNombre} te envió un mensaje`,
        reference: String(chat._id)
      }).catch(err => console.error('Error al notificar mensaje directo:', err));
    } else if (chat.tipo === 'parche') {
      // Chat grupal de parche: notificar a todos los miembros excepto el emisor
      const chatActualizado = await Chat.findById(req.params.id).lean();
      const miembrosGrupo = (chatActualizado?.miembros || chat.miembros || []).map(String);
      const receptores = miembrosGrupo.filter(m => m !== uid);

      // Obtener título del parche para el mensaje
      let tituloParcheStr = chat.titulo || 'el parche';
      try {
        const parcheDoc = await Parche.findById(req.params.id).lean();
        if (parcheDoc?.titulo) tituloParcheStr = parcheDoc.titulo;
      } catch (_) { /* ignorar */ }

      for (const receptorId of receptores) {
        crearNotificacion({
          recipientId: receptorId,
          type: 'nuevo_mensaje',
          title: 'Nuevo mensaje en el parche',
          message: `${miNombre} escribió en "${tituloParcheStr}"`,
          reference: String(chat._id)
        }).catch(err => console.error('Error al notificar mensaje de parche:', err));
      }
    }

    res.status(201).json({ ok: true, mensaje: nuevoMensaje });
  } catch (e) {
    console.error('Error en POST /chats/:id/mensaje:', e);
    res.status(500).json({ error: 'No se pudo enviar el mensaje. Inténtalo de nuevo.' });
  }
});

/**
 * POST /chats/:id/leer
 * Marca los mensajes del chat como leídos por el usuario autenticado.
 */
router.post('/:id/leer', auth, async (req, res) => {
  try {
    const uid = String(req.uid);
    const chat = await Chat.findById(req.params.id);
    if (!chat) return res.status(404).json({ error: 'Conversación no encontrada' });

    if (!esMiembroDelChat(chat, uid)) {
      return res.status(403).json({ error: 'No participas en esta conversación' });
    }

    let modificados = false;
    const nuevosMensajes = (chat.mensajes || []).map(m => {
      if (!m || !m.de || String(m.de) === uid) return m;
      const leidoPor = Array.isArray(m.leidoPor) ? m.leidoPor.map(String) : [];
      if (!leidoPor.includes(uid)) {
        modificados = true;
        return { ...m, leidoPor: [...leidoPor, uid] };
      }
      return m;
    });

    if (modificados) {
      await Chat.findByIdAndUpdate(req.params.id, { $set: { mensajes: nuevosMensajes } });
    }

    res.json({ ok: true });
  } catch (e) {
    console.error('Error en POST /chats/:id/leer:', e);
    res.status(500).json({ error: 'Error al marcar mensajes como leídos' });
  }
});

module.exports = router;

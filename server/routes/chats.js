const express = require('express');
const crypto = require('crypto');
const { auth } = require('../middleware/auth');
const { hayBloqueo } = require('../helpers/reglas');
const Chat = require('../models/Chat');
const Match = require('../models/Match');
const Perfil = require('../models/Perfil');

const router = express.Router();

/**
 * GET /chats
 * Lista chats donde el usuario es miembro, enriqueciendo los chats 1 a 1 con el perfil del otro usuario.
 */
router.get('/', auth, async (req, res) => {
  try {
    const chats = await Chat.find({ miembros: req.uid }).sort({ ultimo: -1 }).lean();

    // Recolectar IDs de los otros participantes para chats 1 a 1
    const otherUserIds = [];
    chats.forEach(c => {
      if (c.tipo === 'directo' || c.tipo === 'match') {
        const other = (c.miembros || []).find(m => String(m) !== String(req.uid));
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
        nombre: p.nombre,
        correo: p.correo,
        rol: p.rol,
        avatarEmoji: p.avatar_emoji || '😊',
        avatarColor: p.avatar_color || '#FF6B4A',
      });
    });

    res.json(chats.map(c => {
      let otroUsuario = null;
      let titulo = c.titulo;

      if (c.tipo === 'directo' || c.tipo === 'match') {
        const other = (c.miembros || []).find(m => String(m) !== String(req.uid));
        if (other && perfilMap.has(String(other))) {
          otroUsuario = perfilMap.get(String(other));
          titulo = otroUsuario.nombre;
        }
      }

      return {
        id: c._id,
        tipo: c.tipo,
        titulo: titulo || (c.tipo === 'parche' ? 'Chat de parche' : 'Conversación'),
        otroUsuario,
        miembros: c.miembros || [],
        mensajes: c.mensajes || [],
        creado: new Date(c.creado).getTime(),
        ultimo: new Date(c.ultimo).getTime()
      };
    }));
  } catch (e) {
    console.error('Error en GET /chats:', e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /chats/directo
 * Crea u obtiene una conversación 1 a 1 directa con otro usuario registrado.
 */
router.post('/directo', auth, async (req, res) => {
  try {
    const { targetUserId } = req.body;
    if (!targetUserId) {
      return res.status(400).json({ error: 'targetUserId es obligatorio' });
    }
    if (targetUserId === req.uid) {
      return res.status(400).json({ error: 'No puedes chatear contigo mismo' });
    }

    const targetUser = await Perfil.findById(targetUserId).lean();
    if (!targetUser) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (await hayBloqueo(req.uid, targetUserId)) {
      return res.status(403).json({ error: 'No puedes comunicarte con este usuario' });
    }

    // Buscar si ya existe un chat 1-a-1 directo o match
    let chat = await Chat.findOne({
      tipo: { $in: ['directo', 'match'] },
      miembros: { $all: [req.uid, targetUserId], $size: 2 }
    });

    if (!chat) {
      const id = crypto.randomUUID();
      const miNombre = req.perfil?.nombre || 'Usuario';
      chat = await Chat.create({
        _id: id,
        tipo: 'directo',
        titulo: `${miNombre} & ${targetUser.nombre}`,
        miembros: [req.uid, targetUserId],
        mensajes: [{
          de: null,
          txt: `¡Conversación iniciada con ${targetUser.nombre}! Di hola 👋`,
          ts: Date.now()
        }],
        creado: new Date(),
        ultimo: new Date()
      });
    }

    res.json({
      id: chat._id,
      tipo: chat.tipo,
      titulo: targetUser.nombre,
      otroUsuario: {
        id: targetUser._id,
        nombre: targetUser.nombre,
        correo: targetUser.correo,
        rol: targetUser.rol,
        avatarEmoji: targetUser.avatar_emoji || '😊',
        avatarColor: targetUser.avatar_color || '#FF6B4A'
      },
      miembros: chat.miembros || [],
      mensajes: chat.mensajes || [],
      creado: new Date(chat.creado).getTime(),
      ultimo: new Date(chat.ultimo).getTime()
    });
  } catch (e) {
    console.error('Error en POST /chats/directo:', e);
    res.status(500).json({ error: e.message });
  }
});

/**
 * GET /chats/:id
 * Obtiene un chat por ID (si el usuario es miembro).
 */
router.get('/:id', auth, async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.id);
    if (!chat) return res.status(404).json({ error: 'Chat no encontrado' });
    if (!(chat.miembros || []).includes(req.uid)) {
      return res.status(403).json({ error: 'No participas en esta conversación' });
    }

    let otroUsuario = null;
    let titulo = chat.titulo;

    if (chat.tipo === 'directo' || chat.tipo === 'match') {
      const otherId = (chat.miembros || []).find(m => m !== req.uid);
      if (otherId) {
        const p = await Perfil.findById(otherId).lean();
        if (p) {
          otroUsuario = {
            id: p._id,
            nombre: p.nombre,
            correo: p.correo,
            rol: p.rol,
            avatarEmoji: p.avatar_emoji || '😊',
            avatarColor: p.avatar_color || '#FF6B4A'
          };
          titulo = p.nombre;
        }
      }
    }

    res.json({
      id: chat._id,
      tipo: chat.tipo,
      titulo: titulo || (chat.tipo === 'parche' ? 'Chat de parche' : 'Conversación'),
      otroUsuario,
      miembros: chat.miembros || [],
      mensajes: chat.mensajes || [],
      creado: new Date(chat.creado).getTime(),
      ultimo: new Date(chat.ultimo).getTime()
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /chats/:id/mensaje
 * Envía un mensaje a la conversación.
 */
router.post('/:id/mensaje', auth, async (req, res) => {
  try {
    const { txt } = req.body;
    if (!txt || txt.length === 0 || txt.length > 500) {
      return res.status(400).json({ error: 'Mensaje vacío o demasiado largo' });
    }

    const chat = await Chat.findById(req.params.id);
    if (!chat) return res.status(404).json({ error: 'Chat no encontrado' });
    if (!(chat.miembros || []).includes(req.uid)) {
      return res.status(403).json({ error: 'No participas en esta conversación' });
    }

    // Si es chat de match, verificar que el match esté activo y no hay bloqueo
    if (chat.tipo === 'match') {
      const match = await Match.findById(req.params.id);
      if (!match || !match.activo) {
        return res.status(400).json({ error: 'Esta conversación está cerrada' });
      }
      if (await hayBloqueo(match.a, match.b)) {
        return res.status(403).json({ error: 'No puedes escribir aquí' });
      }
    } else if (chat.tipo === 'directo') {
      const other = (chat.miembros || []).find(m => m !== req.uid);
      if (other && (await hayBloqueo(req.uid, other))) {
        return res.status(403).json({ error: 'No puedes escribir a este usuario' });
      }
    }

    const msgs = (chat.mensajes || []).concat([{
      de: req.uid,
      txt,
      ts: Date.now()
    }]).slice(-200);

    await Chat.findByIdAndUpdate(req.params.id, {
      $set: { mensajes: msgs, ultimo: new Date() }
    });

    res.json({ ok: true });
  } catch (e) {
    console.error('Error en POST /chats/:id/mensaje:', e);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

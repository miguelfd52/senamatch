const express = require('express');
const { auth } = require('../middleware/auth');
const Notificacion = require('../models/Notificacion');

const router = express.Router();

/**
 * Función utilitaria para crear notificaciones evitando duplicados recientes.
 */
async function crearNotificacion({ recipientId, type, title, message, reference = null }) {
  try {
    if (!recipientId) return null;

    // Evitar duplicados idénticos en los últimos 2 minutos
    const haceDosMin = new Date(Date.now() - 2 * 60 * 1000);
    const existe = await Notificacion.findOne({
      recipientId: String(recipientId),
      type,
      reference: reference ? String(reference) : null,
      createdAt: { $gte: haceDosMin }
    });

    if (existe) {
      existe.title = title;
      existe.message = message;
      existe.read = false;
      existe.createdAt = new Date();
      await existe.save();
      return existe;
    }

    return await Notificacion.create({
      recipientId: String(recipientId),
      type,
      title,
      message,
      reference: reference ? String(reference) : null,
      read: false,
      createdAt: new Date()
    });
  } catch (err) {
    console.error('Error al crear notificación:', err);
    return null;
  }
}

/**
 * GET /notificaciones
 * Consulta notificaciones del usuario autenticado.
 */
router.get('/', auth, async (req, res) => {
  try {
    const uid = String(req.uid);
    const [notificaciones, unreadCount, unreadChatsCount] = await Promise.all([
      Notificacion.find({ recipientId: uid })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      Notificacion.countDocuments({ recipientId: uid, read: false }),
      Notificacion.countDocuments({ recipientId: uid, type: 'nuevo_mensaje', read: false })
    ]);

    const resultado = notificaciones.map(n => ({
      id: String(n._id),
      recipientId: n.recipientId,
      type: n.type,
      title: n.title,
      message: n.message,
      reference: n.reference,
      read: n.read,
      createdAt: n.createdAt ? new Date(n.createdAt).getTime() : Date.now()
    }));

    res.json({
      notificaciones: resultado,
      unreadCount,
      unreadChatsCount
    });
  } catch (err) {
    console.error('Error en GET /notificaciones:', err);
    res.status(500).json({ error: 'Error al obtener notificaciones' });
  }
});

/**
 * PATCH /notificaciones/leer-todas
 * Marca todas las notificaciones del usuario como leídas.
 * IMPORTANTE: debe ir ANTES de /:id/leer para que Express no lo capture como parámetro.
 */
router.patch('/leer-todas', auth, async (req, res) => {
  try {
    const uid = String(req.uid);
    await Notificacion.updateMany({ recipientId: uid, read: false }, { $set: { read: true } });
    res.json({ ok: true, unreadCount: 0 });
  } catch (err) {
    console.error('Error en PATCH /notificaciones/leer-todas:', err);
    res.status(500).json({ error: 'Error al marcar todas las notificaciones' });
  }
});

/**
 * PATCH /notificaciones/:id/leer
 * Marca una notificación individual como leída.
 */
router.patch('/:id/leer', auth, async (req, res) => {
  try {
    const notif = await Notificacion.findById(req.params.id);
    if (!notif) {
      return res.status(404).json({ error: 'Notificación no encontrada' });
    }

    if (String(notif.recipientId) !== String(req.uid)) {
      return res.status(403).json({ error: 'No autorizado para modificar esta notificación' });
    }

    notif.read = true;
    await notif.save();

    const unreadCount = await Notificacion.countDocuments({ recipientId: String(req.uid), read: false });
    res.json({ ok: true, id: notif._id, read: true, unreadCount });
  } catch (err) {
    console.error('Error en PATCH /notificaciones/:id/leer:', err);
    res.status(500).json({ error: 'Error al marcar notificación' });
  }
});

module.exports = { router, crearNotificacion };

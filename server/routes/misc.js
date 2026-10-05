/**
 * Rutas de bloqueos, reportes y configuración.
 */
const express = require('express');
const crypto = require('crypto');
const { auth } = require('../middleware/auth');
const { esStaff } = require('../helpers/reglas');
const Bloqueo = require('../models/Bloqueo');
const Reporte = require('../models/Reporte');
const Config = require('../models/Config');

const router = express.Router();

/* ========== BLOQUEOS (FASE 8) ========== */

router.get('/bloqueos', auth, async (req, res) => {
  try {
    const doc = await Bloqueo.findById(req.uid);
    res.json({
      id: req.uid,
      ids: doc ? doc.ids || [] : [],
      ts: doc ? new Date(doc.ts).getTime() : 0
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/bloqueos', auth, async (req, res) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids.map(String) : [];
    await Bloqueo.findByIdAndUpdate(
      req.uid,
      { $set: { ids, ts: new Date() } },
      { upsert: true }
    );
    res.json({ ok: true, ids });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /bloqueos/toggle
 * Bloquea o desbloquea a un usuario de manera atómica.
 */
router.post('/bloqueos/toggle', auth, async (req, res) => {
  try {
    const { targetUserId } = req.body;
    if (!targetUserId) return res.status(400).json({ error: 'targetUserId es requerido' });

    const targetId = String(targetUserId);
    if (targetId === String(req.uid)) {
      return res.status(400).json({ error: 'No puedes bloquearte a ti mismo' });
    }

    let doc = await Bloqueo.findById(req.uid);
    const ids = doc && Array.isArray(doc.ids) ? doc.ids.map(String) : [];
    const estaBloqueado = ids.includes(targetId);

    let nuevosIds;
    if (estaBloqueado) {
      nuevosIds = ids.filter(id => id !== targetId);
    } else {
      nuevosIds = [...ids, targetId];
    }

    await Bloqueo.findByIdAndUpdate(
      req.uid,
      { $set: { ids: nuevosIds, ts: new Date() } },
      { upsert: true }
    );

    res.json({ ok: true, bloqueado: !estaBloqueado, ids: nuevosIds });
  } catch (e) {
    console.error('Error en /bloqueos/toggle:', e);
    res.status(500).json({ error: 'Error al actualizar el bloqueo' });
  }
});

/* ========== REPORTES (FASE 8) ========== */

router.post('/reportes', auth, async (req, res) => {
  try {
    const {
      targetId, sobre,
      targetType = 'usuario',
      reason, motivo,
      description, detalle
    } = req.body;

    const finalTargetId = targetId || sobre;
    const finalReason = reason || motivo;
    const finalDescription = description || detalle;

    if (!finalReason) {
      return res.status(400).json({ error: 'El motivo del reporte es obligatorio' });
    }

    const id = 'rep_' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);

    const reporte = await Reporte.create({
      _id: id,
      reporterId: String(req.uid),
      de: String(req.uid),
      targetId: finalTargetId ? String(finalTargetId) : null,
      sobre: finalTargetId ? String(finalTargetId) : null,
      targetType: ['usuario', 'publicacion', 'comentario', 'mensaje'].includes(targetType) ? targetType : 'usuario',
      reason: finalReason.trim(),
      motivo: finalReason.trim(),
      description: finalDescription ? finalDescription.trim() : null,
      detalle: finalDescription ? finalDescription.trim() : null,
      status: 'pendiente',
      estado: 'pendiente',
      createdAt: new Date(),
      ts: new Date()
    });

    res.status(201).json({
      ok: true,
      id: reporte._id,
      mensaje: 'Reporte recibido y en proceso de revisión por el equipo de moderación.'
    });
  } catch (e) {
    console.error('Error en POST /reportes:', e);
    res.status(500).json({ error: 'Error al enviar el reporte' });
  }
});

router.get('/reportes', auth, async (req, res) => {
  try {
    let filtro;
    if (esStaff(req.perfil)) {
      filtro = {};
    } else {
      filtro = { de: String(req.uid) };
    }
    const reportes = await Reporte.find(filtro).sort({ createdAt: -1, ts: -1 }).limit(100).lean();
    res.json(reportes);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ========== CONFIG ========== */

router.get('/config/:id', auth, async (req, res) => {
  try {
    const doc = await Config.findById(req.params.id);
    res.json(doc ? doc.datos || {} : {});
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/config/:id', auth, async (req, res) => {
  try {
    if (!esStaff(req.perfil)) {
      return res.status(403).json({ error: 'Solo el equipo staff puede modificar la configuración' });
    }
    await Config.findByIdAndUpdate(
      req.params.id,
      { $set: { datos: req.body } },
      { upsert: true }
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;

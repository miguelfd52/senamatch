/**
 * Rutas de bloqueos, reportes y config.
 */
const express = require('express');
const crypto = require('crypto');
const { auth } = require('../middleware/auth');
const { esStaff } = require('../helpers/reglas');
const Bloqueo = require('../models/Bloqueo');
const Reporte = require('../models/Reporte');
const Config = require('../models/Config');

const router = express.Router();

/* ========== BLOQUEOS ========== */

router.get('/bloqueos', auth, async (req, res) => {
  try {
    const doc = await Bloqueo.findById(req.uid);
    res.json({ id: req.uid, ids: doc ? doc.ids || [] : [], ts: doc ? new Date(doc.ts).getTime() : 0 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/bloqueos', auth, async (req, res) => {
  try {
    await Bloqueo.findByIdAndUpdate(
      req.uid,
      { $set: { ids: req.body.ids || [], ts: new Date() } },
      { upsert: true }
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ========== REPORTES ========== */

router.post('/reportes', auth, async (req, res) => {
  try {
    const { sobre, motivo, detalle } = req.body;
    const id = 'r' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    await Reporte.create({
      _id: id, de: req.uid, sobre, motivo,
      detalle: detalle || null, estado: 'pendiente'
    });
    res.json({ ok: true, id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/reportes', auth, async (req, res) => {
  try {
    let filtro;
    if (esStaff(req.perfil)) {
      filtro = {};  // Staff ve todos
    } else {
      filtro = { de: req.uid };  // Solo los propios
    }
    const reportes = await Reporte.find(filtro).sort({ ts: -1 }).limit(100);
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
      return res.status(403).json({ error: 'Solo staff puede cambiar la configuración' });
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

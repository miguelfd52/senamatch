/**
 * Rutas del Panel de Administración (FASE 10).
 * Protegido en backend: solo roles staff ('admin', 'moderador', 'bienestar') tienen acceso.
 */
const express = require('express');
const { auth } = require('../middleware/auth');
const { esStaff } = require('../helpers/reglas');
const Perfil = require('../models/Perfil');
const Match = require('../models/Match');
const Publicacion = require('../models/Publicacion');
const Parche = require('../models/Parche');
const Chat = require('../models/Chat');
const Reporte = require('../models/Reporte');
const Bloqueo = require('../models/Bloqueo');

const router = express.Router();

/** Middleware para exigir que el usuario sea Staff */
function soloStaff(req, res, next) {
  if (!req.perfil || !esStaff(req.perfil)) {
    return res.status(403).json({ error: 'Acceso denegado: solo personal autorizado puede acceder a la administración' });
  }
  next();
}

/**
 * GET /admin/metricas
 * Métricas generales de la plataforma.
 */
router.get('/metricas', auth, soloStaff, async (req, res) => {
  try {
    const [
      totalUsuarios,
      usuariosActivos,
      totalMatches,
      totalPublicaciones,
      parchesActivos,
      totalChats,
      reportesPendientes
    ] = await Promise.all([
      Perfil.countDocuments(),
      Perfil.countDocuments({ estado: 'activo' }),
      Match.countDocuments({ activo: true }),
      Publicacion.countDocuments(),
      Parche.countDocuments({ estado: 'abierto' }),
      Chat.countDocuments(),
      Reporte.countDocuments({ $or: [{ status: 'pendiente' }, { estado: 'pendiente' }] })
    ]);

    res.json({
      usuarios: {
        total: totalUsuarios,
        activos: usuariosActivos
      },
      matches: totalMatches,
      publicaciones: totalPublicaciones,
      parchesActivos,
      totalChats,
      reportesPendientes
    });
  } catch (err) {
    console.error('Error en GET /admin/metricas:', err);
    res.status(500).json({ error: 'Error al obtener métricas' });
  }
});

/**
 * GET /admin/usuarios
 * Lista usuarios con opción de filtro y paginación.
 */
router.get('/usuarios', auth, soloStaff, async (req, res) => {
  try {
    const { q, estado, rol } = req.query;
    const query = {};

    if (q && q.trim()) {
      const regex = new RegExp(q.trim(), 'i');
      query.$or = [{ nombre: regex }, { correo: regex }, { programa: regex }];
    }
    if (estado) query.estado = estado;
    if (rol) query.rol = rol;

    const usuarios = await Perfil.find(query)
      .sort({ creado: -1 })
      .limit(100)
      .lean();

    res.json(usuarios.map(u => ({
      id: String(u._id),
      nombre: u.nombre,
      correo: u.correo,
      rol: u.rol,
      estado: u.estado,
      centro: u.centro,
      programa: u.programa,
      ficha: u.ficha,
      jornada: u.jornada,
      creado: u.creado ? new Date(u.creado).getTime() : null
    })));
  } catch (err) {
    console.error('Error en GET /admin/usuarios:', err);
    res.status(500).json({ error: 'Error al listar usuarios' });
  }
});

/**
 * PATCH /admin/usuarios/:id/estado
 * Cambiar estado de usuario (activo, suspendido, pausado).
 */
router.patch('/usuarios/:id/estado', auth, soloStaff, async (req, res) => {
  try {
    const { estado } = req.body;
    if (!['activo', 'suspendido', 'pausado'].includes(estado)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }

    const usuario = await Perfil.findByIdAndUpdate(
      req.params.id,
      { $set: { estado } },
      { new: true }
    ).lean();

    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

    res.json({ ok: true, id: usuario._id, estado: usuario.estado });
  } catch (err) {
    console.error('Error en PATCH /admin/usuarios/:id/estado:', err);
    res.status(500).json({ error: 'Error al actualizar estado del usuario' });
  }
});

/**
 * GET /admin/reportes
 * Lista reportes de la comunidad.
 */
router.get('/reportes', auth, soloStaff, async (req, res) => {
  try {
    const reportes = await Reporte.find()
      .sort({ createdAt: -1, ts: -1 })
      .limit(100)
      .lean();

    res.json(reportes.map(r => ({
      id: String(r._id),
      reporterId: String(r.reporterId || r.de),
      targetId: r.targetId || r.sobre,
      targetType: r.targetType || 'usuario',
      reason: r.reason || r.motivo,
      description: r.description || r.detalle,
      status: r.status || r.estado || 'pendiente',
      createdAt: r.createdAt ? new Date(r.createdAt).getTime() : (r.ts ? new Date(r.ts).getTime() : Date.now())
    })));
  } catch (err) {
    console.error('Error en GET /admin/reportes:', err);
    res.status(500).json({ error: 'Error al listar reportes' });
  }
});

/**
 * PATCH /admin/reportes/:id
 * Modifica el estado de un reporte.
 */
router.patch('/reportes/:id', auth, soloStaff, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pendiente', 'en_revision', 'resuelto', 'descartado', 'accion_tomada'].includes(status)) {
      return res.status(400).json({ error: 'Estado de reporte inválido' });
    }

    const reporte = await Reporte.findByIdAndUpdate(
      req.params.id,
      { $set: { status, estado: status } },
      { new: true }
    );

    if (!reporte) return res.status(404).json({ error: 'Reporte no encontrado' });

    res.json({ ok: true, id: reporte._id, status: reporte.status });
  } catch (err) {
    console.error('Error en PATCH /admin/reportes/:id:', err);
    res.status(500).json({ error: 'Error al actualizar reporte' });
  }
});

/**
 * DELETE /admin/publicaciones/:id
 * Eliminar publicación ofensiva o reportada.
 */
router.delete('/publicaciones/:id', auth, soloStaff, async (req, res) => {
  try {
    await Publicacion.findByIdAndDelete(req.params.id);
    res.json({ ok: true, id: req.params.id, mensaje: 'Publicación eliminada por moderación' });
  } catch (err) {
    console.error('Error en DELETE /admin/publicaciones/:id:', err);
    res.status(500).json({ error: 'Error al eliminar la publicación' });
  }
});

module.exports = router;

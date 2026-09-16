const mongoose = require('mongoose');

const reporteSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  // Compatibilidad doble con nombres anteriores y estándar de la FASE 8:
  reporterId: { type: String, ref: 'Perfil' },
  de: { type: String, ref: 'Perfil' },

  targetId: { type: String, default: null },
  sobre: { type: String, default: null },

  targetType: {
    type: String,
    enum: ['usuario', 'publicacion', 'comentario', 'mensaje'],
    default: 'usuario'
  },

  reason: { type: String },
  motivo: { type: String },

  description: { type: String, default: null, maxlength: 1000 },
  detalle: { type: String, default: null, maxlength: 1000 },

  status: {
    type: String,
    default: 'pendiente',
    enum: ['pendiente', 'en_revision', 'resuelto', 'descartado', 'accion_tomada']
  },
  estado: {
    type: String,
    default: 'pendiente',
    enum: ['pendiente', 'en_revision', 'resuelto', 'descartado', 'accion_tomada']
  },

  createdAt: { type: Date, default: Date.now },
  ts: { type: Date, default: Date.now }
}, { _id: false, timestamps: false });

reporteSchema.pre('save', function(next) {
  if (!this.reporterId && this.de) this.reporterId = this.de;
  if (!this.de && this.reporterId) this.de = this.reporterId;
  if (!this.targetId && this.sobre) this.targetId = this.sobre;
  if (!this.sobre && this.targetId) this.sobre = this.targetId;
  if (!this.reason && this.motivo) this.reason = this.motivo;
  if (!this.motivo && this.reason) this.motivo = this.reason;
  if (!this.description && this.detalle) this.description = this.detalle;
  if (!this.detalle && this.description) this.detalle = this.description;
  if (!this.status && this.estado) this.status = this.estado;
  if (!this.estado && this.status) this.estado = this.status;
  if (!this.createdAt && this.ts) this.createdAt = this.ts;
  if (!this.ts && this.createdAt) this.ts = this.createdAt;
  next();
});

reporteSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.models.Reporte || mongoose.model('Reporte', reporteSchema, 'reportes');

const mongoose = require('mongoose');

const reporteSchema = new mongoose.Schema({
  _id: { type: String },
  de: { type: String, required: true, ref: 'Perfil' },
  sobre: { type: String, default: null, ref: 'Perfil' },
  motivo: { type: String, required: true },
  detalle: { type: String, default: null, maxlength: 800 },
  estado: {
    type: String, default: 'pendiente',
    enum: ['pendiente', 'en_revision', 'resuelto', 'descartado']
  },
  ts: { type: Date, default: Date.now }
}, { _id: false, timestamps: false });

module.exports = mongoose.model('Reporte', reporteSchema, 'reportes');

const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
  _id: { type: String }, // a__b__intencion
  a: { type: String, required: true, ref: 'Perfil' },
  b: { type: String, required: true, ref: 'Perfil' },
  intencion: { type: String, required: true },
  activo: { type: Boolean, default: true },
  creado: { type: Date, default: Date.now }
}, { _id: false, timestamps: false });

matchSchema.index({ a: 1, activo: 1 });
matchSchema.index({ b: 1, activo: 1 });

module.exports = mongoose.model('Match', matchSchema, 'matches');

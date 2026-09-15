const mongoose = require('mongoose');

const comentarioSchema = new mongoose.Schema({
  id: { type: String, required: true },
  autorId: { type: String, required: true, ref: 'Perfil' },
  autorNombre: { type: String, default: 'Usuario SENA' },
  autorAvatarEmoji: { type: String, default: '😊' },
  autorFotoUrl: { type: String, default: null },
  texto: { type: String, required: true, maxlength: 400 },
  creado: { type: Date, default: Date.now }
}, { _id: false });

const publicacionSchema = new mongoose.Schema({
  _id: { type: String },
  autor: { type: String, required: true, ref: 'Perfil' },
  autorNombre: { type: String, default: 'Usuario SENA' },
  autorRol: { type: String, default: 'aprendiz' },
  autorAvatarEmoji: { type: String, default: '😊' },
  autorAvatarColor: { type: String, default: '#FF6B4A' },
  autorFotoUrl: { type: String, default: null },
  texto: { type: String, required: true, minlength: 1, maxlength: 1000 },
  foto_url: { type: String, default: null },
  likes: { type: [String], default: [] },
  comentarios: { type: [comentarioSchema], default: [] },
  creado: { type: Date, default: Date.now }
}, { _id: false, timestamps: false });

publicacionSchema.index({ creado: -1 });

module.exports = mongoose.models.Publicacion || mongoose.model('Publicacion', publicacionSchema, 'publicaciones');

const mongoose = require('mongoose');

const perfilSchema = new mongoose.Schema({
  _id: { type: String }, // UUID string
  nombre: {
    type: String, required: true,
    minlength: 2, maxlength: 80
  },
  correo: {
    type: String, required: true, unique: true,
    lowercase: true, trim: true
  },
  // Nunca se devuelve en queries a menos que se pida explícitamente con .select('+password_hash')
  password_hash: { type: String, default: null, select: false },
  rol: {
    type: String, required: true, default: 'aprendiz',
    enum: ['aprendiz', 'egresado', 'instructor', 'bienestar', 'moderador', 'admin']
  },
  estado: {
    type: String, required: true, default: 'activo',
    enum: ['activo', 'pausado', 'suspendido']
  },
  centro: { type: Number, default: null },
  programa: { type: String, default: null },
  ficha: {
    type: String, default: null,
    validate: { validator: v => v === null || /^[0-9]{4,8}$/.test(v), message: 'Ficha inválida' }
  },
  jornada: {
    type: String, default: null,
    enum: [null, 'manana', 'tarde', 'noche', 'virtual']
  },
  nacimiento: { type: Date, default: null },
  bio: { type: String, default: null, maxlength: 400 },
  intereses: { type: [String], default: [] },
  intenciones: { type: [String], default: [] },
  avatar_emoji: { type: String, default: null, maxlength: 8 },
  avatar_color: {
    type: String, default: null,
    validate: { validator: v => v === null || /^#[0-9A-Fa-f]{6}$/.test(v), message: 'Color inválido' }
  },
  foto_url: { type: String, default: null },
  asistencias: { type: Number, default: 0, min: 0 },
  inasistencias: { type: Number, default: 0, min: 0 },
  primera_publicacion_completada: { type: Boolean, default: false },
  demo: { type: Boolean, default: false },
  creado: { type: Date, default: Date.now },
  visto: { type: Date, default: Date.now }
}, { _id: false, timestamps: false });

// Virtual: esfera
perfilSchema.virtual('esfera').get(function () {
  return (this.rol === 'aprendiz' || this.rol === 'egresado') ? 'aprendices' : 'equipo';
});

perfilSchema.set('toJSON', { virtuals: true });
perfilSchema.set('toObject', { virtuals: true });

perfilSchema.index({ centro: 1, estado: 1 });
module.exports = mongoose.models.Perfil || mongoose.model('Perfil', perfilSchema, 'perfiles');

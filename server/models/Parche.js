const mongoose = require('mongoose');

const parcheSchema = new mongoose.Schema({
  _id: { type: String },
  anfitrion: { type: String, required: true, ref: 'Perfil' },
  titulo: { type: String, required: true, minlength: 5, maxlength: 80 },
  descripcion: { type: String, default: null, maxlength: 400 },
  tipo: { type: String, required: true },
  lugar: { type: String, required: true, minlength: 3, maxlength: 80 },
  inicio: { type: Date, required: true },
  duracion: { type: Number, required: true, default: 60, min: 15, max: 480 },
  cupo: { type: Number, required: true, min: 2, max: 200 },
  centro: { type: Number, required: true },
  esfera: { type: String, required: true, enum: ['aprendices', 'equipo'] },
  mixto: { type: Boolean, default: false },
  aprobacion: { type: Boolean, default: false },
  codigo: { type: String, unique: true, sparse: true },
  estado: {
    type: String, default: 'abierto',
    enum: ['abierto', 'cancelado', 'finalizado']
  },
  participantes: { type: [mongoose.Schema.Types.Mixed], default: [] },
  solicitudes: { type: [mongoose.Schema.Types.Mixed], default: [] },
  asistencia: { type: mongoose.Schema.Types.Mixed, default: null },
  creado: { type: Date, default: Date.now }
}, { _id: false, timestamps: false });

parcheSchema.index({ centro: 1, esfera: 1, inicio: 1, estado: 1 });

module.exports = mongoose.model('Parche', parcheSchema, 'parches');

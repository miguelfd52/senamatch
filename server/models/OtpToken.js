const mongoose = require('mongoose');

const otpTokenSchema = new mongoose.Schema({
  correo: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  tipo: {
    type: String,
    enum: ['registro', 'otp_login'],
    default: 'registro',
  },
  code: {
    type: String,
    required: true,
  },
  // Datos temporales de registro pendiente
  nombre: { type: String, default: null },
  rol: { type: String, default: 'aprendiz' },
  hash: { type: String, default: null },
  foto_url: { type: String, default: null },
  intentos: {
    type: Number,
    default: 0,
  },
  lastSent: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 }, // TTL index: MongoDB purga automáticamente los registros expirados
  },
}, { timestamps: true });

module.exports = mongoose.models.OtpToken || mongoose.model('OtpToken', otpTokenSchema, 'otptokens');

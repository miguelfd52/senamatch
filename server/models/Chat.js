const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  _id: { type: String },
  tipo: { type: String, required: true, enum: ['match', 'parche', 'directo'] },
  titulo: { type: String, default: null },
  miembros: { type: [{ type: String, ref: 'Perfil' }], default: [] },
  mensajes: { type: [mongoose.Schema.Types.Mixed], default: [] },
  creado: { type: Date, default: Date.now },
  ultimo: { type: Date, default: Date.now }
}, { _id: false, timestamps: false });

chatSchema.index({ miembros: 1 });
module.exports = mongoose.models.Chat || mongoose.model('Chat', chatSchema, 'chats');

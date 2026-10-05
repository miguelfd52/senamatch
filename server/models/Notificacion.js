const mongoose = require('mongoose');

const notificacionSchema = new mongoose.Schema({
  recipientId: { type: String, required: true, ref: 'Perfil', index: true },
  type: {
    type: String,
    required: true,
    enum: [
      'nuevo_match',
      'nuevo_mensaje',
      'invitacion_parche',
      'union_parche',
      'aceptacion_parche',
      'salida_parche',
      'cancelacion_parche',
      'parche_recordatorio',
      'sistema'
    ]
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  reference: { type: String, default: null }, // ej. chatId, parcheId, pubId
  read: { type: Boolean, default: false, index: true },
  createdAt: { type: Date, default: Date.now, index: true }
}, { timestamps: false });

notificacionSchema.index({ recipientId: 1, read: 1, createdAt: -1 });
// Índice único sparse para garantizar que cada usuario sólo recibe una
// notificación de tipo 'nuevo_match' por chat, incluso ante peticiones concurrentes.
notificacionSchema.index(
  { recipientId: 1, type: 1, reference: 1 },
  { unique: true, sparse: true, name: 'notif_unique_recipient_type_ref' }
);

module.exports = mongoose.models.Notificacion || mongoose.model('Notificacion', notificacionSchema, 'notificaciones');

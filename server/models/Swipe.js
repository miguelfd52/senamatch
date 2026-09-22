const mongoose = require('mongoose');

const swipeSchema = new mongoose.Schema({
  _id: { type: String }, // perfil UUID
  por_intencion: { type: mongoose.Schema.Types.Mixed, default: {} },
  ts: { type: Date, default: Date.now }
}, { timestamps: false });

module.exports = mongoose.model('Swipe', swipeSchema, 'swipes');

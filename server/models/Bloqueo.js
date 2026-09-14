const mongoose = require('mongoose');

const bloqueoSchema = new mongoose.Schema({
  _id: { type: String }, // perfil UUID
  ids: { type: [String], default: [] },
  ts: { type: Date, default: Date.now }
}, { _id: false, timestamps: false });

module.exports = mongoose.model('Bloqueo', bloqueoSchema, 'bloqueos');

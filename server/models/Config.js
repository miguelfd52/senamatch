const mongoose = require('mongoose');

const configSchema = new mongoose.Schema({
  _id: { type: String },
  datos: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { _id: false, timestamps: false });

module.exports = mongoose.model('Config', configSchema, 'config');
